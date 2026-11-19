#!/usr/bin/env python3
"""Generate basket products from canonical captured catalog pages and order options."""
import json
import re
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlsplit
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SKU = re.compile(r'\bR\d+-\d{3}(?:-\d+[A-Za-z0-9]*)?\b', re.I)

def text(node):
    return ' '.join(node.get_text(' ', strip=True).split())

def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower().replace('µg', 'ug')).strip('-')

def code(value):
    match = SKU.search(value)
    return 'R' + match.group(0)[1:] if match else None

def main():
    order = BeautifulSoup((ROOT / 'order/index.html').read_text(), 'html.parser')
    listed = {code(option.get('value', '')) for option in order.select('select[name="quform_1_22"] option')}
    sizes = []
    for option in order.select('select[name="quform_1_29"] option'):
        match = re.fullmatch(r'(.+?)\s*/\s*([\d.,]+)\s*EUR', text(option))
        if match:
            sizes.append((match[1].strip(), int(Decimal(match[2].replace(',', '.')) * 100)))
    formulations = [text(option) for option in order.select('select[name="quform_1_23"] option') if option.get('value')]
    assert sizes and len(formulations) == 1, 'Review captured order sizes/formulations before rebuilding.'
    images = {entry['path']: entry.get('image') for entry in json.loads((ROOT / 'assets/search-data.json').read_text())['entries']}
    catalog = BeautifulSoup((ROOT / 'proteins/index.html').read_text(), 'html.parser')
    products = {}
    for card in catalog.select('.single-search-result'):
        title = card.select_one('.single-result-title')
        link = title.find('a') if title else None
        if not link:
            continue
        page = (ROOT / 'proteins' / unquote(urlsplit(link['href']).path) / 'index.html').resolve()
        assert page.is_relative_to(ROOT / 'proteins') and page.exists(), page
        path = '/' + page.parent.relative_to(ROOT).as_posix() + '/'
        details = BeautifulSoup(page.read_text(), 'html.parser')
        variants = []
        for table in details.select('#main table'):
            rows = table.find_all('tr')
            if not rows:
                continue
            headers = [text(cell).lower() for cell in rows[0].find_all(['th', 'td'])]
            if not headers or not ('catalog' in headers[0] or 'cat number' in headers[0]):
                continue
            for row in rows[1:]:
                cells = row.find_all(['th', 'td'])
                sku = code(text(cells[0])) if cells else None
                if not sku:
                    continue
                attrs = dict(zip(headers, map(text, cells)))
                construct = attrs.get('protein construct') or text(title)
                tag = attrs.get('tag')
                name = construct + (f' ({tag})' if tag else '')
                variants.append((sku, name))
        if not variants:
            catalog_row = next((row for row in card.find_all('tr') if row.find('td') and 'catalog' in text(row.find('td')).lower()), None)
            sku = code(text(catalog_row)) if catalog_row else None
            assert sku, f'Missing displayed SKU for {path}'
            variants = [(sku, text(title))]
        for sku, name in variants:
            options = [{
                'id': slug(f'{sku}-{size}-{formulations[0]}'), 'size': size,
                'formulation': formulations[0], 'priceCents': cents,
                'quoteRequired': False, 'source': 'order/index.html'
            } for size, cents in sizes] if sku in listed else [{
                'id': slug(sku + '-quote'), 'size': 'Size to be confirmed',
                'formulation': 'To be confirmed', 'priceCents': None,
                'quoteRequired': True, 'source': path
            }]
            assert sku not in products or products[sku]['path'] == path, f'Duplicate SKU: {sku}'
            products[sku] = {'id': slug(sku), 'sku': sku, 'name': name, 'path': path,
                             'image': images.get(path), 'options': options}
    data = {'generatedAt': '2026-11-19', 'source': {'catalog': 'proteins/index.html',
            'prices': 'order/index.html', 'priceNote': 'Published order options; final price and availability require confirmation.'},
            'products': sorted(products.values(), key=lambda product: product['id'])}
    ids = [option['id'] for product in data['products'] for option in product['options']]
    assert len(ids) == len(set(ids)), 'Duplicate option IDs'
    (ROOT / 'assets/store-data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(products)} products, {len(ids)} pack options')

if __name__ == '__main__':
    main()
