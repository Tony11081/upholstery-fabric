(function () {
  var config = window.uootdStorefront || {};
  var wishlistKey = 'uootd-wishlist-v1';
  var overlay = document.querySelector('[data-uootd-search-overlay]');
  var overlayInput = document.querySelector('[data-uootd-search-input]');
  var overlayResults = document.querySelector('[data-uootd-search-results]');
  var marketToggle = document.querySelector('[data-uootd-market-toggle]');
  var marketPanel = document.querySelector('[data-uootd-market-panel]');
  var navToggle = document.querySelector('[data-uootd-nav-toggle]');
  var navList = document.querySelector('[data-uootd-nav-list]');
  var searchTimer = null;

  function closeNavPanels(exceptItem) {
    document.querySelectorAll('.uootd-nav-item').forEach(function (item) {
      var keepOpen = exceptItem && item === exceptItem;
      item.classList.toggle('is-open', !!keepOpen);
      var button = item.querySelector('[data-uootd-panel-trigger]');
      var panel = item.querySelector('[data-uootd-panel]');
      if (button) {
        button.setAttribute('aria-expanded', keepOpen ? 'true' : 'false');
      }
      if (panel) {
        panel.hidden = !keepOpen;
      }
    });
  }

  function closeMarketPanel() {
    if (marketToggle) {
      marketToggle.setAttribute('aria-expanded', 'false');
    }
    if (marketPanel) {
      marketPanel.hidden = true;
    }
  }

  function dismissCartToast(shell) {
    if (!shell || shell.classList.contains('is-dismissing')) {
      return;
    }

    shell.classList.add('is-dismissing');
    window.setTimeout(function () {
      shell.remove();
    }, 220);
  }

  function initCartToasts() {
    document.querySelectorAll('[data-uootd-cart-toast]').forEach(function (toast) {
      var shell = toast.closest('.woocommerce-message') || toast.parentElement;
      if (!shell) {
        return;
      }

      shell.classList.add('uootd-cart-toast-shell');

      var dismiss = toast.querySelector('[data-uootd-dismiss-toast]');
      if (dismiss && !dismiss.dataset.uootdBound) {
        dismiss.dataset.uootdBound = 'true';
        dismiss.addEventListener('click', function () {
          dismissCartToast(shell);
        });
      }

      if (!shell.dataset.uootdAutoDismiss) {
        shell.dataset.uootdAutoDismiss = 'true';
        window.setTimeout(function () {
          dismissCartToast(shell);
        }, 7200);
      }
    });
  }

  function readWishlist() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(wishlistKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeWishlist(items) {
    window.localStorage.setItem(wishlistKey, JSON.stringify(items));
  }

  function isSaved(productId) {
    return readWishlist().some(function (item) {
      return String(item.id) === String(productId);
    });
  }

  function updateWishlistCount() {
    var count = readWishlist().length;
    document.querySelectorAll('[data-uootd-wishlist-count]').forEach(function (node) {
      node.textContent = String(count);
    });
  }

  function syncWishlistButtons() {
    document.querySelectorAll('.uootd-wishlist-toggle').forEach(function (button) {
      var active = isSaved(button.dataset.productId);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('is-active', active);
      button.textContent = active ? 'Saved' : (button.classList.contains('uootd-single-wishlist') ? 'Save to Wish List' : 'Save');
    });
  }

  function createWishlistCard(item) {
    var article = document.createElement('article');
    article.className = 'uootd-discovery-card';
    article.innerHTML =
      '<a class="uootd-discovery-card__image" href="' + item.url + '">' +
        (item.image ? '<img src="' + item.image + '" alt="' + item.name + '" loading="lazy" />' : '') +
      '</a>' +
      '<div class="uootd-discovery-card__copy">' +
        '<p class="uootd-discovery-card__meta">' + item.brand + '</p>' +
        '<h3><a href="' + item.url + '">' + item.name + '</a></h3>' +
        '<span class="uootd-discovery-card__price">' + item.price + '</span>' +
        '<div class="uootd-discovery-card__actions">' +
          '<button type="button" class="uootd-wishlist-toggle uootd-loop-wishlist is-active" data-product-id="' + item.id + '" data-product-name="' + item.name + '" data-product-brand="' + item.brand + '" data-product-url="' + item.url + '" data-product-price="' + item.price + '" data-product-image="' + item.image + '" aria-pressed="true">Saved</button>' +
          '<a class="uootd-discovery-card__buy" href="' + item.url + '">View Product</a>' +
        '</div>' +
      '</div>';
    return article;
  }

  function renderWishlistPage() {
    var grid = document.querySelector('[data-uootd-wishlist-grid]');
    var empty = document.querySelector('[data-uootd-wishlist-empty]');
    if (!grid || !empty) {
      return;
    }

    var items = readWishlist();
    grid.innerHTML = '';
    empty.hidden = items.length > 0;

    items.forEach(function (item) {
      grid.appendChild(createWishlistCard(item));
    });
  }

  function toggleWishlist(button) {
    var items = readWishlist();
    var productId = String(button.dataset.productId || '');
    if (!productId) {
      return;
    }

    var existingIndex = items.findIndex(function (item) {
      return String(item.id) === productId;
    });

    if (existingIndex >= 0) {
      items.splice(existingIndex, 1);
    } else {
      items.unshift({
        id: productId,
        name: button.dataset.productName || '',
        brand: button.dataset.productBrand || '',
        url: button.dataset.productUrl || '',
        price: button.dataset.productPrice || '',
        image: button.dataset.productImage || ''
      });
    }

    writeWishlist(items);
    updateWishlistCount();
    syncWishlistButtons();
    renderWishlistPage();
  }

  function closeSearch() {
    if (!overlay) {
      return;
    }
    overlay.hidden = true;
    document.body.classList.remove('uootd-search-open');
  }

  function openSearch(event) {
    if (event) {
      event.preventDefault();
    }
    if (!overlay) {
      if (config.searchPageUrl) {
        window.location.href = config.searchPageUrl;
      }
      return;
    }
    overlay.hidden = false;
    document.body.classList.add('uootd-search-open');
    if (overlayInput) {
      window.setTimeout(function () {
        overlayInput.focus();
      }, 40);
    }
  }

  function renderSearchResults(items, query) {
    if (!overlayResults) {
      return;
    }
    overlayResults.innerHTML = '';
    if (!query) {
      return;
    }

    if (!items.length) {
      overlayResults.innerHTML = '<p class="uootd-search-results__empty">No products matched that search yet.</p>';
      return;
    }

    items.forEach(function (item) {
      var article = document.createElement('a');
      article.className = 'uootd-search-result';
      article.href = item.permalink;
      article.innerHTML =
        (item.image ? '<img src="' + item.image + '" alt="' + item.name + '" loading="lazy" />' : '') +
        '<div><p>' + item.brand + '</p><strong>' + item.name + '</strong><span>' + item.price + '</span></div>';
      overlayResults.appendChild(article);
    });

    var more = document.createElement('a');
    more.className = 'uootd-search-results__more';
    more.href = (config.searchPageUrl || '/search/') + '?q=' + encodeURIComponent(query);
    more.textContent = 'View all results';
    overlayResults.appendChild(more);
  }

  function runSearch(query) {
    if (!config.searchEndpoint || !overlayResults) {
      return;
    }

    if (!query) {
      overlayResults.innerHTML = '';
      return;
    }

    window.fetch(config.searchEndpoint + '?q=' + encodeURIComponent(query), {
      credentials: 'same-origin'
    })
      .then(function (response) {
        return response.ok ? response.json() : [];
      })
      .then(function (items) {
        renderSearchResults(items, query);
      })
      .catch(function () {
        renderSearchResults([], query);
      });
  }

  document.addEventListener('click', function (event) {
    var openTrigger = event.target.closest('[data-uootd-search-open]');
    if (openTrigger) {
      openSearch(event);
      return;
    }

    var closeTrigger = event.target.closest('[data-uootd-search-close]');
    if (closeTrigger) {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (overlay && event.target === overlay) {
      closeSearch();
      return;
    }

    var wishlistButton = event.target.closest('.uootd-wishlist-toggle');
    if (wishlistButton) {
      event.preventDefault();
      toggleWishlist(wishlistButton);
      return;
    }

    if (marketToggle && event.target.closest('[data-uootd-market-toggle]')) {
      event.preventDefault();
      var expanded = marketToggle.getAttribute('aria-expanded') === 'true';
      marketToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (marketPanel) {
        marketPanel.hidden = expanded;
      }
      return;
    }

    if (marketPanel && !event.target.closest('[data-uootd-market-panel]')) {
      closeMarketPanel();
    }

    if (navToggle && event.target.closest('[data-uootd-nav-toggle]')) {
      event.preventDefault();
      var navExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', navExpanded ? 'false' : 'true');
      if (navList) {
        navList.classList.toggle('is-open', !navExpanded);
      }
      if (navExpanded) {
        closeNavPanels();
      }
      return;
    }

    var panelTrigger = event.target.closest('[data-uootd-panel-trigger]');
    if (panelTrigger) {
      event.preventDefault();
      var item = panelTrigger.closest('.uootd-nav-item');
      var panel = item ? item.querySelector('[data-uootd-panel]') : null;
      var expandedPanel = panelTrigger.getAttribute('aria-expanded') === 'true';
      if (!item || !panel) {
        return;
      }
      if (expandedPanel) {
        closeNavPanels();
      } else {
        closeNavPanels(item);
      }
      return;
    }

    if (!event.target.closest('.uootd-nav-item')) {
      closeNavPanels();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeSearch();
      closeMarketPanel();
      closeNavPanels();
      if (navToggle) {
        navToggle.setAttribute('aria-expanded', 'false');
      }
      if (navList) {
        navList.classList.remove('is-open');
      }
    }
  });

  if (overlayInput) {
    overlayInput.addEventListener('input', function () {
      var value = overlayInput.value.trim();
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        runSearch(value);
      }, 180);
    });
  }

  updateWishlistCount();
  syncWishlistButtons();
  renderWishlistPage();
  initCartToasts();
})();
