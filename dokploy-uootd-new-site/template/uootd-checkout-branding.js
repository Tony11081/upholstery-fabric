( function () {
	const config = window.uootdCheckoutBranding || {};
	const replacements = config.replacements || {};
	const pageType = config.pageType || "";
	const overlayConfig = config.redirectOverlay || {};

	if ( ! pageType ) {
		return;
	}

	const normalize = function ( text ) {
		return ( text || "" ).replace( /\s+/g, " " ).trim();
	};

	const hideElement = function ( element ) {
		if ( ! element ) {
			return;
		}

		element.setAttribute( "hidden", "hidden" );
		element.setAttribute( "aria-hidden", "true" );
		element.style.display = "none";
	};

	const replaceExactTextNodes = function () {
		if ( [ "cart", "checkout", "pay" ].includes( pageType ) ) {
			return;
		}

		if ( ! document.body ) {
			return;
		}

		const walker = document.createTreeWalker( document.body, NodeFilter.SHOW_TEXT, {
			acceptNode( node ) {
				if ( ! node || ! node.nodeValue ) {
					return NodeFilter.FILTER_REJECT;
				}

				const parent = node.parentElement;
				if ( ! parent || [ "SCRIPT", "STYLE", "NOSCRIPT" ].includes( parent.tagName ) ) {
					return NodeFilter.FILTER_REJECT;
				}

				return replacements[ normalize( node.nodeValue ) ] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
			},
		} );

		const matches = [];
		while ( walker.nextNode() ) {
			matches.push( walker.currentNode );
		}

		matches.forEach( function ( node ) {
			const current = normalize( node.nodeValue );
			const next = replacements[ current ];
			if ( next && current !== next ) {
				node.nodeValue = node.nodeValue.replace( current, next );
			}
		} );
	};

	const setElementText = function ( selector, text ) {
		if ( ! text ) {
			return;
		}

		document.querySelectorAll( selector ).forEach( function ( element ) {
			if ( normalize( element.textContent ) !== text ) {
				element.textContent = text;
			}
		} );
	};

	const applyScopedCopy = function () {
		if ( pageType === "cart" ) {
			setElementText( ".wc-block-cart__submit-button .wc-block-components-button__text", replacements[ "Proceed to checkout" ] );
			return;
		}

		if ( ! [ "checkout", "pay" ].includes( pageType ) ) {
			return;
		}

		setElementText(
			".wc-block-checkout__contact-fields .wc-block-components-checkout-step__title, .wc-block-checkout__contact-fields legend.screen-reader-text",
			replacements[ "Contact information" ]
		);
		setElementText(
			".wc-block-checkout__billing-fields .wc-block-components-checkout-step__title, .wc-block-checkout__billing-fields legend.screen-reader-text",
			replacements[ "Billing address" ]
		);
		setElementText(
			".wc-block-checkout__payment-method .wc-block-components-checkout-step__title, .wc-block-checkout__payment-method legend.screen-reader-text",
			replacements[ "Payment options" ]
		);
		setElementText(
			".wc-block-components-checkout-return-to-cart-button",
			"Return to Cart"
		);

		const phoneField = document.querySelector( "#billing-phone" );
		if ( phoneField ) {
			const phoneWrapper = phoneField.closest( ".wc-block-components-text-input" );
			const phoneLabel = phoneWrapper ? phoneWrapper.querySelector( "label" ) : null;
			if ( phoneLabel ) {
				phoneLabel.textContent = replacements.Phone || "Phone number";
			}
		}
	};

	const applyDirectLabels = function () {
		const labelMap = [
			[ ".wc-block-cart__submit-button .wc-block-components-button__text", replacements[ "Proceed to checkout" ] ],
			[ ".wc-block-components-checkout-place-order-button .wc-block-components-button__text", replacements[ "Place order" ] ],
			[ ".wc-block-components-checkout-step__title", null ],
		];

		labelMap.forEach( function ( item ) {
			const selector = item[ 0 ];
			const text = item[ 1 ];
			if ( ! text ) {
				return;
			}
			document.querySelectorAll( selector ).forEach( function ( element ) {
				if ( normalize( element.textContent ) !== text ) {
					element.textContent = text;
				}
			} );
		} );
	};

	const cleanCheckoutNoise = function () {
		const orderNotes = document.querySelector( ".wc-block-checkout__order-notes" );
		if ( orderNotes ) {
			hideElement( orderNotes );
		}

		document.querySelectorAll( ".wc-block-cart__payment-options" ).forEach( function ( block ) {
			const hasUsefulControl = !! block.querySelector( "button, input, select, textarea, a, iframe" );
			const text = normalize( block.innerText || "" );

			if ( ! hasUsefulControl && ! text ) {
				hideElement( block );
			}
		} );

		const hasPaymentMethod = !! document.querySelector( ".wc-block-components-payment-method-label" );

		document.querySelectorAll( "#a11y-speak-assertive, #a11y-speak-polite" ).forEach( function ( liveRegion ) {
			if ( hasPaymentMethod && /There are no payment methods available/i.test( liveRegion.textContent || "" ) ) {
				liveRegion.textContent = "";
			}
		} );

		document.querySelectorAll( ".wc-block-components-notice-banner.is-error" ).forEach( function ( banner ) {
			if ( hasPaymentMethod && /There are no payment methods available/i.test( banner.textContent || "" ) ) {
				hideElement( banner );
			}
		} );

		document.querySelectorAll( ".wc-block-components-notice-snackbar-list, .wc-block-components-notices__snackbar" ).forEach( function ( snackbar ) {
			const hasVisibleNotice = !! snackbar.querySelector( ".components-snackbar, .wc-block-components-notice-banner" );
			const text = normalize( snackbar.innerText || "" );

			if ( ! hasVisibleNotice && ( ! text || text === "Notifications" ) ) {
				hideElement( snackbar );
			}
		} );
	};

	const markEnhancedSections = function () {
		const summary = document.querySelector( ".wp-block-woocommerce-checkout-order-summary-block, .wp-block-woocommerce-cart-order-summary-block" );
		if ( summary ) {
			summary.classList.add( "uootd-order-summary-shell" );
		}

		const actionRow = document.querySelector( ".wc-block-checkout__actions_row, .wc-block-cart__submit" );
		if ( actionRow ) {
			actionRow.classList.add( "uootd-checkout-actions-shell" );
		}
	};

	const expandDesktopSummary = function () {
		if ( window.innerWidth < 990 ) {
			return;
		}

		const summaryContent = document.querySelector( ".wc-block-components-checkout-order-summary__content" );
		if ( summaryContent ) {
			summaryContent.style.display = "block";
			summaryContent.hidden = false;
		}
	};

	let awaitingValidationFocus = false;
	let scheduledRun = false;
	let isSubmittingCheckout = false;
	let redirectOverlayActive = false;
	let redirectOverlayTimer = null;
	let redirectOverlaySeconds = 0;
	let lastSubmitIntentAt = 0;

	const ensureRedirectOverlay = function () {
		return document.querySelector( "[data-uootd-redirect-overlay]" );
	};

	const clearRedirectOverlayTimer = function () {
		if ( redirectOverlayTimer ) {
			window.clearInterval( redirectOverlayTimer );
			redirectOverlayTimer = null;
		}
	};

	const updateRedirectOverlay = function () {
		const overlay = ensureRedirectOverlay();
		if ( ! overlay ) {
			return;
		}

		const countdown = overlay.querySelector( "[data-uootd-redirect-overlay-seconds]" );
		const label = overlay.querySelector( "[data-uootd-redirect-overlay-label]" );
		const countdownTemplate = overlayConfig.countdownTemplate || "Redirecting in %ss";
		const waitingLabel = overlayConfig.waitingLabel || "Still opening secure checkout...";

		if ( countdown ) {
			countdown.textContent = redirectOverlaySeconds > 0 ? String( redirectOverlaySeconds ) : "...";
		}

		if ( label ) {
			label.textContent =
				redirectOverlaySeconds > 0
					? countdownTemplate.replace( "%s", String( redirectOverlaySeconds ) )
					: waitingLabel;
		}

		overlay.setAttribute(
			"data-uootd-redirect-overlay-state",
			redirectOverlaySeconds > 0 ? "countdown" : "waiting"
		);
	};

	const hideRedirectOverlay = function () {
		const overlay = ensureRedirectOverlay();
		redirectOverlayActive = false;
		clearRedirectOverlayTimer();

		if ( overlay ) {
			overlay.hidden = true;
			overlay.setAttribute( "aria-hidden", "true" );
			overlay.removeAttribute( "data-uootd-redirect-overlay-state" );
		}

		document.body.classList.remove( "uootd-checkout-redirecting" );
	};

	const showRedirectOverlay = function () {
		if ( ! overlayConfig.enabled || ! [ "checkout", "pay" ].includes( pageType ) ) {
			return;
		}

		const overlay = ensureRedirectOverlay();
		if ( ! overlay ) {
			return;
		}

		redirectOverlayActive = true;
		redirectOverlaySeconds = Math.max( 1, Number.parseInt( overlayConfig.seconds, 10 ) || 5 );
		clearRedirectOverlayTimer();
		updateRedirectOverlay();

		overlay.hidden = false;
		overlay.setAttribute( "aria-hidden", "false" );
		document.body.classList.add( "uootd-checkout-redirecting" );

		redirectOverlayTimer = window.setInterval( function () {
			if ( ! redirectOverlayActive ) {
				clearRedirectOverlayTimer();
				return;
			}

			redirectOverlaySeconds = Math.max( 0, redirectOverlaySeconds - 1 );
			updateRedirectOverlay();

			if ( redirectOverlaySeconds <= 0 ) {
				clearRedirectOverlayTimer();
			}
		}, 1000 );
	};

	const hasVisibleCheckoutError = function () {
		return !! document.querySelector(
			".woocommerce-NoticeGroup-checkout .woocommerce-error, ul.woocommerce-error, .woocommerce-error[role='alert'], .woocommerce-invalid, .wc-block-components-validation-error, .wc-block-components-notice-banner.is-error:not([hidden])"
		);
	};

	const handleCheckoutSubmitIntent = function () {
		const now = Date.now();
		if ( now - lastSubmitIntentAt < 450 ) {
			return;
		}

		lastSubmitIntentAt = now;
		isSubmittingCheckout = true;
		awaitingValidationFocus = true;
		showRedirectOverlay();

		window.setTimeout( function () {
			isSubmittingCheckout = false;
			focusFirstInvalidField();
			run();
		}, 2200 );
	};

	const focusFirstInvalidField = function () {
		if ( ! awaitingValidationFocus ) {
			return;
		}

		const invalidField = document.querySelector(
			".wc-block-components-text-input.has-error input, .wc-block-components-form .has-error select, .wc-block-components-combobox-control.has-error input"
		);

		if ( invalidField ) {
			awaitingValidationFocus = false;
			hideRedirectOverlay();
			invalidField.focus();
			invalidField.scrollIntoView( { behavior: "smooth", block: "center" } );
			return;
		}

		if ( document.querySelector( ".wc-block-components-payment-method-label" ) ) {
			awaitingValidationFocus = false;
		}
	};

	const run = function () {
		if ( isSubmittingCheckout ) {
			if ( hasVisibleCheckoutError() ) {
				hideRedirectOverlay();
			}
			focusFirstInvalidField();
			return;
		}

		if ( redirectOverlayActive && hasVisibleCheckoutError() ) {
			hideRedirectOverlay();
		}

		replaceExactTextNodes();
		applyScopedCopy();
		applyDirectLabels();
		cleanCheckoutNoise();
		markEnhancedSections();
		expandDesktopSummary();
		focusFirstInvalidField();
	};

	if ( document.readyState === "loading" ) {
		document.addEventListener( "DOMContentLoaded", run, { once: true } );
	} else {
		run();
	}

	if ( document.body ) {
		document.body.addEventListener( "click", function ( event ) {
			if (
				event.target.closest(
					".wc-block-components-checkout-place-order-button, #place_order, button[name='woocommerce_checkout_place_order']"
				)
			) {
				handleCheckoutSubmitIntent();
			}
		} );

		document.querySelectorAll( "form.checkout, form#order_review" ).forEach( function ( form ) {
			form.addEventListener(
				"submit",
				function () {
					handleCheckoutSubmitIntent();
				},
				true
			);
		} );

		const observer = new MutationObserver( function () {
			if ( scheduledRun ) {
				return;
			}

			scheduledRun = true;
			window.requestAnimationFrame( function () {
				scheduledRun = false;
				run();
			} );
		} );

		observer.observe( document.body, {
			childList: true,
			subtree: true,
		} );
	}

	if ( window.jQuery ) {
		window.jQuery( document.body ).on( "checkout_error", function () {
			awaitingValidationFocus = false;
			isSubmittingCheckout = false;
			hideRedirectOverlay();
			run();
		} );
	}

	window.addEventListener( "pageshow", function () {
		isSubmittingCheckout = false;
		awaitingValidationFocus = false;
		hideRedirectOverlay();
		run();
	} );
}() );
