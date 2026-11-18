#!/usr/bin/env python3
"""Check static page, stylesheet, and navigation dependencies."""
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from bs4 import BeautifulSoup
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'sources/manifest.json').read_text())
errors = []
checked = 0

def check(value, source):
    global checked
    if not value or value.startswith(('#', 'data:', 'mailto:', 'tel:', 'javascript:')):
        return
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return
    checked += 1
    if url.path.startswith('/'):
        errors.append((str(source), value, 'root-relative URL'))
    elif not (root / source.parent / unquote(url.path)).exists():
        errors.append((str(source), value, 'missing file'))

for record in manifest['pages'].values():
    source = Path(record['path'])
    soup = BeautifulSoup((root / source).read_text(), 'html.parser')
    for tag in soup.find_all(True):
        for attr in ('src', 'href', 'poster'):
            if tag.has_attr(attr): check(tag[attr], source)
        if tag.has_attr('srcset'):
            for part in tag['srcset'].split(','):
                if part.strip(): check(part.strip().split()[0], source)
        for url in re.findall(r'url\([\"\']?([^\"\')]+)', tag.get('style', '')):
            check(url, source)
    for form in soup.find_all('form'):
        if not form.has_attr('data-static-form') or form.get('action') != '#':
            errors.append((str(source), 'form', 'live form endpoint'))
for record in manifest['assets'].values():
    source = Path(record['path'])
    if record.get('saved') and source.suffix == '.css':
        for url in re.findall(r'url\(\s*[\"\']?([^\"\')]+)', (root / source).read_text(errors='replace')):
            check(url.strip(), source)
print(json.dumps({'pages': len(manifest['pages']), 'assets': len(manifest['assets']), 'references_checked': checked, 'errors': errors}, indent=2))
raise SystemExit(bool(errors))
