# Request-based store

User scope: preserve the Recepton site, add a basket and checkout, take no payments, and deploy to the existing Cloudflare project.

Implementation uses the existing static HTML and Formspree transport. Product variants come from canonical catalog tables. Published order sizes provide estimates for listed SKUs; other products require a quote. Basket storage contains only product/option identifiers and quantities. Checkout collects contact/address details, reviews the request before explicit submission, and retains email/copy/download fallbacks. Successful submission removes only submitted quantities.

Validation: basket arithmetic and invalid quantities; price-free storage restoration; quote totals; cross-tab additions during submission; desktop/mobile catalog-to-basket-to-checkout flow; provider failure and successful submission; production assets match the verified local files.

No payment, stock reservation, account login, or order management backend is added. Orders remain requests requiring manual price and availability confirmation.
