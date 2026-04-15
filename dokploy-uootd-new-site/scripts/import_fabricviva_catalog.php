<?php

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

set_time_limit( 0 );
wp_defer_term_counting( true );
wp_defer_comment_counting( true );

function fabricviva_log( string $message ): void {
	WP_CLI::log( $message );
}

function fabricviva_read_catalog( string $path ): array {
	if ( ! file_exists( $path ) ) {
		WP_CLI::error( "Catalog snapshot not found: {$path}" );
	}

	$data = json_decode( (string) file_get_contents( $path ), true );

	if ( ! is_array( $data ) || empty( $data['products'] ) ) {
		WP_CLI::error( 'Catalog snapshot is empty or invalid.' );
	}

	return $data;
}

function fabricviva_ensure_product_categories( array $category_map ): array {
	$term_ids = array();

	foreach ( $category_map as $slug => $config ) {
		$parent_id = 0;

		if ( ! empty( $config['parent'] ) && isset( $term_ids[ $config['parent'] ] ) ) {
			$parent_id = (int) $term_ids[ $config['parent'] ];
		}

		$existing = get_term_by( 'slug', $slug, 'product_cat' );

		if ( $existing instanceof WP_Term ) {
			$term_ids[ $slug ] = (int) $existing->term_id;

			wp_update_term(
				$existing->term_id,
				'product_cat',
				array(
					'name'   => $config['name'],
					'parent' => $parent_id,
				)
			);
			continue;
		}

		$created = wp_insert_term(
			$config['name'],
			'product_cat',
			array(
				'slug'   => $slug,
				'parent' => $parent_id,
			)
		);

		if ( is_wp_error( $created ) ) {
			WP_CLI::warning( sprintf( 'Could not create category %s: %s', $slug, $created->get_error_message() ) );
			continue;
		}

		$term_ids[ $slug ] = (int) $created['term_id'];
	}

	return $term_ids;
}

function fabricviva_find_product_id( array $source_product ): int {
	$ids = get_posts(
		array(
			'post_type'      => 'product',
			'post_status'    => array( 'publish', 'draft', 'pending', 'private' ),
			'fields'         => 'ids',
			'posts_per_page' => 1,
			'meta_key'       => '_fabricviva_source_product_id',
			'meta_value'     => (string) $source_product['id'],
		)
	);

	if ( ! empty( $ids ) ) {
		return (int) $ids[0];
	}

	$existing = get_page_by_path( $source_product['handle'], OBJECT, 'product' );

	return $existing instanceof WP_Post ? (int) $existing->ID : 0;
}

function fabricviva_is_variable_product( array $source_product ): bool {
	if ( count( $source_product['variants'] ) > 1 ) {
		return true;
	}

	foreach ( $source_product['options'] as $option ) {
		if ( empty( $option['values'] ) ) {
			continue;
		}

		if ( 1 === count( $option['values'] ) && 'Default Title' === $option['values'][0] ) {
			continue;
		}

		return true;
	}

	return false;
}

function fabricviva_get_category_ids_for_product( array $source_product, array $term_ids ): array {
	$category_ids = array();

	foreach ( $source_product['collections'] as $collection_slug ) {
		if ( isset( $term_ids[ $collection_slug ] ) ) {
			$category_ids[] = (int) $term_ids[ $collection_slug ];
		}
	}

	return array_values( array_unique( array_filter( $category_ids ) ) );
}

function fabricviva_find_attachment_id_by_source_url( string $image_url ): int {
	$attachments = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'fields'         => 'ids',
			'posts_per_page' => 1,
			'meta_key'       => '_fabricviva_source_image_url',
			'meta_value'     => $image_url,
		)
	);

	return empty( $attachments ) ? 0 : (int) $attachments[0];
}

function fabricviva_import_image( string $image_url, int $product_id, string $alt_text ): int {
	$attachment_id = fabricviva_find_attachment_id_by_source_url( $image_url );

	if ( $attachment_id > 0 ) {
		return $attachment_id;
	}

	$attachment_id = media_sideload_image( $image_url, $product_id, null, 'id' );

	if ( is_wp_error( $attachment_id ) ) {
		WP_CLI::warning( sprintf( 'Image import failed for %s: %s', $image_url, $attachment_id->get_error_message() ) );
		return 0;
	}

	update_post_meta( $attachment_id, '_fabricviva_source_image_url', $image_url );

	if ( '' !== $alt_text ) {
		update_post_meta( $attachment_id, '_wp_attachment_image_alt', sanitize_text_field( $alt_text ) );
	}

	return (int) $attachment_id;
}

function fabricviva_prepare_gallery( array $source_product, int $product_id ): array {
	$attachment_ids = array();

	foreach ( $source_product['images'] as $image ) {
		$attachment_id = fabricviva_import_image(
			(string) $image['src'],
			$product_id,
			(string) ( $image['alt'] ?? $source_product['title'] )
		);

		if ( $attachment_id > 0 ) {
			$attachment_ids[] = $attachment_id;
		}
	}

	return array_values( array_unique( $attachment_ids ) );
}

function fabricviva_prepare_product_object( int $product_id, bool $is_variable ): WC_Product {
	if ( $product_id > 0 ) {
		if ( $is_variable ) {
			wp_set_object_terms( $product_id, 'variable', 'product_type' );
			return new WC_Product_Variable( $product_id );
		}

		wp_set_object_terms( $product_id, 'simple', 'product_type' );
		return new WC_Product_Simple( $product_id );
	}

	return $is_variable ? new WC_Product_Variable() : new WC_Product_Simple();
}

function fabricviva_apply_common_product_fields( WC_Product $product, array $source_product, array $category_ids ): void {
	$product->set_name( $source_product['title'] );
	$product->set_slug( $source_product['handle'] );
	$product->set_status( 'active' === $source_product['status'] ? 'publish' : 'draft' );
	$product->set_catalog_visibility( 'visible' );
	$product->set_description( wp_kses_post( $source_product['body_html'] ) );
	$product->set_short_description( '' );
	$product->set_category_ids( $category_ids );
	$product->set_featured( in_array( 'frontpage', $source_product['collections'], true ) );
	$product->set_manage_stock( false );
	$product->set_stock_status( 'instock' );
	$product->update_meta_data( '_fabricviva_source_product_id', (string) $source_product['id'] );
	$product->update_meta_data( '_fabricviva_source_handle', (string) $source_product['handle'] );
	$product->update_meta_data( '_fabricviva_source_url', (string) $source_product['source_url'] );
	$product->update_meta_data( '_fabricviva_source_collections', wp_json_encode( $source_product['collections'] ) );
}

function fabricviva_apply_simple_product_fields( WC_Product_Simple $product, array $source_product ): void {
	$variant = $source_product['variants'][0] ?? null;

	if ( ! is_array( $variant ) ) {
		return;
	}

	$regular_price = (string) ( $variant['price'] ?? '' );
	$sale_price    = (string) ( $variant['compare_at_price'] ?? '' );

	$product->set_regular_price( $regular_price );

	if ( '' !== $sale_price && (float) $sale_price > (float) $regular_price ) {
		$product->set_sale_price( $regular_price );
		$product->set_regular_price( $sale_price );
	}

	$product->set_sku( '' !== $variant['sku'] ? $variant['sku'] : 'fabricviva-' . $source_product['id'] );
	$product->update_meta_data( '_fabricviva_source_variant_id', (string) $variant['id'] );
}

function fabricviva_build_variable_attributes( WC_Product_Variable $product, array $source_product ): array {
	$attributes           = array();
	$variation_key_lookup = array();

	foreach ( $source_product['options'] as $index => $option ) {
		$values = array_values(
			array_filter(
				array_unique(
					array_map(
						static function ( $value ) {
							return trim( (string) $value );
						},
						(array) ( $option['values'] ?? array() )
					)
				)
			)
		);

		if ( empty( $values ) ) {
			continue;
		}

		if ( 1 === count( $values ) && 'Default Title' === $values[0] ) {
			continue;
		}

		$attribute_name = (string) $option['name'];
		$attribute_slug = sanitize_title( $attribute_name );

		$attribute = new WC_Product_Attribute();
		$attribute->set_id( 0 );
		$attribute->set_name( $attribute_name );
		$attribute->set_options( $values );
		$attribute->set_position( $index );
		$attribute->set_visible( true );
		$attribute->set_variation( true );

		$attributes[]                    = $attribute;
		$variation_key_lookup[ $index ] = $attribute_slug;
	}

	$product->set_attributes( $attributes );

	return $variation_key_lookup;
}

function fabricviva_find_variation_id( int $product_id, int $source_variant_id ): int {
	$variation_ids = get_posts(
		array(
			'post_type'      => 'product_variation',
			'post_status'    => array( 'publish', 'private' ),
			'post_parent'    => $product_id,
			'fields'         => 'ids',
			'posts_per_page' => 1,
			'meta_key'       => '_fabricviva_source_variant_id',
			'meta_value'     => (string) $source_variant_id,
		)
	);

	return empty( $variation_ids ) ? 0 : (int) $variation_ids[0];
}

function fabricviva_sync_variable_product( WC_Product_Variable $product, array $source_product ): void {
	$variation_key_lookup = fabricviva_build_variable_attributes( $product, $source_product );
	$product_id           = $product->save();
	$seen_variation_ids   = array();

	foreach ( $source_product['variants'] as $source_variant ) {
		$variation_id = fabricviva_find_variation_id( $product_id, (int) $source_variant['id'] );
		$variation    = $variation_id > 0 ? new WC_Product_Variation( $variation_id ) : new WC_Product_Variation();

		$variation->set_parent_id( $product_id );
		$variation->set_status( 'publish' );
		$variation->set_manage_stock( false );
		$variation->set_stock_status( ! empty( $source_variant['available'] ) ? 'instock' : 'outofstock' );
		$variation->set_regular_price( (string) $source_variant['price'] );

		if ( ! empty( $source_variant['compare_at_price'] ) && (float) $source_variant['compare_at_price'] > (float) $source_variant['price'] ) {
			$variation->set_sale_price( (string) $source_variant['price'] );
			$variation->set_regular_price( (string) $source_variant['compare_at_price'] );
		}

		$variation->set_sku( '' !== $source_variant['sku'] ? (string) $source_variant['sku'] : 'fabricviva-var-' . $source_variant['id'] );
		$variation->update_meta_data( '_fabricviva_source_variant_id', (string) $source_variant['id'] );

		$attributes = array();
		foreach ( $variation_key_lookup as $index => $attribute_slug ) {
			$option_key = 'option' . (string) ( $index + 1 );
			$option_val = trim( (string) ( $source_variant[ $option_key ] ?? '' ) );

			if ( '' !== $option_val ) {
				$attributes[ $attribute_slug ] = $option_val;
			}
		}
		$variation->set_attributes( $attributes );

		$seen_variation_ids[] = $variation->save();
	}

	$existing_children = $product->get_children();
	foreach ( $existing_children as $child_id ) {
		if ( ! in_array( $child_id, $seen_variation_ids, true ) ) {
			wp_delete_post( $child_id, true );
		}
	}

	WC_Product_Variable::sync( $product_id );
}

function fabricviva_attach_images_to_product( WC_Product $product, array $attachment_ids ): void {
	if ( empty( $attachment_ids ) ) {
		return;
	}

	$product->set_image_id( (int) $attachment_ids[0] );
	$product->set_gallery_image_ids( array_slice( $attachment_ids, 1 ) );
}

function fabricviva_import_products( array $catalog, array $term_ids ): void {
	$total = count( $catalog['products'] );

	foreach ( $catalog['products'] as $index => $source_product ) {
		$product_id   = fabricviva_find_product_id( $source_product );
		$is_variable  = fabricviva_is_variable_product( $source_product );
		$category_ids = fabricviva_get_category_ids_for_product( $source_product, $term_ids );
		$product      = fabricviva_prepare_product_object( $product_id, $is_variable );

		fabricviva_apply_common_product_fields( $product, $source_product, $category_ids );

		if ( $product instanceof WC_Product_Simple ) {
			fabricviva_apply_simple_product_fields( $product, $source_product );
		}

		$product_id = $product->save();

		if ( $product instanceof WC_Product_Variable ) {
			fabricviva_sync_variable_product( $product, $source_product );
			$product = wc_get_product( $product_id );
		}

		$attachment_ids = fabricviva_prepare_gallery( $source_product, $product_id );
		if ( $product instanceof WC_Product ) {
			fabricviva_attach_images_to_product( $product, $attachment_ids );
			$product->save();
		}

		fabricviva_log( sprintf( '[%d/%d] Imported %s', $index + 1, $total, $source_product['title'] ) );
	}
}

function fabricviva_ensure_navigation( array $navigation ): void {
	$option_key = 'fabricviva_navigation_initialized';
	$menu_name  = 'Main Navigation';

	$menu = wp_get_nav_menu_object( $menu_name );
	if ( $menu instanceof WP_Term && get_option( $option_key ) ) {
		$items = wp_get_nav_menu_items( $menu->term_id );
		if ( ! empty( $items ) ) {
			return;
		}
	}

	$menu_id = $menu instanceof WP_Term ? (int) $menu->term_id : wp_create_nav_menu( $menu_name );

	foreach ( (array) wp_get_nav_menu_items( $menu_id ) as $item ) {
		wp_delete_post( $item->ID, true );
	}

	foreach ( $navigation as $nav_item ) {
		$args = array(
			'menu-item-title'  => $nav_item['label'],
			'menu-item-status' => 'publish',
		);

		if ( 'page' === $nav_item['type'] ) {
			$page = get_page_by_path( $nav_item['slug'], OBJECT, 'page' );

			if ( ! $page instanceof WP_Post ) {
				continue;
			}

			$args['menu-item-object-id'] = $page->ID;
			$args['menu-item-object']    = 'page';
			$args['menu-item-type']      = 'post_type';
		} elseif ( 'product_cat' === $nav_item['type'] ) {
			$term = get_term_by( 'slug', $nav_item['slug'], 'product_cat' );

			if ( ! $term instanceof WP_Term ) {
				continue;
			}

			$args['menu-item-object-id'] = $term->term_id;
			$args['menu-item-object']    = 'product_cat';
			$args['menu-item-type']      = 'taxonomy';
		} else {
			continue;
		}

		wp_update_nav_menu_item( $menu_id, 0, $args );
	}

	$locations = get_theme_mod( 'nav_menu_locations', array() );
	$registered = get_registered_nav_menus();

	foreach ( array( 'primary', 'handheld' ) as $location ) {
		if ( isset( $registered[ $location ] ) ) {
			$locations[ $location ] = $menu_id;
		}
	}

	set_theme_mod( 'nav_menu_locations', $locations );
	update_option( $option_key, gmdate( 'c' ) );
}

if ( ! class_exists( 'WooCommerce' ) ) {
	WP_CLI::error( 'WooCommerce must be active before importing the catalog.' );
}

$catalog_path = getenv( 'FABRICVIVA_CATALOG_PATH' );
if ( ! is_string( $catalog_path ) || '' === $catalog_path ) {
	$catalog_path = '/opt/uootd-site/catalog/fabricviva-catalog.json';
}

$catalog  = fabricviva_read_catalog( $catalog_path );
$term_ids = fabricviva_ensure_product_categories( $catalog['category_map'] );

fabricviva_import_products( $catalog, $term_ids );
fabricviva_ensure_navigation( $catalog['navigation'] );

update_option( 'fabricviva_catalog_imported_at', gmdate( 'c' ) );

wp_defer_term_counting( false );
wp_defer_comment_counting( false );
wc_delete_product_transients();
flush_rewrite_rules();

WP_CLI::success( sprintf( 'Imported %d FabricViva products into this isolated Woo site.', count( $catalog['products'] ) ) );
