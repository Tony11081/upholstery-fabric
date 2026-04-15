<?php
/**
 * Plugin Name: UOOTD Storefront Branding
 * Description: Adds a reusable editorial storefront layer for WooCommerce.
 * Author: OpenAI Codex
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'after_setup_theme', 'uootd_storefront_branding_setup', 20 );
add_action( 'init', 'uootd_storefront_branding_register_request_post_type', 20 );
add_action( 'init', 'uootd_storefront_branding_ensure_core_pages', 30 );
add_action( 'wp_enqueue_scripts', 'uootd_storefront_branding_enqueue_assets', 35 );
add_action( 'wp_head', 'uootd_storefront_branding_render_meta_description', 1 );
add_action( 'wp_head', 'uootd_storefront_branding_render_structured_data', 8 );
add_action( 'wp_footer', 'uootd_storefront_branding_render_search_overlay', 15 );
add_action( 'rest_api_init', 'uootd_storefront_branding_register_rest_routes' );
add_action( 'admin_menu', 'uootd_storefront_branding_register_admin_page' );
add_action( 'admin_init', 'uootd_storefront_branding_register_settings' );
add_action( 'admin_post_nopriv_uootd_client_request', 'uootd_storefront_branding_handle_client_request' );
add_action( 'admin_post_uootd_client_request', 'uootd_storefront_branding_handle_client_request' );
add_action( 'storefront_before_content', 'uootd_storefront_branding_render_discovery_shell', 4 );
add_action( 'woocommerce_before_main_content', 'uootd_storefront_branding_render_archive_hero', 7 );
add_action( 'woocommerce_before_shop_loop', 'uootd_storefront_branding_render_archive_seo_content', 25 );
add_action( 'woocommerce_before_add_to_cart_button', 'uootd_storefront_branding_render_direct_checkout_flag', 5 );
add_action( 'woocommerce_single_product_summary', 'uootd_storefront_branding_render_product_eyebrow', 4 );
add_action( 'woocommerce_single_product_summary', 'uootd_storefront_branding_render_single_wishlist_button', 13 );
add_action( 'woocommerce_single_product_summary', 'uootd_storefront_branding_render_product_support', 31 );
add_action( 'woocommerce_after_add_to_cart_button', 'uootd_storefront_branding_render_single_product_secondary_cta', 15 );
add_action( 'woocommerce_after_shop_loop_item_title', 'uootd_storefront_branding_render_loop_wishlist_button', 11 );

add_filter( 'body_class', 'uootd_storefront_branding_body_classes' );
add_filter( 'pre_get_document_title', 'uootd_storefront_branding_document_title', 20 );
add_filter( 'the_title', 'uootd_storefront_branding_frontend_titles', 10, 2 );
add_filter( 'the_content', 'uootd_storefront_branding_adjust_page_content', 6 );
add_filter( 'woocommerce_add_to_cart_validation', 'uootd_storefront_branding_prepare_direct_checkout_cart', 5, 3 );
add_filter( 'woocommerce_add_to_cart_redirect', 'uootd_storefront_branding_add_to_cart_redirect', 20 );
add_filter( 'woocommerce_loop_add_to_cart_link', 'uootd_storefront_branding_loop_add_to_cart_link', 20, 3 );
add_filter( 'woocommerce_product_add_to_cart_text', 'uootd_storefront_branding_loop_add_to_cart_text', 20, 2 );
add_filter( 'woocommerce_product_single_add_to_cart_text', 'uootd_storefront_branding_single_add_to_cart_text' );
add_filter( 'wc_add_to_cart_message_html', 'uootd_storefront_branding_add_to_cart_message_html', 20, 3 );
add_filter( 'woocommerce_short_description', 'uootd_storefront_branding_format_short_description', 20 );
add_filter( 'woocommerce_product_tabs', 'uootd_storefront_branding_product_tabs', 20 );
add_filter( 'woocommerce_product_related_products_heading', 'uootd_storefront_branding_related_heading' );
add_filter( 'woocommerce_output_related_products_args', 'uootd_storefront_branding_related_args' );
add_filter( 'woocommerce_account_menu_items', 'uootd_storefront_branding_account_menu_items' );

function uootd_storefront_branding_get_shell_setting_value( $key, $default = '' ) {
	if ( function_exists( 'uootd_storefront_shell_get_setting' ) ) {
		return uootd_storefront_shell_get_setting( $key, $default );
	}

	return $default;
}

function uootd_storefront_branding_get_brand_name() {
	return uootd_storefront_branding_get_shell_setting_value( 'brand_name', 'UOOTD' );
}

function uootd_storefront_branding_get_brand_wordmark() {
	return uootd_storefront_branding_get_shell_setting_value( 'brand_wordmark', uootd_storefront_branding_get_brand_name() );
}

function uootd_storefront_branding_get_brand_edit_label() {
	return uootd_storefront_branding_get_shell_setting_value( 'brand_edit_label', 'The ' . uootd_storefront_branding_get_brand_name() . ' edit' );
}

function uootd_storefront_branding_get_support_team_title() {
	return uootd_storefront_branding_get_shell_setting_value( 'support_team_title', 'Client Services' );
}

function uootd_storefront_branding_get_support_team_label() {
	return uootd_storefront_branding_get_shell_setting_value( 'support_team_label', 'client services' );
}

function uootd_storefront_branding_get_footer_heading() {
	return uootd_storefront_branding_get_shell_setting_value( 'footer_heading', 'Curated fashion edits, sharper trust cues, and a cleaner route into checkout.' );
}

function uootd_storefront_branding_get_footer_description() {
	return uootd_storefront_branding_get_shell_setting_value( 'footer_description', 'Browse the edit, move into secure card checkout, and return through client services whenever you need order details.' );
}

function uootd_storefront_branding_is_fabric_catalog() {
	return 'fabric' === strtolower( (string) uootd_storefront_branding_get_shell_setting_value( 'catalog_vertical', 'fashion' ) );
}

function uootd_storefront_branding_get_cart_label() {
	$default = uootd_storefront_branding_is_fabric_catalog() ? 'Cart' : 'Bag';

	return (string) uootd_storefront_branding_get_shell_setting_value( 'cart_label', $default );
}

function uootd_storefront_branding_get_add_to_cart_label() {
	$default = uootd_storefront_branding_is_fabric_catalog() ? 'Add to Cart' : 'Add to Bag';

	return (string) uootd_storefront_branding_get_shell_setting_value( 'add_to_cart_label', $default );
}

function uootd_storefront_branding_get_product_unit_label( $count = 2 ) {
	$key = 1 === (int) $count ? 'product_unit_singular' : 'product_unit_plural';

	return (string) uootd_storefront_branding_get_shell_setting_value( $key, 1 === (int) $count ? 'piece' : 'pieces' );
}

function uootd_storefront_branding_get_category_slug_list( $setting_key, $fallback ) {
	$slugs = uootd_storefront_branding_get_shell_setting_value( $setting_key, $fallback );

	if ( ! is_array( $slugs ) ) {
		return $fallback;
	}

	return array_values(
		array_filter(
			array_map(
				static function( $slug ) {
					return sanitize_title( (string) $slug );
				},
				$slugs
			)
		)
	);
}

function uootd_storefront_branding_use_generated_editorial_assets() {
	return (bool) uootd_storefront_branding_get_shell_setting_value( 'use_generated_editorial_assets', ! uootd_storefront_branding_is_fabric_catalog() );
}

function uootd_storefront_branding_get_home_category_defaults() {
	if ( uootd_storefront_branding_is_fabric_catalog() ) {
		return array(
			'all-fabrics' => array(
				'label'       => 'All Fabrics',
				'eyebrow'     => 'Upholstery by the yard',
				'description' => 'Designer-inspired jacquard, chenille, and decorative upholstery fabrics gathered in one easy browse.',
				'action'      => 'Shop all fabrics',
			),
			'gucci-fabric' => array(
				'label'       => 'Gucci Fabric',
				'eyebrow'     => 'Brand-inspired jacquard',
				'description' => 'Monogram and woven Gucci-inspired fabrics suited to upholstery, bag making, and custom projects.',
				'action'      => 'Shop Gucci fabric',
			),
			'lv-fabric' => array(
				'label'       => 'LV Fabric',
				'eyebrow'     => 'Signature woven patterns',
				'description' => 'Louis Vuitton-inspired upholstery fabrics with strong contrast, decorative texture, and by-the-yard ordering.',
				'action'      => 'Shop LV fabric',
			),
		);
	}

	return array(
		'bags' => array(
			'label'           => 'Bags',
			'eyebrow'         => 'Carry the look',
			'description'     => 'Structured totes, shoulder shapes, and crossbody silhouettes.',
			'action'          => 'Shop the edit',
			'generated_asset' => 'hero-editorial-generated.png',
		),
		'jewelry' => array(
			'label'           => 'Jewelry',
			'eyebrow'         => 'Finish the stack',
			'description'     => 'Rings, necklaces, bracelets, and polished statement accents.',
			'action'          => 'Shop the edit',
			'generated_asset' => 'jewelry-editorial-generated.png',
		),
		'accessories' => array(
			'label'           => 'Accessories',
			'eyebrow'         => 'Small details, strong payoff',
			'description'     => 'Wallets, belts, and refined extras that complete the edit.',
			'action'          => 'Shop the edit',
			'generated_asset' => 'accessories-editorial-generated.png',
		),
	);
}

function uootd_storefront_branding_get_generated_asset_relative_path( $filename ) {
	$directory = trim( (string) uootd_storefront_branding_get_shell_setting_value( 'generated_asset_dir', 'uootd-generated' ), '/\\' );
	$filename  = ltrim( $filename, '/\\' );

	return $directory . '/' . $filename;
}

function uootd_storefront_branding_get_official_site_suffix() {
	return uootd_storefront_branding_get_shell_setting_value( 'official_site_suffix', 'Official Site' );
}

function uootd_storefront_branding_format_meta_title( $prefix = '' ) {
	$brand = uootd_storefront_branding_get_brand_name();

	if ( '' === $prefix ) {
		return $brand . ' | ' . uootd_storefront_branding_get_official_site_suffix();
	}

	return $prefix . ' | ' . $brand;
}

require_once dirname( __FILE__ ) . '/uootd-storefront-parity.php';

function uootd_storefront_branding_setup() {
	if ( function_exists( 'storefront_product_search' ) ) {
		remove_action( 'storefront_header', 'storefront_product_search', 40 );
	}

	if ( function_exists( 'storefront_credit' ) ) {
		remove_action( 'storefront_footer', 'storefront_credit', 20 );
	}

	add_action( 'storefront_before_header', 'uootd_storefront_branding_render_service_ribbons', 5 );
	add_action( 'storefront_footer', 'uootd_storefront_branding_render_footer', 20 );
}

function uootd_storefront_branding_enqueue_assets() {
	if ( is_admin() ) {
		return;
	}

	$css_path = dirname( __FILE__ ) . '/uootd-storefront-branding.css';
	$asset    = content_url( 'mu-plugins/uootd-storefront-branding.css' );
	$parity_css_path = dirname( __FILE__ ) . '/uootd-storefront-parity.css';
	$parity_asset    = content_url( 'mu-plugins/uootd-storefront-parity.css' );
	$js_path  = dirname( __FILE__ ) . '/uootd-storefront-branding.js';
	$js_asset = content_url( 'mu-plugins/uootd-storefront-branding.js' );

	wp_enqueue_style(
		'uootd-storefront-branding',
		$asset,
		array(),
		file_exists( $css_path ) ? (string) filemtime( $css_path ) : '1.0.0'
	);

	wp_enqueue_style(
		'uootd-storefront-parity',
		$parity_asset,
		array( 'uootd-storefront-branding' ),
		file_exists( $parity_css_path ) ? (string) filemtime( $parity_css_path ) : '1.0.0'
	);

	wp_enqueue_script(
		'uootd-storefront-branding',
		$js_asset,
		array(),
		file_exists( $js_path ) ? (string) filemtime( $js_path ) : '1.0.0',
		true
	);

	wp_localize_script(
		'uootd-storefront-branding',
		'uootdStorefront',
		array(
			'searchEndpoint' => esc_url_raw( rest_url( 'uootd/v1/search' ) ),
			'searchPageUrl'  => esc_url_raw( uootd_storefront_branding_get_page_url( 'search', '/search/' ) ),
			'wishlistPageUrl'=> esc_url_raw( uootd_storefront_branding_get_page_url( 'wishlist', '/wishlist/' ) ),
			'accountUrl'     => esc_url_raw( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/my-account/' ) ),
		)
	);
}

function uootd_storefront_branding_body_classes( $classes ) {
	$classes[] = 'uootd-storefront-shell';

	if ( is_front_page() ) {
		$classes[] = 'uootd-storefront-home';
	}

	if ( function_exists( 'is_shop' ) && is_shop() ) {
		$classes[] = 'uootd-storefront-shop';
	}

	if ( function_exists( 'is_product_taxonomy' ) && is_product_taxonomy() ) {
		$classes[] = 'uootd-storefront-collection';
	}

	if ( function_exists( 'is_product' ) && is_product() ) {
		$classes[] = 'uootd-storefront-product';
	}

	if ( function_exists( 'is_account_page' ) && is_account_page() ) {
		$classes[] = 'uootd-storefront-account';
	}

	$special_page = uootd_storefront_branding_get_special_page_slug();
	if ( $special_page ) {
		$classes[] = 'uootd-storefront-special';
		$classes[] = 'uootd-page-' . sanitize_html_class( $special_page );
	}

	return $classes;
}

function uootd_storefront_branding_frontend_titles( $title, $post_id ) {
	if ( is_admin() || wp_doing_ajax() || ! $post_id ) {
		return $title;
	}

	$cart_id     = function_exists( 'wc_get_page_id' ) ? (int) wc_get_page_id( 'cart' ) : 0;
	$checkout_id = function_exists( 'wc_get_page_id' ) ? (int) wc_get_page_id( 'checkout' ) : 0;

	if ( $post_id === $cart_id ) {
		return uootd_storefront_branding_get_cart_label();
	}

	if ( $post_id === $checkout_id ) {
		return 'Secure Checkout';
	}

	return $title;
}

function uootd_storefront_branding_adjust_page_content( $content ) {
	if ( is_admin() || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}

	if ( is_front_page() ) {
		remove_filter( 'the_content', 'wpautop' );
		remove_filter( 'the_content', 'shortcode_unautop' );
		return uootd_storefront_branding_render_front_page();
	}

	if ( function_exists( 'is_account_page' ) && is_account_page() ) {
		return uootd_storefront_branding_render_account_hero() . $content;
	}

	$special_page = uootd_storefront_branding_get_special_page_slug();
	if ( $special_page ) {
		remove_filter( 'the_content', 'wpautop' );
		remove_filter( 'the_content', 'shortcode_unautop' );
		return uootd_storefront_branding_render_special_page( $special_page );
	}

	return $content;
}

function uootd_storefront_branding_render_front_page() {
	$shop_url        = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
	$new_in_url      = uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' );
	$trending_url    = uootd_storefront_branding_get_page_url( 'trending', '/trending/' );
	$designers_url   = uootd_storefront_branding_get_page_url( 'designers', '/designers/' );
	$care_url        = uootd_storefront_branding_get_page_url( 'customer-care', '/customer-care/' );
	$track_order_url = uootd_storefront_branding_get_page_url( 'track-order', '/track-order/' );
	$delivery_url    = uootd_storefront_branding_get_page_url( 'delivery', '/delivery/' );
	$payment_url     = uootd_storefront_branding_get_page_url( 'payment', '/payment/' );
	$returns_url     = uootd_storefront_branding_get_page_url( 'exchanges-returns', '/exchanges-returns/' );
	$is_fabric_site  = uootd_storefront_branding_is_fabric_catalog();
	$terms           = uootd_storefront_branding_get_home_category_cards();
	$raw_products    = wc_get_products(
		array(
			'status'  => 'publish',
			'limit'   => 12,
			'orderby' => 'date',
			'order'   => 'DESC',
		)
	);
	$products        = array();
	$hero_term       = ! empty( $terms ) ? $terms[0] : null;
	$secondary_term  = isset( $terms[1] ) ? $terms[1] : null;
	$tertiary_term   = isset( $terms[2] ) ? $terms[2] : null;

	foreach ( $raw_products as $candidate ) {
		if ( ! $candidate instanceof WC_Product || ! $candidate->get_image_id() ) {
			continue;
		}

		$products[] = $candidate;
		if ( count( $products ) >= 8 ) {
			break;
		}
	}

	$featured_url     = $hero_term && ! empty( $hero_term['url'] ) ? $hero_term['url'] : $shop_url;
	$featured_eyebrow = $hero_term && ! empty( $hero_term['eyebrow'] ) ? $hero_term['eyebrow'] : ( $is_fabric_site ? 'Upholstery by the yard' : 'Carry the look' );
	$featured_title   = $hero_term && ! empty( $hero_term['label'] ) ? $hero_term['label'] : ( $is_fabric_site ? 'All Fabrics' : 'Bags' );
	$featured_copy    = $hero_term && ! empty( $hero_term['description'] ) ? $hero_term['description'] : ( $is_fabric_site ? 'Designer-inspired upholstery fabrics, jacquards, and textured weaves selected for a faster browse.' : 'Structured silhouettes and softer neutrals chosen to anchor the edit.' );
	$hero_image       = $hero_term && ! empty( $hero_term['image_full'] ) ? $hero_term['image_full'] : '';

	$live_count        = uootd_storefront_branding_get_live_product_count();
	$brand_count       = max( 1, uootd_storefront_branding_get_fabric_brand_count() );
	$collage_primary = $hero_image;
	$collage_secondary = $secondary_term && ! empty( $secondary_term['image_full'] ) ? $secondary_term['image_full'] : $collage_primary;
	$dual_cards = array();
	$new_in_title = $is_fabric_site ? 'New Arrivals' : 'New In';
	$homepage_metrics = $is_fabric_site
		? array(
			array(
				'value' => number_format_i18n( $live_count ),
				'label' => 'fabrics live now',
			),
			array(
				'value' => number_format_i18n( $brand_count ),
				'label' => 'brand-led routes',
			),
			array(
				'value' => 'By yard',
				'label' => 'source pricing kept',
			),
			array(
				'value' => 'Support',
				'label' => 'before checkout',
			),
		)
		: array(
			array(
				'value' => number_format_i18n( $live_count ),
				'label' => 'pieces live now',
			),
			array(
				'value' => 'Designers',
				'label' => 'ready to browse',
			),
			array(
				'value' => '24/7',
				'label' => 'secure checkout flow',
			),
			array(
				'value' => 'Support',
				'label' => 'before and after checkout',
			),
		);

	if ( $secondary_term ) {
		$dual_cards[] = array(
			'eyebrow' => $secondary_term['eyebrow'],
			'title'   => $secondary_term['label'],
			'copy'    => $secondary_term['description'],
			'action'  => ! empty( $secondary_term['action'] ) ? $secondary_term['action'] : 'Shop the collection',
			'url'     => $secondary_term['url'],
			'image'   => $secondary_term['image_full'],
		);
	}

	if ( $tertiary_term ) {
		$dual_cards[] = array(
			'eyebrow' => $tertiary_term['eyebrow'],
			'title'   => $tertiary_term['label'],
			'copy'    => $tertiary_term['description'],
			'action'  => ! empty( $tertiary_term['action'] ) ? $tertiary_term['action'] : 'Shop the collection',
			'url'     => $tertiary_term['url'],
			'image'   => $tertiary_term['image_full'],
		);
	}

	$feature_image   = $tertiary_term && ! empty( $tertiary_term['image_full'] ) ? $tertiary_term['image_full'] : $collage_secondary;
	$product_images  = array();

	foreach ( array_slice( $products, 0, 3 ) as $product ) {
		$product_images[] = wp_get_attachment_image_url( $product->get_image_id(), 'large' );
	}

	if ( $is_fabric_site ) {
		$discover_cards = array(
			array(
				'eyebrow' => 'Catalog',
				'title'   => 'Browse the full fabric catalog',
				'copy'    => 'Start broad, then narrow down into brand-inspired upholstery, jacquard, and decorative fabric collections.',
				'action'  => 'Open the catalog',
				'url'     => $shop_url,
				'image'   => ! empty( $product_images[0] ) ? $product_images[0] : $collage_primary,
			),
			array(
				'eyebrow' => 'Brands',
				'title'   => 'Jump in by brand',
				'copy'    => 'Use the brand-led index to compare Gucci, LV, Dior, Fendi, and other fabric lines without scanning the full catalog first.',
				'action'  => 'Browse brands',
				'url'     => $designers_url,
				'image'   => ! empty( $product_images[1] ) ? $product_images[1] : $collage_secondary,
			),
			array(
				'eyebrow' => 'Support',
				'title'   => 'Ask before you commit yardage',
				'copy'    => 'Questions about width, weight, texture, continuous cuts, delivery, or order timing stay one clear step from the homepage.',
				'action'  => 'Open support',
				'url'     => $care_url,
				'image'   => ! empty( $product_images[2] ) ? $product_images[2] : $feature_image,
			),
		);
	} else {
		$discover_cards = array(
			array(
				'eyebrow' => 'Designers',
				'title'   => 'Browse the designer index',
				'copy'    => 'Move through the labels in the current edit faster, then drop into the right category page.',
				'action'  => 'Open designers',
				'url'     => $designers_url,
				'image'   => ! empty( $product_images[0] ) ? $product_images[0] : $collage_primary,
			),
			array(
				'eyebrow' => 'Trending',
				'title'   => 'See what is moving now',
				'copy'    => 'The strongest arrivals and high-interest pieces are surfaced here instead of buried across the full catalog.',
				'action'  => 'Open trending',
				'url'     => $trending_url,
				'image'   => ! empty( $product_images[1] ) ? $product_images[1] : $collage_secondary,
			),
			array(
				'eyebrow' => 'Customer care',
				'title'   => 'Get support before and after checkout',
				'copy'    => 'Payment, delivery, tracking and return guidance are now one clear step from the homepage.',
				'action'  => 'Open support',
				'url'     => $care_url,
				'image'   => ! empty( $product_images[2] ) ? $product_images[2] : $feature_image,
			),
		);
	}

	ob_start();
	?>
	<div class="uootd-home">
		<section class="uootd-home-campaign" aria-label="Campaign banner">
			<a class="uootd-home-campaign__banner" href="<?php echo esc_url( $featured_url ); ?>">
				<div class="uootd-home-campaign__media">
					<?php if ( $hero_image ) : ?>
						<img src="<?php echo esc_url( $hero_image ); ?>" alt="<?php echo esc_attr( $featured_title ); ?>" loading="eager" />
					<?php endif; ?>
				</div>
				<div class="uootd-home-campaign__copy">
					<p><?php echo esc_html( uootd_storefront_branding_get_brand_edit_label() ); ?></p>
					<h1><?php echo esc_html( strtoupper( $featured_title ) ); ?> EDIT</h1>
				</div>
				<div class="uootd-home-campaign__aside">
					<strong><?php echo esc_html( $is_fabric_site ? 'Textured, durable, upholstery-ready' : 'Structured, polished, everyday-ready' ); ?></strong>
					<span><?php echo esc_html( $featured_copy ); ?> <?php echo esc_html( $is_fabric_site ? 'Sold by the yard with gallery-led product pages that make finish and pattern comparison easier.' : 'Curated alongside jewelry and finishing pieces that keep the whole look sharp.' ); ?></span>
					<em>Shop the collection</em>
				</div>
			</a>
		</section>

		<section class="uootd-home-metrics" aria-label="<?php echo esc_attr( $is_fabric_site ? 'Catalog highlights' : 'Storefront highlights' ); ?>">
			<?php foreach ( $homepage_metrics as $metric ) : ?>
				<div class="uootd-home-metric">
					<strong><?php echo esc_html( $metric['value'] ); ?></strong>
					<span><?php echo esc_html( $metric['label'] ); ?></span>
				</div>
			<?php endforeach; ?>
		</section>

		<section class="uootd-home-collage" aria-label="Lead story">
			<div class="uootd-home-collage__grid">
				<a class="uootd-home-collage__card uootd-home-collage__card--primary" href="<?php echo esc_url( $featured_url ); ?>">
					<?php if ( $collage_primary ) : ?>
						<img src="<?php echo esc_url( $collage_primary ); ?>" alt="<?php echo esc_attr( $featured_title ); ?>" loading="eager" />
					<?php endif; ?>
				</a>
				<a class="uootd-home-collage__card" href="<?php echo esc_url( $secondary_term ? $secondary_term['url'] : $featured_url ); ?>">
					<?php if ( $collage_secondary ) : ?>
						<img src="<?php echo esc_url( $collage_secondary ); ?>" alt="<?php echo esc_attr( $secondary_term ? $secondary_term['label'] : $featured_title ); ?>" loading="eager" />
					<?php endif; ?>
				</a>
			</div>
			<div class="uootd-home-collage__caption">
				<p><?php echo esc_html( $featured_eyebrow ); ?></p>
				<h2><?php echo esc_html( $featured_title ); ?> takes focus</h2>
				<span><?php echo esc_html( $is_fabric_site ? 'Discover the colors, woven textures, and upholstery-ready patterns setting the tone for the catalog right now.' : 'Discover the shapes, softer leathers and polished metal details setting the tone for the edit right now.' ); ?></span>
				<a href="<?php echo esc_url( $featured_url ); ?>">Shop the collection</a>
			</div>
		</section>

		<section class="uootd-home-newin" aria-label="New in">
			<a class="uootd-home-newin__lead" href="<?php echo esc_url( $new_in_url ); ?>">
				<p><?php echo esc_html( number_format_i18n( $live_count ) ); ?> <?php echo esc_html( uootd_storefront_branding_get_product_unit_label( $live_count ) ); ?> live now</p>
				<h2><?php echo esc_html( $new_in_title ); ?></h2>
				<span><?php echo esc_html( $is_fabric_site ? 'Fresh upholstery fabrics, jacquards, and decorative weaves surface here first, with a short path into support or checkout.' : 'New arrivals refreshed through the week across bags, jewelry and the finishing accessories that complete the look.' ); ?></span>
				<strong><?php echo esc_html( $is_fabric_site ? 'Shop New Arrivals' : 'Shop New In' ); ?></strong>
			</a>
			<div class="uootd-home-products__grid">
				<?php foreach ( array_slice( $products, 0, 4 ) as $product ) : ?>
					<?php echo uootd_storefront_branding_render_home_product_card( $product ); ?>
				<?php endforeach; ?>
			</div>
		</section>

		<section class="uootd-home-dual-promos" aria-label="Editorial promotions">
			<?php foreach ( $dual_cards as $card ) : ?>
				<a class="uootd-home-promo-card" href="<?php echo esc_url( $card['url'] ); ?>">
					<?php if ( ! empty( $card['image'] ) ) : ?>
						<img src="<?php echo esc_url( $card['image'] ); ?>" alt="<?php echo esc_attr( $card['title'] ); ?>" loading="lazy" />
					<?php endif; ?>
					<div class="uootd-home-promo-card__copy">
						<p><?php echo esc_html( $card['eyebrow'] ); ?></p>
						<h2><?php echo esc_html( $card['title'] ); ?></h2>
						<span><?php echo esc_html( $card['copy'] ); ?></span>
						<strong><?php echo esc_html( $card['action'] ); ?></strong>
					</div>
				</a>
			<?php endforeach; ?>
		</section>

		<section class="uootd-home-discover" aria-label="Discover more">
			<div class="uootd-home-section-head">
				<p>Discover more</p>
				<h2><?php echo esc_html( $is_fabric_site ? 'Finding the right fabric should feel faster and safer.' : 'The next move should feel obvious.' ); ?></h2>
				<span><?php echo esc_html( $is_fabric_site ? 'The homepage now pushes the three real buying moves forward: broad catalog browse, brand-level comparison, and support before you commit yardage.' : 'Designers, trending pieces and customer care now sit closer to the homepage, so the site feels easier to trust and easier to browse.' ); ?></span>
			</div>
			<div class="uootd-home-discover__grid">
				<?php foreach ( $discover_cards as $card ) : ?>
					<a class="uootd-home-discover-card" href="<?php echo esc_url( $card['url'] ); ?>">
						<?php if ( ! empty( $card['image'] ) ) : ?>
							<img src="<?php echo esc_url( $card['image'] ); ?>" alt="<?php echo esc_attr( $card['title'] ); ?>" loading="eager" fetchpriority="low" />
						<?php endif; ?>
						<div class="uootd-home-discover-card__copy">
							<p><?php echo esc_html( $card['eyebrow'] ); ?></p>
							<h3><?php echo esc_html( $card['title'] ); ?></h3>
							<span><?php echo esc_html( $card['copy'] ); ?></span>
							<strong><?php echo esc_html( $card['action'] ); ?></strong>
						</div>
					</a>
				<?php endforeach; ?>
			</div>
		</section>

		<section class="uootd-home-assurance" aria-label="<?php echo esc_attr( $is_fabric_site ? 'Storefront reassurance' : 'Official site guide' ); ?>">
			<div class="uootd-home-assurance__copy">
				<p><?php echo esc_html( $is_fabric_site ? 'Why customers shop here' : 'Official site guide' ); ?></p>
				<h2><?php echo esc_html( $is_fabric_site ? 'Built for fabric comparison, clearer ordering, and fewer dead ends.' : 'The right storefront, a faster path into the catalog, and clearer support before checkout.' ); ?></h2>
				<span><?php echo esc_html( $is_fabric_site ? 'This storefront is tuned for upholstery-fabric shopping instead of generic Woo clutter: gallery-led product pages, source-aligned pricing, by-the-yard guidance, and support that stays one click away before checkout.' : 'Visitors looking for the UOOTD official site usually want the real storefront, a direct route into bags and enough support detail to keep moving. The homepage now surfaces those answers earlier.' ); ?></span>
				<div class="uootd-home-assurance__points">
					<span><?php echo esc_html( $is_fabric_site ? 'Source pricing kept on the catalog snapshot' : 'Official UOOTD storefront' ); ?></span>
					<span><?php echo esc_html( $is_fabric_site ? 'By-the-yard ordering language on product pages' : 'Secure card checkout' ); ?></span>
					<span>Tracked dispatch support</span>
					<span><?php echo esc_html( $is_fabric_site ? 'Fabric support before checkout' : 'Returns and order guidance' ); ?></span>
				</div>
				<div class="uootd-home-assurance__links">
					<?php if ( $is_fabric_site ) : ?>
						<a href="<?php echo esc_url( $shop_url ); ?>">All Fabrics</a>
						<a href="<?php echo esc_url( $designers_url ); ?>">Brands</a>
					<?php endif; ?>
					<a href="<?php echo esc_url( $care_url ); ?>"><?php echo esc_html( uootd_storefront_branding_get_support_team_title() ); ?></a>
					<a href="<?php echo esc_url( $track_order_url ); ?>">Track your order</a>
					<a href="<?php echo esc_url( $delivery_url ); ?>">Delivery</a>
					<a href="<?php echo esc_url( $payment_url ); ?>">Payment</a>
					<a href="<?php echo esc_url( $returns_url ); ?>">Returns</a>
				</div>
			</div>
			<div class="uootd-home-assurance__faq">
				<?php foreach ( array_slice( uootd_storefront_branding_get_home_faq_items(), 0, 3 ) as $faq ) : ?>
					<details>
						<summary><?php echo esc_html( $faq['question'] ); ?></summary>
						<p><?php echo esc_html( $faq['answer'] ); ?></p>
					</details>
				<?php endforeach; ?>
			</div>
		</section>
	</div>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_loop_add_to_cart_text( $text, $product ) {
	if ( ! $product instanceof WC_Product ) {
		return $text;
	}

	return $product->is_purchasable() ? 'Buy Now' : $text;
}

function uootd_storefront_branding_single_add_to_cart_text() {
	return 'Buy Now';
}

function uootd_storefront_branding_get_direct_checkout_url( $product_id, $quantity = 1 ) {
	$args = array(
		'add-to-cart'           => absint( $product_id ),
		'quantity'              => max( 1, absint( $quantity ) ),
		'uootd-direct-checkout' => '1',
	);

	return add_query_arg( $args, home_url( '/' ) );
}

function uootd_storefront_branding_prepare_direct_checkout_cart( $passed, $product_id, $quantity ) {
	static $cart_reset = false;

	if ( $cart_reset || is_admin() || wp_doing_ajax() ) {
		return $passed;
	}

	$direct_checkout = isset( $_REQUEST['uootd-direct-checkout'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['uootd-direct-checkout'] ) ) : '';
	if ( '1' !== $direct_checkout ) {
		return $passed;
	}

	if ( function_exists( 'WC' ) && WC()->cart ) {
		WC()->cart->empty_cart();
		$cart_reset = true;
	}

	return $passed;
}

function uootd_storefront_branding_add_to_cart_redirect( $url ) {
	if ( is_admin() || wp_doing_ajax() ) {
		return $url;
	}

	$direct_checkout = isset( $_REQUEST['uootd-direct-checkout'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['uootd-direct-checkout'] ) ) : '';
	if ( '1' !== $direct_checkout ) {
		return $url;
	}

	return function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' );
}

function uootd_storefront_branding_loop_add_to_cart_link( $html, $product, $args ) {
	if ( ! $product instanceof WC_Product || ! $product->is_purchasable() || ! $product->is_in_stock() ) {
		return $html;
	}

	$quantity = isset( $args['quantity'] ) ? (int) $args['quantity'] : 1;
	$url      = uootd_storefront_branding_get_direct_checkout_url( $product->get_id(), $quantity );
	$label    = $product->supports( 'ajax_add_to_cart' ) ? 'Buy Now' : 'Choose Options';

	if ( ! $product->is_type( 'simple' ) ) {
		return $html;
	}

	return sprintf(
		'<a href="%1$s" class="button uootd-direct-buy-button" aria-label="%2$s">%3$s</a>',
		esc_url( $url ),
		esc_attr( sprintf( 'Buy %s now', $product->get_name() ) ),
		esc_html( $label )
	);
}

function uootd_storefront_branding_add_to_cart_message_html( $message, $products, $show_qty ) {
	if ( ! function_exists( 'wc_get_cart_url' ) || ! function_exists( 'wc_get_product' ) ) {
		return $message;
	}

	$product_ids = array();
	if ( is_array( $products ) ) {
		foreach ( $products as $product_id => $quantity ) {
			if ( $quantity <= 0 ) {
				continue;
			}

			$product_ids[] = absint( $product_id );
		}
	} elseif ( is_numeric( $products ) ) {
		$product_ids[] = absint( $products );
	}

	$product_ids = array_values( array_filter( array_unique( $product_ids ) ) );
	if ( empty( $product_ids ) ) {
		return $message;
	}

	$cart_label = uootd_storefront_branding_get_cart_label();
	$headline = 'Added to ' . strtolower( $cart_label );
	$summary  = 'Review your selection or continue through the edit.';

	if ( 1 === count( $product_ids ) ) {
		$product = wc_get_product( $product_ids[0] );
		if ( $product instanceof WC_Product ) {
			$headline = trim( wp_strip_all_tags( $product->get_name() ) );
		}
	} else {
		/* translators: %d: number of products added to the bag. */
		$headline = sprintf(
			_n(
				'%d ' . uootd_storefront_branding_get_product_unit_label( 1 ) . ' added to ' . strtolower( $cart_label ),
				'%d ' . uootd_storefront_branding_get_product_unit_label( 2 ) . ' added to ' . strtolower( $cart_label ),
				count( $product_ids ),
				'uootd-storefront-branding'
			),
			count( $product_ids )
		);
	}

	ob_start();
	?>
	<div class="uootd-cart-toast" data-uootd-cart-toast>
		<div class="uootd-cart-toast__content">
			<p class="uootd-cart-toast__eyebrow"><?php echo esc_html( $cart_label . ' updated' ); ?></p>
			<p class="uootd-cart-toast__headline"><?php echo esc_html( $headline ); ?></p>
			<p class="uootd-cart-toast__summary"><?php echo esc_html( $summary ); ?></p>
		</div>
		<div class="uootd-cart-toast__actions">
			<a class="uootd-cart-toast__link" href="<?php echo esc_url( wc_get_cart_url() ); ?>">View <?php echo esc_html( strtolower( $cart_label ) ); ?></a>
			<button type="button" class="uootd-cart-toast__dismiss" data-uootd-dismiss-toast aria-label="<?php echo esc_attr( 'Dismiss ' . strtolower( $cart_label ) . ' update' ); ?>">
				<span aria-hidden="true">+</span>
			</button>
		</div>
	</div>
	<?php

	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_direct_checkout_flag() {
	if ( ! is_product() ) {
		return;
	}
	?>
	<input type="hidden" name="uootd-direct-checkout" value="1" />
	<?php
}

function uootd_storefront_branding_render_single_product_secondary_cta() {
	global $product;

	if ( ! is_product() || ! $product instanceof WC_Product || ! $product->is_purchasable() ) {
		return;
	}
	?>
	<button
		type="submit"
		name="add-to-cart"
		value="<?php echo esc_attr( $product->get_id() ); ?>"
		class="button uootd-add-to-bag-secondary"
		onclick="var flag=this.form.querySelector('[name=&quot;uootd-direct-checkout&quot;]'); if(flag){flag.value='0';}"
	>
		<?php echo esc_html( uootd_storefront_branding_get_add_to_cart_label() ); ?>
	</button>
	<p class="uootd-product-cta-note"><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Buy Now sends this fabric straight into secure checkout. Add to Cart is better when you want to compare multiple fabrics, combine colors, or build one larger yardage order in a single cart.' : 'Buy now opens secure checkout with this item immediately. ' . uootd_storefront_branding_get_add_to_cart_label() . ' is better when you want to keep browsing and combine items in one ' . strtolower( uootd_storefront_branding_get_cart_label() ) . '.' ); ?></p>
	<?php
}

function uootd_storefront_branding_product_tabs( $tabs ) {
	if ( isset( $tabs['description'] ) ) {
		$tabs['description']['title'] = uootd_storefront_branding_is_fabric_catalog() ? 'Fabric Details' : 'Details';

		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			$tabs['description']['callback'] = 'uootd_storefront_branding_render_fabric_description_tab';
		}
	}

	if ( isset( $tabs['additional_information'] ) ) {
		$tabs['additional_information']['title'] = uootd_storefront_branding_is_fabric_catalog() ? 'Specs & Care' : 'Product Notes';
	}

	unset( $tabs['reviews'] );

	return $tabs;
}

function uootd_storefront_branding_render_fabric_description_tab() {
	global $product;

	if ( ! $product instanceof WC_Product ) {
		return;
	}

	$description = trim( (string) $product->get_description() );
	if ( '' === $description ) {
		$description = trim( (string) $product->get_short_description() );
	}

	$formatted = uootd_storefront_branding_format_fabric_description( $description );
	?>
	<h2>Description</h2>
	<?php
	if ( '' !== $formatted ) {
		echo wp_kses_post( $formatted );
		return;
	}

	echo wp_kses_post( wpautop( $description ) );
}

function uootd_storefront_branding_related_heading() {
	return uootd_storefront_branding_is_fabric_catalog() ? 'More fabrics to compare' : 'More from the edit';
}

function uootd_storefront_branding_related_args( $args ) {
	$args['posts_per_page'] = 4;
	$args['columns']        = 4;

	return $args;
}

function uootd_storefront_branding_account_menu_items( $items ) {
	unset( $items['downloads'] );

	if ( isset( $items['dashboard'] ) ) {
		$items['dashboard'] = 'Overview';
	}

	return $items;
}

function uootd_storefront_branding_render_meta_description() {
	if ( is_admin() ) {
		return;
	}

	$meta = uootd_storefront_branding_get_seo_meta();

	if ( empty( $meta['description'] ) ) {
		return;
	}

	printf(
		"<meta name=\"description\" content=\"%s\" />\n",
		esc_attr( $meta['description'] )
	);

	printf(
		"<meta property=\"og:title\" content=\"%s\" />\n<meta property=\"og:description\" content=\"%s\" />\n<meta property=\"og:type\" content=\"%s\" />\n<meta property=\"og:url\" content=\"%s\" />\n<meta name=\"twitter:card\" content=\"summary_large_image\" />\n",
		esc_attr( $meta['title'] ),
		esc_attr( $meta['description'] ),
		esc_attr( $meta['og_type'] ),
		esc_url( $meta['url'] )
	);
}

function uootd_storefront_branding_document_title( $title ) {
	if ( is_admin() ) {
		return $title;
	}

	$meta = uootd_storefront_branding_get_seo_meta();

	return ! empty( $meta['title'] ) ? $meta['title'] : $title;
}

function uootd_storefront_branding_get_current_url() {
	$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';

	return home_url( $request_uri );
}

function uootd_storefront_branding_get_home_faq_items() {
	$brand_name = uootd_storefront_branding_get_brand_name();

	if ( uootd_storefront_branding_is_fabric_catalog() ) {
		return array(
			array(
				'question' => 'Is this the official ' . $brand_name . ' site?',
				'answer'   => 'Yes. This storefront is focused on designer-inspired upholstery fabric, jacquard fabric, and decorative yardage with direct checkout and order support.',
			),
			array(
				'question' => 'What can I shop on ' . $brand_name . '?',
				'answer'   => 'The catalog focuses on upholstery fabrics by the yard, including Gucci-inspired, LV-inspired, Dior-inspired, Fendi-inspired, jacquard, and other decorative woven options.',
			),
			array(
				'question' => 'Are these fabrics sold by the yard?',
				'answer'   => 'Yes. Product pages keep the source pricing structure, clarify yardage ordering, and note that multi-yard orders stay in one continuous cut when available.',
			),
			array(
				'question' => 'Where should I start if I want upholstery fabric fast?',
				'answer'   => 'Start with All Fabrics for the broadest browse, or jump straight into brand-led collections like Gucci Fabric, LV Fabric, Dior Fabric, and Fendi Fabric.',
			),
		);
	}

	return array(
		array(
			'question' => 'Is this the official UOOTD site?',
			'answer'   => 'Yes. This is the main UOOTD storefront for curated bags, jewelry, accessories, checkout, and client services.',
		),
		array(
			'question' => 'What can I shop at UOOTD?',
			'answer'   => 'UOOTD focuses on bags, jewelry, accessories, and selected new-in pieces organized into clear shopping categories.',
		),
		array(
			'question' => 'How does checkout work on UOOTD?',
			'answer'   => 'Orders move through a secure card checkout flow with tracked dispatch updates and account-based order support after payment.',
		),
		array(
			'question' => 'Where should I start if I want UOOTD bags?',
			'answer'   => 'Start with the Bags category to browse totes, shoulder bags, crossbody bags, wallets, and other structured everyday styles.',
		),
	);
}

function uootd_storefront_branding_get_archive_faq_items( $slug = '' ) {
	$brand_name = uootd_storefront_branding_get_brand_name();

	if ( uootd_storefront_branding_is_fabric_catalog() ) {
		$default = array(
			array(
				'question' => 'What can I find in this ' . $brand_name . ' collection?',
				'answer'   => 'Each collection groups related upholstery fabrics so it is easier to compare weave, pattern, and brand-led styling before checkout.',
			),
			array(
				'question' => 'Does ' . $brand_name . ' keep source pricing on these fabrics?',
				'answer'   => 'Yes. The catalog keeps the imported pricing structure aligned with the source snapshot used for this site.',
			),
			array(
				'question' => 'Can I shop this fabric collection on mobile?',
				'answer'   => 'Yes. Category pages, product galleries, and checkout flow are optimized for phone-first browsing and faster product discovery.',
			),
		);

		if ( 'all-fabrics' === $slug ) {
			return array(
				array(
					'question' => 'Is this the main upholstery fabric catalog?',
					'answer'   => 'Yes. All Fabrics is the broadest browse across the site, pulling together brand-inspired upholstery, jacquard, chenille, and decorative fabric listings.',
				),
				array(
					'question' => 'What kinds of fabrics are included here?',
					'answer'   => 'You will find woven jacquards, monogram upholstery fabrics, chenille, brocade-style options, and other decorative textiles suited to furniture, bags, pillows, and DIY work.',
				),
				array(
					'question' => 'How do ordering and delivery work?',
					'answer'   => 'Orders move through secure checkout, then into tracked delivery updates so you can follow the order after purchase.',
				),
			);
		}

		return $default;
	}

	$default = array(
		array(
			'question' => 'What can I shop in this UOOTD collection?',
			'answer'   => 'Each category gathers a focused part of the UOOTD edit so shoppers can move quickly from discovery to checkout without browsing the full catalog first.',
		),
		array(
			'question' => 'Does UOOTD offer secure checkout and tracking?',
			'answer'   => 'Yes. Orders move through secure card checkout and tracked dispatch updates, with client services available after purchase.',
		),
		array(
			'question' => 'Can I shop this collection on mobile?',
			'answer'   => 'Yes. Category pages, product cards, and checkout flow are optimized for phone-first browsing and faster product discovery.',
		),
	);

	if ( 'bags' === $slug ) {
		return array(
			array(
				'question' => 'Is this the official UOOTD bags page?',
				'answer'   => 'Yes. This category is the main UOOTD bags landing page for shoppers searching UOOTD bags, UOOTD bag, and related bag collections.',
			),
			array(
				'question' => 'What types of bags can I find here?',
				'answer'   => 'The bags edit includes totes, shoulder bags, crossbody bags, wallets, and compact leather pieces selected for everyday styling and easier browsing.',
			),
			array(
				'question' => 'How do payment and delivery work for UOOTD bags?',
				'answer'   => 'Bags orders move through secure card checkout, then into tracked dispatch updates so shoppers can follow the order journey more clearly.',
			),
		);
	}

	return $default;
}

function uootd_storefront_branding_get_archive_seo_content_data() {
	$brand_name = uootd_storefront_branding_get_brand_name();

	if ( is_shop() ) {
		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			return array(
				'eyebrow' => 'Upholstery fabric shopping guide',
				'title'   => 'Shop upholstery, jacquard, and decorative fabric with a faster route into the right collection.',
				'copy'    => array(
					'The main shop brings together new arrivals, core fabric collections, and product pages built to compare pattern, texture, and brand-led style more quickly.',
					'Visitors landing on upholsteryfabric.net usually want the real catalog, clear fabric categories, and enough checkout reassurance to keep moving. This page is structured around that intent.',
				),
				'faq'     => uootd_storefront_branding_get_archive_faq_items(),
			);
		}

		return array(
			'eyebrow' => 'Official site shopping guide',
			'title'   => 'Shop the UOOTD official site with a clearer route into bags, jewelry, and accessories.',
			'copy'    => array(
				'The main UOOTD shop brings together new arrivals, core categories, and product pages built for faster decision-making on desktop and mobile.',
				'Visitors searching for the UOOTD official site, official website, or UOOTD shop usually want to confirm they are in the right place before moving into checkout. This page is structured to answer that intent quickly.',
			),
			'faq'     => uootd_storefront_branding_get_archive_faq_items(),
		);
	}

	if ( function_exists( 'is_product_category' ) && is_product_category() ) {
		$term = get_queried_object();
		$slug = $term && ! empty( $term->slug ) ? $term->slug : '';
		$name = $term && ! empty( $term->name ) ? $term->name : 'Collection';

		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			if ( 'all-fabrics' === $slug ) {
				return array(
					'eyebrow' => 'Fabric buying guide',
					'title'   => 'All Fabrics: upholstery, jacquard, chenille, and decorative yardage in one browse.',
					'copy'    => array(
						'All Fabrics brings together the widest mix of brand-inspired upholstery fabrics, jacquards, chenille, and decorative weaves in one category page.',
						'Shoppers looking for upholstery fabric by the yard usually want the full catalog first, then a faster path into the right brand-inspired collection. This page is built for that pattern of browsing.',
					),
					'faq'     => uootd_storefront_branding_get_archive_faq_items( 'all-fabrics' ),
				);
			}

			return array(
				'eyebrow' => 'Collection guide',
				'title'   => sprintf( 'Shop %s on %s.', $name, $brand_name ),
				'copy'    => array(
					sprintf( 'This %s collection keeps the fabric catalog focused so visitors can compare the right patterns and textures faster.', strtolower( wp_strip_all_tags( $name ) ) ),
					'The page combines collection context, product galleries, and checkout reassurance so search visitors can confirm fit and intent before clicking deeper.',
				),
				'faq'     => uootd_storefront_branding_get_archive_faq_items( $slug ),
			);
		}

		if ( 'bags' === $slug ) {
			return array(
				'eyebrow' => 'Bags buying guide',
				'title'   => 'UOOTD bags: totes, shoulder bags, crossbody styles, and compact leather pieces.',
				'copy'    => array(
					'UOOTD bags brings together structured totes, shoulder silhouettes, crossbody options, and compact leather goods in one focused category page.',
					'Shoppers searching for UOOTD bags, UOOTD bag, UOOTD bolsas, or UOOTD carteras are usually looking for the official storefront, clear product browsing, and enough checkout reassurance to keep moving. This page is designed for that exact intent.',
				),
				'faq'     => uootd_storefront_branding_get_archive_faq_items( 'bags' ),
			);
		}

		return array(
			'eyebrow' => 'Collection guide',
			'title'   => sprintf( 'Shop %s on the UOOTD official site.', $name ),
			'copy'    => array(
				sprintf( 'This %s category keeps the UOOTD catalog focused so shoppers can move into the right products faster.', strtolower( wp_strip_all_tags( $name ) ) ),
				'The page combines category context, product cards, and checkout reassurance so search visitors can confirm fit and intent before clicking deeper.',
			),
			'faq'     => uootd_storefront_branding_get_archive_faq_items( $slug ),
		);
	}

	return array();
}

function uootd_storefront_branding_get_seo_meta() {
	$meta = array(
		'title'       => '',
		'description' => '',
		'url'         => uootd_storefront_branding_get_current_url(),
		'og_type'     => 'website',
		'schema_type' => 'WebPage',
		'faq'         => array(),
	);

	if ( is_front_page() ) {
		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			$meta['title']       = 'UpholsteryFabric.net | Upholstery, Jacquard & Decorative Fabric by the Yard';
			$meta['description'] = 'Shop upholsteryfabric.net for designer-inspired upholstery fabric, jacquard fabric, and decorative fabric by the yard with secure checkout and tracked delivery.';
		} else {
			$meta['title']       = 'UOOTD Official Site | Bags, Jewelry & Accessories';
			$meta['description'] = 'UOOTD official site for curated bags, jewelry, and accessories with secure card checkout, tracked dispatch, and client services.';
		}
		$meta['url']         = home_url( '/' );
		$meta['faq']         = uootd_storefront_branding_get_home_faq_items();
		return $meta;
	}

	if ( function_exists( 'is_shop' ) && is_shop() ) {
		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			$meta['title']       = 'Shop UpholsteryFabric.net | Designer-Inspired Upholstery Fabric Catalog';
			$meta['description'] = 'Browse designer-inspired upholstery fabric, jacquard fabric, chenille, and decorative yardage on upholsteryfabric.net with secure checkout and tracked delivery.';
		} else {
			$meta['title']       = 'Shop UOOTD | Official Site for Bags, Jewelry & Accessories';
			$meta['description'] = 'Shop the UOOTD official site for bags, jewelry, and accessories. Browse new arrivals, secure card checkout, and tracked dispatch.';
		}
		$meta['url']         = wc_get_page_permalink( 'shop' );
		$meta['faq']         = uootd_storefront_branding_get_archive_faq_items();
		return $meta;
	}

	if ( function_exists( 'is_product_category' ) && is_product_category() ) {
		$term  = get_queried_object();
		$slug  = $term && ! empty( $term->slug ) ? $term->slug : '';
		$name  = $term && ! empty( $term->name ) ? wp_strip_all_tags( $term->name ) : 'Collection';
		$meta['url'] = $term && ! is_wp_error( $term ) ? get_term_link( $term ) : $meta['url'];
		$meta['faq'] = uootd_storefront_branding_get_archive_faq_items( $slug );
		$meta['schema_type'] = 'CollectionPage';

		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			$meta['title']       = sprintf( '%s | UpholsteryFabric.net', $name );
			$meta['description'] = sprintf( 'Shop %s on upholsteryfabric.net for designer-inspired upholstery fabric by the yard, with product galleries, secure checkout, and tracked delivery.', $name );
			return $meta;
		}

		if ( 'bags' === $slug ) {
			$meta['title']       = 'UOOTD Bags | Official Site Bags Edit';
			$meta['description'] = 'Shop UOOTD bags on the official site. Browse totes, shoulder bags, crossbody bags, and wallets with secure card checkout and tracked dispatch.';
			return $meta;
		}

		$meta['title']       = sprintf( '%s | UOOTD Official Site', $name );
		$meta['description'] = sprintf( 'Shop %s on the UOOTD official site with secure card checkout, tracked dispatch, and focused product discovery.', $name );
		return $meta;
	}

	$special_page = uootd_storefront_branding_get_special_page_slug();
	if ( $special_page ) {
		$special_meta = uootd_storefront_branding_get_special_page_meta( $special_page );
		if ( ! empty( $special_meta ) ) {
			return array_merge( $meta, $special_meta );
		}
	}

	if ( function_exists( 'is_product' ) && is_product() ) {
		global $product;

		if ( $product instanceof WC_Product ) {
			$brand_name = uootd_storefront_branding_get_brand_name();
			$source = $product->get_short_description();
			if ( '' === trim( wp_strip_all_tags( $source ) ) ) {
				$source = $product->get_description();
			}

			$meta['title']       = sprintf( '%s | %s', $product->get_name(), $brand_name );
			$meta['description'] = wp_trim_words( wp_strip_all_tags( $source ), 24, '' );
			$meta['url']         = $product->get_permalink();
			$meta['og_type']     = 'product';
			$meta['schema_type'] = 'Product';
		}

		return $meta;
	}

	if ( function_exists( 'is_account_page' ) && is_account_page() ) {
		$brand_name          = uootd_storefront_branding_get_brand_name();
		$support_title       = uootd_storefront_branding_get_support_team_title();
		$meta['title']       = sprintf( '%s %s | Orders, Tracking & Account', $brand_name, $support_title );
		$meta['description'] = sprintf( 'Manage orders, saved addresses, and account details from the %s %s area.', $brand_name, strtolower( $support_title ) );
		return $meta;
	}

	return $meta;
}

function uootd_storefront_branding_render_structured_data() {
	if ( is_admin() ) {
		return;
	}

	$meta  = uootd_storefront_branding_get_seo_meta();
	$graph = array();
	$logo  = '';
	$brand_name = uootd_storefront_branding_get_brand_name();
	$logo_id = (int) get_theme_mod( 'custom_logo' );

	if ( $logo_id ) {
		$logo = wp_get_attachment_image_url( $logo_id, 'full' );
	}

	if ( is_front_page() ) {
		$graph[] = array(
			'@type'       => 'Organization',
			'name'        => $brand_name,
			'url'         => home_url( '/' ),
			'logo'        => $logo,
			'description' => $meta['description'],
		);
		$graph[] = array(
			'@type'       => 'WebSite',
			'name'        => $brand_name,
			'url'         => home_url( '/' ),
			'description' => $meta['description'],
		);
	}

	if ( ! empty( $meta['title'] ) ) {
		$graph[] = array(
			'@type'       => $meta['schema_type'],
			'name'        => $meta['title'],
			'url'         => $meta['url'],
			'description' => $meta['description'],
		);
	}

	if ( ! empty( $meta['faq'] ) ) {
		$graph[] = array(
			'@type'      => 'FAQPage',
			'mainEntity' => array_map(
				static function ( $faq ) {
					return array(
						'@type'          => 'Question',
						'name'           => $faq['question'],
						'acceptedAnswer' => array(
							'@type' => 'Answer',
							'text'  => $faq['answer'],
						),
					);
				},
				$meta['faq']
			),
		);
	}

	if ( empty( $graph ) ) {
		return;
	}

	printf(
		"<script type=\"application/ld+json\">%s</script>\n",
		wp_json_encode(
			array(
				'@context' => 'https://schema.org',
				'@graph'   => $graph,
			),
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
		)
	);
}

function uootd_storefront_branding_render_archive_seo_content() {
	if ( ! ( is_shop() || is_product_taxonomy() ) || is_search() ) {
		return;
	}

	$data = uootd_storefront_branding_get_archive_seo_content_data();

	if ( empty( $data['title'] ) ) {
		return;
	}
	?>
	<section class="uootd-archive-seo" aria-label="<?php echo esc_attr( $data['title'] ); ?>">
		<div class="uootd-archive-seo__intro">
			<p><?php echo esc_html( $data['eyebrow'] ); ?></p>
			<h2><?php echo esc_html( $data['title'] ); ?></h2>
			<?php foreach ( $data['copy'] as $paragraph ) : ?>
				<p><?php echo esc_html( $paragraph ); ?></p>
			<?php endforeach; ?>
		</div>
		<div class="uootd-archive-seo__faq">
			<?php foreach ( $data['faq'] as $faq ) : ?>
				<details>
					<summary><?php echo esc_html( $faq['question'] ); ?></summary>
					<p><?php echo esc_html( $faq['answer'] ); ?></p>
				</details>
			<?php endforeach; ?>
		</div>
	</section>
	<?php
}

function uootd_storefront_branding_render_archive_hero() {
	if ( ! ( is_shop() || is_product_taxonomy() ) || is_search() ) {
		return;
	}

	$copy        = uootd_storefront_branding_get_archive_copy();
	$primary_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
	$stats       = uootd_storefront_branding_get_archive_stats();
	$chips       = uootd_storefront_branding_get_archive_chips();
	?>
	<section class="uootd-shop-hero" aria-label="<?php echo esc_attr( $copy['title'] ); ?>">
		<div class="uootd-shop-hero__copy">
			<p class="uootd-shop-hero__eyebrow"><?php echo esc_html( $copy['eyebrow'] ); ?></p>
			<h1 class="uootd-shop-hero__title"><?php echo esc_html( $copy['title'] ); ?></h1>
			<p class="uootd-shop-hero__description"><?php echo esc_html( $copy['description'] ); ?></p>
			<div class="uootd-shop-hero__actions">
				<a class="uootd-shop-hero__link" href="<?php echo esc_url( $primary_url ); ?>">View the full edit</a>
				<span class="uootd-shop-hero__meta">Secure card checkout and tracked dispatch</span>
			</div>
			<div class="uootd-shop-hero__chips">
				<?php foreach ( $chips as $chip ) : ?>
					<a href="<?php echo esc_url( $chip['url'] ); ?>"><?php echo esc_html( $chip['label'] ); ?></a>
				<?php endforeach; ?>
			</div>
		</div>
		<div class="uootd-shop-hero__stats" aria-hidden="true">
			<?php foreach ( $stats as $stat ) : ?>
				<div>
					<strong><?php echo esc_html( $stat['value'] ); ?></strong>
					<span><?php echo esc_html( $stat['label'] ); ?></span>
				</div>
			<?php endforeach; ?>
		</div>
	</section>
	<?php
}

function uootd_storefront_branding_get_archive_copy() {
	if ( is_shop() ) {
		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			return array(
				'eyebrow'     => uootd_storefront_branding_get_brand_edit_label(),
				'title'       => 'Designer-inspired upholstery and jacquard fabrics by the yard.',
				'description' => 'Browse the full catalog or jump straight into brand-inspired upholstery, jacquard, chenille, and decorative fabric collections.',
			);
		}

		return array(
			'eyebrow'     => uootd_storefront_branding_get_brand_edit_label(),
			'title'       => 'Curated bags, jewelry, and finishing pieces that feel considered.',
			'description' => 'Move through the full edit or jump straight into signature categories. Each piece is selected to feel polished, wearable, and easy to style.',
		);
	}

	$term = get_queried_object();
	$slug = $term && ! empty( $term->slug ) ? $term->slug : '';
	$name = $term && ! empty( $term->name ) ? $term->name : 'Collection';

	if ( uootd_storefront_branding_is_fabric_catalog() ) {
		$map = array(
			'all-fabrics'        => 'The broadest browse across designer-inspired upholstery, jacquard, chenille, and decorative fabrics sold by the yard.',
			'new-arrivals'       => 'The newest fabric arrivals, refreshed with fresh patterns, finishes, and colorways for upholstery and DIY work.',
			'gucci-fabric'       => 'Gucci-inspired jacquard and woven upholstery fabrics with monogram-led texture and decorative contrast.',
			'lv-fabric'          => 'Louis Vuitton-inspired upholstery fabrics with recognizable woven motifs, layered color, and by-the-yard ordering.',
			'dior-fabric'        => 'Dior-inspired decorative fabrics with crisp monogram structure and upholstery-ready surfaces.',
			'fendi-fabric'       => 'Fendi-inspired jacquard fabrics with stronger contrast, dense pattern, and decorative upholstery appeal.',
			'other-logo-fabrics' => 'A wider mix of brand-inspired upholstery fabrics, decorative weaves, and harder-to-place patterned yardage.',
			'jacquard-fabric'    => 'Texture-led jacquard and brocade options chosen for upholstery, bags, pillows, and custom soft-goods projects.',
			'accessories'        => 'Small extras and related add-ons kept close to the main fabric browse.',
		);

		return array(
			'eyebrow'     => 'Fabric Collection',
			'title'       => $name,
			'description' => isset( $map[ $slug ] ) ? $map[ $slug ] : 'A focused section of the fabric catalog, built to make pattern, texture, and brand-led browsing easier.',
		);
	}

	$map = array(
		'bags'            => 'A focused mix of totes, shoulder bags, crossbody pieces, and statement silhouettes.',
		'jewelry'         => 'Layerable rings, bracelets, necklaces, and standout accents designed to finish a look cleanly.',
		'accessories'     => 'Wallets, belts, and compact extras that add texture and polish without overworking the outfit.',
		'tote-bags'       => 'Structured and easy-carry silhouettes chosen for everyday rotation and polished travel days.',
		'crossbody-bags'  => 'Hands-free shapes with strong lines, compact proportions, and easy day-to-evening styling.',
		'shoulder-bags'   => 'Elevated shoulder shapes that sit cleanly with tailoring, denim, or layered neutral looks.',
		'rings'           => 'Statement rings and clean stackers that bring depth and shine without clutter.',
		'necklaces'       => 'Finishing chains and pendants designed to layer into everyday wardrobes with ease.',
		'wallets'         => 'Compact essentials that keep the edit polished, practical, and travel-ready.',
	);

	return array(
		'eyebrow'     => 'Curated Collection',
		'title'       => $name,
		'description' => isset( $map[ $slug ] ) ? $map[ $slug ] : 'A curated section of the ' . strtolower( uootd_storefront_branding_get_brand_edit_label() ) . ', selected to keep the collection focused and easy to shop.',
	);
}

function uootd_storefront_branding_get_live_product_count() {
	$product_count = wp_count_posts( 'product' );

	return isset( $product_count->publish ) ? (int) $product_count->publish : 0;
}

function uootd_storefront_branding_get_fabric_brand_count() {
	if ( ! uootd_storefront_branding_is_fabric_catalog() || ! function_exists( 'uootd_storefront_branding_get_designer_catalog' ) ) {
		return 0;
	}

	$catalog = uootd_storefront_branding_get_designer_catalog();

	return is_array( $catalog ) ? count( $catalog ) : 0;
}

function uootd_storefront_branding_get_archive_stats() {
	if ( is_shop() ) {
		if ( uootd_storefront_branding_is_fabric_catalog() ) {
			return array(
				array(
					'value' => number_format_i18n( uootd_storefront_branding_get_live_product_count() ),
					'label' => uootd_storefront_branding_get_product_unit_label( 2 ) . ' live now',
				),
				array(
					'value' => number_format_i18n( max( 1, uootd_storefront_branding_get_fabric_brand_count() ) ),
					'label' => 'brand-led routes',
				),
				array(
					'value' => 'By yard',
					'label' => 'ordering kept clear',
				),
			);
		}

		return array(
			array(
				'value' => number_format_i18n( uootd_storefront_branding_get_live_product_count() ),
				'label' => 'pieces live now',
			),
			array(
				'value' => '3',
				'label' => 'core departments',
			),
			array(
				'value' => '24/7',
				'label' => 'secure checkout flow',
			),
		);
	}

	$term = get_queried_object();
	if ( ! $term || empty( $term->term_id ) ) {
		return array(
			array(
				'value' => number_format_i18n( uootd_storefront_branding_get_live_product_count() ),
				'label' => uootd_storefront_branding_get_product_unit_label( 2 ) . ' live now',
			),
			array(
				'value' => '3',
				'label' => 'core departments',
			),
			array(
				'value' => '24/7',
				'label' => 'secure checkout flow',
			),
		);
	}

	$child_terms = get_terms(
		array(
			'taxonomy'   => 'product_cat',
			'parent'     => (int) $term->term_id,
			'hide_empty' => true,
			'fields'     => 'ids',
		)
	);

	if ( is_wp_error( $child_terms ) ) {
		$child_terms = array();
	}

	$related_count = count( $child_terms );
	$related_label = 'related edits';
	$related_value = $related_count;

	if ( 0 === $related_count ) {
		$sibling_terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'parent'     => (int) $term->parent,
				'hide_empty' => true,
				'fields'     => 'ids',
			)
		);

		if ( is_wp_error( $sibling_terms ) ) {
			$sibling_terms = array();
		}

		$related_value = max( 1, count( $sibling_terms ) - 1 );
		$related_label = 1 === $related_value ? 'adjacent edit' : 'adjacent edits';
	}

	return array(
		array(
			'value' => number_format_i18n( isset( $term->count ) ? (int) $term->count : 0 ),
			'label' => uootd_storefront_branding_is_fabric_catalog() ? uootd_storefront_branding_get_product_unit_label( 2 ) . ' in this collection' : 'pieces in this edit',
		),
		array(
			'value' => number_format_i18n( $related_value ),
			'label' => uootd_storefront_branding_is_fabric_catalog() ? str_replace( 'edit', 'collection', $related_label ) : $related_label,
		),
		array(
			'value' => '24/7',
			'label' => 'secure checkout flow',
		),
	);
}

function uootd_storefront_branding_get_archive_chips() {
	$slugs = uootd_storefront_branding_get_category_slug_list(
		'archive_chip_slugs',
		uootd_storefront_branding_is_fabric_catalog()
			? array( 'all-fabrics', 'gucci-fabric', 'lv-fabric', 'dior-fabric', 'fendi-fabric', 'jacquard-fabric' )
			: array( 'bags', 'jewelry', 'accessories', 'tote-bags', 'crossbody-bags', 'rings' )
	);
	$chips = array();

	foreach ( $slugs as $slug ) {
		$term = get_term_by( 'slug', $slug, 'product_cat' );
		if ( ! $term || is_wp_error( $term ) ) {
			continue;
		}

		$chips[] = array(
			'label' => sprintf( '%s (%s)', $term->name, number_format_i18n( (int) $term->count ) ),
			'url'   => get_term_link( $term ),
		);
	}

	return array_slice( $chips, 0, 6 );
}

function uootd_storefront_branding_get_generated_asset_url( $relative_path, $fallback = '' ) {
	if ( '' === $relative_path ) {
		return $fallback;
	}

	$uploads = wp_get_upload_dir();
	if ( empty( $uploads['basedir'] ) || empty( $uploads['baseurl'] ) ) {
		return $fallback;
	}

	$relative_path = ltrim( $relative_path, '/\\' );
	$file_path     = trailingslashit( $uploads['basedir'] ) . str_replace( array( '\\', '/' ), DIRECTORY_SEPARATOR, $relative_path );

	if ( file_exists( $file_path ) ) {
		return trailingslashit( $uploads['baseurl'] ) . str_replace( '\\', '/', $relative_path );
	}

	return $fallback;
}

function uootd_storefront_branding_get_home_category_cards() {
	$cards = array();
	$copy  = uootd_storefront_branding_get_shell_setting_value( 'home_category_cards', uootd_storefront_branding_get_home_category_defaults() );

	if ( ! is_array( $copy ) || empty( $copy ) ) {
		$copy = uootd_storefront_branding_get_home_category_defaults();
	}

	foreach ( array_keys( $copy ) as $slug ) {
		$term = get_term_by( 'slug', $slug, 'product_cat' );
		if ( ! $term || is_wp_error( $term ) ) {
			continue;
		}

		$image      = '';
		$image_full = '';
		$items      = wc_get_products(
			array(
				'status'   => 'publish',
				'limit'    => 1,
				'category' => array( $slug ),
				'orderby'  => 'date',
				'order'    => 'DESC',
			)
		);

		if ( ! empty( $items ) ) {
			$image      = wp_get_attachment_image_url( $items[0]->get_image_id(), 'woocommerce_thumbnail' );
			$image_full = wp_get_attachment_image_url( $items[0]->get_image_id(), 'full' );
		}

		$generated_image = '';

		if ( uootd_storefront_branding_use_generated_editorial_assets() && ! empty( $copy[ $slug ]['generated_asset'] ) ) {
			$generated_image = uootd_storefront_branding_get_generated_asset_url(
				uootd_storefront_branding_get_generated_asset_relative_path( $copy[ $slug ]['generated_asset'] )
			);
		}

		if ( $generated_image ) {
			$image      = $generated_image;
			$image_full = $generated_image;
		}

		$cards[] = array(
			'slug'        => $slug,
			'label'       => $copy[ $slug ]['label'],
			'eyebrow'     => $copy[ $slug ]['eyebrow'],
			'description' => $copy[ $slug ]['description'],
			'action'      => isset( $copy[ $slug ]['action'] ) ? $copy[ $slug ]['action'] : 'Shop the collection',
			'count_label' => sprintf( '%s %s', number_format_i18n( (int) $term->count ), uootd_storefront_branding_get_product_unit_label( (int) $term->count ) ),
			'url'         => get_term_link( $term ),
			'image'       => $image,
			'image_full'  => $image_full,
		);
	}

	return $cards;
}

function uootd_storefront_branding_get_product_brand( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return 'Curated piece';
	}

	return strtoupper( uootd_storefront_branding_extract_brand_from_name( $product->get_name() ) );
}

function uootd_storefront_branding_get_product_display_name( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return '';
	}

	$name  = trim( preg_replace( '/\s+/', ' ', $product->get_name() ) );
	$brand = uootd_storefront_branding_get_product_brand( $product );

	if ( $brand && 0 === stripos( $name, $brand . ' ' ) ) {
		$name = trim( substr( $name, strlen( $brand ) ) );
	}

	return wp_trim_words( $name, 8, '' );
}

function uootd_storefront_branding_render_home_product_card( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return '';
	}

	$image       = wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' );
	$price       = $product->get_price_html();
	$permalink   = $product->get_permalink();
	$brand_label = uootd_storefront_branding_get_product_brand( $product );
	$title_label = uootd_storefront_branding_get_product_display_name( $product );

	ob_start();
	?>
	<article class="uootd-home-product-card">
		<a class="uootd-home-product-card__image" href="<?php echo esc_url( $permalink ); ?>">
			<?php if ( $image ) : ?>
				<img src="<?php echo esc_url( $image ); ?>" alt="<?php echo esc_attr( $product->get_name() ); ?>" loading="lazy" />
			<?php endif; ?>
		</a>
		<div class="uootd-home-product-card__copy">
			<p><?php echo esc_html( $brand_label ); ?></p>
			<h3><a href="<?php echo esc_url( $permalink ); ?>"><?php echo esc_html( $title_label ); ?></a></h3>
			<span class="uootd-home-product-card__price"><?php echo wp_kses_post( $price ); ?></span>
		</div>
	</article>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_service_ribbons() {
	$messages = uootd_storefront_branding_get_service_messages();
	?>
	<div class="uootd-service-ribbons" aria-hidden="true">
		<?php foreach ( $messages as $message ) : ?>
			<p><?php echo esc_html( $message ); ?></p>
		<?php endforeach; ?>
	</div>
	<?php
}

function uootd_storefront_branding_render_product_eyebrow() {
	if ( ! is_product() ) {
		return;
	}

	$terms = get_the_terms( get_the_ID(), 'product_cat' );
	if ( empty( $terms ) || is_wp_error( $terms ) ) {
		return;
	}

	$primary = reset( $terms );
	?>
	<p class="uootd-product-eyebrow"><?php echo esc_html( $primary->name ); ?> edit</p>
	<?php
}

function uootd_storefront_branding_render_product_support() {
	if ( ! is_product() ) {
		return;
	}
	?>
	<section class="uootd-product-support" aria-label="Purchase support">
		<div>
			<strong><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Price kept per yard' : 'Secure card checkout' ); ?></strong>
			<span><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Product pages and checkout keep the imported pricing structure aligned, so there is less friction between browse, cart, and payment.' : 'Hosted payment page with order confirmation and a clean redirect flow.' ); ?></span>
		</div>
		<div>
			<strong><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Continuous cuts when possible' : 'Tracked dispatch' ); ?></strong>
			<span><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Multiple quantities are intended to stay in one continuous piece when stock allows, which is easier for upholstery, cushions, and custom projects.' : 'Orders move through a secure handoff with tracking once your payment is confirmed.' ); ?></span>
		</div>
		<div>
			<strong><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Fabric support' : 'Concierge help' ); ?></strong>
			<span><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Need help confirming width, weight, texture, or upholstery suitability? Contact Fabric Support before checkout so the order feels lower risk.' : 'Need help confirming size or finish? Leave a note at checkout and we review it before dispatch.' ); ?></span>
		</div>
	</section>
	<?php
}

function uootd_storefront_branding_format_fabric_description( $description ) {
	$normalized = preg_replace( '/<br\s*\/?>/i', "\n", (string) $description );
	$normalized = html_entity_decode( wp_strip_all_tags( $normalized ), ENT_QUOTES, get_bloginfo( 'charset' ) );
	$lines      = preg_split( '/\r\n|\r|\n/', $normalized );
	$intro      = array();
	$details    = array();
	$notes      = array();

	foreach ( (array) $lines as $line ) {
		$line = trim( preg_replace( '/\s+/', ' ', (string) $line ) );
		$line = trim( $line, " \t\n\r\0\x0B+=" );
		$line = preg_replace( '/^(?:\x{1F449}|\x{2764}\x{FE0F})\s*/u', '', $line );

		if ( '' === $line || false !== stripos( $line, 'detail' ) ) {
			continue;
		}

		if ( false !== strpos( $line, ':' ) ) {
			list( $label, $value ) = array_map( 'trim', explode( ':', $line, 2 ) );
			$label = ucwords( strtolower( $label ) );
			$line  = '' !== $value ? $label . ': ' . $value : $label;
		}

		if ( preg_match( '/^(Material|Width|Weight|Care)\b/i', $line ) ) {
			$details[] = $line;
			continue;
		}

		if ( preg_match( '/^(Price per Yard|Qty\s*\d+|Multiple quantities|Colors may look)/i', $line ) ) {
			$notes[] = $line;
			continue;
		}

		$intro[] = $line;
	}

	if ( empty( $intro ) && empty( $details ) && empty( $notes ) ) {
		return '';
	}

	ob_start();
	?>
	<div class="uootd-product-summary-copy">
		<?php foreach ( array_slice( $intro, 0, 2 ) as $paragraph ) : ?>
			<p><?php echo esc_html( $paragraph ); ?></p>
		<?php endforeach; ?>
		<?php if ( ! empty( $details ) ) : ?>
			<div class="uootd-product-summary-copy__group">
				<strong>Fabric details</strong>
				<ul>
					<?php foreach ( $details as $detail ) : ?>
						<li><?php echo esc_html( $detail ); ?></li>
					<?php endforeach; ?>
				</ul>
			</div>
		<?php endif; ?>
		<?php if ( ! empty( $notes ) ) : ?>
			<div class="uootd-product-summary-copy__group">
				<strong>Ordering notes</strong>
				<ul>
					<?php foreach ( $notes as $note ) : ?>
						<li><?php echo esc_html( $note ); ?></li>
					<?php endforeach; ?>
				</ul>
			</div>
		<?php endif; ?>
	</div>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_format_short_description( $description ) {
	if ( is_admin() || ! is_product() ) {
		return $description;
	}

	if ( uootd_storefront_branding_is_fabric_catalog() ) {
		$formatted_fabric_description = uootd_storefront_branding_format_fabric_description( $description );

		if ( '' !== $formatted_fabric_description ) {
			return $formatted_fabric_description;
		}
	}

	$plain = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $description ) ) );
	if ( '' === $plain ) {
		return $description;
	}

	$formatted = esc_html( $plain );
	$labels    = array(
		'Overview:'            => '<strong>Overview</strong><br>',
		'Key details:'         => '<strong>Key details</strong><br>',
		'Size &amp; dimensions:' => '<strong>Size &amp; dimensions</strong><br>',
		'Materials:'           => '<strong>Materials</strong><br>',
		'Shipping &amp; returns:' => '<strong>Shipping &amp; returns</strong><br>',
	);

	foreach ( $labels as $label => $replacement ) {
		$formatted = str_replace( $label, $replacement, $formatted );
	}

	$formatted = preg_replace( '/\.\s*(<strong>)/', '.<br><br>$1', $formatted );

	return '<div class="uootd-product-summary-copy">' . wp_kses_post( $formatted ) . '</div>';
}

function uootd_storefront_branding_render_account_hero() {
	ob_start();
	?>
	<section class="uootd-account-hero" aria-label="Client services">
		<div class="uootd-account-hero__copy">
			<p class="uootd-account-hero__eyebrow"><?php echo esc_html( uootd_storefront_branding_get_support_team_title() ); ?></p>
			<h1 class="uootd-account-hero__title">Everything you need after checkout, in one place.</h1>
			<p class="uootd-account-hero__description">Review orders, update saved addresses, and return to your secure account details without digging through emails.</p>
		</div>
		<div class="uootd-account-hero__note">
			<span>Secure order history</span>
			<span>Saved delivery details</span>
			<span>Easy re-entry to the edit</span>
		</div>
	</section>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_footer() {
	$shop_url      = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
	$account_url   = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/my-account/' );
	$cart_url      = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' );
	$checkout_url  = function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' );
	$new_in_url    = uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' );
	$designers_url = uootd_storefront_branding_get_page_url( 'designers', '/designers/' );
	$care_url      = uootd_storefront_branding_get_page_url( 'customer-care', '/customer-care/' );
	$delivery_url  = uootd_storefront_branding_get_page_url( 'delivery', '/delivery/' );
	$payment_url   = uootd_storefront_branding_get_page_url( 'payment', '/payment/' );
	$returns_url   = uootd_storefront_branding_get_page_url( 'exchanges-returns', '/exchanges-returns/' );
	$wishlist_url  = uootd_storefront_branding_get_page_url( 'wishlist', '/wishlist/' );
	$rewards_url   = uootd_storefront_branding_get_page_url( 'rewards', '/rewards/' );
	$is_fabric_site = uootd_storefront_branding_is_fabric_catalog();
	$category_urls = array();
	$category_slugs = uootd_storefront_branding_get_category_slug_list(
		'footer_category_slugs',
		$is_fabric_site
			? array( 'all-fabrics', 'gucci-fabric', 'lv-fabric', 'dior-fabric', 'fendi-fabric', 'jacquard-fabric' )
			: array( 'bags', 'jewelry', 'accessories' )
	);

	foreach ( $category_slugs as $slug ) {
		$term = get_term_by( 'slug', $slug, 'product_cat' );
		if ( $term && ! is_wp_error( $term ) ) {
			$category_urls[ $term->name ] = get_term_link( $term );
		}
	}
	?>
	<div class="uootd-site-footer">
		<div class="uootd-site-footer__signup">
			<p class="uootd-site-footer__eyebrow"><?php echo esc_html( uootd_storefront_branding_get_brand_wordmark() ); ?></p>
			<h2><?php echo esc_html( uootd_storefront_branding_get_footer_heading() ); ?></h2>
			<p><?php echo esc_html( uootd_storefront_branding_get_footer_description() ); ?></p>
			<div class="uootd-site-footer__signup-actions">
				<a href="<?php echo esc_url( $new_in_url ); ?>"><?php echo esc_html( $is_fabric_site ? 'Shop New Arrivals' : 'Shop New In' ); ?></a>
				<a href="<?php echo esc_url( $is_fabric_site ? $care_url : $account_url ); ?>"><?php echo esc_html( uootd_storefront_branding_get_support_team_title() ); ?></a>
			</div>
		</div>
		<div class="uootd-site-footer__columns">
			<div>
				<p><?php echo esc_html( uootd_storefront_branding_get_support_team_title() ); ?></p>
				<a href="<?php echo esc_url( $care_url ); ?>"><?php echo esc_html( uootd_storefront_branding_get_support_team_title() ); ?></a>
				<?php if ( $is_fabric_site ) : ?>
					<a href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'contact-us', '/contact-us/' ) ); ?>">Contact us</a>
				<?php endif; ?>
				<a href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'track-order', '/track-order/' ) ); ?>">Track your order</a>
				<a href="<?php echo esc_url( $payment_url ); ?>">Payment</a>
				<a href="<?php echo esc_url( $returns_url ); ?>">Returns</a>
			</div>
			<div>
				<p>Shop</p>
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>">Home</a>
				<a href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ) ); ?>"><?php echo esc_html( $is_fabric_site ? 'New Arrivals' : 'New In' ); ?></a>
				<a href="<?php echo esc_url( $is_fabric_site ? $shop_url : $designers_url ); ?>"><?php echo esc_html( $is_fabric_site ? 'All Fabrics' : 'Designers' ); ?></a>
				<?php if ( $is_fabric_site ) : ?>
					<a href="<?php echo esc_url( $designers_url ); ?>">Brands</a>
				<?php endif; ?>
				<?php foreach ( $category_urls as $label => $url ) : ?>
					<a href="<?php echo esc_url( $url ); ?>"><?php echo esc_html( $label ); ?></a>
				<?php endforeach; ?>
			</div>
			<div>
				<p><?php echo esc_html( $is_fabric_site ? 'Ordering help' : 'Why shop with us' ); ?></p>
				<?php if ( $is_fabric_site ) : ?>
					<a href="<?php echo esc_url( $shop_url ); ?>">Buy by the yard</a>
					<a href="<?php echo esc_url( $checkout_url ); ?>">Secure card checkout</a>
					<a href="<?php echo esc_url( $delivery_url ); ?>">Tracked delivery</a>
					<a href="<?php echo esc_url( $care_url ); ?>">Ask before checkout</a>
				<?php else : ?>
					<a href="<?php echo esc_url( $checkout_url ); ?>">Secure card checkout</a>
					<a href="<?php echo esc_url( $wishlist_url ); ?>">Wish list</a>
					<a href="<?php echo esc_url( $rewards_url ); ?>">Rewards</a>
					<a href="<?php echo esc_url( $delivery_url ); ?>">Tracked delivery</a>
				<?php endif; ?>
			</div>
		</div>
		<div class="uootd-site-footer__meta">
			<span>Secure card checkout</span>
			<span>Tracked dispatch</span>
			<span><?php echo esc_html( $is_fabric_site ? 'Fabric support before checkout' : 'Client account support' ); ?></span>
		</div>
	</div>
	<?php
}
