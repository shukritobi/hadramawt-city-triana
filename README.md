# Hadhramawt City Restaurant — Pickup Ordering

A mobile-first restaurant storefront for **Restoran Hadhramawt City, Tropicana Aman**, built from the restaurant-provided 26-page menu PDF.

## Included

- 155 menu items and variants across family sets, appetizers, rice dishes, hot dishes, BBQ, shawarma, desserts, juices and drinks.
- Search + category filters.
- Persistent cart.
- Pickup-only checkout and pickup time selection.
- Billplz bill creation using server-side credentials.
- Billplz X Signature callback verification.
- Payment status page with server-side Billplz verification to handle redirect/callback timing races.
- Cloudflare D1 order storage.
- Responsive UI, SEO metadata and Restaurant schema.

## Recommended hosting

Use **Cloudflare Pages** connected to this GitHub repository. GitHub Pages can serve the static storefront, but it cannot safely hold the Billplz Secret Key or run the payment callbacks, so the complete ordering flow requires Cloudflare Pages Functions (the `functions/` folder in this repo).

### Cloudflare Pages settings

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `/`
- Functions directory: automatically detected from `/functions`

## 1. Create D1 database

Create a D1 database (for example `hadhramawt-orders`) and bind it to the Pages project as `DB`.

Run `schema.sql` against the database.

## 2. Billplz configuration

Create a normal Billplz **Collection** and note its Collection ID. Bill creation uses Billplz `/api/v3/bills`, which is the Bill endpoint documented in Billplz's current quick-start flow.

Set these Cloudflare environment variables/secrets:

- `BILLPLZ_SECRET_KEY` — Billplz Secret Key. **Secret. Never expose this in browser code.**
- `BILLPLZ_COLLECTION_ID` — Collection ID for restaurant orders.
- `BILLPLZ_X_SIGNATURE_KEY` — X Signature key from Billplz Keys & Integration. **Secret.**
- `BILLPLZ_MODE` — `sandbox` while testing, then `production` when ready.
- `SITE_URL` — optional canonical origin, e.g. `https://order.hadhramawtcity.my`. If omitted, the request origin is used.

Enable **X Signature Payment** in Billplz so callbacks include `x_signature`.

The checkout creates:

- Callback: `/api/billplz-callback`
- Redirect: `/payment-return.html`

## 3. Go-live checklist

1. Confirm every menu price with the restaurant, especially pages where the PDF typography is compact.
2. Test the full flow in Billplz Sandbox.
3. Confirm a paid Sandbox transaction changes the D1 order to `paid`.
4. Switch `BILLPLZ_MODE` to `production` and replace sandbox credentials with production credentials.
5. Run one low-value live order and verify payment, callback, order record and pickup status page.

## Restaurant details used

- Restoran Hadhramawt City
- No 42, Jalan Aman Tiara 7, Bandar Tropicana Aman 2, 42500 Telok Panglima Garang, Selangor
- +60 11-1104 6311
- Daily 11:00 AM–12:00 AM

Menu item information comes from the supplied Hadhramawt City PDF. Public restaurant details were cross-checked during the September 2026 site build.
