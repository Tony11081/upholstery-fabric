#!/bin/sh
set -eu

wait_for_wordpress_files() {
  until [ -f /var/www/html/wp-includes/version.php ]; do
    sleep 3
  done
}

wait_for_wp_config() {
  until [ -s /var/www/html/wp-config.php ]; do
    sleep 3
  done
}

wait_for_database() {
  until wp db check --allow-root >/dev/null 2>&1; do
    sleep 5
  done
}

install_wordpress_if_needed() {
  if wp core is-installed --allow-root >/dev/null 2>&1; then
    return
  fi

  wp core install \
    --url="${WP_SITE_URL}" \
    --title="${WP_SITE_TITLE}" \
    --admin_user="${WP_ADMIN_USER}" \
    --admin_password="${WP_ADMIN_PASSWORD}" \
    --admin_email="${WP_ADMIN_EMAIL}" \
    --skip-email \
    --allow-root
}

install_woocommerce_stack() {
  if ! wp plugin is-installed woocommerce --allow-root >/dev/null 2>&1; then
    wp plugin install woocommerce --activate --allow-root
  else
    wp plugin activate woocommerce --allow-root || true
  fi

  if ! wp theme is-installed storefront --allow-root >/dev/null 2>&1; then
    wp theme install storefront --activate --allow-root
  else
    wp theme activate storefront --allow-root || true
  fi
}

configure_core_options() {
  wp option update blogdescription "${WP_TAGLINE}" --allow-root
  wp option update timezone_string "${TZ}" --allow-root
  wp option update permalink_structure "/%postname%/" --allow-root
  wp option update posts_per_page "24" --allow-root
}

ensure_commerce_pages() {
  wp eval '
  $pages = array(
    "home" => array(
      "title"   => "Home",
      "content" => ""
    ),
    "shop" => array(
      "title"   => "Shop",
      "content" => ""
    ),
    "cart" => array(
      "title"   => "Cart",
      "content" => "[woocommerce_cart]"
    ),
    "checkout" => array(
      "title"   => "Checkout",
      "content" => "[woocommerce_checkout]"
    ),
    "my-account" => array(
      "title"   => "My Account",
      "content" => "[woocommerce_my_account]"
    )
  );

  $option_map = array(
    "shop"       => "woocommerce_shop_page_id",
    "cart"       => "woocommerce_cart_page_id",
    "checkout"   => "woocommerce_checkout_page_id",
    "my-account" => "woocommerce_myaccount_page_id"
  );

  foreach ( $pages as $slug => $page_data ) {
    $existing = get_page_by_path( $slug, OBJECT, "page" );

    if ( $existing instanceof WP_Post ) {
      $page_id = $existing->ID;
    } else {
      $page_id = wp_insert_post(
        array(
          "post_type"    => "page",
          "post_status"  => "publish",
          "post_title"   => $page_data["title"],
          "post_name"    => $slug,
          "post_content" => $page_data["content"],
        )
      );
    }

    if ( isset( $option_map[ $slug ] ) ) {
      update_option( $option_map[ $slug ], (int) $page_id );
    }

    if ( "home" === $slug ) {
      update_option( "show_on_front", "page" );
      update_option( "page_on_front", (int) $page_id );
    }
  }
  ' --allow-root
}

cleanup_defaults() {
  wp plugin deactivate hello --allow-root >/dev/null 2>&1 || true
  wp plugin delete hello --allow-root >/dev/null 2>&1 || true
  wp post delete 1 --force --allow-root >/dev/null 2>&1 || true
  wp comment delete 1 --force --allow-root >/dev/null 2>&1 || true
}

import_fabricviva_catalog() {
  catalog_path="${FABRICVIVA_CATALOG_PATH:-/opt/uootd-catalog/fabricviva-catalog.json}"
  import_script_path="${FABRICVIVA_IMPORT_SCRIPT_PATH:-/opt/uootd-scripts/import_fabricviva_catalog.php}"

  if [ ! -f "$catalog_path" ]; then
    echo "FabricViva catalog snapshot not found at ${catalog_path}, skipping catalog import."
    return
  fi

  if [ ! -f "$import_script_path" ]; then
    echo "FabricViva importer not found at ${import_script_path}, skipping catalog import."
    return
  fi

  FABRICVIVA_CATALOG_PATH="$catalog_path" wp eval-file "$import_script_path" --allow-root
}

wait_for_wordpress_files
wait_for_wp_config
wait_for_database
install_wordpress_if_needed
install_woocommerce_stack
configure_core_options
ensure_commerce_pages
cleanup_defaults
import_fabricviva_catalog
wp rewrite flush --hard --allow-root

echo "WordPress, WooCommerce, the storefront shell, and the FabricViva catalog are ready."
