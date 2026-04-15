<?php
/**
 * Discovery, service, search, and wishlist layer for the UOOTD storefront shell.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function uootd_storefront_branding_get_page_url( $slug, $fallback = '/' ) {
	$page = get_page_by_path( $slug );

	if ( $page instanceof WP_Post ) {
		return get_permalink( $page );
	}

	return home_url( $fallback );
}

function uootd_storefront_branding_get_special_page_titles() {
	$defaults = array(
		'search'            => 'Search',
		'new-in'            => 'New In',
		'trending'          => 'Trending',
		'sale'              => 'Sale',
		'designers'         => 'Designers',
		'editorial'         => 'Editorial',
		'customer-care'     => 'Customer Care',
		'track-order'       => 'Track an Order',
		'create-return'     => 'Create a Return',
		'contact-us'        => 'Contact Us',
		'delivery'          => 'Delivery',
		'payment'           => 'Payment',
		'exchanges-returns' => 'Exchanges & Returns',
		'terms'             => 'Terms',
		'privacy'           => 'Privacy',
		'cookie'            => 'Cookie',
		'wishlist'          => 'Wish List',
		'rewards'           => 'Rewards',
		'home-style'        => 'Home',
	);

	$overrides = uootd_storefront_branding_get_shell_setting_value( 'special_page_titles', array() );

	if ( is_array( $overrides ) ) {
		return array_merge( $defaults, $overrides );
	}

	return $defaults;
}

function uootd_storefront_branding_get_special_page_slug() {
	if ( ! is_page() ) {
		return '';
	}

	$post = get_post();
	if ( ! $post instanceof WP_Post ) {
		return '';
	}

	$pages = uootd_storefront_branding_get_special_page_titles();

	return isset( $pages[ $post->post_name ] ) ? $post->post_name : '';
}

function uootd_storefront_branding_register_request_post_type() {
	register_post_type(
		'uootd_request',
		array(
			'labels' => array(
				'name'          => 'Client Requests',
				'singular_name' => 'Client Request',
			),
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => 'themes.php',
			'supports'            => array( 'title', 'editor', 'custom-fields' ),
			'capability_type'     => 'post',
			'exclude_from_search' => true,
			'menu_icon'           => 'dashicons-email-alt2',
		)
	);
}

function uootd_storefront_branding_ensure_core_pages() {
	$pages = uootd_storefront_branding_get_special_page_titles();

	foreach ( $pages as $slug => $title ) {
		if ( get_page_by_path( $slug ) ) {
			continue;
		}

		wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_title'   => $title,
				'post_name'    => $slug,
				'post_content' => '',
			)
		);
	}
}

function uootd_storefront_branding_register_admin_page() {
	$shell_title = uootd_storefront_branding_get_brand_wordmark() . ' Shell';

	add_theme_page(
		$shell_title,
		$shell_title,
		'manage_options',
		'uootd-shell',
		'uootd_storefront_branding_render_admin_page'
	);
}

function uootd_storefront_branding_register_settings() {
	register_setting(
		'uootd_storefront_shell',
		'uootd_storefront_shell_settings',
		array(
			'sanitize_callback' => 'uootd_storefront_branding_sanitize_settings',
			'default'           => array(),
		)
	);
}

function uootd_storefront_branding_sanitize_settings( $input ) {
	$input = is_array( $input ) ? $input : array();

	return array(
		'market_label'     => isset( $input['market_label'] ) ? sanitize_text_field( $input['market_label'] ) : 'United States',
		'market_note'      => isset( $input['market_note'] ) ? sanitize_text_field( $input['market_note'] ) : 'All orders shown in USD with tracked delivery updates.',
		'service_messages' => isset( $input['service_messages'] ) ? trim( sanitize_textarea_field( $input['service_messages'] ) ) : '',
	);
}

function uootd_storefront_branding_get_shell_setting( $key, $default = '' ) {
	$settings = get_option( 'uootd_storefront_shell_settings', array() );

	return isset( $settings[ $key ] ) && '' !== $settings[ $key ] ? $settings[ $key ] : $default;
}

if ( ! function_exists( 'uootd_storefront_branding_get_brand_name' ) ) {
	function uootd_storefront_branding_get_brand_name() {
		return uootd_storefront_branding_get_shell_setting( 'brand_name', 'UOOTD' );
	}
}

if ( ! function_exists( 'uootd_storefront_branding_get_brand_wordmark' ) ) {
	function uootd_storefront_branding_get_brand_wordmark() {
		return uootd_storefront_branding_get_shell_setting( 'brand_wordmark', uootd_storefront_branding_get_brand_name() );
	}
}

if ( ! function_exists( 'uootd_storefront_branding_get_support_team_title' ) ) {
	function uootd_storefront_branding_get_support_team_title() {
		return uootd_storefront_branding_get_shell_setting( 'support_team_title', 'Client Services' );
	}
}

if ( ! function_exists( 'uootd_storefront_branding_get_support_team_label' ) ) {
	function uootd_storefront_branding_get_support_team_label() {
		return uootd_storefront_branding_get_shell_setting( 'support_team_label', 'Support team' );
	}
}

function uootd_storefront_branding_render_admin_page() {
	?>
	<div class="wrap">
		<h1><?php echo esc_html( uootd_storefront_branding_get_brand_wordmark() . ' Shell' ); ?></h1>
		<p>Manage the market label and the service ribbon copy used across the storefront shell.</p>
		<form action="options.php" method="post">
			<?php settings_fields( 'uootd_storefront_shell' ); ?>
			<?php $settings = get_option( 'uootd_storefront_shell_settings', array() ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="uootd-market-label">Market label</label></th>
					<td><input id="uootd-market-label" name="uootd_storefront_shell_settings[market_label]" type="text" class="regular-text" value="<?php echo esc_attr( isset( $settings['market_label'] ) ? $settings['market_label'] : 'United States' ); ?>" /></td>
				</tr>
				<tr>
					<th scope="row"><label for="uootd-market-note">Market note</label></th>
					<td><input id="uootd-market-note" name="uootd_storefront_shell_settings[market_note]" type="text" class="regular-text" value="<?php echo esc_attr( isset( $settings['market_note'] ) ? $settings['market_note'] : 'All orders shown in USD with tracked delivery updates.' ); ?>" /></td>
				</tr>
				<tr>
					<th scope="row"><label for="uootd-service-messages">Service ribbon messages</label></th>
					<td>
						<textarea id="uootd-service-messages" name="uootd_storefront_shell_settings[service_messages]" class="large-text" rows="6"><?php echo esc_textarea( isset( $settings['service_messages'] ) ? $settings['service_messages'] : '' ); ?></textarea>
						<p class="description">Enter one message per line.</p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Save shell settings' ); ?>
		</form>
	</div>
	<?php
}

function uootd_storefront_branding_get_service_messages() {
	$raw = uootd_storefront_branding_get_shell_setting( 'service_messages', '' );
	if ( '' === $raw ) {
		return array(
			'New arrivals refreshed throughout the week',
			'Tracked delivery and secure card checkout on every order',
			'Client services available before and after purchase',
		);
	}

	$messages = array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', $raw ) ) );

	return ! empty( $messages ) ? array_values( $messages ) : array(
		'New arrivals refreshed throughout the week',
		'Tracked delivery and secure card checkout on every order',
	);
}

function uootd_storefront_branding_get_market_context() {
	return array(
		'label'    => uootd_storefront_branding_get_shell_setting( 'market_label', 'United States' ),
		'currency' => 'USD',
		'note'     => uootd_storefront_branding_get_shell_setting( 'market_note', 'All orders shown in USD with tracked delivery updates.' ),
	);
}

function uootd_storefront_branding_get_navigation_items() {
	if ( uootd_storefront_branding_is_fabric_catalog() ) {
		$slugs      = uootd_storefront_branding_get_category_slug_list(
			'navigation_category_slugs',
			array( 'all-fabrics', 'gucci-fabric', 'lv-fabric', 'dior-fabric', 'fendi-fabric', 'other-logo-fabrics', 'jacquard-fabric', 'accessories' )
		);
		$navigation = array();
		$new_arrivals = get_term_by( 'slug', 'new-arrivals', 'product_cat' );

		if ( $new_arrivals && ! is_wp_error( $new_arrivals ) ) {
			$new_arrivals_link = get_term_link( $new_arrivals );
			if ( ! is_wp_error( $new_arrivals_link ) ) {
				$navigation[] = array(
					'label' => 'New Arrivals',
					'url'   => $new_arrivals_link,
				);
			}
		}

		foreach ( $slugs as $slug ) {
			$term = get_term_by( 'slug', $slug, 'product_cat' );
			if ( ! $term || is_wp_error( $term ) ) {
				continue;
			}

			$link = get_term_link( $term );
			if ( is_wp_error( $link ) ) {
				continue;
			}

			$navigation[] = array(
				'label' => $term->name,
				'url'   => $link,
			);
		}

		$navigation[] = array(
			'label' => uootd_storefront_branding_get_support_team_title(),
			'url'   => uootd_storefront_branding_get_page_url( 'customer-care', '/customer-care/' ),
		);

		return $navigation;
	}

	$catalog_items = array();
	$catalog_map   = array(
		'shoes'      => 'Shoes',
		'bags'       => 'Bags',
		'accessories'=> 'Accessories',
		'jewelry'    => 'Jewelry',
		'watches'    => 'Watches',
		'suitcases'  => 'Suitcases',
	);

	foreach ( $catalog_map as $slug => $label ) {
		$term = get_term_by( 'slug', $slug, 'product_cat' );
		if ( ! $term || is_wp_error( $term ) ) {
			continue;
		}

		$count = isset( $term->count ) ? (int) $term->count : 0;
		if ( $count <= 0 && ! in_array( $slug, array( 'shoes', 'bags', 'accessories' ), true ) ) {
			continue;
		}

		$link = get_term_link( $term );
		if ( is_wp_error( $link ) ) {
			continue;
		}

		$catalog_items[] = array(
			'label' => $label,
			'url'   => $link,
		);
	}

	$navigation = array(
		array(
			'label' => 'New In',
			'url'   => uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ),
			'links' => array(
				array( 'label' => 'This week', 'url' => uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ) ),
				array( 'label' => 'Trending now', 'url' => uootd_storefront_branding_get_page_url( 'trending', '/trending/' ) ),
				array( 'label' => 'Sale edit', 'url' => uootd_storefront_branding_get_page_url( 'sale', '/sale/' ) ),
			),
			'feature' => array(
				'title' => 'Fresh pieces into the edit',
				'copy'  => 'Browse the newest arrivals first, then move directly into secure checkout.',
				'url'   => uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ),
			),
		),
		array(
			'label' => 'Trending',
			'url'   => uootd_storefront_branding_get_page_url( 'trending', '/trending/' ),
		),
		array(
			'label' => 'Designers',
			'url'   => uootd_storefront_branding_get_page_url( 'designers', '/designers/' ),
			'links' => array(
				array( 'label' => 'Designers A-Z', 'url' => uootd_storefront_branding_get_page_url( 'designers', '/designers/' ) ),
				array( 'label' => 'Editorial', 'url' => uootd_storefront_branding_get_page_url( 'editorial', '/editorial/' ) ),
			),
			'feature' => array(
				'title' => 'Designer-led discovery',
				'copy'  => 'Use the A-Z index to jump straight into a house, then shop by bag, jewelry, or accessory.',
				'url'   => uootd_storefront_branding_get_page_url( 'designers', '/designers/' ),
			),
		),
	);

	if ( ! empty( $catalog_items ) ) {
		$navigation = array_merge( $navigation, $catalog_items );
	}

	$navigation = array_merge(
		$navigation,
		array(
			array( 'label' => 'Editorial', 'url' => uootd_storefront_branding_get_page_url( 'editorial', '/editorial/' ) ),
			array( 'label' => 'Sale', 'url' => uootd_storefront_branding_get_page_url( 'sale', '/sale/' ) ),
		)
	);

	return $navigation;
}

function uootd_storefront_branding_render_discovery_shell() {
	if ( is_admin() || wp_doing_ajax() ) {
		return;
	}

	$market     = uootd_storefront_branding_get_market_context();
	$nav_items  = uootd_storefront_branding_get_navigation_items();
	$bag_count  = function_exists( 'WC' ) && WC()->cart ? (int) WC()->cart->get_cart_contents_count() : 0;
	$bag_url    = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' );
	$account    = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/my-account/' );
	$is_fabric_site = uootd_storefront_branding_is_fabric_catalog();
	$designers_url  = uootd_storefront_branding_get_page_url( 'designers', '/designers/' );
	$search_url = uootd_storefront_branding_get_page_url( 'search', '/search/' );
	?>
	<div class="uootd-shell">
		<div class="uootd-shell__utility">
			<div class="uootd-shell__market">
				<button class="uootd-market-trigger" type="button" data-uootd-market-toggle aria-expanded="false">
					<span><?php echo esc_html( $market['label'] ); ?></span>
					<strong><?php echo esc_html( $market['currency'] ); ?></strong>
				</button>
				<div class="uootd-market-panel" hidden data-uootd-market-panel>
					<p>Shipping market</p>
					<strong><?php echo esc_html( $market['label'] ); ?> / <?php echo esc_html( $market['currency'] ); ?></strong>
					<span><?php echo esc_html( $market['note'] ); ?></span>
				</div>
			</div>
			<div class="uootd-shell__actions">
				<button type="button" class="uootd-shell__action uootd-shell__action--search" data-uootd-search-open>Search</button>
				<?php if ( $is_fabric_site ) : ?>
					<a class="uootd-shell__action uootd-shell__action--brands" href="<?php echo esc_url( $designers_url ); ?>">Brands</a>
				<?php else : ?>
					<a class="uootd-shell__action uootd-shell__action--rewards" href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'rewards', '/rewards/' ) ); ?>">Rewards</a>
				<?php endif; ?>
				<a class="uootd-shell__action uootd-shell__action--account" href="<?php echo esc_url( $account ); ?>">Sign In</a>
				<a class="uootd-shell__action uootd-shell__action--wishlist" href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'wishlist', '/wishlist/' ) ); ?>">Wish List <span data-uootd-wishlist-count>0</span></a>
				<a class="uootd-shell__action uootd-shell__action--service" href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'customer-care', '/customer-care/' ) ); ?>"><?php echo esc_html( uootd_storefront_branding_get_support_team_title() ); ?></a>
				<a class="uootd-shell__action uootd-shell__action--bag" href="<?php echo esc_url( $bag_url ); ?>"><?php echo esc_html( uootd_storefront_branding_get_cart_label() ); ?> <span><?php echo esc_html( (string) $bag_count ); ?></span></a>
			</div>
		</div>
		<nav class="uootd-discovery-nav" aria-label="Primary">
			<div class="uootd-discovery-nav__inner">
				<a class="uootd-discovery-nav__brand" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php echo esc_html( uootd_storefront_branding_get_brand_wordmark() ); ?></a>
				<button type="button" class="uootd-discovery-nav__toggle" data-uootd-nav-toggle aria-expanded="false">Menu</button>
				<div class="uootd-discovery-nav__list" data-uootd-nav-list>
					<?php foreach ( $nav_items as $item ) : ?>
						<?php $has_panel = ! empty( $item['links'] ) || ! empty( $item['feature'] ); ?>
						<div class="uootd-nav-item<?php echo $has_panel ? ' has-panel' : ''; ?>">
							<div class="uootd-nav-item__head">
								<a href="<?php echo esc_url( $item['url'] ); ?>"><?php echo esc_html( $item['label'] ); ?></a>
								<?php if ( $has_panel ) : ?>
									<button type="button" class="uootd-nav-item__toggle" data-uootd-panel-trigger aria-expanded="false">Open</button>
								<?php endif; ?>
							</div>
							<?php if ( $has_panel ) : ?>
								<div class="uootd-nav-item__panel" data-uootd-panel hidden>
									<?php if ( ! empty( $item['links'] ) ) : ?>
										<div class="uootd-nav-item__links">
											<?php foreach ( $item['links'] as $link ) : ?>
												<a href="<?php echo esc_url( $link['url'] ); ?>"><?php echo esc_html( $link['label'] ); ?></a>
											<?php endforeach; ?>
										</div>
									<?php endif; ?>
									<?php if ( ! empty( $item['feature'] ) ) : ?>
										<a class="uootd-nav-item__feature" href="<?php echo esc_url( $item['feature']['url'] ); ?>">
											<p>Inside the edit</p>
											<strong><?php echo esc_html( $item['feature']['title'] ); ?></strong>
											<span><?php echo esc_html( $item['feature']['copy'] ); ?></span>
										</a>
									<?php endif; ?>
								</div>
							<?php endif; ?>
						</div>
					<?php endforeach; ?>
				</div>
				<a class="uootd-discovery-nav__search" href="<?php echo esc_url( $search_url ); ?>" data-uootd-search-open>Search</a>
			</div>
		</nav>
	</div>
	<?php
}

function uootd_storefront_branding_extract_brand_from_name( $name ) {
	$name = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) $name ) ) );
	if ( '' === $name ) {
		return 'Curated piece';
	}

	$brands = array(
		'Louis Vuitton',
		'Van Cleef & Arpels',
		'Van Cleef',
		'Christian Dior',
		'Saint Laurent',
		'Bottega Veneta',
		'Golden Goose',
		'Tory Burch',
		'Michael Kors',
		'Miu Miu',
		'Maison Margiela',
		'Gentle Monster',
		'Chrome Hearts',
		'Salvatore Ferragamo',
		'Moncler',
		'Balenciaga',
		'Alexander McQueen',
		'Burberry',
		'Givenchy',
		'Longines',
		'Rolex',
		'Hermes',
		'Cartier',
		'Chanel',
		'Prada',
		'Fendi',
		'Gucci',
		'Coach',
		'Celine',
		'Loewe',
		'Bvlgari',
		'Tiffany',
		'YSL',
	);

	foreach ( $brands as $brand ) {
		if ( 0 === stripos( $name, $brand . ' ' ) || 0 === strcasecmp( $name, $brand ) ) {
			return $brand;
		}
	}

	$tokens = preg_split( '/\s+/', $name );
	if ( empty( $tokens[0] ) ) {
		return 'Curated piece';
	}

	$reject = array( 'designer', 'unknown', 'not', 'luxury', 'fashion', 'bag', 'bags' );
	if ( in_array( strtolower( $tokens[0] ), $reject, true ) ) {
		return 'Curated piece';
	}

	return ucfirst( strtolower( $tokens[0] ) );
}

function uootd_storefront_branding_get_designer_catalog() {
	$cached = get_transient( 'uootd_designer_catalog_v2' );
	if ( false !== $cached ) {
		return $cached;
	}

	$ids = get_posts(
		array(
			'post_type'              => 'product',
			'post_status'            => 'publish',
			'posts_per_page'         => -1,
			'fields'                 => 'ids',
			'orderby'                => 'date',
			'order'                  => 'DESC',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);

	$catalog = array();
	foreach ( $ids as $product_id ) {
		$brand = uootd_storefront_branding_extract_brand_from_name( get_the_title( $product_id ) );
		if ( 'Curated piece' === $brand ) {
			continue;
		}

		if ( ! isset( $catalog[ $brand ] ) ) {
			$catalog[ $brand ] = array(
				'label'    => $brand,
				'count'    => 0,
				'image'    => '',
				'url'      => add_query_arg( 'designer', rawurlencode( $brand ), uootd_storefront_branding_get_page_url( 'designers', '/designers/' ) ),
				'eyebrow'  => strtoupper( substr( $brand, 0, 1 ) ),
				'headline' => $brand . ' edit',
				'copy'     => uootd_storefront_branding_is_fabric_catalog() ? 'Shop fabric listings grouped around this brand so pattern and weave comparisons feel faster.' : 'Shop refined pieces organized around the house identity and current seasonal shapes.',
			);
		}

		++$catalog[ $brand ]['count'];

		if ( '' === $catalog[ $brand ]['image'] ) {
			$image = get_the_post_thumbnail_url( $product_id, 'woocommerce_thumbnail' );
			if ( $image ) {
				$catalog[ $brand ]['image'] = $image;
			}
		}
	}

	uksort( $catalog, 'strcasecmp' );
	$catalog = array_values( $catalog );
	set_transient( 'uootd_designer_catalog_v2', $catalog, 12 * HOUR_IN_SECONDS );

	return $catalog;
}

function uootd_storefront_branding_get_help_faq_items( $slug ) {
	$items = array(
		'customer-care' => array(
			array(
				'question' => 'How do I track a ' . uootd_storefront_branding_get_brand_name() . ' order?',
				'answer'   => 'Use the Track an Order page with your order ID and billing email to review the latest status.',
			),
			array(
				'question' => 'Where can I ask for help before purchase?',
				'answer'   => 'Use ' . uootd_storefront_branding_get_support_team_title() . ' or Contact Us to ask about product finish, delivery timing, or payment before checkout.',
			),
		),
		'delivery' => array(
			array(
				'question' => 'Does ' . uootd_storefront_branding_get_brand_name() . ' offer tracked delivery?',
				'answer'   => 'Yes. Orders move through tracked dispatch updates after payment is confirmed.',
			),
		),
		'payment' => array(
			array(
				'question' => 'What payment flow does ' . uootd_storefront_branding_get_brand_name() . ' use?',
				'answer'   => 'Checkout moves through a secure hosted card handoff with order confirmation once payment is accepted.',
			),
		),
		'exchanges-returns' => array(
			array(
				'question' => 'How do I start a return?',
				'answer'   => 'Open Create a Return and send your order reference, email, and reason so the team can review the request.',
			),
		),
	);

	return isset( $items[ $slug ] ) ? $items[ $slug ] : array();
}

function uootd_storefront_branding_get_special_page_meta( $slug ) {
	$brand_name   = uootd_storefront_branding_get_brand_name();
	$support_team = strtolower( uootd_storefront_branding_get_support_team_title() );
	$is_fabric_site = uootd_storefront_branding_is_fabric_catalog();

	$defaults = array(
		'title'       => uootd_storefront_branding_format_meta_title(),
		'description' => $is_fabric_site
			? 'Discover ' . $brand_name . ' for designer-inspired upholstery fabric, jacquard fabric, order support, and secure checkout.'
			: 'Discover the ' . $brand_name . ' official site for curated fashion, ' . $support_team . ', secure checkout, and tracked delivery.',
		'url'         => uootd_storefront_branding_get_page_url( $slug, '/' . $slug . '/' ),
		'og_type'     => 'website',
		'schema_type' => 'WebPage',
		'faq'         => uootd_storefront_branding_get_help_faq_items( $slug ),
	);

	$query = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : '';

	$map = array(
		'new-in' => array(
			'title'       => uootd_storefront_branding_format_meta_title( $is_fabric_site ? 'New Arrivals' : 'New In' ),
			'description' => $is_fabric_site ? 'Shop the newest upholstery and decorative fabric arrivals on ' . $brand_name . '.' : 'Shop the newest ' . $brand_name . ' arrivals with a direct route from discovery into secure checkout.',
			'schema_type' => 'CollectionPage',
		),
		'trending' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Trending' ),
			'description' => $is_fabric_site ? 'Explore trending fabric listings on ' . $brand_name . ' across upholstery, jacquard, and decorative yardage.' : 'Explore trending ' . $brand_name . ' pieces across bags, jewelry, accessories, and high-interest edits.',
			'schema_type' => 'CollectionPage',
		),
		'sale' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Sale' ),
			'description' => 'Browse ' . $brand_name . ' sale edits with faster access to discounted styles and secure card checkout.',
			'schema_type' => 'CollectionPage',
		),
		'designers' => array(
			'title'       => uootd_storefront_branding_format_meta_title( $is_fabric_site ? 'Brands' : 'Designers A-Z' ),
			'description' => $is_fabric_site ? 'Browse ' . $brand_name . ' by brand to move faster through Gucci, LV, Dior, Fendi, and other fabric collections.' : 'Shop ' . $brand_name . ' by designer with an A-Z index and brand-led product discovery across the catalog.',
			'schema_type' => 'CollectionPage',
		),
		'editorial' => array(
			'title'       => uootd_storefront_branding_format_meta_title( $is_fabric_site ? 'Collections' : 'Editorial' ),
			'description' => $is_fabric_site ? 'Explore collection-led browse paths across new arrivals, trending fabric, and brand-based upholstery categories.' : 'Read the ' . $brand_name . ' editorial edit with campaign stories, category highlights, and direct product links.',
			'schema_type' => 'CollectionPage',
		),
		'customer-care' => array(
			'title'       => uootd_storefront_branding_format_meta_title( uootd_storefront_branding_get_support_team_title() ),
			'description' => 'Contact ' . $brand_name . ' ' . $support_team . ' for tracking, delivery, payment, returns, and purchase support.',
			'faq'         => uootd_storefront_branding_get_help_faq_items( 'customer-care' ),
		),
		'track-order' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Track an Order' ),
			'description' => 'Track a ' . $brand_name . ' order with your order ID and billing email address.',
		),
		'create-return' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Create a Return' ),
			'description' => 'Start a return request with ' . $brand_name . ' ' . strtolower( uootd_storefront_branding_get_support_team_label() ) . ' and keep your order details together in one place.',
		),
		'contact-us' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Contact Us' ),
			'description' => 'Reach ' . $brand_name . ' ' . $support_team . ' for pre-purchase questions, order support, and delivery help.',
		),
		'delivery' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Delivery' ),
			'description' => 'Delivery information, tracked dispatch updates, and purchase support for ' . $brand_name . ' orders.',
			'faq'         => uootd_storefront_branding_get_help_faq_items( 'delivery' ),
		),
		'payment' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Payment' ),
			'description' => 'Learn how secure card checkout works at ' . $brand_name . ' and what to expect during payment handoff.',
			'faq'         => uootd_storefront_branding_get_help_faq_items( 'payment' ),
		),
		'exchanges-returns' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Exchanges & Returns' ),
			'description' => 'Review ' . $brand_name . ' exchanges and returns guidance before creating a return request.',
			'faq'         => uootd_storefront_branding_get_help_faq_items( 'exchanges-returns' ),
		),
		'terms' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Terms' ),
			'description' => 'Terms and conditions for using the ' . $brand_name . ' storefront and placing an order.',
		),
		'privacy' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Privacy' ),
			'description' => 'Privacy information for ' . $brand_name . ' customers, including account, order, and contact data handling.',
		),
		'cookie' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Cookie' ),
			'description' => 'How ' . $brand_name . ' uses cookies to support storefront performance, analytics, and customer convenience.',
		),
		'wishlist' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Wish List' ),
			'description' => 'Save ' . $brand_name . ' favorites and return to them quickly from your wish list.',
		),
		'rewards' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Rewards' ),
			'description' => 'Learn how ' . $brand_name . ' rewards will work as loyalty benefits, order perks, and early access improvements.',
		),
		'home-style' => array(
			'title'       => uootd_storefront_branding_format_meta_title( 'Home' ),
			'description' => 'Explore the ' . $brand_name . ' home-style edit with decorative pieces and interior-facing accents.',
			'schema_type' => 'CollectionPage',
		),
	);

	if ( 'search' === $slug ) {
		if ( '' !== $query ) {
			$defaults['title']       = uootd_storefront_branding_format_meta_title( 'Search results for ' . $query );
			$defaults['description'] = sprintf( 'Search results for %s on the %s official site.', $query, $brand_name );
		} else {
			$defaults['title']       = uootd_storefront_branding_format_meta_title( 'Search' );
			$defaults['description'] = $is_fabric_site ? 'Search fabrics, collections, and product names on ' . $brand_name . '.' : 'Search designers, categories, and products on the ' . $brand_name . ' official site.';
		}

		return $defaults;
	}

	return isset( $map[ $slug ] ) ? array_merge( $defaults, $map[ $slug ] ) : $defaults;
}

function uootd_storefront_branding_get_products_for_designer( $designer, $limit = 12 ) {
	$ids = get_posts(
		array(
			'post_type'              => 'product',
			'post_status'            => 'publish',
			'posts_per_page'         => -1,
			'fields'                 => 'ids',
			'orderby'                => 'date',
			'order'                  => 'DESC',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);

	$products = array();
	foreach ( $ids as $product_id ) {
		if ( 0 !== strcasecmp( uootd_storefront_branding_extract_brand_from_name( get_the_title( $product_id ) ), $designer ) ) {
			continue;
		}

		$product = wc_get_product( $product_id );
		if ( $product instanceof WC_Product && $product->get_image_id() ) {
			$products[] = $product;
		}

		if ( count( $products ) >= $limit ) {
			break;
		}
	}

	return $products;
}

function uootd_storefront_branding_get_special_page_products( $slug, $args = array() ) {
	$args = wp_parse_args(
		$args,
		array(
			'query'    => '',
			'designer' => '',
			'limit'    => 12,
		)
	);

	$query_args = array(
		'status'  => 'publish',
		'limit'   => (int) $args['limit'],
		'orderby' => 'date',
		'order'   => 'DESC',
	);

	if ( 'new-in' === $slug ) {
		return wc_get_products( $query_args );
	}

	if ( 'sale' === $slug ) {
		$query_args['on_sale'] = true;
		return wc_get_products( $query_args );
	}

	if ( 'trending' === $slug ) {
		$query_args['orderby'] = 'popularity';
		return wc_get_products( $query_args );
	}

	if ( 'home-style' === $slug ) {
		$query_args['category'] = array( 'home', 'accessories' );
		return wc_get_products( $query_args );
	}

	if ( 'editorial' === $slug ) {
		$query_args['featured'] = true;
		$products = wc_get_products( $query_args );
		if ( empty( $products ) ) {
			unset( $query_args['featured'] );
			$products = wc_get_products( $query_args );
		}
		return $products;
	}

	if ( 'search' === $slug && '' !== $args['query'] ) {
		$query_args['search'] = $args['query'];
		return wc_get_products( $query_args );
	}

	if ( 'designer' === $slug && '' !== $args['designer'] ) {
		return uootd_storefront_branding_get_products_for_designer( $args['designer'], (int) $args['limit'] );
	}

	return array();
}

function uootd_storefront_branding_render_page_hero( $args ) {
	$args = wp_parse_args(
		$args,
		array(
			'eyebrow' => uootd_storefront_branding_get_brand_wordmark(),
			'title'   => 'Inside the edit',
			'copy'    => '',
			'chips'   => array(),
			'cta'     => '',
			'cta_url' => '',
		)
	);

	ob_start();
	?>
	<section class="uootd-special-hero">
		<div class="uootd-special-hero__copy">
			<p><?php echo esc_html( $args['eyebrow'] ); ?></p>
			<h1><?php echo esc_html( $args['title'] ); ?></h1>
			<?php if ( $args['copy'] ) : ?>
				<span><?php echo esc_html( $args['copy'] ); ?></span>
			<?php endif; ?>
			<?php if ( ! empty( $args['chips'] ) ) : ?>
				<div class="uootd-special-hero__chips">
					<?php foreach ( $args['chips'] as $chip ) : ?>
						<span><?php echo esc_html( $chip ); ?></span>
					<?php endforeach; ?>
				</div>
			<?php endif; ?>
			<?php if ( $args['cta'] && $args['cta_url'] ) : ?>
				<a href="<?php echo esc_url( $args['cta_url'] ); ?>"><?php echo esc_html( $args['cta'] ); ?></a>
			<?php endif; ?>
		</div>
	</section>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_discovery_product_card( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return '';
	}

	$image      = wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' );
	$brand      = uootd_storefront_branding_extract_brand_from_name( $product->get_name() );
	$title      = uootd_storefront_branding_get_product_display_name( $product );
	$price      = $product->get_price_html();
	$permalink  = $product->get_permalink();
	$buy_url    = $product->is_purchasable() && $product->is_in_stock() ? uootd_storefront_branding_get_direct_checkout_url( $product->get_id() ) : $permalink;
	$action     = $product->is_purchasable() && $product->is_in_stock() ? 'Buy Now' : 'View Product';

	ob_start();
	?>
	<article class="uootd-discovery-card">
		<a class="uootd-discovery-card__image" href="<?php echo esc_url( $permalink ); ?>">
			<?php if ( $image ) : ?>
				<img src="<?php echo esc_url( $image ); ?>" alt="<?php echo esc_attr( $product->get_name() ); ?>" loading="lazy" />
			<?php endif; ?>
		</a>
		<div class="uootd-discovery-card__copy">
			<p class="uootd-discovery-card__meta"><?php echo esc_html( strtoupper( $brand ) ); ?></p>
			<h3><a href="<?php echo esc_url( $permalink ); ?>"><?php echo esc_html( $title ); ?></a></h3>
			<span class="uootd-discovery-card__price"><?php echo wp_kses_post( $price ); ?></span>
			<div class="uootd-discovery-card__actions">
				<?php echo uootd_storefront_branding_render_wishlist_button_markup( $product, 'loop' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<a class="uootd-discovery-card__buy" href="<?php echo esc_url( $buy_url ); ?>"><?php echo esc_html( $action ); ?></a>
			</div>
		</div>
	</article>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_product_grid_section( $title, $copy, $products, $empty_message = 'No pieces are available yet.' ) {
	ob_start();
	?>
	<section class="uootd-special-section">
		<div class="uootd-special-section__head">
			<h2><?php echo esc_html( $title ); ?></h2>
			<?php if ( $copy ) : ?>
				<span><?php echo esc_html( $copy ); ?></span>
			<?php endif; ?>
		</div>
		<?php if ( ! empty( $products ) ) : ?>
			<div class="uootd-discovery-grid">
				<?php foreach ( $products as $product ) : ?>
					<?php echo uootd_storefront_branding_render_discovery_product_card( $product ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<?php endforeach; ?>
			</div>
		<?php else : ?>
			<p class="uootd-special-section__empty"><?php echo esc_html( $empty_message ); ?></p>
		<?php endif; ?>
	</section>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_card_links( $cards, $class = 'uootd-info-grid' ) {
	if ( empty( $cards ) ) {
		return '';
	}

	ob_start();
	?>
	<div class="<?php echo esc_attr( $class ); ?>">
		<?php foreach ( $cards as $card ) : ?>
			<a class="uootd-info-card" href="<?php echo esc_url( $card['url'] ); ?>">
				<?php if ( ! empty( $card['eyebrow'] ) ) : ?>
					<p><?php echo esc_html( $card['eyebrow'] ); ?></p>
				<?php endif; ?>
				<strong><?php echo esc_html( $card['title'] ); ?></strong>
				<span><?php echo esc_html( $card['copy'] ); ?></span>
			</a>
		<?php endforeach; ?>
	</div>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_form_notice( $type ) {
	$submitted = isset( $_GET['submitted'] ) ? sanitize_text_field( wp_unslash( $_GET['submitted'] ) ) : '';
	if ( $submitted !== $type ) {
		return '';
	}

	return '<div class="uootd-form-notice">Thanks. Your request has been received and will be reviewed by ' . esc_html( strtolower( uootd_storefront_branding_get_support_team_label() ) ) . '.</div>';
}

function uootd_storefront_branding_render_support_form( $type ) {
	$is_return = 'return' === $type;
	$heading   = $is_return ? 'Return request details' : 'Contact ' . uootd_storefront_branding_get_support_team_title();
	$button    = $is_return ? 'Submit return request' : 'Send message';

	ob_start();
	?>
	<form class="uootd-support-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<?php wp_nonce_field( 'uootd_client_request', 'uootd_client_request_nonce' ); ?>
		<input type="hidden" name="action" value="uootd_client_request" />
		<input type="hidden" name="request_type" value="<?php echo esc_attr( $type ); ?>" />
		<input type="hidden" name="redirect_to" value="<?php echo esc_url( uootd_storefront_branding_get_current_url() ); ?>" />
		<div class="uootd-support-form__full">
			<h2><?php echo esc_html( $heading ); ?></h2>
		</div>
		<label>
			<span>Full name</span>
			<input type="text" name="client_name" required />
		</label>
		<label>
			<span>Email</span>
			<input type="email" name="client_email" required />
		</label>
		<label>
			<span>Order number</span>
			<input type="text" name="order_number" <?php echo $is_return ? 'required' : ''; ?> />
		</label>
		<label>
			<span><?php echo $is_return ? 'Item or reason' : 'Subject'; ?></span>
			<input type="text" name="subject" required />
		</label>
		<label class="uootd-support-form__full">
			<span>Details</span>
			<textarea name="details" rows="6" required></textarea>
		</label>
		<div class="uootd-support-form__full">
			<button type="submit"><?php echo esc_html( $button ); ?></button>
		</div>
	</form>
	<?php
	return (string) ob_get_clean();
}

function uootd_storefront_branding_render_special_page( $slug ) {
	$query          = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : '';
	$designer       = isset( $_GET['designer'] ) ? sanitize_text_field( wp_unslash( $_GET['designer'] ) ) : '';
	$shop_url       = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
	$is_fabric_site = uootd_storefront_branding_is_fabric_catalog();
	$output         = '';

	$care_cards = array(
		array( 'eyebrow' => 'Support', 'title' => 'Track an Order', 'copy' => 'Follow your order with your ID and billing email.', 'url' => uootd_storefront_branding_get_page_url( 'track-order', '/track-order/' ) ),
		array( 'eyebrow' => 'Support', 'title' => 'Create a Return', 'copy' => 'Send your request to ' . strtolower( uootd_storefront_branding_get_support_team_label() ) . ' with order details.', 'url' => uootd_storefront_branding_get_page_url( 'create-return', '/create-return/' ) ),
		array( 'eyebrow' => 'Support', 'title' => 'Contact Us', 'copy' => $is_fabric_site ? 'Ask about fabric weight, finish, delivery timing, or payment before checkout.' : 'Ask about products, delivery timing, or payment before checkout.', 'url' => uootd_storefront_branding_get_page_url( 'contact-us', '/contact-us/' ) ),
		array( 'eyebrow' => 'Guide', 'title' => 'Delivery', 'copy' => 'Review tracked dispatch and delivery timing guidance.', 'url' => uootd_storefront_branding_get_page_url( 'delivery', '/delivery/' ) ),
		array( 'eyebrow' => 'Guide', 'title' => 'Payment', 'copy' => 'Understand how secure card checkout and payment handoff work.', 'url' => uootd_storefront_branding_get_page_url( 'payment', '/payment/' ) ),
		array( 'eyebrow' => 'Guide', 'title' => 'Exchanges & Returns', 'copy' => 'See the policy and next steps before opening a return.', 'url' => uootd_storefront_branding_get_page_url( 'exchanges-returns', '/exchanges-returns/' ) ),
	);

	ob_start();
	?>
	<div class="uootd-special-page">
		<?php
		switch ( $slug ) {
			case 'new-in':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'New arrivals',
						'title'   => $is_fabric_site ? 'The latest fabrics into the catalog.' : 'The latest pieces into the edit.',
						'copy'    => $is_fabric_site ? 'Fresh upholstery, jacquard, chenille, and decorative fabric drops with a direct path into checkout.' : 'Fresh product drops across bags, jewelry, and accessories with a direct path into secure checkout.',
						'chips'   => array( 'Weekly refresh', 'Tracked delivery', 'Secure payment' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo uootd_storefront_branding_render_product_grid_section( 'Newest arrivals', 'Updated by publish date so recent additions surface first.', uootd_storefront_branding_get_special_page_products( 'new-in' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;

			case 'trending':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Trending now',
						'title'   => 'The pieces drawing the strongest interest.',
						'copy'    => 'A faster way to browse popular product lines and high-click edits.',
						'chips'   => array( 'Popularity-led', 'Cross-category', 'Edit-ready' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo uootd_storefront_branding_render_product_grid_section( 'Trending products', 'Ordered by current product popularity.', uootd_storefront_branding_get_special_page_products( 'trending' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;

			case 'sale':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Sale',
						'title'   => 'Selected reductions without losing the luxury storefront feel.',
						'copy'    => 'Discounted products presented with the same clean discovery and trusted checkout flow.',
						'chips'   => array( 'Reduced prices', 'Direct checkout', 'Tracked dispatch' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo uootd_storefront_branding_render_product_grid_section( 'Current sale picks', 'Styles currently marked down in the catalog.', uootd_storefront_branding_get_special_page_products( 'sale' ), 'No sale products are available yet.' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;

			case 'designers':
				if ( '' !== $designer ) {
					echo uootd_storefront_branding_render_page_hero(
						array(
							'eyebrow' => $is_fabric_site ? 'Brand collection' : 'Designer edit',
							'title'   => $designer,
							'copy'    => $is_fabric_site ? 'A filtered view of this brand across the ' . uootd_storefront_branding_get_brand_name() . ' fabric catalog.' : 'A filtered view of this house across the ' . uootd_storefront_branding_get_brand_name() . ' catalog.',
							'chips'   => array( 'Brand-led browse', 'Secure card checkout', $is_fabric_site ? 'Fabric-led search' : 'Wish list ready' ),
							'cta'     => $is_fabric_site ? 'Back to brands' : 'Back to designers A-Z',
							'cta_url' => uootd_storefront_branding_get_page_url( 'designers', '/designers/' ),
						)
					); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					echo uootd_storefront_branding_render_product_grid_section( $designer . ' products', $is_fabric_site ? 'Grouped from product titles to create a cleaner brand-led fabric browse.' : 'Curated from product titles to create a cleaner designer-led browse.', uootd_storefront_branding_get_special_page_products( 'designer', array( 'designer' => $designer ) ), $is_fabric_site ? 'No products were found for this brand yet.' : 'No products were found for this designer yet.' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				} else {
					$catalog = uootd_storefront_branding_get_designer_catalog();
					echo uootd_storefront_branding_render_page_hero(
						array(
							'eyebrow' => $is_fabric_site ? 'Brands A-Z' : 'Designers A-Z',
							'title'   => $is_fabric_site ? 'Browse the catalog by brand.' : 'Browse the edit by fashion house.',
							'copy'    => $is_fabric_site ? 'Brand-level discovery makes it easier to jump into Gucci, LV, Dior, Fendi, and other fabric lines without digging through the full catalog.' : 'Brand-level discovery modeled on a luxury department-store browse, not a generic product feed.',
							'chips'   => array( 'A-Z browse', 'Brand counts', 'Fast category jump' ),
						)
					); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					?>
					<section class="uootd-special-section">
						<div class="uootd-special-section__head">
							<h2><?php echo esc_html( $is_fabric_site ? 'Brands' : 'Designers' ); ?></h2>
							<span><?php echo esc_html( $is_fabric_site ? 'Use the brand name as the entry point, then move directly into the right fabric collection.' : 'Use the house name as the entry point, then move directly into product discovery.' ); ?></span>
						</div>
						<div class="uootd-designer-grid">
							<?php foreach ( $catalog as $card ) : ?>
								<a class="uootd-designer-card" href="<?php echo esc_url( $card['url'] ); ?>">
									<?php if ( ! empty( $card['image'] ) ) : ?>
										<img src="<?php echo esc_url( $card['image'] ); ?>" alt="<?php echo esc_attr( $card['label'] ); ?>" loading="lazy" />
									<?php endif; ?>
									<div class="uootd-designer-card__copy">
										<p><?php echo esc_html( $card['eyebrow'] ); ?></p>
										<strong><?php echo esc_html( $card['label'] ); ?></strong>
										<span><?php echo esc_html( $card['count'] ); ?> <?php echo esc_html( $is_fabric_site ? 'products in this collection' : 'items in the edit' ); ?></span>
									</div>
								</a>
							<?php endforeach; ?>
						</div>
					</section>
					<?php
				}
				break;

			case 'editorial':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => $is_fabric_site ? 'Collections' : 'Editorial',
						'title'   => $is_fabric_site ? 'Collection-led routes through the fabric catalog.' : 'Campaign stories and category-led edits.',
						'copy'    => $is_fabric_site ? 'Use collection-led browse paths to move between new arrivals, trending fabric, and brand-based categories more quickly.' : 'A light editorial layer that links articles, category pages, and product discovery together.',
						'chips'   => array( 'Stories', 'Commerce links', 'SEO depth' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo uootd_storefront_branding_render_card_links(
					array(
						array( 'eyebrow' => 'Edit', 'title' => 'The new-in report', 'copy' => $is_fabric_site ? 'Start with the latest upholstery and decorative fabric arrivals.' : 'Start with the latest arrivals and move into the newest bags and accessories.', 'url' => uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ) ),
						array( 'eyebrow' => 'Edit', 'title' => 'Trending now', 'copy' => $is_fabric_site ? 'See which fabric listings and collections are drawing the most interest.' : 'See which pieces and houses are drawing the most interest.', 'url' => uootd_storefront_branding_get_page_url( 'trending', '/trending/' ) ),
						array( 'eyebrow' => 'Edit', 'title' => $is_fabric_site ? 'Brands A-Z' : 'Designers A-Z', 'copy' => $is_fabric_site ? 'Use brand-led discovery to shop with more intent.' : 'Use designer-led discovery to shop with more intent.', 'url' => uootd_storefront_branding_get_page_url( 'designers', '/designers/' ) ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo uootd_storefront_branding_render_product_grid_section( $is_fabric_site ? 'Collection picks' : 'Editorial picks', $is_fabric_site ? 'Featured fabrics that help visitors jump from high-level collection browse into actual products.' : 'Featured products that sit naturally beside magazine-style landing copy.', uootd_storefront_branding_get_special_page_products( 'editorial' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;

			case 'customer-care':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => uootd_storefront_branding_get_support_team_title(),
						'title'   => 'Every support path in one place.',
						'copy'    => 'Track orders, create returns, review delivery guidance, and contact the ' . strtolower( uootd_storefront_branding_get_support_team_label() ) . ' team from a unified service hub.',
						'chips'   => array( 'Track', 'Return', 'Payment help', 'Delivery help' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo uootd_storefront_branding_render_card_links( $care_cards ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;

			case 'track-order':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Track an order',
						'title'   => 'Check the status of your order.',
						'copy'    => 'Use your order number and billing email to see the current status.',
						'chips'   => array( 'Order lookup', 'Billing email', 'Status updates' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
				<section class="uootd-special-section">
					<div class="uootd-special-section__head">
						<h2>Order lookup</h2>
						<span>Enter the details used at checkout to review the latest order status.</span>
					</div>
					<div class="uootd-tracking-form">
						<?php echo do_shortcode( '[woocommerce_order_tracking]' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					</div>
				</section>
				<?php
				echo uootd_storefront_branding_render_card_links( $care_cards ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;

			case 'create-return':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Create a return',
						'title'   => 'Open a return request with ' . strtolower( uootd_storefront_branding_get_support_team_label() ) . '.',
						'copy'    => 'Share your order details and the team can review the next step.',
						'chips'   => array( 'Order reference', 'Reason', uootd_storefront_branding_get_support_team_title() ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
				<section class="uootd-special-section">
					<?php echo uootd_storefront_branding_render_form_notice( 'return' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					<?php echo uootd_storefront_branding_render_support_form( 'return' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</section>
				<?php
				break;

			case 'contact-us':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Contact us',
						'title'   => $is_fabric_site ? 'Ask before you order fabric, or follow up after checkout.' : 'Ask before you buy, or follow up after checkout.',
						'copy'    => $is_fabric_site ? 'Questions about texture, weight, delivery timing, or payment can all route through the same ' . strtolower( uootd_storefront_branding_get_support_team_label() ) . ' layer.' : 'Questions about finish, delivery timing, or payment can all route through the same ' . strtolower( uootd_storefront_branding_get_support_team_label() ) . ' layer.',
						'chips'   => array( 'Pre-purchase help', 'Delivery help', 'Order follow-up' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
				<section class="uootd-special-section">
					<?php echo uootd_storefront_branding_render_form_notice( 'contact' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					<?php echo uootd_storefront_branding_render_support_form( 'contact' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</section>
				<?php
				break;

			case 'delivery':
			case 'payment':
			case 'exchanges-returns':
			case 'terms':
			case 'privacy':
			case 'cookie':
			case 'rewards':
				$titles = array(
					'delivery'          => 'Delivery that feels clearer before purchase.',
					'payment'           => 'Payment that stays consistent with the storefront experience.',
					'exchanges-returns' => 'Exchanges and returns made easier to start.',
					'terms'             => 'Terms that make order expectations more explicit.',
					'privacy'           => 'Privacy details presented in plain language.',
					'cookie'            => 'Cookie information focused on customer convenience and analytics.',
					'rewards'           => 'Rewards will grow into early access and service-led benefits.',
				);
				$copy = array(
					'delivery'          => 'Orders are confirmed after payment and then move through tracked dispatch. Timing can vary by item, but updates remain visible through your order journey.',
					'payment'           => 'Checkout uses a hosted secure card handoff so billing details are entered on a payment page that feels more focused and lower risk.',
					'exchanges-returns' => 'If you need to create a return, start from the return request page with your order number, email, and the reason for the request.',
					'terms'             => 'Using the storefront and placing an order means agreeing to the purchase flow, delivery expectations, and support process described across the site.',
					'privacy'           => 'Order details, account data, and support submissions are used to complete purchases and follow up on service requests.',
					'cookie'            => 'Cookies help remember storefront preferences, understand on-site behavior, and improve performance across devices.',
					'rewards'           => 'This section is the placeholder for loyalty logic, early access drops, and future high-value client benefits.',
				);
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Guide',
						'title'   => $titles[ $slug ],
						'copy'    => $copy[ $slug ],
						'chips'   => array( uootd_storefront_branding_get_support_team_title(), uootd_storefront_branding_is_fabric_catalog() ? 'Fabric buying guidance' : 'Luxury storefront cues', 'Support-first UX' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
				<section class="uootd-special-section">
					<div class="uootd-special-section__head">
						<h2>What this means for the customer</h2>
						<span><?php echo esc_html( $copy[ $slug ] ); ?></span>
					</div>
					<?php echo uootd_storefront_branding_render_card_links( $care_cards ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</section>
				<?php
				break;

			case 'wishlist':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Wish list',
						'title'   => 'Save pieces and return when you are ready.',
						'copy'    => 'Favorites are kept locally so customers can move between inspiration and purchase more easily.',
						'chips'   => array( 'Saved products', 'Quick re-entry', 'Direct checkout' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
				<section class="uootd-special-section">
					<p class="uootd-wishlist-empty" data-uootd-wishlist-empty>Your wish list is empty. Save products from listing pages or a product page to build your edit.</p>
					<div class="uootd-discovery-grid" data-uootd-wishlist-grid></div>
				</section>
				<?php
				break;

			case 'home-style':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Home',
						'title'   => 'A softer edit for home-style pieces and accents.',
						'copy'    => 'Extend the browse beyond fashion-only categories with decorative, collectible, and gifting-led pieces.',
						'chips'   => array( 'Decorative accents', 'Gifting edit', 'Cross-category' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo uootd_storefront_branding_render_product_grid_section( 'Home-style picks', 'A light expansion beyond the core fashion edit.', uootd_storefront_branding_get_special_page_products( 'home-style' ), 'No home-style products are available yet.' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;

			case 'search':
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => 'Search',
						'title'   => '' !== $query ? 'Results for "' . $query . '"' : ( $is_fabric_site ? 'Search the fabric catalog' : 'Search the edit' ),
						'copy'    => $is_fabric_site ? 'Look up fabric names, brand-inspired collections, and category cues from one dedicated search page.' : 'Look up brands, product names, and category cues from a cleaner dedicated search page.',
						'chips'   => array( 'Autosuggest', $is_fabric_site ? 'Collection-first' : 'Designer-first', 'Product results' ),
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
				<section class="uootd-special-section">
					<form class="uootd-search-page-form" method="get" action="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'search', '/search/' ) ); ?>">
						<input type="search" name="q" value="<?php echo esc_attr( $query ); ?>" placeholder="<?php echo esc_attr( $is_fabric_site ? 'Search for a fabric, brand, or collection' : 'Search for a brand, bag, or category' ); ?>" />
						<button type="submit">Search</button>
					</form>
				</section>
				<?php
				if ( '' !== $query ) {
					echo uootd_storefront_branding_render_product_grid_section( 'Search results', 'Relevant matches from the live WooCommerce catalog.', uootd_storefront_branding_get_special_page_products( 'search', array( 'query' => $query ) ), 'No results matched that search yet.' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				} else {
					echo uootd_storefront_branding_render_card_links(
						$is_fabric_site
							? array(
								array( 'eyebrow' => 'Try', 'title' => 'All Fabrics', 'copy' => 'Browse the full upholstery fabric catalog.', 'url' => home_url( '/product-category/all-fabrics/' ) ),
								array( 'eyebrow' => 'Try', 'title' => 'Brands', 'copy' => 'Use the brand index for fabric-led discovery.', 'url' => uootd_storefront_branding_get_page_url( 'designers', '/designers/' ) ),
								array( 'eyebrow' => 'Try', 'title' => 'New Arrivals', 'copy' => 'Start with the latest fabric arrivals.', 'url' => uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ) ),
							)
							: array(
								array( 'eyebrow' => 'Try', 'title' => 'Bags', 'copy' => 'Browse the core bag edit.', 'url' => home_url( '/product-category/bags/' ) ),
								array( 'eyebrow' => 'Try', 'title' => 'Designers', 'copy' => 'Use the A-Z designer page for house-led discovery.', 'url' => uootd_storefront_branding_get_page_url( 'designers', '/designers/' ) ),
								array( 'eyebrow' => 'Try', 'title' => 'New In', 'copy' => 'Start with the latest arrivals.', 'url' => uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ) ),
							)
					); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				}
				break;

			default:
				echo uootd_storefront_branding_render_page_hero(
					array(
						'eyebrow' => uootd_storefront_branding_get_brand_wordmark(),
						'title'   => 'Explore the edit',
						'copy'    => $is_fabric_site ? 'Use the primary navigation to browse new arrivals, core fabric collections, and support pages.' : 'Use the primary navigation to browse new arrivals, designers, and support pages.',
						'cta'     => 'Back to shop',
						'cta_url' => $shop_url,
					)
				); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				break;
		}
		?>
	</div>
	<?php
	$output = (string) ob_get_clean();

	return $output;
}

function uootd_storefront_branding_register_rest_routes() {
	register_rest_route(
		'uootd/v1',
		'/search',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'uootd_storefront_branding_rest_search',
			'permission_callback' => '__return_true',
		)
	);
}

function uootd_storefront_branding_rest_search( WP_REST_Request $request ) {
	$query = trim( (string) $request->get_param( 'q' ) );
	if ( '' === $query ) {
		return rest_ensure_response( array() );
	}

	$products = wc_get_products(
		array(
			'status'  => 'publish',
			'limit'   => 8,
			'orderby' => 'date',
			'order'   => 'DESC',
			'search'  => $query,
		)
	);

	$results = array();
	$needle  = strtolower( $query );
	foreach ( $products as $product ) {
		if ( ! $product instanceof WC_Product ) {
			continue;
		}

		$brand = uootd_storefront_branding_extract_brand_from_name( $product->get_name() );
		$hay   = strtolower( $product->get_name() . ' ' . $brand );
		if ( false === strpos( $hay, $needle ) ) {
			continue;
		}

		$results[] = array(
			'id'        => $product->get_id(),
			'name'      => $product->get_name(),
			'brand'     => $brand,
			'price'     => wp_strip_all_tags( $product->get_price_html() ),
			'permalink' => $product->get_permalink(),
			'image'     => wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' ),
		);
	}

	return rest_ensure_response( $results );
}

function uootd_storefront_branding_render_search_overlay() {
	if ( is_admin() ) {
		return;
	}
	?>
	<div class="uootd-search-overlay" hidden data-uootd-search-overlay>
		<div class="uootd-search-overlay__panel">
			<div class="uootd-search-overlay__head">
				<strong><?php echo esc_html( uootd_storefront_branding_is_fabric_catalog() ? 'Search the fabric catalog' : 'Search the edit' ); ?></strong>
				<button type="button" data-uootd-search-close>Close</button>
			</div>
			<form class="uootd-search-form" action="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'search', '/search/' ) ); ?>" method="get">
				<input type="search" name="q" placeholder="<?php echo esc_attr( uootd_storefront_branding_is_fabric_catalog() ? 'Search fabric, brand, or collection' : 'Search designer, bag, jewelry, or accessory' ); ?>" autocomplete="off" data-uootd-search-input />
				<button type="submit">Search</button>
			</form>
			<div class="uootd-search-results" data-uootd-search-results></div>
			<div class="uootd-search-overlay__suggestions">
				<?php if ( uootd_storefront_branding_is_fabric_catalog() ) : ?>
					<a href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ) ); ?>">New Arrivals</a>
					<a href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'designers', '/designers/' ) ); ?>">Brands</a>
					<a href="<?php echo esc_url( home_url( '/product-category/all-fabrics/' ) ); ?>">All Fabrics</a>
				<?php else : ?>
					<a href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'new-in', '/new-in/' ) ); ?>">New In</a>
					<a href="<?php echo esc_url( uootd_storefront_branding_get_page_url( 'designers', '/designers/' ) ); ?>">Designers</a>
					<a href="<?php echo esc_url( home_url( '/product-category/bags/' ) ); ?>">Bags</a>
				<?php endif; ?>
			</div>
		</div>
	</div>
	<?php
}

function uootd_storefront_branding_render_wishlist_button_markup( $product, $context = 'single' ) {
	if ( ! $product instanceof WC_Product ) {
		return '';
	}

	$image = wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' );
	$brand = uootd_storefront_branding_extract_brand_from_name( $product->get_name() );
	$label = 'single' === $context ? 'Save to Wish List' : 'Save';

	return sprintf(
		'<button type="button" class="uootd-wishlist-toggle uootd-%1$s-wishlist" data-product-id="%2$d" data-product-name="%3$s" data-product-brand="%4$s" data-product-url="%5$s" data-product-price="%6$s" data-product-image="%7$s" aria-pressed="false">%8$s</button>',
		esc_attr( $context ),
		(int) $product->get_id(),
		esc_attr( $product->get_name() ),
		esc_attr( $brand ),
		esc_url( $product->get_permalink() ),
		esc_attr( wp_strip_all_tags( $product->get_price_html() ) ),
		esc_url( $image ),
		esc_html( $label )
	);
}

function uootd_storefront_branding_render_single_wishlist_button() {
	global $product;

	if ( ! is_product() || ! $product instanceof WC_Product ) {
		return;
	}

	echo uootd_storefront_branding_render_wishlist_button_markup( $product, 'single' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

function uootd_storefront_branding_render_loop_wishlist_button() {
	global $product;

	if ( ! $product instanceof WC_Product ) {
		return;
	}

	echo uootd_storefront_branding_render_wishlist_button_markup( $product, 'loop' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

function uootd_storefront_branding_handle_client_request() {
	$nonce = isset( $_POST['uootd_client_request_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['uootd_client_request_nonce'] ) ) : '';
	if ( ! wp_verify_nonce( $nonce, 'uootd_client_request' ) ) {
		wp_die( 'Invalid request.' );
	}

	$type       = isset( $_POST['request_type'] ) ? sanitize_text_field( wp_unslash( $_POST['request_type'] ) ) : 'contact';
	$name       = isset( $_POST['client_name'] ) ? sanitize_text_field( wp_unslash( $_POST['client_name'] ) ) : '';
	$email      = isset( $_POST['client_email'] ) ? sanitize_email( wp_unslash( $_POST['client_email'] ) ) : '';
	$order      = isset( $_POST['order_number'] ) ? sanitize_text_field( wp_unslash( $_POST['order_number'] ) ) : '';
	$subject    = isset( $_POST['subject'] ) ? sanitize_text_field( wp_unslash( $_POST['subject'] ) ) : '';
	$details    = isset( $_POST['details'] ) ? sanitize_textarea_field( wp_unslash( $_POST['details'] ) ) : '';
	$redirect   = isset( $_POST['redirect_to'] ) ? esc_url_raw( wp_unslash( $_POST['redirect_to'] ) ) : home_url( '/' );
	$post_title = sprintf( '%s request - %s', ucfirst( $type ), $name ? $name : 'Client' );
	$content    = "Email: {$email}\nOrder: {$order}\nSubject: {$subject}\n\n{$details}";

	wp_insert_post(
		array(
			'post_type'    => 'uootd_request',
			'post_status'  => 'publish',
			'post_title'   => $post_title,
			'post_content' => $content,
		)
	);

	$submitted = 'return' === $type ? 'return' : 'contact';
	wp_safe_redirect( add_query_arg( 'submitted', $submitted, $redirect ) );
	exit;
}
