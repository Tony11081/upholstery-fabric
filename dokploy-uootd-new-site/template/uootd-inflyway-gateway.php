<?php
/**
 * Plugin Name: UOOTD Inflyway Gateway
 * Description: Adds an Inflyway hosted checkout gateway for WooCommerce with payment sync support.
 * Author: OpenAI Codex
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const UOOTD_INFLYWAY_GATEWAY_ID          = 'uootd_inflyway';
const UOOTD_INFLYWAY_SETTINGS_OPTION     = 'woocommerce_uootd_inflyway_settings';
const UOOTD_INFLYWAY_LINK_META           = '_uootd_inflyway_payment_link';
const UOOTD_INFLYWAY_ORDER_ID_META       = '_uootd_inflyway_order_id';
const UOOTD_INFLYWAY_ORDER_REF_META      = '_uootd_inflyway_order_ref';
const UOOTD_INFLYWAY_LAST_SYNC_META      = '_uootd_inflyway_last_sync_at';
const UOOTD_INFLYWAY_LAST_STATUS_META    = '_uootd_inflyway_last_status';
const UOOTD_INFLYWAY_PAID_AT_META        = '_uootd_inflyway_paid_at';
const UOOTD_INFLYWAY_CALLBACK_TOKEN_META = '_uootd_inflyway_callback_token';
const UOOTD_INFLYWAY_CRON_HOOK           = 'uootd_inflyway_poll_payments';

add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
		}
	}
);

add_filter(
	'cron_schedules',
	static function ( $schedules ) {
		$schedules['uootd_inflyway_five_minutes'] = array(
			'interval' => 300,
			'display'  => __( 'Every Five Minutes', 'uootd-inflyway' ),
		);

		return $schedules;
	}
);

add_action(
	'init',
	static function () {
		if ( ! wp_next_scheduled( UOOTD_INFLYWAY_CRON_HOOK ) ) {
			wp_schedule_event( time() + 300, 'uootd_inflyway_five_minutes', UOOTD_INFLYWAY_CRON_HOOK );
		}
	}
);

add_action( UOOTD_INFLYWAY_CRON_HOOK, 'uootd_inflyway_poll_pending_orders' );
add_action( 'rest_api_init', 'uootd_inflyway_register_rest_routes' );
add_action( 'plugins_loaded', 'uootd_inflyway_bootstrap_gateway', 20 );

function uootd_inflyway_bootstrap_gateway() {
	if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
		return;
	}

	class UOOTD_WC_Gateway_Inflyway extends WC_Payment_Gateway {
		public function __construct() {
			$this->id                 = UOOTD_INFLYWAY_GATEWAY_ID;
			$this->method_title       = __( 'Inflyway Hosted Checkout', 'uootd-inflyway' );
			$this->method_description = __( 'Redirect customers to Inflyway hosted checkout and sync paid orders back into WooCommerce.', 'uootd-inflyway' );
			$this->has_fields         = false;
			$this->supports           = array( 'products' );

			$this->init_form_fields();
			$this->init_settings();

			$this->title       = $this->get_option( 'title', __( 'Credit / Debit Card', 'uootd-inflyway' ) );
			$this->description = $this->get_option( 'description', __( 'Pay securely on our hosted checkout page.', 'uootd-inflyway' ) );
			$this->enabled     = $this->get_option( 'enabled', 'no' );

			add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
		}

		public function init_form_fields() {
			$callback_url = rest_url( 'uootd-inflyway/v1/payment-callback' );
			$token        = uootd_inflyway_get_callback_token();

			$this->form_fields = array(
				'enabled'           => array(
					'title'   => __( 'Enable/Disable', 'uootd-inflyway' ),
					'type'    => 'checkbox',
					'label'   => __( 'Enable Inflyway hosted checkout', 'uootd-inflyway' ),
					'default' => 'no',
				),
				'title'             => array(
					'title'       => __( 'Title', 'uootd-inflyway' ),
					'type'        => 'text',
					'description' => __( 'Title shown to customers during checkout.', 'uootd-inflyway' ),
					'default'     => __( 'Credit / Debit Card', 'uootd-inflyway' ),
					'desc_tip'    => true,
				),
				'description'       => array(
					'title'       => __( 'Description', 'uootd-inflyway' ),
					'type'        => 'textarea',
					'description' => __( 'Short description shown below the payment method at checkout.', 'uootd-inflyway' ),
					'default'     => __( 'You will be redirected to our secure hosted checkout page to complete payment.', 'uootd-inflyway' ),
				),
				'api_base_url'      => array(
					'title'       => __( 'API Base URL', 'uootd-inflyway' ),
					'type'        => 'text',
					'description' => __( 'Primary Inflyway API gateway URL.', 'uootd-inflyway' ),
					'default'     => 'https://inflyway-api.openaigrowth.com',
					'desc_tip'    => true,
				),
				'fallback_base_url' => array(
					'title'       => __( 'Fallback Base URL', 'uootd-inflyway' ),
					'type'        => 'text',
					'description' => __( 'Optional fallback gateway used when the primary route is unavailable.', 'uootd-inflyway' ),
					'default'     => 'http://23.94.38.181:3456',
					'desc_tip'    => true,
				),
				'api_key'           => array(
					'title'       => __( 'API Key', 'uootd-inflyway' ),
					'type'        => 'password',
					'description' => __( 'Sent in the x-api-key header for checkout and payment sync requests.', 'uootd-inflyway' ),
					'default'     => '',
				),
				'create_path'       => array(
					'title'       => __( 'Create Order Path', 'uootd-inflyway' ),
					'type'        => 'text',
					'description' => __( 'Relative path used to create checkout links.', 'uootd-inflyway' ),
					'default'     => '/checkout/create',
					'desc_tip'    => true,
				),
				'lookup_path'       => array(
					'title'       => __( 'Lookup Order Path', 'uootd-inflyway' ),
					'type'        => 'text',
					'description' => __( 'Relative path used to check payment status.', 'uootd-inflyway' ),
					'default'     => '/orders/get',
					'desc_tip'    => true,
				),
				'callback_token'    => array(
					'title'       => __( 'Callback Token', 'uootd-inflyway' ),
					'type'        => 'text',
					'description' => sprintf(
						__( 'Optional token for the payment callback endpoint. Callback URL: %1$s . Current token: %2$s', 'uootd-inflyway' ),
						$callback_url,
						$token
					),
					'default'     => $token,
				),
				'debug'             => array(
					'title'   => __( 'Debug Logging', 'uootd-inflyway' ),
					'type'    => 'checkbox',
					'label'   => __( 'Write API request notes into the WooCommerce order log', 'uootd-inflyway' ),
					'default' => 'no',
				),
			);
		}

		public function is_available() {
			if ( 'yes' !== $this->enabled ) {
				return false;
			}

			$api_key = trim( (string) $this->get_option( 'api_key', '' ) );
			if ( '' === $api_key ) {
				return false;
			}

			return parent::is_available();
		}

		public function admin_options() {
			parent::admin_options();
			echo '<p style="margin-top:12px;">' . esc_html__( 'Orders created through this gateway are polled every five minutes and can also be updated via the callback endpoint.', 'uootd-inflyway' ) . '</p>';
		}

		public function process_payment( $order_id ) {
			$order = wc_get_order( $order_id );
			if ( ! $order ) {
				wc_add_notice( __( 'Order not found.', 'uootd-inflyway' ), 'error' );
				return array( 'result' => 'failure' );
			}

			$existing_link = uootd_inflyway_normalize_url( $order->get_meta( UOOTD_INFLYWAY_LINK_META ) );
			if ( $existing_link && ! $order->is_paid() ) {
				if ( function_exists( 'WC' ) && WC()->cart ) {
					WC()->cart->empty_cart();
				}

				return array(
					'result'   => 'success',
					'redirect' => $existing_link,
				);
			}

			$payload  = uootd_inflyway_build_checkout_payload( $order );
			$response = uootd_inflyway_request_gateway( uootd_inflyway_get_setting( 'create_path', '/checkout/create' ), $payload );
			$result   = uootd_inflyway_extract_gateway_order_result( $response['response'] );

			if ( empty( $response['ok'] ) ) {
				$message = uootd_inflyway_extract_gateway_error( $response );
				$order->add_order_note( sprintf( 'Inflyway checkout creation failed: %s', $message ) );
				wc_add_notice( $message, 'error' );
				return array( 'result' => 'failure' );
			}

			if ( empty( $result['success'] ) && ! empty( $payload['image'] ) && uootd_inflyway_should_retry_without_image( $result['error'] ) ) {
				$payload['image'] = '';
				$response         = uootd_inflyway_request_gateway( uootd_inflyway_get_setting( 'create_path', '/checkout/create' ), $payload );
				$result           = uootd_inflyway_extract_gateway_order_result( $response['response'] );
			}

			if ( empty( $result['success'] ) && ! empty( $payload['type'] ) && 'default' !== $payload['type'] && uootd_inflyway_should_retry_with_default_template( $result['error'] ) ) {
				$payload['type']  = 'default';
				$payload['image'] = '';
				$payload['title'] = uootd_inflyway_build_gateway_title( $payload['orderRef'], 'default' );
				$response         = uootd_inflyway_request_gateway( uootd_inflyway_get_setting( 'create_path', '/checkout/create' ), $payload );
				$result           = uootd_inflyway_extract_gateway_order_result( $response['response'] );
			}

			if ( empty( $result['success'] ) || empty( $result['order_url'] ) ) {
				$message = ! empty( $result['error'] ) ? $result['error'] : __( 'Unable to create payment link.', 'uootd-inflyway' );
				$order->add_order_note( sprintf( 'Inflyway checkout creation failed: %s', $message ) );
				wc_add_notice( $message, 'error' );
				return array( 'result' => 'failure' );
			}

			$order->update_meta_data( UOOTD_INFLYWAY_LINK_META, $result['order_url'] );
			$order->update_meta_data( UOOTD_INFLYWAY_ORDER_ID_META, $result['order_id'] );
			$order->update_meta_data( UOOTD_INFLYWAY_ORDER_REF_META, $payload['orderRef'] );
			$order->update_meta_data( UOOTD_INFLYWAY_LAST_SYNC_META, current_time( 'mysql', true ) );
			$order->update_meta_data( UOOTD_INFLYWAY_LAST_STATUS_META, 'pending' );
			$order->save();

			$order->add_order_note(
				sprintf(
					'Inflyway checkout created. Order ID: %1$s. Payment link: %2$s',
					$result['order_id'] ? $result['order_id'] : 'n/a',
					$result['order_url']
				)
			);

			if ( 'yes' === uootd_inflyway_get_setting( 'debug', 'no' ) ) {
				$order->add_order_note( 'Inflyway payload: ' . wp_json_encode( $payload ) );
			}

			if ( function_exists( 'WC' ) && WC()->cart ) {
				WC()->cart->empty_cart();
			}

			return array(
				'result'   => 'success',
				'redirect' => $result['order_url'],
			);
		}
	}

	if ( class_exists( 'Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' ) && ! class_exists( 'UOOTD_WC_Gateway_Inflyway_Blocks' ) ) {
		class UOOTD_WC_Gateway_Inflyway_Blocks extends Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType {
			protected $name = UOOTD_INFLYWAY_GATEWAY_ID;

			public function initialize() {
				$this->settings = get_option( UOOTD_INFLYWAY_SETTINGS_OPTION, array() );
			}

			public function is_active() {
				return 'yes' === (string) $this->get_setting( 'enabled', 'no' ) && '' !== trim( (string) $this->get_setting( 'api_key', '' ) );
			}

			public function get_payment_method_script_handles() {
				$handle = 'uootd-inflyway-blocks';
				wp_register_script(
					$handle,
					plugins_url( 'uootd-inflyway-blocks.js', __FILE__ ),
					array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities', 'wp-i18n' ),
					file_exists( dirname( __FILE__ ) . '/uootd-inflyway-blocks.js' ) ? (string) filemtime( dirname( __FILE__ ) . '/uootd-inflyway-blocks.js' ) : '1.0.0',
					true
				);

				return array( $handle );
			}

			public function get_payment_method_data() {
				return array(
					'title'       => uootd_inflyway_get_setting( 'title', __( 'Credit / Debit Card', 'uootd-inflyway' ) ),
					'description' => uootd_inflyway_get_setting( 'description', __( 'You will be redirected to our secure hosted checkout page to complete payment.', 'uootd-inflyway' ) ),
					'supports'    => array( 'products' ),
				);
			}
		}
	}

	add_filter(
		'woocommerce_payment_gateways',
		static function ( $gateways ) {
			$gateways[] = 'UOOTD_WC_Gateway_Inflyway';
			return $gateways;
		}
	);

	add_action(
		'woocommerce_blocks_payment_method_type_registration',
		static function ( $payment_method_registry ) {
			if ( class_exists( 'UOOTD_WC_Gateway_Inflyway_Blocks' ) ) {
				$payment_method_registry->register( new UOOTD_WC_Gateway_Inflyway_Blocks() );
			}
		}
	);

	add_action( 'woocommerce_admin_order_data_after_order_details', 'uootd_inflyway_render_admin_order_meta' );
	add_action( 'woocommerce_thankyou_' . UOOTD_INFLYWAY_GATEWAY_ID, 'uootd_inflyway_render_order_pay_link' );
	add_action( 'woocommerce_view_order', 'uootd_inflyway_render_account_order_pay_link' );
	add_filter( 'woocommerce_order_actions', 'uootd_inflyway_add_order_action', 10, 2 );
	add_action( 'woocommerce_order_action_uootd_inflyway_sync_payment', 'uootd_inflyway_manual_sync_order' );
}

function uootd_inflyway_get_settings() {
	$defaults = array(
		'enabled'           => 'no',
		'title'             => __( 'Credit / Debit Card', 'uootd-inflyway' ),
		'description'       => __( 'You will be redirected to our secure hosted checkout page to complete payment.', 'uootd-inflyway' ),
		'api_base_url'      => 'https://inflyway-api.openaigrowth.com',
		'fallback_base_url' => 'http://23.94.38.181:3456',
		'api_key'           => '',
		'create_path'       => '/checkout/create',
		'lookup_path'       => '/orders/get',
		'callback_token'    => uootd_inflyway_get_callback_token(),
		'debug'             => 'no',
	);

	$settings = get_option( UOOTD_INFLYWAY_SETTINGS_OPTION, array() );
	if ( ! is_array( $settings ) ) {
		$settings = array();
	}

	return wp_parse_args( $settings, $defaults );
}

function uootd_inflyway_get_setting( $key, $default = '' ) {
	$settings = uootd_inflyway_get_settings();
	return array_key_exists( $key, $settings ) ? $settings[ $key ] : $default;
}

function uootd_inflyway_get_callback_token() {
	$settings = get_option( UOOTD_INFLYWAY_SETTINGS_OPTION, array() );
	if ( is_array( $settings ) && ! empty( $settings['callback_token'] ) ) {
		return (string) $settings['callback_token'];
	}

	$token = get_option( UOOTD_INFLYWAY_CALLBACK_TOKEN_META, '' );
	if ( ! $token ) {
		$token = wp_generate_password( 32, false, false );
		update_option( UOOTD_INFLYWAY_CALLBACK_TOKEN_META, $token, false );
	}

	return (string) $token;
}

function uootd_inflyway_join_url( $base, $path ) {
	$base = rtrim( trim( (string) $base ), '/' );
	$path = '/' . ltrim( trim( (string) $path ), '/' );
	return $base . $path;
}

function uootd_inflyway_normalize_url( $value ) {
	if ( ! is_string( $value ) ) {
		return '';
	}

	$value = trim( $value );
	if ( '' === $value ) {
		return '';
	}

	if ( preg_match( '#^https?://#i', $value ) ) {
		return $value;
	}

	if ( 0 === strpos( strtolower( $value ), 'www.' ) ) {
		return 'https://' . $value;
	}

	return '';
}

function uootd_inflyway_request_gateway( $path, $body = array(), $method = 'POST' ) {
	$settings = uootd_inflyway_get_settings();
	$api_key  = trim( (string) $settings['api_key'] );

	if ( '' === $api_key ) {
		return array(
			'ok'       => false,
			'status'   => 0,
			'error'    => __( 'Inflyway API key is missing.', 'uootd-inflyway' ),
			'response' => null,
		);
	}

	$attempts = array_filter(
		array_unique(
			array(
				trim( (string) $settings['api_base_url'] ),
				trim( (string) $settings['fallback_base_url'] ),
			)
		)
	);

	$last_error    = '';
	$last_status   = 0;
	$last_response = null;

	foreach ( $attempts as $base_url ) {
		$args = array(
			'method'  => strtoupper( $method ),
			'timeout' => 25,
			'headers' => array(
				'x-api-key'    => $api_key,
				'Content-Type' => 'application/json',
			),
		);

		if ( 'GET' !== strtoupper( $method ) ) {
			$args['body'] = wp_json_encode( $body );
		}

		$response = wp_remote_request( uootd_inflyway_join_url( $base_url, $path ), $args );
		if ( is_wp_error( $response ) ) {
			$last_error = $response->get_error_message();
			continue;
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$raw    = wp_remote_retrieve_body( $response );
		$data   = json_decode( $raw, true );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			$data = $raw;
		}

		$last_status   = $status;
		$last_response = $data;

		if ( 404 === $status ) {
			$last_error = __( 'Gateway route not found.', 'uootd-inflyway' );
			continue;
		}

		return array(
			'ok'       => $status >= 200 && $status < 300,
			'status'   => $status,
			'error'    => $status >= 200 && $status < 300 ? '' : uootd_inflyway_extract_gateway_error( $data ),
			'response' => $data,
			'base_url' => $base_url,
		);
	}

	return array(
		'ok'       => false,
		'status'   => $last_status,
		'error'    => $last_error ? $last_error : uootd_inflyway_extract_gateway_error( $last_response ),
		'response' => $last_response,
	);
}

function uootd_inflyway_extract_nested_string( $value, $keys ) {
	if ( is_string( $value ) ) {
		$value = trim( $value );
		return '' !== $value ? $value : '';
	}

	if ( is_array( $value ) ) {
		foreach ( $keys as $key ) {
			if ( isset( $value[ $key ] ) && is_string( $value[ $key ] ) && '' !== trim( $value[ $key ] ) ) {
				return trim( $value[ $key ] );
			}
		}

		foreach ( $value as $nested ) {
			$found = uootd_inflyway_extract_nested_string( $nested, $keys );
			if ( '' !== $found ) {
				return $found;
			}
		}
	}

	return '';
}

function uootd_inflyway_extract_gateway_error( $payload ) {
	$candidate = uootd_inflyway_extract_nested_string( $payload, array( 'error', 'message', 'desc', 'errorMessage' ) );
	return '' !== $candidate ? $candidate : __( 'Inflyway request failed.', 'uootd-inflyway' );
}

function uootd_inflyway_should_retry_without_image( $error ) {
	$error = strtolower( trim( (string) $error ) );
	if ( '' === $error ) {
		return false;
	}

	return false !== strpos( $error, '商品信息不存在' ) || false !== strpos( $error, 'image' ) || false !== strpos( $error, 'goods' );
}

function uootd_inflyway_should_retry_with_default_template( $error ) {
	return uootd_inflyway_should_retry_without_image( $error );
}

function uootd_inflyway_extract_gateway_order_result( $payload ) {
	$record  = is_array( $payload ) ? $payload : array();
	$data    = isset( $record['data'] ) && is_array( $record['data'] ) ? $record['data'] : $record;
	$success = ! empty( $record['success'] ) || ( isset( $record['code'] ) && in_array( (string) $record['code'], array( '0', '000000' ), true ) );

	$order_url = '';
	foreach ( array( 'paymentLinkUrl', 'orderUrl', 'paymentUrl', 'payUrl', 'checkoutUrl', 'url' ) as $key ) {
		$order_url = uootd_inflyway_normalize_url( uootd_inflyway_extract_nested_string( $data, array( $key ) ) );
		if ( $order_url ) {
			break;
		}
	}

	return array(
		'success'          => $success && '' !== $order_url,
		'order_id'         => uootd_inflyway_extract_nested_string( $data, array( 'orderId', 'orderNo', 'orderNumber', 'id' ) ),
		'order_url'        => $order_url,
		'payment_amount'   => isset( $data['paymentAmount'] ) ? $data['paymentAmount'] : ( isset( $data['amount'] ) ? $data['amount'] : '' ),
		'payment_currency' => uootd_inflyway_extract_nested_string( $data, array( 'paymentCurrency', 'currency' ) ),
		'error'            => uootd_inflyway_extract_gateway_error( $payload ),
	);
}

function uootd_inflyway_get_order_ref( WC_Order $order ) {
	$existing = trim( (string) $order->get_meta( UOOTD_INFLYWAY_ORDER_REF_META ) );
	if ( '' !== $existing ) {
		return $existing;
	}

	return 'UOOTD-WC-' . $order->get_id();
}

function uootd_inflyway_get_primary_order_image( WC_Order $order ) {
	foreach ( $order->get_items() as $item ) {
		$product = $item->get_product();
		if ( ! $product ) {
			continue;
		}

		$image_id = $product->get_image_id();
		if ( ! $image_id ) {
			continue;
		}

		$image_url = wp_get_attachment_image_url( $image_id, 'full' );
		if ( $image_url ) {
			return $image_url;
		}
	}

	return '';
}

function uootd_inflyway_infer_template_key( WC_Order $order ) {
	$text = '';

	foreach ( $order->get_items() as $item ) {
		$text .= ' ' . $item->get_name();
		$product = $item->get_product();
		if ( $product ) {
			$terms = get_the_terms( $product->get_id(), 'product_cat' );
			if ( is_array( $terms ) ) {
				foreach ( $terms as $term ) {
					$text .= ' ' . $term->name;
				}
			}
		}
	}

	$text = strtolower( $text );
	if ( preg_match( '/\b(bag|handbag|wallet|tote|crossbody|shoulder|backpack|clutch|pouch)\b|包|手袋|钱包|斜挎/', $text ) ) {
		return 'bag';
	}
	if ( preg_match( '/\b(shoe|shoes|sneaker|boot|heel|loafer|sandal)\b|鞋|靴/', $text ) ) {
		return 'shoes';
	}
	if ( preg_match( '/\b(dress|coat|jacket|shirt|pants|jeans|skirt|top|hoodie|sweater)\b|衣|裙|裤|外套/', $text ) ) {
		return 'clothing';
	}
	if ( preg_match( '/\b(watch|jewelry|bracelet|ring|necklace|belt|scarf|hat|glasses|sunglasses|accessor)\b|首饰|手表|腰带|围巾|帽|眼镜/', $text ) ) {
		return 'accessory';
	}

	return 'default';
}

function uootd_inflyway_get_gateway_item_descriptor( WC_Order $order ) {
	foreach ( $order->get_items() as $item ) {
		$name = trim( wp_strip_all_tags( $item->get_name() ) );
		if ( '' === $name ) {
			continue;
		}

		if ( function_exists( 'mb_strlen' ) && function_exists( 'mb_substr' ) ) {
			return mb_strlen( $name ) > 56 ? mb_substr( $name, 0, 53 ) . '...' : $name;
		}

		return strlen( $name ) > 56 ? substr( $name, 0, 53 ) . '...' : $name;
	}

	return '';
}

function uootd_inflyway_get_item_count( WC_Order $order ) {
	$count = 0;

	foreach ( $order->get_items() as $item ) {
		$count += (int) $item->get_quantity();
	}

	return max( 1, $count );
}

function uootd_inflyway_get_generic_merchandise_label( $type ) {
	$labels = array(
		'bag'       => 'Curated leather goods order',
		'shoes'     => 'Curated footwear order',
		'clothing'  => 'Curated ready-to-wear order',
		'accessory' => 'Curated accessories order',
		'default'   => 'Curated fashion order',
	);

	return isset( $labels[ $type ] ) ? $labels[ $type ] : $labels['default'];
}

function uootd_inflyway_get_order_field_value( WC_Order $order, $shipping_getter, $billing_getter ) {
	$shipping_value = '';
	$billing_value  = '';

	if ( is_callable( array( $order, $shipping_getter ) ) ) {
		$shipping_value = trim( (string) $order->{$shipping_getter}() );
	}

	if ( '' !== $shipping_value ) {
		return $shipping_value;
	}

	if ( is_callable( array( $order, $billing_getter ) ) ) {
		$billing_value = trim( (string) $order->{$billing_getter}() );
	}

	return $billing_value;
}

function uootd_inflyway_build_gateway_title( $order_ref, $type, WC_Order $order = null ) {
	return sprintf( 'UOOTD Secure Checkout #%s', $order_ref );
}

function uootd_inflyway_resolve_gateway_template_type( $type ) {
	// The hosted API currently proves most stable on the default template.
	return 'default';
}

function uootd_inflyway_build_order_note( WC_Order $order, $order_ref ) {
	$type    = uootd_inflyway_resolve_gateway_template_type( uootd_inflyway_infer_template_key( $order ) );
	$units   = uootd_inflyway_get_item_count( $order );
	$lines   = array();
	$lines[] = 'Woo Order: ' . $order_ref;
	$lines[] = 'Store: ' . home_url();
	$lines[] = 'Checkout: Secure card payment';
	$lines[] = 'Merchandise: ' . uootd_inflyway_get_generic_merchandise_label( $type );
	$lines[] = 'Units: ' . $units;
	$lines[] = 'Customer: ' . trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
	$lines[] = 'Email: ' . $order->get_billing_email();
	$lines[] = 'Phone: ' . $order->get_billing_phone();
	$lines[] = 'Total: ' . $order->get_currency() . ' ' . wc_format_decimal( $order->get_total(), 2 );

	$address_lines = array_filter(
		array(
			'Ship to: ' . trim( $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name() ),
			$order->get_shipping_address_1(),
			$order->get_shipping_address_2(),
			trim( $order->get_shipping_city() . ' ' . $order->get_shipping_state() . ' ' . $order->get_shipping_postcode() ),
			$order->get_shipping_country(),
		)
	);

	if ( ! empty( $address_lines ) ) {
		$lines[] = 'Shipping:';
		foreach ( $address_lines as $address_line ) {
			$lines[] = '- ' . $address_line;
		}
	}

	return implode( "\n", array_filter( $lines ) );
}

function uootd_inflyway_build_checkout_payload( WC_Order $order ) {
	$order_ref  = uootd_inflyway_get_order_ref( $order );
	$type       = uootd_inflyway_resolve_gateway_template_type( uootd_inflyway_infer_template_key( $order ) );
	$phone      = trim( (string) $order->get_billing_phone() );
	$note       = uootd_inflyway_build_order_note( $order, $order_ref );
	$first_name = uootd_inflyway_get_order_field_value( $order, 'get_shipping_first_name', 'get_billing_first_name' );
	$last_name  = uootd_inflyway_get_order_field_value( $order, 'get_shipping_last_name', 'get_billing_last_name' );
	$country    = uootd_inflyway_get_order_field_value( $order, 'get_shipping_country', 'get_billing_country' );
	$state      = uootd_inflyway_get_order_field_value( $order, 'get_shipping_state', 'get_billing_state' );
	$city       = uootd_inflyway_get_order_field_value( $order, 'get_shipping_city', 'get_billing_city' );
	$postcode   = uootd_inflyway_get_order_field_value( $order, 'get_shipping_postcode', 'get_billing_postcode' );
	$address_1  = uootd_inflyway_get_order_field_value( $order, 'get_shipping_address_1', 'get_billing_address_1' );
	$address_2  = uootd_inflyway_get_order_field_value( $order, 'get_shipping_address_2', 'get_billing_address_2' );
	$full_name  = trim( $first_name . ' ' . $last_name );

	return array(
		'amount'       => (float) $order->get_total(),
		'currency'     => $order->get_currency() ? $order->get_currency() : 'USD',
		'orderRef'     => $order_ref,
		'note'         => $note,
		'raw'          => $note,
		'type'         => $type,
		'title'        => uootd_inflyway_build_gateway_title( $order_ref, $type, $order ),
		'image'        => uootd_inflyway_get_primary_order_image( $order ),
		'email'        => $order->get_billing_email(),
		'mobile'       => $phone,
		'whatsapp'     => $phone,
		'name'         => $full_name,
		'firstName'    => $first_name,
		'lastName'     => $last_name,
		'country'      => $country,
		'state'        => $state,
		'city'         => $city,
		'postalCode'   => $postcode,
		'zip'          => $postcode,
		'address1'     => $address_1,
		'address2'     => $address_2,
		'shippingInfo' => array(
			'fullName'   => $full_name,
			'firstName'  => $first_name,
			'lastName'   => $last_name,
			'name'       => $full_name,
			'email'      => $order->get_billing_email(),
			'phone'      => $phone,
			'country'    => $country,
			'state'      => $state,
			'city'       => $city,
			'postalCode' => $postcode,
			'zip'        => $postcode,
			'address1'   => $address_1,
			'address2'   => $address_2,
			'addressLine1' => $address_1,
			'addressLine2' => $address_2,
		),
	);
}

function uootd_inflyway_is_paid_order_payload( $payload ) {
	if ( ! is_array( $payload ) ) {
		return false;
	}

	$payment_status = strtoupper( trim( (string) ( isset( $payload['paymentStatus'] ) ? $payload['paymentStatus'] : '' ) ) );
	$order_status   = strtoupper( trim( (string) ( isset( $payload['orderStatus'] ) ? $payload['orderStatus'] : ( isset( $payload['status'] ) ? $payload['status'] : '' ) ) ) );
	$success_time   = '';

	foreach ( array( 'paymentSuccessTime', 'paySuccessTime', 'paymentTime' ) as $key ) {
		if ( ! empty( $payload[ $key ] ) ) {
			$success_time = (string) $payload[ $key ];
			break;
		}
	}

	if ( '' !== trim( $success_time ) ) {
		return true;
	}

	if ( in_array( $payment_status, array( '01', '10', '20', 'SUCCESS', 'PAID', 'COMPLETED' ), true ) ) {
		return true;
	}

	return in_array( $order_status, array( 'PAID', 'SUCCESS', 'CONFIRMED', 'COMPLETED', 'POCS' ), true );
}

function uootd_inflyway_sync_order( WC_Order $order ) {
	$inflyway_order_id = trim( (string) $order->get_meta( UOOTD_INFLYWAY_ORDER_ID_META ) );
	if ( '' === $inflyway_order_id ) {
		return array(
			'ok'      => false,
			'message' => __( 'Missing Inflyway order id.', 'uootd-inflyway' ),
		);
	}

	$payload  = array(
		'query'    => $inflyway_order_id,
		'pages'    => 2,
		'pageSize' => 20,
	);
	$response = uootd_inflyway_request_gateway( uootd_inflyway_get_setting( 'lookup_path', '/orders/get' ), $payload );

	if ( empty( $response['ok'] ) ) {
		$order->update_meta_data( UOOTD_INFLYWAY_LAST_SYNC_META, current_time( 'mysql', true ) );
		$order->save();

		return array(
			'ok'      => false,
			'message' => uootd_inflyway_extract_gateway_error( $response ),
			'payload' => $response,
		);
	}

	$data        = is_array( $response['response'] ) ? $response['response'] : array();
	$raw         = isset( $data['raw'] ) && is_array( $data['raw'] ) ? $data['raw'] : $data;
	$payment_url = '';
	foreach ( array( 'orderUrl', 'paymentLinkUrl', 'paymentUrl', 'payUrl' ) as $key ) {
		if ( ! empty( $raw[ $key ] ) ) {
			$payment_url = uootd_inflyway_normalize_url( $raw[ $key ] );
			if ( $payment_url ) {
				break;
			}
		}
	}

	if ( ! $payment_url && ! empty( $data['orderUrl'] ) ) {
		$payment_url = uootd_inflyway_normalize_url( $data['orderUrl'] );
	}

	if ( $payment_url ) {
		$order->update_meta_data( UOOTD_INFLYWAY_LINK_META, $payment_url );
	}

	$order->update_meta_data( UOOTD_INFLYWAY_LAST_SYNC_META, current_time( 'mysql', true ) );
	$order->update_meta_data( UOOTD_INFLYWAY_LAST_STATUS_META, isset( $raw['orderStatus'] ) ? $raw['orderStatus'] : ( isset( $raw['paymentStatus'] ) ? $raw['paymentStatus'] : '' ) );

	if ( uootd_inflyway_is_paid_order_payload( $raw ) ) {
		$paid_at = ! empty( $raw['paymentSuccessTime'] ) ? (string) $raw['paymentSuccessTime'] : current_time( 'mysql', true );
		$order->update_meta_data( UOOTD_INFLYWAY_PAID_AT_META, $paid_at );
		$order->save();

		if ( ! $order->is_paid() ) {
			$order->payment_complete( $inflyway_order_id );
			$order->add_order_note( sprintf( 'Inflyway payment confirmed for order %s.', $inflyway_order_id ) );
		}

		return array(
			'ok'     => true,
			'paid'   => true,
			'raw'    => $raw,
			'status' => isset( $raw['orderStatus'] ) ? $raw['orderStatus'] : '',
		);
	}

	$order->save();

	return array(
		'ok'     => true,
		'paid'   => false,
		'raw'    => $raw,
		'status' => isset( $raw['orderStatus'] ) ? $raw['orderStatus'] : '',
	);
}

function uootd_inflyway_poll_pending_orders() {
	if ( 'yes' !== uootd_inflyway_get_setting( 'enabled', 'no' ) ) {
		return;
	}

	$orders = wc_get_orders(
		array(
			'limit'          => 20,
			'payment_method' => UOOTD_INFLYWAY_GATEWAY_ID,
			'status'         => array( 'pending', 'on-hold' ),
			'orderby'        => 'date',
			'order'          => 'DESC',
			'meta_query'     => array(
				array(
					'key'     => UOOTD_INFLYWAY_ORDER_ID_META,
					'compare' => 'EXISTS',
				),
			),
		)
	);

	foreach ( $orders as $order ) {
		if ( $order instanceof WC_Order ) {
			uootd_inflyway_sync_order( $order );
		}
	}
}

function uootd_inflyway_render_admin_order_meta( $order ) {
	if ( ! $order instanceof WC_Order || UOOTD_INFLYWAY_GATEWAY_ID !== $order->get_payment_method() ) {
		return;
	}

	$link      = uootd_inflyway_normalize_url( $order->get_meta( UOOTD_INFLYWAY_LINK_META ) );
	$order_id  = trim( (string) $order->get_meta( UOOTD_INFLYWAY_ORDER_ID_META ) );
	$last_sync = trim( (string) $order->get_meta( UOOTD_INFLYWAY_LAST_SYNC_META ) );
	$status    = trim( (string) $order->get_meta( UOOTD_INFLYWAY_LAST_STATUS_META ) );

	echo '<div class="order_data_column" style="width:100%;padding-top:12px;">';
	echo '<h4>Inflyway</h4>';
	echo '<p><strong>Order ID:</strong> ' . esc_html( $order_id ? $order_id : 'n/a' ) . '</p>';
	echo '<p><strong>Last status:</strong> ' . esc_html( $status ? $status : 'n/a' ) . '</p>';
	echo '<p><strong>Last sync:</strong> ' . esc_html( $last_sync ? $last_sync : 'n/a' ) . '</p>';
	if ( $link ) {
		echo '<p><a class="button" href="' . esc_url( $link ) . '" target="_blank" rel="noreferrer noopener">Open payment link</a></p>';
	}
	echo '</div>';
}

function uootd_inflyway_render_order_pay_link( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order instanceof WC_Order || $order->is_paid() ) {
		return;
	}

	uootd_inflyway_sync_order( $order );
	$link = uootd_inflyway_normalize_url( $order->get_meta( UOOTD_INFLYWAY_LINK_META ) );
	if ( ! $link ) {
		return;
	}

	echo '<section class="woocommerce-order uootd-inflyway-order-link">';
	echo '<h2>' . esc_html__( 'Need your payment link again?', 'uootd-inflyway' ) . '</h2>';
	echo '<p>' . esc_html__( 'You can reopen the secure checkout page below.', 'uootd-inflyway' ) . '</p>';
	echo '<p><a class="button alt" href="' . esc_url( $link ) . '" target="_blank" rel="noreferrer noopener">' . esc_html__( 'Open secure checkout', 'uootd-inflyway' ) . '</a></p>';
	echo '</section>';
}

function uootd_inflyway_render_account_order_pay_link( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order instanceof WC_Order || UOOTD_INFLYWAY_GATEWAY_ID !== $order->get_payment_method() || $order->is_paid() ) {
		return;
	}

	uootd_inflyway_render_order_pay_link( $order_id );
}

function uootd_inflyway_add_order_action( $actions, $order ) {
	if ( ! $order instanceof WC_Order || UOOTD_INFLYWAY_GATEWAY_ID !== $order->get_payment_method() ) {
		return $actions;
	}

	$actions['uootd_inflyway_sync_payment'] = __( 'Sync Inflyway payment', 'uootd-inflyway' );
	return $actions;
}

function uootd_inflyway_manual_sync_order( $order ) {
	if ( $order instanceof WC_Order ) {
		$result = uootd_inflyway_sync_order( $order );
		if ( ! empty( $result['ok'] ) ) {
			$order->add_order_note( ! empty( $result['paid'] ) ? 'Manual Inflyway sync confirmed payment.' : 'Manual Inflyway sync checked payment status.' );
		} else {
			$order->add_order_note( 'Manual Inflyway sync failed: ' . ( ! empty( $result['message'] ) ? $result['message'] : 'Unknown error' ) );
		}
	}
}

function uootd_inflyway_register_rest_routes() {
	register_rest_route(
		'uootd-inflyway/v1',
		'/payment-callback',
		array(
			'methods'             => 'POST',
			'permission_callback' => 'uootd_inflyway_validate_callback_request',
			'callback'            => 'uootd_inflyway_handle_payment_callback',
		)
	);
}

function uootd_inflyway_validate_callback_request( WP_REST_Request $request ) {
	$token = trim( (string) uootd_inflyway_get_setting( 'callback_token', uootd_inflyway_get_callback_token() ) );
	if ( '' === $token ) {
		return new WP_Error( 'callback_disabled', 'Callback token is missing.', array( 'status' => 401 ) );
	}

	$auth_header = trim( (string) $request->get_header( 'authorization' ) );
	$custom      = trim( (string) $request->get_header( 'x-internal-token' ) );
	$provided    = '';

	if ( 0 === stripos( $auth_header, 'bearer ' ) ) {
		$provided = trim( substr( $auth_header, 7 ) );
	} elseif ( $custom ) {
		$provided = $custom;
	}

	if ( ! hash_equals( $token, $provided ) ) {
		return new WP_Error( 'forbidden', 'Invalid callback token.', array( 'status' => 403 ) );
	}

	return true;
}

function uootd_inflyway_find_order_for_callback( $inflyway_order_id, $order_ref ) {
	if ( $inflyway_order_id ) {
		$orders = wc_get_orders(
			array(
				'limit'      => 1,
				'meta_query' => array(
					array(
						'key'   => UOOTD_INFLYWAY_ORDER_ID_META,
						'value' => $inflyway_order_id,
					),
				),
			)
		);

		if ( ! empty( $orders ) ) {
			return $orders[0];
		}
	}

	if ( $order_ref ) {
		$orders = wc_get_orders(
			array(
				'limit'      => 1,
				'meta_query' => array(
					array(
						'key'   => UOOTD_INFLYWAY_ORDER_REF_META,
						'value' => $order_ref,
					),
				),
			)
		);

		if ( ! empty( $orders ) ) {
			return $orders[0];
		}
	}

	return null;
}

function uootd_inflyway_handle_payment_callback( WP_REST_Request $request ) {
	$body              = $request->get_json_params();
	$inflyway_order_id = isset( $body['inflywayOrderId'] ) ? trim( (string) $body['inflywayOrderId'] ) : '';
	$order_ref         = isset( $body['orderNumber'] ) ? trim( (string) $body['orderNumber'] ) : '';
	$payment_link      = isset( $body['paymentLinkUrl'] ) ? uootd_inflyway_normalize_url( $body['paymentLinkUrl'] ) : '';
	$payment_status    = isset( $body['paymentStatus'] ) ? strtolower( trim( (string) $body['paymentStatus'] ) ) : '';
	$paid              = in_array( $payment_status, array( 'paid', 'success', 'completed', 'confirmed' ), true );

	$order = uootd_inflyway_find_order_for_callback( $inflyway_order_id, $order_ref );
	if ( ! $order instanceof WC_Order ) {
		return new WP_REST_Response(
			array(
				'success' => false,
				'code'    => 'ORDER_NOT_FOUND',
				'message' => 'Order not found',
			),
			404
		);
	}

	if ( $payment_link ) {
		$order->update_meta_data( UOOTD_INFLYWAY_LINK_META, $payment_link );
	}

	if ( $inflyway_order_id ) {
		$order->update_meta_data( UOOTD_INFLYWAY_ORDER_ID_META, $inflyway_order_id );
	}

	$order->update_meta_data( UOOTD_INFLYWAY_LAST_SYNC_META, current_time( 'mysql', true ) );
	$order->update_meta_data( UOOTD_INFLYWAY_LAST_STATUS_META, $payment_status ? $payment_status : 'callback' );

	if ( $paid ) {
		$order->update_meta_data( UOOTD_INFLYWAY_PAID_AT_META, isset( $body['paymentSuccessTime'] ) ? (string) $body['paymentSuccessTime'] : current_time( 'mysql', true ) );
		$order->save();
		if ( ! $order->is_paid() ) {
			$order->payment_complete( $inflyway_order_id );
			$order->add_order_note( 'Inflyway callback confirmed payment.' );
		}
	} else {
		$order->save();
	}

	return new WP_REST_Response(
		array(
			'success'          => true,
			'orderId'          => $order->get_id(),
			'orderNumber'      => $order->get_order_number(),
			'inflywayOrderId'  => $inflyway_order_id,
			'status'           => $order->get_status(),
			'paymentLinkUrl'   => $payment_link,
			'paymentConfirmed' => $paid,
		),
		200
	);
}
