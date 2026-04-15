<?php
/**
 * Plugin Name: UOOTD Checkout Branding
 * Description: Adds a branded cart and checkout shell for the UOOTD storefront.
 * Author: OpenAI Codex
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_enqueue_scripts', 'uootd_checkout_branding_enqueue_assets', 40 );
add_action( 'wp_footer', 'uootd_checkout_branding_render_redirect_overlay', 30 );
add_filter( 'body_class', 'uootd_checkout_branding_body_class' );
add_filter( 'the_content', 'uootd_checkout_branding_prepend_intro', 5 );
add_filter( 'woocommerce_gateway_title', 'uootd_checkout_branding_gateway_title', 20, 2 );
add_filter( 'woocommerce_gateway_description', 'uootd_checkout_branding_gateway_description', 20, 2 );
add_filter( 'woocommerce_coupons_enabled', '__return_false' );
add_filter( 'woocommerce_enable_order_notes_field', '__return_false' );
add_filter( 'woocommerce_checkout_fields', 'uootd_checkout_branding_require_phone' );
add_filter( 'woocommerce_order_button_text', 'uootd_checkout_branding_order_button_text' );
add_filter( 'gettext', 'uootd_checkout_branding_classic_checkout_strings', 20, 3 );

function uootd_checkout_branding_get_page_type() {
	if ( function_exists( 'is_cart' ) && is_cart() ) {
		return 'cart';
	}

	if ( function_exists( 'is_checkout_pay_page' ) && is_checkout_pay_page() ) {
		return 'pay';
	}

	if ( function_exists( 'is_checkout' ) && is_checkout() ) {
		if ( function_exists( 'is_order_received_page' ) && is_order_received_page() ) {
			return '';
		}

		return 'checkout';
	}

	return '';
}

function uootd_checkout_branding_enqueue_assets() {
	$page_type = uootd_checkout_branding_get_page_type();
	if ( '' === $page_type ) {
		return;
	}

	$css_handle = 'uootd-checkout-branding';
	$js_handle  = 'uootd-checkout-branding';
	$css_path   = dirname( __FILE__ ) . '/uootd-checkout-branding.css';
	$js_path    = dirname( __FILE__ ) . '/uootd-checkout-branding.js';
	$asset_base = content_url( 'mu-plugins' );

	wp_enqueue_style(
		$css_handle,
		$asset_base . '/uootd-checkout-branding.css',
		array(),
		file_exists( $css_path ) ? (string) filemtime( $css_path ) : '1.0.0'
	);

	wp_enqueue_script(
		$js_handle,
		$asset_base . '/uootd-checkout-branding.js',
		array(),
		file_exists( $js_path ) ? (string) filemtime( $js_path ) : '1.0.0',
		true
	);

	$copy = array(
		'pageType'     => $page_type,
		'replacements' => array(
			'Cart'                       => 'Your Bag',
			'Checkout'                   => 'Secure Checkout',
			'Proceed to checkout'        => 'Continue to Secure Checkout',
			'Place order'                => 'Open Secure Checkout',
			'Order summary'              => 'Your Order',
			'Payment'                    => 'Secure Payment',
			'Billing address'            => 'Shipping and billing address',
			'Delivery Details'           => 'Shipping and billing address',
			'Contact information'        => 'Client Details',
			'Phone (optional)'           => 'Phone number',
			'Phone'                      => 'Phone number',
			'Payment options'            => 'Secure payment',
			'Shipping and billing address' => 'Shipping and billing address',
		),
		'helperText'   => array(
			'cart'     => 'Your delivery details and selected items carry over to the secure payment page.',
			'checkout' => 'After you place the order, we automatically carry your contact and delivery details into the secure payment page.',
			'pay'      => 'Reopen your hosted secure payment page to complete this order.',
		),
		'redirectOverlay' => array(
			'enabled'           => in_array( $page_type, array( 'checkout', 'pay' ), true ),
			'seconds'           => 5,
			'countdownTemplate' => 'Redirecting in %ss',
			'waitingLabel'      => 'Still opening secure checkout...',
		),
	);

	wp_add_inline_script( $js_handle, 'window.uootdCheckoutBranding=' . wp_json_encode( $copy ) . ';', 'before' );
}

function uootd_checkout_branding_render_redirect_overlay() {
	$page_type = uootd_checkout_branding_get_page_type();
	if ( ! in_array( $page_type, array( 'checkout', 'pay' ), true ) ) {
		return;
	}
	?>
	<div class="uootd-checkout-redirect-overlay" data-uootd-redirect-overlay hidden aria-hidden="true" role="status" aria-live="polite">
		<div class="uootd-checkout-redirect-overlay__dialog">
			<p class="uootd-checkout-redirect-overlay__eyebrow">Secure handoff</p>
			<h2 class="uootd-checkout-redirect-overlay__title">Opening secure payment page</h2>
			<p class="uootd-checkout-redirect-overlay__copy" data-uootd-redirect-overlay-message>
				We are transferring your order total, contact details, and delivery information to our hosted secure checkout.
			</p>
			<div class="uootd-checkout-redirect-overlay__countdown" data-uootd-redirect-overlay-state="countdown">
				<span class="uootd-checkout-redirect-overlay__seconds" data-uootd-redirect-overlay-seconds>5</span>
				<span class="uootd-checkout-redirect-overlay__label" data-uootd-redirect-overlay-label>Redirecting in 5s</span>
			</div>
			<p class="uootd-checkout-redirect-overlay__hint">
				Please keep this tab open. You will be redirected automatically.
			</p>
		</div>
	</div>
	<?php
}

function uootd_checkout_branding_body_class( $classes ) {
	$page_type = uootd_checkout_branding_get_page_type();
	if ( '' === $page_type ) {
		return $classes;
	}

	$classes[] = 'uootd-checkout-shell';
	$classes[] = 'uootd-checkout-shell--' . $page_type;

	return $classes;
}

function uootd_checkout_branding_prepend_intro( $content ) {
	if ( is_admin() || ! in_the_loop() || ! is_main_query() ) {
		return $content;
	}

	$page_type = uootd_checkout_branding_get_page_type();
	if ( '' === $page_type ) {
		return $content;
	}

	static $rendered = false;
	if ( $rendered ) {
		return $content;
	}
	$rendered = true;

	if ( 'checkout' === $page_type ) {
		$classic_checkout = do_shortcode( '[woocommerce_checkout]' );
		if ( '' !== trim( $classic_checkout ) ) {
			$content = $classic_checkout;
		}
	}

	return uootd_checkout_branding_render_intro( $page_type ) . $content;
}

function uootd_checkout_branding_render_intro( $page_type ) {
	$shop_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/' );
	$cart_url = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' );

	$config = array(
		'cart'     => array(
			'eyebrow'     => 'Private Client Cart',
			'title'       => 'Your Bag',
			'description' => 'Review your final selection, refine quantities, then continue to our secure hosted checkout.',
			'primary_url' => $shop_url,
			'primary'     => 'Keep Browsing',
			'secondary'   => 'Hosted card payment',
		),
		'checkout' => array(
			'eyebrow'     => 'Secure Checkout',
			'title'       => 'Finalize Your Order',
			'description' => 'Confirm delivery details here. We carry the same information into the hosted secure payment page automatically.',
			'primary_url' => $cart_url,
			'primary'     => 'Back to Bag',
			'secondary'   => 'Tracked order support',
		),
		'pay'      => array(
			'eyebrow'     => 'Complete Payment',
			'title'       => 'Open Your Secure Payment Page',
			'description' => 'This order already has a hosted payment session. Reopen it any time below and continue exactly where you left off.',
			'primary_url' => $cart_url,
			'primary'     => 'Back to Bag',
			'secondary'   => 'Concierge-ready checkout',
		),
	);

	$data = isset( $config[ $page_type ] ) ? $config[ $page_type ] : $config['checkout'];
	$steps = uootd_checkout_branding_get_progress_steps( $page_type );

	ob_start();
	?>
	<section class="uootd-checkout-hero" aria-label="<?php echo esc_attr( $data['title'] ); ?>">
		<div class="uootd-checkout-hero__veil" aria-hidden="true"></div>
		<div class="uootd-checkout-hero__content">
			<p class="uootd-checkout-hero__eyebrow"><?php echo esc_html( $data['eyebrow'] ); ?></p>
			<h1 class="uootd-checkout-hero__title"><?php echo esc_html( $data['title'] ); ?></h1>
			<ol class="uootd-checkout-progress" aria-label="Checkout progress">
				<?php foreach ( $steps as $index => $step ) : ?>
					<li class="uootd-checkout-progress__step uootd-checkout-progress__step--<?php echo esc_attr( $step['state'] ); ?>"<?php if ( 'current' === $step['state'] ) : ?> aria-current="step"<?php endif; ?>>
						<span class="uootd-checkout-progress__marker" aria-hidden="true">
							<?php echo esc_html( $index + 1 ); ?>
						</span>
						<span class="uootd-checkout-progress__copy">
							<strong><?php echo esc_html( $step['label'] ); ?></strong>
							<em><?php echo esc_html( $step['note'] ); ?></em>
						</span>
					</li>
				<?php endforeach; ?>
			</ol>
			<p class="uootd-checkout-hero__description"><?php echo esc_html( $data['description'] ); ?></p>
			<div class="uootd-checkout-hero__actions">
				<a class="uootd-checkout-hero__link" href="<?php echo esc_url( $data['primary_url'] ); ?>"><?php echo esc_html( $data['primary'] ); ?></a>
				<span class="uootd-checkout-hero__meta"><?php echo esc_html( $data['secondary'] ); ?></span>
			</div>
		</div>
		<div class="uootd-checkout-hero__chips" aria-hidden="true">
			<span>Encrypted card handoff</span>
			<span>Client service follow-up</span>
			<span>Delivery updates after payment</span>
		</div>
	</section>
	<?php
	return (string) ob_get_clean();
}

function uootd_checkout_branding_get_progress_steps( $page_type ) {
	$states = array(
		'cart'     => array( 'current', 'upcoming', 'upcoming' ),
		'checkout' => array( 'complete', 'current', 'upcoming' ),
		'pay'      => array( 'complete', 'complete', 'current' ),
	);

	$step_states = isset( $states[ $page_type ] ) ? $states[ $page_type ] : $states['checkout'];

	return array(
		array(
			'label' => 'Bag',
			'note'  => 'Review your selection',
			'state' => $step_states[0],
		),
		array(
			'label' => 'Details',
			'note'  => 'Confirm shipping info',
			'state' => $step_states[1],
		),
		array(
			'label' => 'Secure Payment',
			'note'  => 'Open hosted checkout',
			'state' => $step_states[2],
		),
	);
}

function uootd_checkout_branding_gateway_title( $title, $gateway_id ) {
	if ( 'uootd_inflyway' !== $gateway_id ) {
		return $title;
	}

	return 'Secure Card Checkout';
}

function uootd_checkout_branding_gateway_description( $description, $gateway_id ) {
	if ( 'uootd_inflyway' !== $gateway_id ) {
		return $description;
	}

	return 'Pay on our hosted secure card page with guided order support and post-payment confirmation.';
}

function uootd_checkout_branding_require_phone( $fields ) {
	if ( empty( $fields['billing']['billing_phone'] ) ) {
		return $fields;
	}

	$fields['billing']['billing_phone']['required'] = true;
	$fields['billing']['billing_phone']['label']    = 'Phone number';
	$fields['billing']['billing_phone']['priority'] = 85;

	return $fields;
}

function uootd_checkout_branding_order_button_text( $text ) {
	if ( 'checkout' !== uootd_checkout_branding_get_page_type() ) {
		return $text;
	}

	return 'OPEN SECURE CHECKOUT';
}

function uootd_checkout_branding_classic_checkout_strings( $translated, $text, $domain ) {
	if ( is_admin() || 'checkout' !== uootd_checkout_branding_get_page_type() ) {
		return $translated;
	}

	$replacements = array(
		'Billing details' => 'Shipping and billing address',
		'Your order'      => 'Your Order',
		'Place order'     => 'Open Secure Checkout',
	);

	if ( isset( $replacements[ $text ] ) ) {
		return $replacements[ $text ];
	}

	return $translated;
}
