# Recepton Biotech static website

GitHub Pages version of https://www.receptonbiotech.com/, captured November 18–19, 2026. The 140 captured pages retain the original markup, responsive styles, images, fonts, and product information. The copy includes older company/service pages, article tags, categories, and author archives.

## Preview and publish

Run `python3 -m http.server 8000`, then visit http://localhost:8000.

Publish from the `main` branch, repository root. `.nojekyll` preserves the original asset directories. Page links, search results, and runtime modules support a GitHub Pages project URL. No build server, account registration, API key, or paid service is required for visitors.

## Working features

- Product search, catalog-number/alphabetical sorting, tag/expression-host/origin filters, and Clear filters. Query parameters preserve selections across reloads.
- Full-text search across the captured site, with product/article/page scopes. Article search includes body text and verified tags; archive and tag navigation stays local.
- Product-table Order buttons preselect the catalog entry. Entries missing from the old order dropdown remain available as requests for confirmation.
- Three-step order form with Back/Next, up to four products, removable extra products, required fields, and positive whole-number quantities.
- Contact and order request review, correctly encoded email drafts addressed to `office@receptonbiotech.com`, clipboard copy, and downloadable UTF-8 text files. Visitors send the prepared request from their own email app. No automatic delivery or false success confirmation.
- Optional Save/Load/Delete draft buttons. Personal details are stored in this browser's local storage only when Save is clicked. Deleting a saved draft leaves the current form intact.
- Responsive navigation, catalog filters, request controls, and site search on mobile.

## Limits

GitHub Pages does not run the original WordPress backend. This copy cannot automatically send mail, process payments, store orders centrally, provide WordPress administration, or synchronize content changes from the original site. Email delivery requires the visitor to send the draft; copy/download remains available when an email app cannot open or truncates a long draft.

Six assets already return 404 on the original site: `neuropol.otf` and `Grafika1.jpg` through `Grafika5.jpg`. Their failed retrievals remain recorded in `sources/manifest.json`; the 1,130 available assets are stored locally. Some legacy pages therefore retain the original missing imagery/font fallbacks.

## Rebuild and verify

Capture tooling requires Python with `requests`, `beautifulsoup4`, and `lxml` installed. In the original development environment, use `/opt/anaconda3/bin/python`.

```sh
python scripts/mirror.py
python scripts/build-search.py
python scripts/verify.py
```

The mirror reuses cached source pages/assets. `python scripts/mirror.py --localize` rebuilds HTML from those cached originals without recapturing pages. Run `build-search.py` after content changes. Original source HTML stays in ignored `sources/pages/`; sitemap XML and capture results provide provenance.

Verification checks local navigation/assets, safe form actions, runtime files, and search-index paths. Browser checks covered catalog filters/reset, full-text and tag searches, mobile navigation/layout, GitHub project-path URLs, required fields, product prefill, removable items, draft restoration/deletion, request previews, Unicode email bodies, and downloaded requests. Browser test artifacts remain in ignored `output/`.

Original branding, content, and asset ownership remain with their respective owners.
