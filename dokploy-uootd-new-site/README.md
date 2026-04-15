# Dokploy Fabric Catalog Site

This folder is a dedicated Dokploy starter for a separate WooCommerce fabric site.
It reuses the UOOTD storefront shell only as a frontend template and does not share another site's volume names, table prefix, or brand config.
The current defaults are tuned for `https://upholsteryfabric.net`.
The bundle is self-contained, so Dokploy only needs this folder from the repository.

## What it includes

- A separate `MariaDB + WordPress + wp-setup` stack
- Startup sync for the current UOOTD storefront, parity, checkout, and Inflyway shell files
- A bundled `template/` directory so Dokploy does not depend on files outside this folder
- Automatic install of `WooCommerce` and `Storefront`
- Automatic creation of `Home / Shop / Cart / Checkout / My Account`
- Automatic copy of the `uootd-generated` editorial assets used by the homepage shell
- Automatic import of the FabricViva catalog snapshot with prices, product images, categories, and primary navigation

## Dokploy setup

1. Create a new `Docker Compose` app in Dokploy.
2. Point it at this repository.
3. Set the compose path to `dokploy-uootd-new-site/compose.yaml`.
4. Fill the environment values from `dokploy-uootd-new-site/.env.example`.
5. Bind the domain to the `wordpress` service on container port `80`.

## Must change before launch

- Review `dokploy-uootd-new-site/uootd-shell-config.local.php` if you want to rename the site away from `UpholsteryFabric.net`.
- Replace every placeholder password, email, and domain in `.env.example` with new-site-only values.
- Leave the Inflyway gateway disabled in WooCommerce until the new site has its own credentials.

## Catalog import path

- Refresh `dokploy-uootd-new-site/catalog/fabricviva-catalog.json` before deploy if you want a newer source snapshot.
- The `wp-setup` container imports the snapshot directly into WooCommerce on first boot.
- Product prices come from the snapshot and stay unchanged relative to that snapshot.
- The importer creates:
  - `All Fabrics`, `New Arrivals`, and brand-based fabric categories
  - Category assignments based on the source Shopify collections
  - A `Main Navigation` menu wired to Storefront `primary` and `handheld`
  - Variable products for the multi-option fabric listings

## Notes

- The `wp-setup` service is idempotent for catalog imports and safe to rerun during redeploys.
- The first import can take a while because product images are sideloaded into the new site's media library.
- After the site is stable, you can stop or remove `wp-setup` in Dokploy if you do not want to keep the helper container running.
