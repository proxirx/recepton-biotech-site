# Recepton Biotech static website

Static copy of https://www.receptonbiotech.com/, captured November 18, 2026. Original page markup, responsive styles, images, fonts, product information, and browser interactions are retained wherever available.

## Preview

Run `python3 -m http.server 8000`, then visit http://localhost:8000.

## GitHub Pages

Publish from the `main` branch, repository root. `.nojekyll` preserves the original asset directories. Navigation and presentation assets use relative URLs and work under a project repository URL.

## Working static controls

- Product search, catalog-number/alphabetical sorting, and tag, expression-host, and origin filters run in the browser. Selections survive reloads through URL query parameters.
- Article and archive search matches displayed titles and summaries. Search and catalog controls are available on mobile.
- The order form supports all three steps, Back/Next navigation, up to four products, required-field validation, and positive whole-number quantities. Values remain in the form when navigating between steps.

## Deferred server features

Contact, quote, and order submissions remain disconnected. No orders, messages, or payments are sent; the final submission shows a local notice. Article tag links still lead to the original website. Server-backed login and WordPress APIs are not included.

## Capture

`sources/manifest.json` records original source URLs and retrieval results. `scripts/mirror.py` rebuilds the mirror using Python, `requests`, and `beautifulsoup4`. Capture sources and browser verification artifacts remain local and are excluded from Git.

Original branding, content, and asset ownership remain with their respective owners.
