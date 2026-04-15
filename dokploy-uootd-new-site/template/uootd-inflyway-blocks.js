( function () {
	const registry = window.wc && window.wc.wcBlocksRegistry;
	const settings = window.wc && window.wc.wcSettings;
	const htmlEntities = window.wp && window.wp.htmlEntities;
	const element = window.wp && window.wp.element;

	if ( ! registry || ! settings || ! element ) {
		return;
	}

	const paymentMethodData = settings.getPaymentMethodData( 'uootd_inflyway', {} );
	const title = ( htmlEntities && htmlEntities.decodeEntities ? htmlEntities.decodeEntities( paymentMethodData.title || '' ) : paymentMethodData.title ) || 'Credit / Debit Card';

	const Content = function () {
		return element.createElement( 'div', {
			className: 'uootd-inflyway-block-description',
			dangerouslySetInnerHTML: {
				__html: paymentMethodData.description || '',
			},
		} );
	};

	const Label = function ( props ) {
		const PaymentMethodLabel = props.components && props.components.PaymentMethodLabel;
		if ( PaymentMethodLabel ) {
			return element.createElement( PaymentMethodLabel, { text: title } );
		}
		return element.createElement( 'span', null, title );
	};

	registry.registerPaymentMethod( {
		name: 'uootd_inflyway',
		label: element.createElement( Label, null ),
		content: element.createElement( Content, null ),
		edit: element.createElement( Content, null ),
		canMakePayment: function () {
			return true;
		},
		ariaLabel: title,
		supports: {
			features: paymentMethodData.supports || [ 'products' ],
		},
	} );
}() );
