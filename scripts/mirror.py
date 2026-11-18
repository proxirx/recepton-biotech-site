#!/usr/bin/env python3
"""Capture public Recepton pages and localize their presentation assets."""
import concurrent.futures as cf
import hashlib
import html
import json
import os
from pathlib import Path
import re
import time
import sys
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote, parse_qs
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.receptonbiotech.com/'
HOSTS = {'www.receptonbiotech.com', 'receptonbiotech.com'}
CSS_URL = re.compile(r'url\(\s*[\"\']?([^\"\'\)]+)[\"\']?\s*\)')
ABS_URL = re.compile(r'(?:https?:)?//(?:www\.)?receptonbiotech\.com/[^\s<>\"\'\\)]+')
assets, pages, failures = {}, {}, []

def canonical(url):
    p = urlsplit(html.unescape(url))
    if p.hostname not in HOSTS:
        return urlunsplit((p.scheme or 'https', p.netloc, p.path, p.query, ''))
    if 's' in parse_qs(p.query, keep_blank_values=True):
        return ORIGIN + '?s='
    return ORIGIN.rstrip('/') + (p.path.rstrip('/') or '/')

def internal(url):
    return urlsplit(url).hostname in HOSTS

def page_candidate(url):
    p = urlsplit(url)
    return internal(url) and not p.path.startswith(('/wp-', '/feed', '/comments', '/author/', '/tag/', '/category/', '/cdn-cgi/')) and not re.search(r'\.[a-z0-9]{2,5}$', p.path, re.I) and (not p.query or p.query == 's=')

def page_path(url):
    p = urlsplit(url)
    if p.query == 's=':
        return Path('articles/index.html')
    return Path(unquote(p.path).strip('/')) / 'index.html'

def asset_path(url):
    p = urlsplit(url)
    if internal(url):
        return Path(unquote(p.path).lstrip('/'))
    suffix = Path(p.path).suffix or '.css'
    return Path('assets/external') / (hashlib.sha256(url.encode()).hexdigest()[:16] + suffix)

def fetch(url):
    if page_candidate(canonical(url)):
        cached = ROOT / 'sources/pages' / page_path(canonical(url))
        if cached.is_file(): return cached.read_bytes(), 'text/html'
    else:
        cached = ROOT / asset_path(canonical(url) if internal(url) else url)
        if cached.is_file(): return cached.read_bytes(), ''
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=45, headers={'User-Agent': 'Mozilla/5.0 ReceptonStaticMirror/1.0'})
            r.raise_for_status()
            return r.content, r.headers.get('Content-Type', '')
        except requests.RequestException as exc:
            if attempt == 2:
                return None, str(exc)
            time.sleep(attempt + 1)

def register_asset(raw, base):
    url = urljoin(base, html.unescape(raw.strip()))
    if urlsplit(url).scheme not in ('http', 'https'):
        return
    p = urlsplit(url)
    if internal(url) and (not p.path.startswith(('/wp-content/', '/wp-includes/')) or not Path(p.path).suffix):
        return
    if not internal(url) and p.hostname not in ('fonts.googleapis.com', 'fonts.gstatic.com'):
        return
    key = canonical(url) if internal(url) else url
    assets.setdefault(key, {'url': url, 'path': str(asset_path(key))})

def collect_assets(soup, base):
    for tag in soup.find_all(True):
        for attr in ('src', 'poster', 'data-src', 'data-lazy-src'):
            if tag.has_attr(attr): register_asset(tag[attr], base)
        if tag.name == 'link' and ('stylesheet' in tag.get('rel', []) or 'icon' in ' '.join(tag.get('rel', []))):
            register_asset(tag.get('href', ''), base)
        for item in tag.get('srcset', '').split(','):
            if item.strip(): register_asset(item.strip().split()[0], base)
        for match in CSS_URL.finditer(tag.get('style', '')):
            register_asset(match[1], base)
    for tag in soup.find_all(['style', 'script']):
        for match in CSS_URL.finditer(tag.get_text()): register_asset(match[1], base)
        for match in ABS_URL.finditer(tag.get_text()): register_asset(match[0], base)

def relative(path, current):
    return os.path.relpath(path, current.parent).replace(os.sep, '/')

def local_url(raw, base, current):
    if not raw or raw.startswith(('#', 'data:', 'mailto:', 'tel:', 'javascript:')):
        return raw
    url = urljoin(base, html.unescape(raw))
    key = canonical(url)
    fragment = urlsplit(url).fragment
    if key in pages:
        path = pages[key]['path']
        result = relative(Path(path).parent, current) + '/'
    elif key in assets and assets[key].get('saved'):
        result = relative(Path(assets[key]['path']), current)
    else:
        return raw
    return result + ('#' + fragment if fragment else '')

def rewrite_text(text, base, current):
    text = CSS_URL.sub(lambda m: m[0].replace(m[1], local_url(m[1].strip(), base, current), 1), text)
    return ABS_URL.sub(lambda m: local_url(m[0], base, current), text)

pending = {ORIGIN, ORIGIN + 'proteins/', ORIGIN + '?s='}
if '--localize' in sys.argv:
    manifest = json.loads((ROOT / 'sources/manifest.json').read_text())
    pages, assets = manifest['pages'], manifest['assets']
    pending = set()
while pending:
    batch = sorted({canonical(u) for u in pending} - pages.keys())
    pending = set()
    if not batch: break
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(fetch, batch))
    for url, (data, content_type) in zip(batch, results):
        if data is None or 'html' not in content_type:
            failures.append({'url': url, 'error': content_type}); continue
        source = data.decode('utf-8', errors='replace')
        path = page_path(url)
        saved_source = ROOT / 'sources/pages' / path
        saved_source.parent.mkdir(parents=True, exist_ok=True)
        saved_source.write_text(source)
        soup = BeautifulSoup(source, 'html.parser')
        pages[url] = {'path': str(path), 'source': str(saved_source.relative_to(ROOT))}
        collect_assets(soup, url)
        for a in soup.find_all('a', href=True):
            target = canonical(urljoin(url, a['href']))
            if page_candidate(target) and target not in pages: pending.add(target)
    print(f'Pages: {len(pages)}, queued: {len(pending)}, assets: {len(assets)}', flush=True)

while True:
    batch = [(k, v) for k, v in assets.items() if 'saved' not in v]
    if not batch: break
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(fetch, [v['url'] for _, v in batch]))
    for (key, record), (data, content_type) in zip(batch, results):
        record['saved'] = data is not None
        if data is None:
            failures.append({'url': record['url'], 'error': content_type}); continue
        target = ROOT / record['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        if target.suffix.lower() == '.css':
            for match in CSS_URL.finditer(data.decode('utf-8', errors='replace')):
                register_asset(match[1], record['url'])
    print(f'Assets saved: {sum(v.get("saved", False) for v in assets.values())}/{len(assets)}', flush=True)

for key, record in assets.items():
    current = Path(record['path'])
    if record.get('saved') and current.suffix.lower() == '.css':
        target = ROOT / current
        target.write_text(rewrite_text(target.read_text(errors='replace'), record['url'], current))

def static_script(match):
    markup = match[0]
    opening = markup.split('>', 1)[0]
    if 'speculationrules' in opening or re.search(r'id=[\"\'](?:modal|info-bar|slidein)[\"\']', opening) or 'fusion_login_nonce' in markup or 'contact-form-7/includes/js/' in opening or 'quform/cache/quform.js' in opening or '/cdn-cgi/scripts/' in opening:
        return ''
    return markup

def email_link(match):
    markup = match[0]
    encoded = re.search(r'data-cfemail=[\"\']([0-9a-f]+)', markup)
    if not encoded: encoded = re.search(r'/cdn-cgi/l/email-protection#([0-9a-f]+)', markup)
    if not encoded: return markup
    data = bytes.fromhex(encoded[1])
    address = ''.join(chr(byte ^ data[0]) for byte in data[1:])
    return '<a href="mailto:' + html.escape(address, quote=True) + '">' + html.escape(address) + '</a>'

for url, record in pages.items():
    current = Path(record['path'])
    source = (ROOT / record['source']).read_text()
    source = re.sub(r'<script\b[^>]*>.*?</script\s*>', static_script, source, flags=re.S | re.I)
    source = re.sub(r'<link\b[^>]*>', lambda m: '' if re.search(r'rel=[\"\'](?:alternate|EditURI|https://api.w.org/)', m[0]) else m[0], source, flags=re.I)
    source = re.sub(r'<a\b[^>]*(?:data-cfemail|/cdn-cgi/l/email-protection)[^>]*>.*?</a>', email_link, source, flags=re.S | re.I)
    source = rewrite_text(source, url, current)
    attr_pattern = r'\b(href|src|poster|data-src|data-lazy-src)=([\"\'])(.*?)\2'
    source = re.sub(attr_pattern, lambda m: m[1] + '=' + m[2] + local_url(m[3], url, current) + m[2], source, flags=re.I)
    source = re.sub(r'\bsrcset=([\"\'])(.*?)\1', lambda m: 'srcset=' + m[1] + ', '.join(' '.join([local_url(part.strip().split()[0], url, current)] + part.strip().split()[1:]) for part in m[2].split(',') if part.strip()) + m[1], source, flags=re.I)
    source = re.sub(r'<form\b[^>]*>', lambda m: re.sub(r'\s(?:action|onsubmit)=([\"\']).*?\1', '', m[0])[:-1] + ' action="#" data-static-form>', source, flags=re.I)
    runtime = '<script src="' + relative(Path('assets/static.js'), current) + '"></script>'
    source = source.replace('</body>', runtime + '\n</body>')
    target = ROOT / current
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(source)

(ROOT / 'sources/manifest.json').write_text(json.dumps({'origin': ORIGIN, 'captured': '2026-11-18', 'pages': pages, 'assets': assets, 'failures': failures}, indent=2))
print(f'Complete: {len(pages)} pages; {len(assets)} assets; {len(failures)} retrieval failures', flush=True)
