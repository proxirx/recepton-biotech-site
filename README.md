# Recepton Biotech static website

GitHub Pages version of https://www.receptonbiotech.com/, captured November 18–19, 2026. The 140 captured pages retain the original markup, responsive styles, images, fonts, and product information. The copy includes older company/service pages, article tags, categories, and author archives.

## Preview and publish

Run `python3 -m http.server 8000`, then visit http://localhost:8000.

Publish from the `main` branch, repository root. `.nojekyll` preserves the original asset directories. Page links, search results, and runtime modules support a GitHub Pages project URL. No build server, account registration, API key, or paid service is required for visitors.

## Working features

- Store controls on catalog/product pages, pack-size selection, persistent basket, editable quantities, and basket checkout without payment. `/order/` opens the same checkout; existing product query links open a selection dialog.
- Published order-option prices are estimates. Products missing from the captured order list require a quote. Shipping, taxes, availability and final pricing are confirmed manually. Basket storage contains identifiers/quantities only; checkout personal details are saved only if the visitor explicitly saves a draft.
- Checkout reviews the full basket, contact and shipping details before Formspree submission. Failed sending preserves the basket; successful sending clears submitted quantities while retaining items added elsewhere.
- Product search, catalog-number/alphabetical sorting, tag/expression-host/origin filters, and Clear filters. Query parameters preserve selections across reloads.
- Full-text search across the captured site, with product/article/page scopes. Article search includes body text and verified tags; archive and tag navigation stays local.
- Product-table Order buttons preselect the catalog entry. Entries missing from the old order dropdown remain available as requests for confirmation.
- Contact and order request review, correctly encoded email drafts, clipboard copy, and downloadable UTF-8 text files. Without a Formspree endpoint, visitors send the request from their own email app; the default fallback inbox is `contact@fusiomica.com`. Configuring Formspree adds explicit online sending after review.
- Optional Save/Load/Delete draft buttons. Personal details are stored in this browser's local storage only when Save is clicked. Deleting a saved draft leaves the current form intact.
- Responsive navigation, catalog filters, request controls, and site search on mobile.

## Online submissions with Formspree

Contact and order requests use the account-owned Formspree form `Recepton website requests` (`xdegzvgr`), configured to notify `contact@fusiomica.com`. Formspree's Formshield spam filter is enabled; CAPTCHA is currently disabled. Existing email/copy/download controls remain available. To replace the receiving form:

1. Create a Formspree form in your account and verify the receiving email address. Set the destination in Formspree's dashboard.
2. In `assets/form-config.js`, set `endpoint` to the form's public `https://formspree.io/f/...` endpoint. Set `recipientEmail` to the same receiving inbox for the email fallback and on-page instructions. This public endpoint is not an API key; no secrets belong in this file.
3. Commit and push. Both contact and order previews will show a **Send request** button. The payload includes one reply-to email, the complete reviewed message, and a contact/order type.

Online submission disables controls while pending, prevents repeat sends of the same accepted request, and shows success only after Formspree accepts it. Validation errors, rate limits, and unconfirmed network failures preserve the form and fallback options. No automatic retry occurs. A honeypot is included. If the Formspree form requires CAPTCHA, its widget/token integration must also be configured before activation; this adapter does not bypass CAPTCHA.

Notification delivery and submission limits are managed by Formspree. An accepted submission is not proof of inbox delivery. Transport tests use mocked responses and never send real email:

```sh
node --test tests/formspree.test.mjs
```

## Cloudflare deployment

The existing Cloudflare Worker is `recepton-biotech-site`. Its Git integration uses the `main` branch and `npx wrangler deploy`, with no build command. `wrangler.jsonc` serves the repository's public static files; `.assetsignore` excludes source captures, tests and development files. Static asset requests do not need a Worker script.

For a direct dashboard folder upload, run `python3 scripts/build-site.py` and upload `output/cloudflare-store`. For CLI deployment, authenticate Wrangler and run `npx wrangler deploy`. Run `python scripts/build-store.py` after catalog/order-option changes, and `node --test tests/*.test.mjs` to check basket and transport behavior.

## Limits

GitHub Pages does not run the original WordPress backend. A configured Formspree endpoint handles online submissions and notifications externally. Without it, delivery requires the visitor to send the email draft. This copy does not process payments, provide WordPress administration, or synchronize content changes from the original site. Copy/download remains available if online sending or an email app fails.

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
