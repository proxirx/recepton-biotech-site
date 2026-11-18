# Recepton Biotech static website

Static copy of https://www.receptonbiotech.com/, captured November 18, 2026. Original page markup, responsive styles, images, fonts, product information, and browser interactions are retained wherever available.

## Preview

Run `python3 -m http.server 8000`, then visit http://localhost:8000.

## GitHub Pages

Publish from the `main` branch, repository root. `.nojekyll` preserves the original asset directories. Navigation and presentation assets use relative URLs and work under a project repository URL.

## Deferred server features

Contact, quote, order, search, and catalog-filter forms retain their appearance but do not submit to the original WordPress server. Submission shows a local notice. No orders, messages, or payments are sent. Server-backed login and WordPress APIs are not included.

## Capture

`sources/manifest.json` records original source URLs and retrieval results. `scripts/mirror.py` rebuilds the mirror using Python, `requests`, and `beautifulsoup4`. Capture sources and browser verification artifacts remain local and are excluded from Git.

Original branding, content, and asset ownership remain with their respective owners.
