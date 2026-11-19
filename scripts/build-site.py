#!/usr/bin/env python3
"""Package public site files for a static-host upload; omit development/source files."""
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = root / 'output/cloudflare-store'
manifest = json.loads((root / 'sources/manifest.json').read_text())
files = {record['path'] for record in manifest['pages'].values()}
files.update(record['path'] for record in manifest['assets'].values() if record.get('saved'))
files.update(str(path.relative_to(root)) for path in (root / 'assets').rglob('*') if path.is_file() and path.name != '.DS_Store')
files.update(['basket/index.html', 'checkout/index.html'])
if destination.exists():
    shutil.rmtree(destination)
for name in sorted(files):
    source = root / name
    assert source.is_relative_to(root) and source.is_file(), name
    target = destination / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
print(f'Packaged {len(files)} public files in {destination}')
