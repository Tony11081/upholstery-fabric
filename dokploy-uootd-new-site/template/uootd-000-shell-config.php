<?php
/**
 * Shared configuration bootstrap for the reusable UOOTD storefront shell.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'uootd_storefront_shell_get_defaults' ) ) {
	function uootd_storefront_shell_get_defaults() {
		$site_name  = function_exists( 'get_bloginfo' ) ? trim( (string) get_bloginfo( 'name' ) ) : '';
		$brand_name = '' !== $site_name ? $site_name : 'UOOTD';

		return array(
			'brand_name'           => $brand_name,
			'brand_wordmark'       => $brand_name,
			'brand_edit_label'     => 'The ' . $brand_name . ' edit',
			'support_team_title'   => 'Client Services',
			'support_team_label'   => 'client services',
			'footer_heading'       => 'Curated fashion edits, sharper trust cues, and a cleaner route into checkout.',
			'footer_description'   => 'Browse the edit, move into secure card checkout, and return through client services whenever you need order details.',
			'generated_asset_dir'  => 'uootd-generated',
			'catalog_vertical'     => 'fashion',
			'cart_label'           => 'Bag',
			'add_to_cart_label'    => 'Add to Bag',
			'product_unit_singular'=> 'piece',
			'product_unit_plural'  => 'pieces',
			'use_generated_editorial_assets' => true,
			'official_site_suffix' => 'Official Site',
		);
	}
}

if ( ! function_exists( 'uootd_storefront_shell_get_profile' ) ) {
	function uootd_storefront_shell_get_profile() {
		static $profile = null;

		if ( null !== $profile ) {
			return $profile;
		}

		$profile     = uootd_storefront_shell_get_defaults();
		$config_path = dirname( __FILE__ ) . '/uootd-shell-config.local.php';

		if ( file_exists( $config_path ) ) {
			$overrides = include $config_path;
			if ( is_array( $overrides ) ) {
				$profile = array_replace_recursive( $profile, $overrides );
			}
		}

		$profile = function_exists( 'apply_filters' ) ? apply_filters( 'uootd_storefront_shell_profile', $profile ) : $profile;

		return $profile;
	}
}

if ( ! function_exists( 'uootd_storefront_shell_get_setting' ) ) {
	function uootd_storefront_shell_get_setting( $key, $default = '' ) {
		$profile = uootd_storefront_shell_get_profile();

		return array_key_exists( $key, $profile ) ? $profile[ $key ] : $default;
	}
}
