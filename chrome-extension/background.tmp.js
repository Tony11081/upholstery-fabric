const waitForTabComplete = (tabId, timeoutMs = 15000) => new Promise((resolve) => {
  let timeoutId = null;
  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
    chrome.tabs.onUpdated.removeListener(listener);
  };
  const listener = (updatedTabId, info) => {
    if (updatedTabId === tabId && info.status === 'complete') {
      cleanup();
      resolve(true);
    }
  };
  timeoutId = setTimeout(() => {
    cleanup();
    resolve(false);
  }, timeoutMs);
  chrome.tabs.onUpdated.addListener(listener);
});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isFrameDetachedError = (error) => {
  const message = error?.message || '';
  return message.includes('Frame with ID')
    || message.includes('Target frame was detached')
    || message.includes('frame was removed');
};
const executeScriptWithRetry = async (options, retries = 2) => {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chrome.scripting.executeScript(options);
    } catch (error) {
      lastError = error;
      if (!isFrameDetachedError(error) || attempt === retries) {
        throw error;
      }
      await sleep(1000);
    }
  }
  throw lastError;
};

const fetchOrderUrlFromTab = async (tabId) => {
  if (!tabId) return null;
  try {
    const results = await executeScriptWithRetry({
      target: { tabId },
      func: () => {
        const hash = window.location.hash || '';
        const queryIndex = hash.indexOf('?');
        const queryString = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
        const params = new URLSearchParams(queryString);
        const raw = params.get('orderUrl');
        if (raw) return decodeURIComponent(raw);
        const match = (window.location.href || '').match(/[?&]orderUrl=([^&]+)/);
        return match ? decodeURIComponent(match[1]) : null;
      },
    });
    return results?.[0]?.result ?? null;
  } catch {
    return null;
  }
};

const fetchPaymentLinkFromTab = async (tabId) => {
  if (!tabId) return null;
  try {
    const results = await executeScriptWithRetry({
      target: { tabId, allFrames: true },
      world: 'MAIN',
      func: async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const isLink = (value) => typeof value === 'string' && value.startsWith('http');

        const decodeOrderUrl = () => {
          const hash = window.location.hash || '';
          const queryIndex = hash.indexOf('?');
          const queryString = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
          const params = new URLSearchParams(queryString);
          const raw = params.get('orderUrl');
          if (raw) return decodeURIComponent(raw);
          const match = (window.location.href || '').match(/[?&]orderUrl=([^&]+)/);
          return match ? decodeURIComponent(match[1]) : null;
        };

        const readDatasetLink = (el) => {
          if (!el) return null;
          const dataset = el.dataset || {};
          const candidates = [
            dataset.clipboardText,
            dataset.link,
            dataset.url,
            dataset.href,
            el.getAttribute('data-clipboard-text'),
            el.getAttribute('data-link'),
            el.getAttribute('data-url'),
            el.getAttribute('data-href'),
            el.getAttribute('href'),
          ].filter(Boolean);
          const hit = candidates.find(isLink);
          return hit ? String(hit) : null;
        };

        const findShareButton = () => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          const byText = buttons.find((btn) => {
            const text = (btn.textContent || '').trim();
            return text.includes('å¤å¶é¾æ¥åäº«') || text.includes('æå¼é¾æ¥');
          });
          if (byText) return byText;
          const iconUse = document.querySelector(
            'use[xlink\\:href="#svg-icon-copy-link"], use[href="#svg-icon-copy-link"]'
          );
          const iconButton = iconUse?.closest('button')
            || iconUse?.closest('[role="button"]')
            || iconUse?.parentElement;
          return iconButton ?? null;
        };

        const findLinkInDom = () => {
          const shareBtn = findShareButton();
          if (shareBtn) {
            const link = readDatasetLink(shareBtn) || readDatasetLink(shareBtn.closest('button'))
              || readDatasetLink(shareBtn.closest('a'));
            if (link) return link;
          }

          const anchors = Array.from(document.querySelectorAll('a[href]'));
          const anchor = anchors.find((a) =>
            /store\.flylinking\.com|\/shipping\?id=/.test(a.href),
          );
          if (anchor?.href) return anchor.href;

          const textLinks = Array.from(document.querySelectorAll('input, textarea'))
            .map((el) => el.value)
            .filter(isLink);
          return textLinks[0] || null;
        };

        const clickAndCaptureClipboard = async () => {
          const shareBtn = findShareButton();
          if (!shareBtn) return null;
          const clipboard = navigator.clipboard;
          const originalWrite = clipboard?.writeText?.bind(clipboard);
          let captured = null;

          if (originalWrite) {
            clipboard.writeText = async (text) => {
              captured = String(text);
              return originalWrite(text);
            };
          }

          shareBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await wait(800);

          if (originalWrite) {
            clipboard.writeText = originalWrite;
          }

          if (captured && isLink(captured)) return captured;
          return findLinkInDom();
        };

        for (let attempt = 0; attempt < 3; attempt++) {
          const linkFromUrl = decodeOrderUrl();
          if (linkFromUrl) return linkFromUrl;
          const linkFromDom = findLinkInDom();
          if (linkFromDom) return linkFromDom;
          const clipped = await clickAndCaptureClipboard();
          if (clipped) return clipped;
          await wait(800);
        }
        return null;
      },
    });
    if (!Array.isArray(results)) return null;
    const hit = results.map((item) => item?.result).find((value) => value);
    return hit ?? null;
  } catch {
    return null;
  }
};

const CREATE_ORDER_QUEUE_LIMIT = 20;
const CREATE_ORDER_TIMEOUT_MS = 180000;
const CREATE_ORDER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CREATE_ORDER_CACHE_MAX = 100;
const createOrderQueue = [];
const inFlightOrders = new Map();
const orderResultCache = new Map();
let createOrderQueueRunning = false;
let lastInflywayTabId = null;

const normalizeOrderKey = (message) => {
  const raw = message?.orderNumber;
  if (raw === undefined || raw === null) return '';
  return String(raw).trim();
};

const getCachedOrderResult = (orderKey) => {
  if (!orderKey) return null;
  const entry = orderResultCache.get(orderKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CREATE_ORDER_CACHE_TTL_MS) {
    orderResultCache.delete(orderKey);
    return null;
  }
  return entry.result;
};

const setCachedOrderResult = (orderKey, result) => {
  if (!orderKey || !result?.success) return;
  orderResultCache.set(orderKey, { result, timestamp: Date.now() });
  while (orderResultCache.size > CREATE_ORDER_CACHE_MAX) {
    const oldestKey = orderResultCache.keys().next().value;
    if (!oldestKey) break;
    orderResultCache.delete(oldestKey);
  }
};

const enqueueCreateOrder = (message, sender) => {
  const orderKey = normalizeOrderKey(message);
  const cached = getCachedOrderResult(orderKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  if (orderKey && inFlightOrders.has(orderKey)) {
    return inFlightOrders.get(orderKey);
  }

  if (createOrderQueue.length >= CREATE_ORDER_QUEUE_LIMIT) {
    return Promise.resolve({ success: false, error: 'éåå·²æ»¡ï¼è¯·ç¨ååè¯' });
  }

  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  if (orderKey) {
    inFlightOrders.set(orderKey, promise);
  }

  createOrderQueue.push({ message, sender, orderKey, resolve: resolvePromise, reject: rejectPromise });
  processCreateOrderQueue();
  return promise;
};

const processCreateOrderQueue = async () => {
  if (createOrderQueueRunning) return;
  createOrderQueueRunning = true;

  while (createOrderQueue.length > 0) {
    const item = createOrderQueue.shift();
    if (!item) break;
    const { message, sender, orderKey, resolve } = item;

    await new Promise((done) => {
      let finished = false;
      const timeoutId = setTimeout(() => {
        if (finished) return;
        finished = true;
        resolve({ success: false, error: 'å¤çè¶æ¶' });
        done();
      }, CREATE_ORDER_TIMEOUT_MS);

      const internalMessage = { ...message, type: 'CREATE_ORDER_INTERNAL' };
      onMessageHandler(internalMessage, sender, (response) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        if (orderKey && response?.success) {
          setCachedOrderResult(orderKey, response);
        }
        resolve(response);
        done();
      });
    });

    if (orderKey) {
      inFlightOrders.delete(orderKey);
    }
  }

  createOrderQueueRunning = false;
};

const extractQrFromOrderUrl = async (orderUrl) => {
  if (!orderUrl) return null;
  const previousTab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const existingTab = lastInflywayTabId
    ? await chrome.tabs.get(lastInflywayTabId).catch(() => null)
    : null;
  const originalUrl = existingTab?.url || null;
  const orderTab = existingTab ?? await chrome.tabs.create({ url: orderUrl, active: true });
  const tabId = orderTab?.id;
  if (!tabId) return null;
  const shouldClose = !existingTab;
  if (existingTab) {
    await chrome.tabs.update(tabId, { url: orderUrl, active: true });
  }
  const tabStillExists = await chrome.tabs.get(tabId).catch(() => null);
  if (!tabStillExists) return { success: false, error: 'è®¢åé¡µå·²å³é­' };
  await waitForTabComplete(tabId, 30000);
  await sleep(5000);

  let result = null;
  try {
    const results = await executeScriptWithRetry({
      target: { tabId, allFrames: true },
      func: () => {
        return new Promise((resolve) => {
          const wait = (ms) => new Promise(r => setTimeout(r, ms));

          const isVisible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };

          const getOrderNumber = () => {
            const params = new URLSearchParams(window.location.search);
            const orderId = params.get('id');
            if (orderId) return orderId;
            const match = (document.body.textContent || '').match(/FLY\d+/);
            return match ? match[0] : 'UNKNOWN';
          };

          const getSize = (el) => {
            const rect = el.getBoundingClientRect();
            let width = rect.width || 0;
            let height = rect.height || 0;
            if (el.tagName === 'IMG') {
              width = Math.max(width, el.naturalWidth || 0, el.width || 0);
              height = Math.max(height, el.naturalHeight || 0, el.height || 0);
            } else if (el.tagName === 'CANVAS') {
              width = Math.max(width, el.width || 0);
              height = Math.max(height, el.height || 0);
            }
            return { width, height, area: width * height };
          };

          const isIconSvg = (svg) => {
            const className = (svg.getAttribute('class') || '').toLowerCase();
            if (className.includes('iconfont')) return true;
            const use = svg.querySelector('use');
            if (!use) return false;
            const href = use.getAttribute('xlink:href') || use.getAttribute('href') || '';
            return href === '#svg-icon-q-rcode-copy';
          };

          const isSquareish = (width, height) => {
            if (!width || !height) return false;
            const ratio = width / height;
            return ratio > 0.85 && ratio < 1.18;
          };

          const pickLargest = (elements, minSize, filterFn) => {
            let best = null;
            let bestArea = 0;
            for (const el of elements) {
              if (!isVisible(el)) continue;
              const { width, height, area } = getSize(el);
              if (filterFn && !filterFn(el, width, height)) continue;
              if (width < minSize || height < minSize) continue;
              if (area > bestArea) {
                best = el;
                bestArea = area;
              }
            }
            return best;
          };

          const qrUrlCache = new Map();

          const hasQrHintText = (value) => {
            if (!value) return false;
            const raw = String(value);
            const text = raw.toLowerCase();
            if (text.includes('qrcode')
              || text.includes('qr-code')
              || text.includes('qr_code')
              || text.includes('q-rcode')
              || /qr\s*code/.test(text)
              || /\bqr\b/.test(text)) {
              return true;
            }
            if (raw.includes('\u4e8c\u7ef4\u7801') || raw.includes('\u626b\u7801') || raw.includes('\u652f\u4ed8\u4e8c\u7ef4\u7801')) {
              return true;
            }
            return raw.includes('\u4e8c\u7ef4\u7801') || raw.includes('\u626b\u7801');
          };

          const hasQrHintFromElement = (el) => {
            if (!el) return false;
            const parts = [
              el.getAttribute('alt'),
              el.getAttribute('aria-label'),
              el.getAttribute('title'),
              el.getAttribute('class'),
              el.id,
              el.getAttribute('src'),
              el.getAttribute('data-src'),
              el.currentSrc
            ].filter(Boolean);
            if (parts.some(hasQrHintText)) return true;
            const hintContainer = el.closest('[class*="qr"], [id*="qr"]');
            if (hintContainer) {
              const hintText = `${hintContainer.className || ''} ${hintContainer.id || ''}`;
              if (hasQrHintText(hintText)) return true;
            }
            return false;
          };

          const loadImageData = async (url) => {
            if (!url) return null;
            const size = 80;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return null;

            const img = new Image();
            if (!url.startsWith('data:')) {
              img.crossOrigin = 'anonymous';
            }

            return await new Promise((resolve) => {
              let done = false;
              const finish = (value) => {
                if (done) return;
                done = true;
                resolve(value);
              };
              const timer = setTimeout(() => finish(null), 2000);

              img.onload = () => {
                clearTimeout(timer);
                try {
                  ctx.drawImage(img, 0, 0, size, size);
                  const data = ctx.getImageData(0, 0, size, size);
                  finish(data);
                } catch {
                  finish(null);
                }
              };
              img.onerror = () => {
                clearTimeout(timer);
                finish(null);
              };
              img.src = url;
            });
          };

          const looksLikeQrImageUrl = async (url) => {
            if (!url) return false;
            if (qrUrlCache.has(url)) return qrUrlCache.get(url);
            const imageData = await loadImageData(url);
            if (!imageData) {
              qrUrlCache.set(url, false);
              return false;
            }

            const { data, width, height } = imageData;
            let black = 0;
            let white = 0;
            let total = 0;
            for (let i = 0; i < data.length; i += 4) {
              const alpha = data[i + 3];
              if (alpha < 10) continue;
              const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
              total++;
              if (lum < 50) black++;
              else if (lum > 205) white++;
            }

            const bw = black + white;
            if (!total || !bw) {
              qrUrlCache.set(url, false);
              return false;
            }

            const bwRatio = bw / total;
            const blackRatio = black / bw;
            if (bwRatio < 0.65 || blackRatio < 0.12 || blackRatio > 0.88) {
              qrUrlCache.set(url, false);
              return false;
            }

            let transitions = 0;
            let samples = 0;
            const step = 4;
            for (let y = 0; y < height; y += step) {
              let prev = null;
              for (let x = 0; x < width; x += step) {
                const idx = (y * width + x) * 4;
                const alpha = data[idx + 3];
                if (alpha < 10) continue;
                const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
                const val = lum < 128 ? 0 : 1;
                if (prev !== null && val !== prev) transitions++;
                prev = val;
                samples++;
              }
            }

            const transitionRatio = transitions / Math.max(1, samples);
            const result = transitionRatio > 0.18;
            qrUrlCache.set(url, result);
            return result;
          };

          const scoreUrlCandidate = async (url, hasHint) => {
            if (!url) return { score: 0, hasHint: false };
            const hint = Boolean(hasHint);
            let score = hint ? 3 : 0;
            if (await looksLikeQrImageUrl(url)) score += 4;
            return { score, hasHint: hint };
          };

          const scoreImageCandidate = async (img) => {
            const src = img.currentSrc || img.src || img.getAttribute('data-src');
            if (!src) return { score: 0, hasHint: false, src: null };
            const hint = hasQrHintFromElement(img) || hasQrHintText(src);
            const { score, hasHint } = await scoreUrlCandidate(src, hint);
            return { score, hasHint, src };
          };

          const getImageCandidates = (root) => {
            return Array.from(root.querySelectorAll('img'))
              .map(el => ({ el, size: getSize(el) }))
              .filter(({ el, size }) => isVisible(el)
                && size.width >= 90
                && size.height >= 90
                && isSquareish(size.width, size.height))
              .sort((a, b) => b.size.area - a.size.area)
              .slice(0, 6)
              .map(item => item.el);
          };

          const pickQrImageFromCandidates = async (candidates) => {
            let bestUrl = null;
            let bestScore = 0;
            let bestHasHint = false;
            for (const img of candidates) {
              const { score, hasHint, src } = await scoreImageCandidate(img);
              if (!src) continue;
              if (score > bestScore) {
                bestUrl = src;
                bestScore = score;
                bestHasHint = hasHint;
              }
            }
            if (bestUrl && (bestScore >= 4 || (bestHasHint && bestScore >= 3))) {
              return bestUrl;
            }
            return null;
          };

          const getBackgroundCandidates = (root) => {
            const nodes = root.querySelectorAll('*');
            const candidates = [];
            const maxSide = 800;
            for (const node of nodes) {
              if (!isVisible(node)) continue;
              const style = window.getComputedStyle(node);
              const bg = style.backgroundImage || '';
              if (!bg || bg === 'none') continue;
              const match = bg.match(/url\(["']?(.*?)["']?\)/);
              if (!match) continue;
              const { width, height, area } = getSize(node);
              if (width < 120 || height < 120) continue;
              if (!isSquareish(width, height)) continue;
              if (width > maxSide || height > maxSide) continue;
              candidates.push({ url: match[1], area });
            }
            candidates.sort((a, b) => b.area - a.area);
            return candidates.slice(0, 4);
          };

          const pickQrFromBackgroundCandidates = async (candidates) => {
            let bestUrl = null;
            let bestScore = 0;
            let bestHasHint = false;
            for (const candidate of candidates) {
              const hint = hasQrHintText(candidate.url);
              const { score, hasHint } = await scoreUrlCandidate(candidate.url, hint);
              if (score > bestScore) {
                bestUrl = candidate.url;
                bestScore = score;
                bestHasHint = hasHint;
              }
            }
            if (bestUrl && (bestScore >= 4 || (bestHasHint && bestScore >= 3))) {
              return bestUrl;
            }
            return null;
          };

          const extractSvg = async (svg) => {
            const rect = svg.getBoundingClientRect();
            if (rect.width < 120 || rect.height < 120) return null;
            if (isIconSvg(svg)) return null;

            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 300;
            const ctx = canvas.getContext('2d');

            const svgData = new XMLSerializer().serializeToString(svg);
            const img = new Image();
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            await new Promise((res) => {
              img.onload = () => {
                ctx.drawImage(img, 0, 0, 300, 300);
                URL.revokeObjectURL(url);
                res();
              };
              img.src = url;
            });

            return canvas.toDataURL('image/png');
          };

          const findPaymentRoot = () => {
            const nodes = Array.from(document.querySelectorAll('body *'));
            let best = null;
            let bestLength = Number.POSITIVE_INFINITY;
            for (const node of nodes) {
              if (!isVisible(node)) continue;
              const container = node.closest('section, main, article, div') || node;
              const text = (container.textContent || '').trim();
              if (!text) continue;
              const lower = text.toLowerCase();
              const hasKeyword = lower.includes('scan to pay')
                || lower.includes('payment qr')
                || lower.includes('qr')
                || text.includes('æ«ç ')
                || text.includes('äºç»´ç ?)
                || text.includes('æ¯ä»äºç»´ç ?)
                || text.includes('æ«ç ')
                || text.includes('äºç»´ç ?);
              if (!hasKeyword) continue;
              if (text.length < bestLength) {
                best = container;
                bestLength = text.length;
              }
            }
            return best;
          };

          const tryFindQrInRoot = async (root) => {
            const svgPreferred = root.querySelector('svg#my-svg');
            if (svgPreferred && isVisible(svgPreferred)) {
              const svgUrl = await extractSvg(svgPreferred);
              if (svgUrl) return svgUrl;
            }

            const svg = pickLargest(
              root.querySelectorAll('svg'),
              120,
              (el, width, height) => !isIconSvg(el) && isSquareish(width, height)
            );
            if (svg) {
              const svgUrl = await extractSvg(svg);
              if (svgUrl) return svgUrl;
            }

            const canvas = pickLargest(
              root.querySelectorAll('canvas'),
              120,
              (_el, width, height) => isSquareish(width, height)
            );
            if (canvas) {
              try {
                return canvas.toDataURL('image/png');
              } catch {
                return null;
              }
            }

            const imgCandidates = getImageCandidates(root);
            const imgUrl = await pickQrImageFromCandidates(imgCandidates);
            if (imgUrl) return imgUrl;

            const bgCandidates = getBackgroundCandidates(root);
            const bgUrl = await pickQrFromBackgroundCandidates(bgCandidates);
            if (bgUrl) return bgUrl;

            return null;
          };

          const hoverElement = (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const opts = {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2
            };
            if (window.PointerEvent) {
              const pointerOpts = {
                ...opts,
                pointerType: 'mouse',
                isPrimary: true
              };
              el.dispatchEvent(new PointerEvent('pointerenter', pointerOpts));
              el.dispatchEvent(new PointerEvent('pointerover', pointerOpts));
              el.dispatchEvent(new PointerEvent('pointermove', pointerOpts));
            }
            el.dispatchEvent(new MouseEvent('mouseenter', opts));
            el.dispatchEvent(new MouseEvent('mouseover', opts));
            el.dispatchEvent(new MouseEvent('mousemove', opts));
            return true;
          };

          const triggerQrPreview = () => {
            let triggered = false;
            let qrShareBtn = Array.from(document.querySelectorAll('button')).find(btn =>
              btn.textContent.includes('äºç»´ç åäº?)
            );
            if (!qrShareBtn) {
              qrShareBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find((btn) => {
                const text = (btn.textContent || '').trim();
                return text.includes('äºç»´ç åäº?)
                  || text.includes('äºç»´ç ?)
                  || /qr/i.test(text)
                  || text.includes('æµå²æ·?);
              });
            }
            if (qrShareBtn) {
              hoverElement(qrShareBtn);
              triggered = true;
            }

            const qrIconUse = document.querySelector(
              'use[xlink\\:href="#svg-icon-q-rcode-copy"], use[href="#svg-icon-q-rcode-copy"]'
            );
            const qrIcon = qrIconUse?.closest('svg');
            const qrIconBtn = qrIcon?.closest('button')
              || qrIcon?.closest('[role="button"]')
              || qrIcon?.parentElement
              || qrIcon;
            if (qrIconBtn) {
              hoverElement(qrIconBtn);
              triggered = true;
            }

            if (qrShareBtn) {
              qrShareBtn.click();
              triggered = true;
            } else if (qrIconBtn) {
              qrIconBtn.click();
              triggered = true;
            }

            return triggered;
          };

          (async () => {
            const orderNumber = getOrderNumber();
            for (let i = 0; i < 50; i++) {
              triggerQrPreview();
              const paymentRoot = findPaymentRoot();
              const roots = paymentRoot ? [paymentRoot, document.body] : [document.body];
              for (const root of roots) {
                const qrCodeUrl = await tryFindQrInRoot(root);
                if (qrCodeUrl) {
                  resolve({ success: true, qrCodeUrl, orderNumber });
                  return;
                }
              }
              await wait(500);
            }
            resolve({ success: false, error: 'æªæ¾å°æ¯ä»äºç»´ç ', orderNumber });
          })().catch(e => resolve({ success: false, error: e.message }));
        });
      }
    });
    const candidates = (results || []).map(entry => entry?.result).filter(Boolean);
    result = candidates.find(entry => entry?.success) ?? candidates[0] ?? null;
  } catch (error) {
    console.warn('extractQrFromOrderUrl failed', error);
    result = { success: false, error: error?.message || 'Failed to extract QR code' };
  } finally {
    try {
      if (shouldClose) {
        await chrome.tabs.remove(tabId);
      } else if (originalUrl) {
        await chrome.tabs.update(tabId, { url: originalUrl, active: false });
      }
    } catch (error) {
      console.warn('Failed to close order tab', error);
    }
    try {
      if (previousTab?.id && previousTab.id !== tabId) {
        await chrome.tabs.update(previousTab.id, { active: true });
      }
    } catch {
      // ignore focus restore failure
    }
  }

  return result;
};

// çå¬æ¥èª content scripts çæ¶æ?const onMessageHandler = (message, sender, sendResponse) => {
  console.log('Background æ¶å°æ¶æ¯:', message, 'from:', sender);

  if (message.type === 'CREATE_ORDER' && message.amount) {
    enqueueCreateOrder(message, sender)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({ success: false, error: error?.message || 'å¤çå¤±è´¥' });
      });
    return true;
  }

  if (message.type === 'CREATE_ORDER_INTERNAL' && message.amount) {
    (async () => {
      try {
        const targetUrl = 'https://inflyway.com/kamelnet/#/kn/fly-link/orders/add';
        let tabs = await chrome.tabs.query({ url: targetUrl });

        if (tabs.length === 0) {
          tabs = await chrome.tabs.query({ url: 'https://*.inflyway.com/*' });
          if (tabs.length === 0) {
            tabs = await chrome.tabs.query({ url: 'https://inflyway.com/*' });
          }
          if (tabs.length > 0) {
            const tabId = tabs[0].id;
            if (tabId) {
              console.log('åæ¢å°åå»ºè®¢åé¡µé?);
              await chrome.tabs.update(tabId, { url: targetUrl, active: false });
              await waitForTabComplete(tabId);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }

        if (tabs.length > 0) {
          const targetTab = tabs[0];
          const targetTabId = targetTab.id;
          const targetUrl = 'https://inflyway.com/kamelnet/#/kn/fly-link/orders/add';
          const currentUrl = targetTab.url || '';
          console.log('æ¾å° inflyway æ ç­¾é¡?', targetTabId, 'URL:', currentUrl);
          if (targetTabId) {
            lastInflywayTabId = targetTabId;
          }

          if (!currentUrl.includes('/orders/add')) {
            console.log('åæ¢å°åå»ºè®¢åé¡µé?);
            await chrome.tabs.update(targetTabId, { url: targetUrl, active: false });
            await new Promise((resolve) => {
              chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === targetTabId && info.status === 'complete') {
                  chrome.tabs.onUpdated.removeListener(listener);
                  resolve();
                }
              });
            });
            await sleep(3000);
          }

          try {
            const results = await executeScriptWithRetry({
              target: { tabId: targetTabId },
              func: (amt) => {
                return new Promise((resolve) => {
                  async function createOrder(amount) {
                    const wait = (ms) => new Promise(r => setTimeout(r, ms));
                    const isVisible = (el) => {
                      if (!el) return false;
                      const style = window.getComputedStyle(el);
                      const rect = el.getBoundingClientRect();
                      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
                    };
                    const getDrawer = () => {
                      const candidates = Array.from(document.querySelectorAll('.el-drawer__wrapper, .el-drawer, .el-dialog__wrapper, .el-dialog, [role="dialog"]'))
                        .filter(isVisible);
                      return candidates.length ? candidates[candidates.length - 1] : null;
                    };
                    const findProductRows = (root) => {
                      if (!root) return [];
                      const selectors = [
                        '.el-table__body-wrapper .el-table__row',
                        '.el-table__body tr',
                        '.el-table__row',
                        '.table-row-info',
                        '[class*="table-row"]',
                      ];
                      for (const selector of selectors) {
                        const nodes = Array.from(root.querySelectorAll(selector)).filter(isVisible);
                        if (nodes.length > 0) return nodes;
                      }
                      return [];
                    };
                    const waitForProductRows = async (timeoutMs = 15000) => {
                      const start = Date.now();
                      while (Date.now() - start < timeoutMs) {
                        const drawer = getDrawer() || document;
                        const rows = findProductRows(drawer);
                        if (rows.length > 0) return true;
                        await wait(400);
                      }
                      return false;
                    };
                    const findAddButton = (root) => {
                      if (!root) return null;
                      const rows = findProductRows(root);
                      if (rows.length > 0) {
                        const row = rows[0];
                        const direct = row.querySelector('.table-row-add');
                        if (direct && isVisible(direct)) return direct;
                        const plusIcon = Array.from(row.querySelectorAll('.el-icon-plus')).find(isVisible);
                        if (plusIcon) {
                          const plusBtn = plusIcon.closest('button, [role="button"], span');
                          if (plusBtn) return plusBtn;
                        }
                      }
                      const direct = root.querySelector('.table-row-add');
                      if (direct && isVisible(direct)) return direct;
                      const plusIcon = Array.from(root.querySelectorAll('.el-icon-plus')).find(isVisible);
                      if (plusIcon) {
                        const plusBtn = plusIcon.closest('button, [role="button"], span');
                        if (plusBtn) return plusBtn;
                      }
                      return null;
                    };
                    const waitForAddButton = async (timeoutMs = 15000) => {
                      const start = Date.now();
                      while (Date.now() - start < timeoutMs) {
                        const drawer = getDrawer() || document;
                        const addBtn = findAddButton(drawer);
                        if (addBtn) return addBtn;
                        await wait(400);
                      }
                      return null;
                    };
                    const waitForOrderRow = async (timeoutMs = 8000) => {
                      const start = Date.now();
                      while (Date.now() - start < timeoutMs) {
                        const rows = document.querySelectorAll('.table-row-info, .el-table__body-wrapper .el-table__row, [class*="table-row-info"]');
                        if (rows.length > 0) return true;
                        await wait(300);
                      }
                      return false;
                    };
                    const setNativeValue = (element, value) => {
                      const setter = Object.getOwnPropertyDescriptor(element.__proto__, 'value')?.set ||
                        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                      if (setter) {
                        setter.call(element, value);
                      } else {
                        element.value = value;
                      }
                    };
                    const parseQuantity = (value) => {
                      const match = `${value ?? ''}`.match(/\d+/);
                      return match ? Number(match[0]) : null;
                    };
                    const applyQuantityInContainer = async (container, amountValue) => {
                      if (!container) return false;
                      const target = Math.max(1, Math.floor(Number(amountValue) || 1));
                      const targetStr = String(target);
                      const input = container.querySelector('input[role="spinbutton"], .el-input-number input, input.el-input__inner');
                      const plusButton = container.querySelector('.el-input-number__increase') ||
                        Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === '+') ||
                        null;
                      const minusButton = container.querySelector('.el-input-number__decrease') ||
                        Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === '-') ||
                        null;

                      if (input) {
                        setNativeValue(input, targetStr);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('blur', { bubbles: true }));
                        await wait(200);
                        const current = parseQuantity(input.value) ?? parseQuantity(input.getAttribute('aria-valuenow'));
                        if (current === target) return true;
                      }

                      if (plusButton || minusButton) {
                        const currentValue = input
                          ? parseQuantity(input.value) ?? parseQuantity(input.getAttribute('aria-valuenow'))
                          : null;
                        let current = Number.isFinite(currentValue) ? currentValue : 1;
                        const delta = target - current;
                        const button = delta > 0 ? plusButton : minusButton;
                        if (!button) return false;
                        const steps = Math.abs(delta);
                        for (let i = 0; i < steps; i += 1) {
                          button.click();
                          if (i % 5 === 0) {
                            await wait(60);
                          }
                        }
                        await wait(200);
                        return true;
                      }

                      return false;
                    };

                    console.log('å¼å§åå»ºè®¢åï¼éé¢:', amount);
                    await wait(500);

                    // 1. ç¹å»"éæ©åå"
                    let buttons = Array.from(document.querySelectorAll('button'));
                    const selectBtn = buttons.find(el => el.textContent.trim() === 'éæ©åå');
                    if (selectBtn) {
                      console.log('ç¹å»éæ©åå');
                      selectBtn.click();
                      await wait(800);

                      const rowsReady = await waitForProductRows();
                      if (!rowsReady) {
                        throw new Error('Product list not ready');
                      }

                      // 2. å¨æ½å±ä¸­æ¥æ¾ååç?+"æé®
                      const addBtn = await waitForAddButton();
                      const addBtns = addBtn ? [addBtn] : [];
                      if (!addBtn) {
                        throw new Error('Product list not ready');
                      }
                      if (addBtns.length > 0) {
                        console.log('æ¾å°å¯éååï¼ç¹å»ç¬¬ä¸ä¸?);
                        addBtns[0].click();
                        await wait(2000);

                        // ç¹å»æ°ééæ©å¼¹çªç?ç¡®å®"
                        const popover = document.querySelector('.el-popover:not([style*="display: none"])');
                        if (popover) {
                          await applyQuantityInContainer(popover, amount);
                          const popoverBtns = Array.from(popover.querySelectorAll('button'));
                          const popoverConfirm = popoverBtns.find(btn => btn.textContent.includes('ç¡®å®'));
                          if (popoverConfirm) {
                            console.log('ç¹å»æ°éç¡®å®');
                            popoverConfirm.click();
                            await wait(1000);
                          }
                        }

                        
                        const added = await waitForOrderRow();
                        if (!added) {
                          throw new Error('Product not added');
                        }
                      }

                      // 3. ç¹å»ç¡®å®å³é­æ½å±
                      buttons = Array.from(document.querySelectorAll('button'));
                      const confirmBtn = buttons.find(btn => btn.textContent.trim() === 'ç¡®å®');
                      if (confirmBtn) {
                        confirmBtn.click();
                        await wait(1500);
                      }
                    }

                    // 4. å¡«åè®¢åæ»é¢
                    const allInputs = document.querySelectorAll('input');
                    for (const input of allInputs) {
                      const parent = input.closest('div');
                      const text = parent?.textContent || '';
                      if (text.includes('ç¾å') && text.includes('æ¬§å')) {
                        console.log('å¡«åè®¢åæ»é¢:', amount);
                        input.focus();
                        input.value = amount;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.blur();
                        await wait(500);
                        break;
                      }
                    }

                    // 5. ç¹å»"åå»ºå¿«æ·è®¢å"
                    buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find(btn => btn.textContent.includes('åå»ºå¿«æ·è®¢å'));
                    if (!submitBtn) {
                      resolve({ success: false, error: 'æªæ¾å°åå»ºå¿«æ·è®¢åæé? });
                      return;
                    }

                    submitBtn.click();
                    console.log('å·²ç¹å»åå»ºå¿«æ·è®¢å?);
                    await wait(3000);

                    const getOrderNumber = () => {
                      const match = (document.body.textContent || '').match(/FLY\\d+/);
                      return match ? match[0] : 'UNKNOWN';
                    };

                    const decodeOrderUrl = () => {
                      const hash = window.location.hash || '';
                      const queryIndex = hash.indexOf('?');
                      const queryString = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
                      const params = new URLSearchParams(queryString);
                      const raw = params.get('orderUrl');
                      if (raw) return decodeURIComponent(raw);
                      const match = (window.location.href || '').match(/[?&]orderUrl=([^&]+)/);
                      return match ? decodeURIComponent(match[1]) : null;
                    };

                    const isLink = (value) => typeof value === 'string' && value.startsWith('http');

                    const readDatasetLink = (el) => {
                      if (!el) return null;
                      const dataset = el.dataset || {};
                      const candidates = [
                        dataset.clipboardText,
                        dataset.link,
                        dataset.url,
                        dataset.href,
                        el.getAttribute('data-clipboard-text'),
                        el.getAttribute('data-link'),
                        el.getAttribute('data-url'),
                        el.getAttribute('data-href'),
                        el.getAttribute('href'),
                      ].filter(Boolean);
                      const hit = candidates.find(isLink);
                      return hit ? String(hit) : null;
                    };

                    const findCopyLinkButton = () => {
                      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                      const byText = buttons.find((btn) => {
                        const text = (btn.textContent || '').trim();
                        return text.includes('å¤å¶é¾æ¥åäº«') || text.includes('å¤å¶é¾æ¥') || text.includes('æå¼é¾æ¥');
                      });
                      if (byText) return byText;
                      const iconUse = document.querySelector(
                        'use[xlink\\:href="#svg-icon-copy-link"], use[href="#svg-icon-copy-link"]'
                      );
                      return iconUse?.closest('button')
                        || iconUse?.closest('[role="button"]')
                        || iconUse?.parentElement
                        || null;
                    };

                    const findLinkInDom = () => {
                      const shareBtn = findCopyLinkButton();
                      if (shareBtn) {
                        const link = readDatasetLink(shareBtn)
                          || readDatasetLink(shareBtn.closest('button'))
                          || readDatasetLink(shareBtn.closest('a'));
                        if (link) return link;
                      }

                      const dataLinks = Array.from(
                        document.querySelectorAll('[data-clipboard-text], [data-link], [data-url], [data-href]')
                      );
                      for (const node of dataLinks) {
                        const link = readDatasetLink(node);
                        if (link) return link;
                      }

                      const anchors = Array.from(document.querySelectorAll('a[href]'));
                      const anchor = anchors.find((a) =>
                        a.href.includes('store.flylinking.com') || a.href.includes('/shipping?id=')
                      );
                      if (anchor?.href) return anchor.href;

                      const textLinks = Array.from(document.querySelectorAll('input, textarea'))
                        .map((el) => el.value)
                        .filter(isLink);
                      return textLinks[0] || null;
                    };

                    const waitForPaymentLink = async () => {
                      for (let i = 0; i < 15; i++) {
                        const linkFromUrl = decodeOrderUrl();
                        if (linkFromUrl) return linkFromUrl;
                        const linkFromDom = findLinkInDom();
                        if (linkFromDom) return linkFromDom;
                        const shareBtn = findCopyLinkButton();
                        if (shareBtn) {
                          shareBtn.click();
                          await wait(500);
                          const afterClick = findLinkInDom();
                          if (afterClick) return afterClick;
                        }
                        await wait(700);
                      }
                      return null;
                    };

                    const paymentLinkUrl = await waitForPaymentLink();
                    if (paymentLinkUrl) {
                      resolve({ success: true, paymentLinkUrl, orderNumber: getOrderNumber() });
                      return;
                    }

                    // 6. æ¥æ¾æ¯ä»äºç»´ç ?                    console.log('æ¥æ¾æ¯ä»äºç»´ç ?);
                    await wait(2000);

                    const hoverElement = (el) => {
                      if (!el) return false;
                      const rect = el.getBoundingClientRect();
                      const opts = {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2
                      };
                      if (window.PointerEvent) {
                        const pointerOpts = {
                          ...opts,
                          pointerType: 'mouse',
                          isPrimary: true
                        };
                        el.dispatchEvent(new PointerEvent('pointerenter', pointerOpts));
                        el.dispatchEvent(new PointerEvent('pointerover', pointerOpts));
                        el.dispatchEvent(new PointerEvent('pointermove', pointerOpts));
                      }
                      el.dispatchEvent(new MouseEvent('mouseenter', opts));
                      el.dispatchEvent(new MouseEvent('mouseover', opts));
                      el.dispatchEvent(new MouseEvent('mousemove', opts));
                      return true;
                    };

                    const qrShareBtn = Array.from(document.querySelectorAll('button')).find(btn =>
                      btn.textContent.includes('äºç»´ç åäº?)
                    );
                    if (qrShareBtn) {
                      console.log('Hover QR share button');
                      hoverElement(qrShareBtn);
                      await wait(500);
                    }

                    const qrIconUse = document.querySelector(
                      'use[xlink\\:href="#svg-icon-q-rcode-copy"], use[href="#svg-icon-q-rcode-copy"]'
                    );
                    const qrIcon = qrIconUse?.closest('svg');
                    const qrIconBtn = qrIcon?.closest('button')
                      || qrIcon?.closest('[role="button"]')
                      || qrIcon?.parentElement
                      || qrIcon;
                    if (qrIconBtn) {
                      console.log('Hover QR icon');
                      hoverElement(qrIconBtn);
                      await wait(500);
                    }

                    if (qrShareBtn) {
                      console.log('Click QR share button');
                      qrShareBtn.click();
                      await wait(1500);
                    } else if (qrIconBtn) {
                      console.log('Click QR icon');
                      qrIconBtn.click();
                      await wait(1500);
                    }

                    const hasPaymentText = (text) => {
                      const normalized = (text || '').toLowerCase();
                      return normalized.includes('scan to pay')
                        || normalized.includes('payment qr')
                        || text.includes('æ«ç ')
                        || text.includes('æ¯ä»äºç»´ç ?);
                    };

                    const isVisible = (el) => {
                      if (!el) return false;
                      const style = window.getComputedStyle(el);
                      if (style.display === 'none' || style.visibility === 'hidden') return false;
                      const rect = el.getBoundingClientRect();
                      return rect.width > 0 && rect.height > 0;
                    };

                    const hasQrHintText = (value) => {
            if (!value) return false;
            const raw = String(value);
            const text = raw.toLowerCase();
            if (text.includes('qrcode')
              || text.includes('qr-code')
              || text.includes('qr_code')
              || text.includes('q-rcode')
              || /qr\s*code/.test(text)
              || /\bqr\b/.test(text)) {
              return true;
            }
            if (raw.includes('\u4e8c\u7ef4\u7801') || raw.includes('\u626b\u7801') || raw.includes('\u652f\u4ed8\u4e8c\u7ef4\u7801')) {
              return true;
            }
            return raw.includes('\u4e8c\u7ef4\u7801') || raw.includes('\u626b\u7801');
          };

          const hasQrHintFromElement = (el) => {
                      if (!el) return false;
                      const parts = [
                        el.getAttribute('alt'),
                        el.getAttribute('aria-label'),
                        el.getAttribute('title'),
                        el.getAttribute('class'),
                        el.id,
                        el.getAttribute('src'),
                        el.getAttribute('data-src')
                      ].filter(Boolean);
                      if (parts.some(hasQrHintText)) return true;
                      const hintContainer = el.closest('[class*="qr"], [id*="qr"]');
                      if (hintContainer) {
                        const hintText = `${hintContainer.className || ''} ${hintContainer.id || ''}`;
                        if (hasQrHintText(hintText)) return true;
                      }
                      return false;
                    };

                    const analyzeBitmap = (imageData) => {
                      if (!imageData) return false;
                      const { data, width, height } = imageData;
                      let black = 0;
                      let white = 0;
                      let total = 0;
                      for (let i = 0; i < data.length; i += 4) {
                        const alpha = data[i + 3];
                        if (alpha < 10) continue;
                        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
                        total++;
                        if (lum < 50) black++;
                        else if (lum > 205) white++;
                      }
                      const bw = black + white;
                      if (!total || !bw) return false;
                      const bwRatio = bw / total;
                      const blackRatio = black / bw;
                      if (bwRatio < 0.65 || blackRatio < 0.12 || blackRatio > 0.88) return false;

                      let transitions = 0;
                      let samples = 0;
                      const step = 4;
                      for (let y = 0; y < height; y += step) {
                        let prev = null;
                        for (let x = 0; x < width; x += step) {
                          const idx = (y * width + x) * 4;
                          const alpha = data[idx + 3];
                          if (alpha < 10) continue;
                          const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
                          const val = lum < 128 ? 0 : 1;
                          if (prev !== null && val !== prev) transitions++;
                          prev = val;
                          samples++;
                        }
                      }
                      const transitionRatio = transitions / Math.max(1, samples);
                      return transitionRatio > 0.18;
                    };

                    const looksLikeQrCanvas = (canvas) => {
                      try {
                        const size = 80;
                        const temp = document.createElement('canvas');
                        temp.width = size;
                        temp.height = size;
                        const ctx = temp.getContext('2d', { willReadFrequently: true });
                        if (!ctx) return false;
                        ctx.drawImage(canvas, 0, 0, size, size);
                        const data = ctx.getImageData(0, 0, size, size);
                        return analyzeBitmap(data);
                      } catch {
                        return false;
                      }
                    };

                    const looksLikeQrImage = async (img) => {
                      if (!img) return false;
                      const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
                      if (hasQrHintFromElement(img) || hasQrHintText(src)) return true;
                      try {
                        const size = 80;
                        const temp = document.createElement('canvas');
                        temp.width = size;
                        temp.height = size;
                        const ctx = temp.getContext('2d', { willReadFrequently: true });
                        if (!ctx) return false;
                        ctx.drawImage(img, 0, 0, size, size);
                        const data = ctx.getImageData(0, 0, size, size);
                        return analyzeBitmap(data);
                      } catch {
                        return false;
                      }
                    };

                    const findPaymentContainer = (orderNumber) => {
                      const nodes = Array.from(
                        document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="dialog"], [class*="popup"], [class*="drawer"]')
                      );
                      let best = null;
                      let bestLength = Number.POSITIVE_INFINITY;
                      for (const node of nodes) {
                        if (!isVisible(node)) continue;
                        const text = node.textContent || '';
                        if (text.includes('å®¢æ·é¡¾é®') || text.includes('service@inflyway')) continue;
                        if (!hasPaymentText(text) && (!orderNumber || !text.includes(orderNumber))) continue;
                        if (text.length < bestLength) {
                          best = node;
                          bestLength = text.length;
                        }
                      }
                      return best;
                    };

                    const getOrderUrl = () => {
                      const hash = window.location.hash || '';
                      const queryIndex = hash.indexOf('?');
                      const queryString = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
                      const params = new URLSearchParams(queryString);
                      const raw = params.get('orderUrl');
                      if (raw) return decodeURIComponent(raw);
                      const match = (window.location.href || '').match(/[?&]orderUrl=([^&]+)/);
                      return match ? decodeURIComponent(match[1]) : null;
                    };

                    for (let i = 0; i < 15; i++) {
                      const pageText = document.body.textContent || '';
                      const orderMatch = pageText.match(/FLY\d+/);
                      const orderNumber = orderMatch ? orderMatch[0] : 'UNKNOWN';
                      const bodyLooksPayment = hasPaymentText(pageText);
                      const container = findPaymentContainer(orderMatch ? orderMatch[0] : null);

                      const svg = container?.querySelector('svg#my-svg')
                        || (bodyLooksPayment ? document.querySelector('svg#my-svg') : null);
                      if (svg && isVisible(svg)) {
                        const rect = svg.getBoundingClientRect();
                        if (rect.width >= 120 && rect.height >= 120) {
                          console.log('æ¾å°SVGäºç»´ç ?);

                          // å°SVGè½¬æ¢ä¸ºPNG
                          const canvas = document.createElement('canvas');
                          canvas.width = 300;
                          canvas.height = 300;
                          const ctx = canvas.getContext('2d');

                          const svgData = new XMLSerializer().serializeToString(svg);
                          const img = new Image();
                          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                          const url = URL.createObjectURL(svgBlob);

                          await new Promise((res) => {
                            img.onload = () => {
                              ctx.drawImage(img, 0, 0, 300, 300);
                              URL.revokeObjectURL(url);
                              res();
                            };
                            img.src = url;
                          });

                          const qrCodeUrl = canvas.toDataURL('image/png');
                          resolve({ success: true, qrCodeUrl, orderNumber });
                          return;
                        }
                      }

                      const canvases = Array.from(container?.querySelectorAll('canvas') || []);
                      for (const canvas of canvases) {
                        if (!isVisible(canvas) || canvas.width < 120 || canvas.height < 120) continue;
                        if (!looksLikeQrCanvas(canvas)) continue;
                        const qrCodeUrl = canvas.toDataURL('image/png');
                        resolve({ success: true, qrCodeUrl, orderNumber });
                        return;
                      }

                      const images = Array.from(container?.querySelectorAll('img') || []);
                      for (const img of images) {
                        if (!isVisible(img) || img.width < 120 || img.height < 120) continue;
                        if (!await looksLikeQrImage(img)) continue;
                        const src = img.currentSrc || img.src;
                        if (!src) continue;
                        resolve({ success: true, qrCodeUrl: src, orderNumber });
                        return;
                      }

                      await wait(500);
                    }

                    resolve({ success: false, error: 'æªæ¾å°æ¯ä»äºç»´ç ', orderUrl: getOrderUrl() });
                  }

                  createOrder(amt).catch(e => resolve({ success: false, error: e.message }));
                });
              },
              args: [message.amount]
            });

            let response = results[0].result;
            console.log('æ§è¡ç»æ:', response);

            const orderUrlFromResponse = response?.orderUrl || null;
            const orderUrlFromTab = orderUrlFromResponse ? null : await fetchOrderUrlFromTab(targetTabId);
            const paymentLinkFromTab = await fetchPaymentLinkFromTab(targetTabId);
            const paymentLinkUrl = paymentLinkFromTab || orderUrlFromResponse || orderUrlFromTab;
            if (paymentLinkUrl) {
              response = {
                success: true,
                orderNumber: response?.orderNumber ?? message.orderNumber,
                paymentLinkUrl,
                qrCodeUrl: response?.qrCodeUrl,
              };
            }

            if (response.needNewWindow) {
              // ç­å¾æ°çªå£æå¼
              await new Promise(resolve => setTimeout(resolve, 2000));

              // æ¥æ¾æ°æå¼ççªå?              const allTabs = await chrome.tabs.query({});
              console.log('æææ ç­¾é¡µ:', allTabs.map(t => ({ id: t.id, url: t.url })));
              const newTab = allTabs.find(t => t.url && t.url.includes('inflyway.com') && t.id !== tabs[0].id);
              console.log('åæ ç­¾é¡µ ID:', tabs[0].id);
              console.log('æ¾å°çæ°çªå£:', newTab);

              if (newTab) {
                console.log('æ¾å°æ°çªå?', newTab.id);

                // å¨æ°çªå£ä¸­å¡«åååä¿¡æ?                const productResult = await executeScriptWithRetry({
                  target: { tabId: newTab.id },
                  func: (amt) => {
                    return new Promise((resolve) => {
                      async function fillProduct() {
                        const wait = (ms) => new Promise(r => setTimeout(r, ms));
                        await wait(1000);

                        // å¡«åæ°é
                        const setNativeValue = (element, value) => {
                          const setter = Object.getOwnPropertyDescriptor(element.__proto__, 'value')?.set ||
                            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                          if (setter) {
                            setter.call(element, value);
                          } else {
                            element.value = value;
                          }
                        };

                        const parseQuantity = (value) => {
                          const match = `${value ?? ''}`.match(/\\d+/);
                          return match ? Number(match[0]) : null;
                        };

                        const findQuantityControl = () => {
                          const rowSelectors = ['.table-row-info', '.table-row', '[class*=\"table-row\"]', '[class*=\"order-item\"]'];
                          const rows = rowSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
                          for (const row of rows) {
                            const input = row.querySelector('input[role=\"spinbutton\"], .el-input-number input, input.el-input__inner');
                            if (!input) continue;
                            const container = input.closest('.el-input-number') || row;
                            const plusButton = container.querySelector('.el-input-number__increase') ||
                              row.querySelector('.el-input-number__increase') ||
                              null;
                            const minusButton = container.querySelector('.el-input-number__decrease') ||
                              row.querySelector('.el-input-number__decrease') ||
                              null;
                            return { input, plusButton, minusButton };
                          }
                          const allInputs = Array.from(document.querySelectorAll('input'));
                          const spinCandidates = Array.from(
                            document.querySelectorAll('input[role=\"spinbutton\"], .el-input-number input, input.el-input__inner'),
                          );
                          const candidates = allInputs.filter((input) => {
                            const type = (input.getAttribute('type') || '').toLowerCase();
                            const inputMode = (input.getAttribute('inputmode') || '').toLowerCase();
                            const role = (input.getAttribute('role') || '').toLowerCase();
                            const value = input.value || '';
                            return type === 'number' ||
                              inputMode === 'numeric' ||
                              inputMode === 'decimal' ||
                              role === 'spinbutton' ||
                              (/^\\d+$/.test(value) && value.length <= 4);
                          });

                          const labeledInput = candidates.find((input) => {
                            const text = input.closest('div')?.textContent || '';
                            const aria = input.getAttribute('aria-label') || '';
                            const placeholder = input.getAttribute('placeholder') || '';
                            const combined = `${text} ${aria} ${placeholder}`.toLowerCase();
                            return combined.includes('æ°é') || combined.includes('qty');
                          });

                          let input =
                            labeledInput ||
                            spinCandidates.find((item) => item.closest('.el-input-number')) ||
                            spinCandidates[0] ||
                            candidates[0] ||
                            null;
                          const plusButtons = Array.from(document.querySelectorAll('.el-input-number__increase, button'))
                            .filter((btn) => btn.textContent?.trim() === '+' || btn.className?.includes('increase'));
                          const minusButtons = Array.from(document.querySelectorAll('.el-input-number__decrease, button'))
                            .filter((btn) => btn.textContent?.trim() === '-' || btn.className?.includes('decrease'));

                          let plusButton = null;
                          let minusButton = null;

                          if (input) {
                            const container = input.closest('.el-input-number') || input.closest('div');
                            if (container) {
                              plusButton = container.querySelector('.el-input-number__increase') ||
                                Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === '+') ||
                                null;
                              minusButton = container.querySelector('.el-input-number__decrease') ||
                                Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === '-') ||
                                null;
                            }
                          }

                          if (!plusButton || !minusButton) {
                            for (const plus of plusButtons) {
                              let node = plus.closest('div');
                              while (node && node !== document.body) {
                                const minus = Array.from(node.querySelectorAll('button, .el-input-number__decrease'))
                                  .find((btn) => btn.textContent?.trim() === '-' || btn.className?.includes('decrease'));
                                const localInput = node.querySelector('input');
                                if (minus) {
                                  plusButton = plus;
                                  minusButton = minus;
                                  if (!input && localInput) {
                                    input = localInput;
                                  }
                                  break;
                                }
                                node = node.parentElement;
                              }
                              if (plusButton && minusButton) break;
                            }
                          }

                          return { input, plusButton, minusButton };
                        };

                        const target = Math.max(1, Math.floor(Number(amt) || 1));
                        const targetStr = String(target);
                        let control = null;
                        for (let attempt = 0; attempt < 10; attempt += 1) {
                          control = findQuantityControl();
                          if (control.input || control.plusButton || control.minusButton) break;
                          await wait(400);
                        }

                        if (control) {
                          const { input, plusButton, minusButton } = control;
                          if (input) {
                            setNativeValue(input, targetStr);
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            input.dispatchEvent(new Event('blur', { bubbles: true }));
                            await wait(300);
                            const current = parseQuantity(input.value) ??
                              parseQuantity(input.getAttribute('aria-valuenow'));
                            if (current === target) {
                              console.log('å¡«åæ°é:', targetStr);
                            }
                          }

                          if (plusButton || minusButton) {
                            const currentValue = input
                              ? parseQuantity(input.value) ?? parseQuantity(input.getAttribute('aria-valuenow'))
                              : null;
                            let current = Number.isFinite(currentValue) ? currentValue : 1;
                            const delta = target - current;
                            const button = delta > 0 ? plusButton : minusButton;
                            if (button) {
                              const steps = Math.abs(delta);
                              for (let i = 0; i < steps; i += 1) {
                                button.click();
                                if (i % 5 === 0) {
                                  await wait(60);
                                }
                              }
                              await wait(200);
                            }
                            console.log('å¡«åæ°é:', targetStr);
                          }
                        }

                        // ç¹å»ç¡®å®
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const confirmBtn = buttons.find(btn => btn.textContent.trim() === 'ç¡®å®');
                        if (confirmBtn) {
                          console.log('ç¹å»ç¡®å®');
                          confirmBtn.click();
                          await wait(1000);
                        }

                        resolve({ success: true });
                      }
                      fillProduct().catch(e => resolve({ success: false, error: e.message }));
                    });
                  },
                  args: [message.amount]
                });

                console.log('åååå»ºç»æ:', productResult[0].result);

                // å³é­æ°çªå?                await chrome.tabs.remove(newTab.id);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // ç»§ç»­å¨åçªå£å¡«åè®¢å
                const finalResult = await executeScriptWithRetry({
                  target: { tabId: tabs[0].id },
                  func: (amt) => {
                    return new Promise((resolve) => {
                      async function completeOrder(amount) {
                        const wait = (ms) => new Promise(r => setTimeout(r, ms));
                        const getOrderUrl = () => {
                          const hash = window.location.hash || '';
                          const queryIndex = hash.indexOf('?');
                          const queryString = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
                          const params = new URLSearchParams(queryString);
                          const raw = params.get('orderUrl');
                          if (raw) return decodeURIComponent(raw);
                          const match = (window.location.href || '').match(/[?&]orderUrl=([^&]+)/);
                          return match ? decodeURIComponent(match[1]) : null;
                        };

                        // å¡«åè®¢åæ»é¢
                        await wait(500);
                        const allInputs = document.querySelectorAll('input');
                        for (const input of allInputs) {
                          const parent = input.closest('div');
                          const text = parent?.textContent || '';
                          if (text.includes('ç¾å') && text.includes('æ¬§å')) {
                            console.log('å¡«åè®¢åæ»é¢:', amount);
                            input.focus();
                            input.value = amount;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            input.blur();
                            await wait(500);
                            break;
                          }
                        }

                        // ç¹å»"åå»ºå¿«æ·è®¢å"
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const submitBtn = buttons.find(btn => btn.textContent.includes('åå»ºå¿«æ·è®¢å'));
                        if (!submitBtn) {
                          resolve({ success: false, error: 'æªæ¾å°åå»ºå¿«æ·è®¢åæé? });
                          return;
                        }

                        submitBtn.click();
                        console.log('å·²ç¹å»åå»ºå¿«æ·è®¢å?);
                        await wait(3000);

                        const getOrderNumber = () => {
                          const match = (document.body.textContent || '').match(/FLY\\d+/);
                          return match ? match[0] : 'UNKNOWN';
                        };

                        const isLink = (value) => typeof value === 'string' && value.startsWith('http');

                        const readDatasetLink = (el) => {
                          if (!el) return null;
                          const dataset = el.dataset || {};
                          const candidates = [
                            dataset.clipboardText,
                            dataset.link,
                            dataset.url,
                            dataset.href,
                            el.getAttribute('data-clipboard-text'),
                            el.getAttribute('data-link'),
                            el.getAttribute('data-url'),
                            el.getAttribute('data-href'),
                            el.getAttribute('href'),
                          ].filter(Boolean);
                          const hit = candidates.find(isLink);
                          return hit ? String(hit) : null;
                        };

                        const findCopyLinkButton = () => {
                          const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                          const byText = buttons.find((btn) => {
                            const text = (btn.textContent || '').trim();
                            return text.includes('å¤å¶é¾æ¥åäº«') || text.includes('å¤å¶é¾æ¥') || text.includes('æå¼é¾æ¥');
                          });
                          if (byText) return byText;
                          const iconUse = document.querySelector(
                            'use[xlink\\:href="#svg-icon-copy-link"], use[href="#svg-icon-copy-link"]'
                          );
                          return iconUse?.closest('button')
                            || iconUse?.closest('[role="button"]')
                            || iconUse?.parentElement
                            || null;
                        };

                        const findLinkInDom = () => {
                          const shareBtn = findCopyLinkButton();
                          if (shareBtn) {
                            const link = readDatasetLink(shareBtn)
                              || readDatasetLink(shareBtn.closest('button'))
                              || readDatasetLink(shareBtn.closest('a'));
                            if (link) return link;
                          }

                          const dataLinks = Array.from(
                            document.querySelectorAll('[data-clipboard-text], [data-link], [data-url], [data-href]')
                          );
                          for (const node of dataLinks) {
                            const link = readDatasetLink(node);
                            if (link) return link;
                          }

                          const anchors = Array.from(document.querySelectorAll('a[href]'));
                          const anchor = anchors.find((a) =>
                            a.href.includes('store.flylinking.com') || a.href.includes('/shipping?id=')
                          );
                          if (anchor?.href) return anchor.href;

                          const textLinks = Array.from(document.querySelectorAll('input, textarea'))
                            .map((el) => el.value)
                            .filter(isLink);
                          return textLinks[0] || null;
                        };

                        const waitForPaymentLink = async () => {
                          for (let i = 0; i < 15; i++) {
                            const linkFromUrl = getOrderUrl();
                            if (linkFromUrl) return linkFromUrl;
                            const linkFromDom = findLinkInDom();
                            if (linkFromDom) return linkFromDom;
                            const shareBtn = findCopyLinkButton();
                            if (shareBtn) {
                              shareBtn.click();
                              await wait(500);
                              const afterClick = findLinkInDom();
                              if (afterClick) return afterClick;
                            }
                            await wait(700);
                          }
                          return null;
                        };

                        const paymentLinkUrl = await waitForPaymentLink();
                        if (paymentLinkUrl) {
                          resolve({ success: true, paymentLinkUrl, orderNumber: getOrderNumber() });
                          return;
                        }

                        // æ¥æ¾æ¯ä»äºç»´ç åè®¢åå?                        for (let i = 0; i < 20; i++) {
                          const dialogs = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="dialog"]');

                          for (const dialog of dialogs) {
                            const style = window.getComputedStyle(dialog);
                            if (style.display === 'none' || style.visibility === 'hidden') continue;
                            if (dialog.textContent.includes('å®¢æ·é¡¾é®') || dialog.textContent.includes('service@inflyway')) continue;

                            const orderMatch = dialog.textContent.match(/FLY\d+/);
                            if (orderMatch) {
                              const imgs = dialog.querySelectorAll('img, canvas');
                              for (const img of imgs) {
                                if (img.width >= 150 && img.height >= 150) {
                                  if (img.tagName === 'IMG' && img.src.includes('qrcode-fp')) continue;

                                  const qrUrl = img.tagName === 'CANVAS' ? img.toDataURL() : img.src;
                                  console.log('æ¾å°æ¯ä»äºç»´ç ï¼è®¢åå?', orderMatch[0]);
                                  resolve({ success: true, qrCodeUrl: qrUrl, orderNumber: orderMatch[0] });
                                  return;
                                }
                              }
                            }
                          }

                          await wait(500);
                        }

                        resolve({ success: false, error: 'æªæ¾å°æ¯ä»äºç»´ç ', orderUrl: getOrderUrl() });
                      }
                      completeOrder(amt).catch(e => resolve({ success: false, error: e.message }));
                    });
                  },
                  args: [message.amount]
                });
                let finalResponse = finalResult[0].result;
                const orderUrlFromResponse = finalResponse?.orderUrl || null;
                const orderUrlFromTab = orderUrlFromResponse
                  ? null
                  : await fetchOrderUrlFromTab(newTab.id);
                const paymentLinkFromTab = await fetchPaymentLinkFromTab(newTab.id);
                const paymentLinkUrl = paymentLinkFromTab || orderUrlFromResponse || orderUrlFromTab;
                if (paymentLinkUrl) {
                  finalResponse = {
                    success: true,
                    orderNumber: finalResponse?.orderNumber ?? message.orderNumber,
                    paymentLinkUrl,
                    qrCodeUrl: finalResponse?.qrCodeUrl,
                  };
                }
                sendResponse(finalResponse);
              } else {
                sendResponse({ success: false, error: 'æªæ¾å°æ°çªå£' });
              }
            } else {
              sendResponse(response);
            }
          } catch (error) {
            console.error('æ§è¡éè¯¯:', error);
            sendResponse({ success: false, error: error.message });
          }
        } else {
          console.log('æªæ¾å?inflyway æ ç­¾é¡µï¼åå»ºæ°æ ç­¾é¡µ');
          const tab = await chrome.tabs.create({
            url: 'https://inflyway.com/kamelnet/#/kn/fly-link/orders/add',
            active: false
          });
          if (tab?.id) {
            lastInflywayTabId = tab.id;
          }

          await new Promise((resolve) => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
              if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
              }
            });
          });

          await sleep(5000);

          try {
            const results = await executeScriptWithRetry({
              target: { tabId: tab.id },
              func: (amt) => {
                return new Promise((resolve) => {
                  async function createOrder(amount) {
                    const wait = (ms) => new Promise(r => setTimeout(r, ms));
                                        const isVisible = (el) => {
                      if (!el) return false;
                      const style = window.getComputedStyle(el);
                      const rect = el.getBoundingClientRect();
                      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
                    };
                    const getDrawer = () => {
                      const candidates = Array.from(document.querySelectorAll('.el-drawer__wrapper, .el-drawer, .el-dialog__wrapper, .el-dialog, [role="dialog"]'))
                        .filter(isVisible);
                      return candidates.length ? candidates[candidates.length - 1] : null;
                    };
                    const findProductRows = (root) => {
                      if (!root) return [];
                      const selectors = [
                        '.el-table__body-wrapper .el-table__row',
                        '.el-table__body tr',
                        '.el-table__row',
                        '.table-row-info',
                        '[class*="table-row"]',
                      ];
                      for (const selector of selectors) {
                        const nodes = Array.from(root.querySelectorAll(selector)).filter(isVisible);
                        if (nodes.length > 0) return nodes;
                      }
                      return [];
                    };
                    const waitForProductRows = async (timeoutMs = 15000) => {
                      const start = Date.now();
                      while (Date.now() - start < timeoutMs) {
                        const drawer = getDrawer() || document;
                        const rows = findProductRows(drawer);
                        if (rows.length > 0) return true;
                        await wait(400);
                      }
                      return false;
                    };
                    const findAddButton = (root) => {
                      if (!root) return null;
                      const rows = findProductRows(root);
                      if (rows.length > 0) {
                        const row = rows[0];
                        const direct = row.querySelector('.table-row-add');
                        if (direct && isVisible(direct)) return direct;
                        const plusIcon = Array.from(row.querySelectorAll('.el-icon-plus')).find(isVisible);
                        if (plusIcon) {
                          const plusBtn = plusIcon.closest('button, [role="button"], span');
                          if (plusBtn) return plusBtn;
                        }
                      }
                      const direct = root.querySelector('.table-row-add');
                      if (direct && isVisible(direct)) return direct;
                      const plusIcon = Array.from(root.querySelectorAll('.el-icon-plus')).find(isVisible);
                      if (plusIcon) {
                        const plusBtn = plusIcon.closest('button, [role="button"], span');
                        if (plusBtn) return plusBtn;
                      }
                      return null;
                    };
                    const waitForAddButton = async (timeoutMs = 15000) => {
                      const start = Date.now();
                      while (Date.now() - start < timeoutMs) {
                        const drawer = getDrawer() || document;
                        const addBtn = findAddButton(drawer);
                        if (addBtn) return addBtn;
                        await wait(400);
                      }
                      return null;
                    };
                    const waitForOrderRow = async (timeoutMs = 8000) => {
                      const start = Date.now();
                      while (Date.now() - start < timeoutMs) {
                        const rows = document.querySelectorAll('.table-row-info, .el-table__body-wrapper .el-table__row, [class*="table-row-info"]');
                        if (rows.length > 0) return true;
                        await wait(300);
                      }
                      return false;
                    };
                    const setNativeValue = (element, value) => {
                      const setter = Object.getOwnPropertyDescriptor(element.__proto__, 'value')?.set ||
                        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                      if (setter) {
                        setter.call(element, value);
                      } else {
                        element.value = value;
                      }
                    };
                    const parseQuantity = (value) => {
                      const match = `${value ?? ''}`.match(/\d+/);
                      return match ? Number(match[0]) : null;
                    };
                    const applyQuantityInContainer = async (container, amountValue) => {
                      if (!container) return false;
                      const target = Math.max(1, Math.floor(Number(amountValue) || 1));
                      const targetStr = String(target);
                      const input = container.querySelector('input[role="spinbutton"], .el-input-number input, input.el-input__inner');
                      const plusButton = container.querySelector('.el-input-number__increase') ||
                        Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === '+') ||
                        null;
                      const minusButton = container.querySelector('.el-input-number__decrease') ||
                        Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === '-') ||
                        null;

                      if (input) {
                        setNativeValue(input, targetStr);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('blur', { bubbles: true }));
                        await wait(200);
                        const current = parseQuantity(input.value) ?? parseQuantity(input.getAttribute('aria-valuenow'));
                        if (current === target) return true;
                      }

                      if (plusButton || minusButton) {
                        const currentValue = input
                          ? parseQuantity(input.value) ?? parseQuantity(input.getAttribute('aria-valuenow'))
                          : null;
                        let current = Number.isFinite(currentValue) ? currentValue : 1;
                        const delta = target - current;
                        const button = delta > 0 ? plusButton : minusButton;
                        if (!button) return false;
                        const steps = Math.abs(delta);
                        for (let i = 0; i < steps; i += 1) {
                          button.click();
                          if (i % 5 === 0) {
                            await wait(60);
                          }
                        }
                        await wait(200);
                        return true;
                      }

                      return false;
                    };

                    console.log('å¼å§åå»ºè®¢åï¼éé¢:', amount);
                    await wait(2000);

                    // 1. ç¹å»"éæ©åå"
                    let buttons = Array.from(document.querySelectorAll('button'));
                    const selectBtn = buttons.find(el => el.textContent.trim() === 'éæ©åå');
                    if (selectBtn) {
                      console.log('ç¹å»éæ©åå');
                      selectBtn.click();
                      await wait(800);

                      const rowsReady = await waitForProductRows();
                      if (!rowsReady) {
                        throw new Error('Product list not ready');
                      }

                      // 2. å¨æ½å±ä¸­æ¥æ¾ååç?+"æé®
                      const addBtn = await waitForAddButton();
                      const addBtns = addBtn ? [addBtn] : [];
                      if (!addBtn) {
                        throw new Error('Product list not ready');
                      }
                      if (addBtns.length > 0) {
                        console.log('æ¾å°å¯éååï¼ç¹å»ç¬¬ä¸ä¸?);
                        addBtns[0].click();
                        await wait(2000);

                        // ç¹å»æ°ééæ©å¼¹çªç?ç¡®å®"
                        const popover = document.querySelector('.el-popover:not([style*="display: none"])');
                        if (popover) {
                          await applyQuantityInContainer(popover, amount);
                          const popoverBtns = Array.from(popover.querySelectorAll('button'));
                          const popoverConfirm = popoverBtns.find(btn => btn.textContent.includes('ç¡®å®'));
                          if (popoverConfirm) {
                            console.log('ç¹å»æ°éç¡®å®');
                            popoverConfirm.click();
                            await wait(1000);
                          }
                        }

                        
                        const added = await waitForOrderRow();
                        if (!added) {
                          throw new Error('Product not added');
                        }
                      }

                      // 3. ç¹å»ç¡®å®å³é­æ½å±
                      buttons = Array.from(document.querySelectorAll('button'));
                      const confirmBtn = buttons.find(btn => btn.textContent.trim() === 'ç¡®å®');
                      if (confirmBtn) {
                        confirmBtn.click();
                        await wait(1500);
                      }
                    }

                    // 4. å¡«åè®¢åæ»é¢
                    const allInputs = document.querySelectorAll('input');
                    for (const input of allInputs) {
                      const parent = input.closest('div');
                      const text = parent?.textContent || '';
                      if (text.includes('ç¾å') && text.includes('æ¬§å')) {
                        console.log('å¡«åè®¢åæ»é¢:', amount);
                        input.focus();
                        input.value = amount;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.blur();
                        await wait(500);
                        break;
                      }
                    }

                    // 5. ç¹å»"åå»ºå¿«æ·è®¢å"
                    buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find(btn => btn.textContent.includes('åå»ºå¿«æ·è®¢å'));
                    if (!submitBtn) {
                      resolve({ success: false, error: 'æªæ¾å°åå»ºå¿«æ·è®¢åæé? });
                      return;
                    }

                    submitBtn.click();
                    console.log('å·²ç¹å»åå»ºå¿«æ·è®¢å?);
                    await wait(3000);

                    const getOrderNumber = () => {
                      const match = (document.body.textContent || '').match(/FLY\\d+/);
                      return match ? match[0] : 'UNKNOWN';
                    };

                    const decodeOrderUrl = () => {
                      const hash = window.location.hash || '';
                      const queryIndex = hash.indexOf('?');
                      const queryString = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
                      const params = new URLSearchParams(queryString);
                      const raw = params.get('orderUrl');
                      if (raw) return decodeURIComponent(raw);
                      const match = (window.location.href || '').match(/[?&]orderUrl=([^&]+)/);
                      return match ? decodeURIComponent(match[1]) : null;
                    };

                    const isLink = (value) => typeof value === 'string' && value.startsWith('http');

                    const readDatasetLink = (el) => {
                      if (!el) return null;
                      const dataset = el.dataset || {};
                      const candidates = [
                        dataset.clipboardText,
                        dataset.link,
                        dataset.url,
                        dataset.href,
                        el.getAttribute('data-clipboard-text'),
                        el.getAttribute('data-link'),
                        el.getAttribute('data-url'),
                        el.getAttribute('data-href'),
                        el.getAttribute('href'),
                      ].filter(Boolean);
                      const hit = candidates.find(isLink);
                      return hit ? String(hit) : null;
                    };

                    const findCopyLinkButton = () => {
                      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                      const byText = buttons.find((btn) => {
                        const text = (btn.textContent || '').trim();
                        return text.includes('å¤å¶é¾æ¥åäº«') || text.includes('å¤å¶é¾æ¥') || text.includes('æå¼é¾æ¥');
                      });
                      if (byText) return byText;
                      const iconUse = document.querySelector(
                        'use[xlink\\:href="#svg-icon-copy-link"], use[href="#svg-icon-copy-link"]'
                      );
                      return iconUse?.closest('button')
                        || iconUse?.closest('[role="button"]')
                        || iconUse?.parentElement
                        || null;
                    };

                    const findLinkInDom = () => {
                      const shareBtn = findCopyLinkButton();
                      if (shareBtn) {
                        const link = readDatasetLink(shareBtn)
                          || readDatasetLink(shareBtn.closest('button'))
                          || readDatasetLink(shareBtn.closest('a'));
                        if (link) return link;
                      }

                      const dataLinks = Array.from(
                        document.querySelectorAll('[data-clipboard-text], [data-link], [data-url], [data-href]')
                      );
                      for (const node of dataLinks) {
                        const link = readDatasetLink(node);
                        if (link) return link;
                      }

                      const anchors = Array.from(document.querySelectorAll('a[href]'));
                      const anchor = anchors.find((a) =>
                        a.href.includes('store.flylinking.com') || a.href.includes('/shipping?id=')
                      );
                      if (anchor?.href) return anchor.href;

                      const textLinks = Array.from(document.querySelectorAll('input, textarea'))
                        .map((el) => el.value)
                        .filter(isLink);
                      return textLinks[0] || null;
                    };

                    const waitForPaymentLink = async () => {
                      for (let i = 0; i < 15; i++) {
                        const linkFromUrl = decodeOrderUrl();
                        if (linkFromUrl) return linkFromUrl;
                        const linkFromDom = findLinkInDom();
                        if (linkFromDom) return linkFromDom;
                        const shareBtn = findCopyLinkButton();
                        if (shareBtn) {
                          shareBtn.click();
                          await wait(500);
                          const afterClick = findLinkInDom();
                          if (afterClick) return afterClick;
                        }
                        await wait(700);
                      }
                      return null;
                    };

                    const paymentLinkUrl = await waitForPaymentLink();
                    if (paymentLinkUrl) {
                      resolve({ success: true, paymentLinkUrl, orderNumber: getOrderNumber() });
                      return;
                    }

                    // 6. æ¥æ¾æ¯ä»äºç»´ç ?                    console.log('æ¥æ¾æ¯ä»äºç»´ç ?);
                    await wait(2000);

                    const hoverElement = (el) => {
                      if (!el) return false;
                      const rect = el.getBoundingClientRect();
                      const opts = {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2
                      };
                      if (window.PointerEvent) {
                        const pointerOpts = {
                          ...opts,
                          pointerType: 'mouse',
                          isPrimary: true
                        };
                        el.dispatchEvent(new PointerEvent('pointerenter', pointerOpts));
                        el.dispatchEvent(new PointerEvent('pointerover', pointerOpts));
                        el.dispatchEvent(new PointerEvent('pointermove', pointerOpts));
                      }
                      el.dispatchEvent(new MouseEvent('mouseenter', opts));
                      el.dispatchEvent(new MouseEvent('mouseover', opts));
                      el.dispatchEvent(new MouseEvent('mousemove', opts));
                      return true;
                    };

                    const qrShareBtn = Array.from(document.querySelectorAll('button')).find(btn =>
                      btn.textContent.includes('äºç»´ç åäº?)
                    );
                    if (qrShareBtn) {
                      console.log('Hover QR share button');
                      hoverElement(qrShareBtn);
                      await wait(500);
                    }

                    const qrIconUse = document.querySelector(
                      'use[xlink\\:href="#svg-icon-q-rcode-copy"], use[href="#svg-icon-q-rcode-copy"]'
                    );
                    const qrIcon = qrIconUse?.closest('svg');
                    const qrIconBtn = qrIcon?.closest('button')
                      || qrIcon?.closest('[role="button"]')
                      || qrIcon?.parentElement
                      || qrIcon;
                    if (qrIconBtn) {
                      console.log('Hover QR icon');
                      hoverElement(qrIconBtn);
                      await wait(500);
                    }

                    if (qrShareBtn) {
                      console.log('Click QR share button');
                      qrShareBtn.click();
                      await wait(1500);
                    } else if (qrIconBtn) {
                      console.log('Click QR icon');
                      qrIconBtn.click();
                      await wait(1500);
                    }

                    const hasPaymentText = (text) => {
                      const normalized = (text || '').toLowerCase();
                      return normalized.includes('scan to pay')
                        || normalized.includes('payment qr')
                        || text.includes('æ«ç ')
                        || text.includes('æ¯ä»äºç»´ç ?);
                    };

                    const isVisible = (el) => {
                      if (!el) return false;
                      const style = window.getComputedStyle(el);
                      if (style.display === 'none' || style.visibility === 'hidden') return false;
                      const rect = el.getBoundingClientRect();
                      return rect.width > 0 && rect.height > 0;
                    };

                    const hasQrHintText = (value) => {
            if (!value) return false;
            const raw = String(value);
            const text = raw.toLowerCase();
            if (text.includes('qrcode')
              || text.includes('qr-code')
              || text.includes('qr_code')
              || text.includes('q-rcode')
              || /qr\s*code/.test(text)
              || /\bqr\b/.test(text)) {
              return true;
            }
            if (raw.includes('\u4e8c\u7ef4\u7801') || raw.includes('\u626b\u7801') || raw.includes('\u652f\u4ed8\u4e8c\u7ef4\u7801')) {
              return true;
            }
            return raw.includes('\u4e8c\u7ef4\u7801') || raw.includes('\u626b\u7801');
          };

          const hasQrHintFromElement = (el) => {
                      if (!el) return false;
                      const parts = [
                        el.getAttribute('alt'),
                        el.getAttribute('aria-label'),
                        el.getAttribute('title'),
                        el.getAttribute('class'),
                        el.id,
                        el.getAttribute('src'),
                        el.getAttribute('data-src')
                      ].filter(Boolean);
                      if (parts.some(hasQrHintText)) return true;
                      const hintContainer = el.closest('[class*="qr"], [id*="qr"]');
                      if (hintContainer) {
                        const hintText = `${hintContainer.className || ''} ${hintContainer.id || ''}`;
                        if (hasQrHintText(hintText)) return true;
                      }
                      return false;
                    };

                    const analyzeBitmap = (imageData) => {
                      if (!imageData) return false;
                      const { data, width, height } = imageData;
                      let black = 0;
                      let white = 0;
                      let total = 0;
                      for (let i = 0; i < data.length; i += 4) {
                        const alpha = data[i + 3];
                        if (alpha < 10) continue;
                        const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
                        total++;
                        if (lum < 50) black++;
                        else if (lum > 205) white++;
                      }
                      const bw = black + white;
                      if (!total || !bw) return false;
                      const bwRatio = bw / total;
                      const blackRatio = black / bw;
                      if (bwRatio < 0.65 || blackRatio < 0.12 || blackRatio > 0.88) return false;

                      let transitions = 0;
                      let samples = 0;
                      const step = 4;
                      for (let y = 0; y < height; y += step) {
                        let prev = null;
                        for (let x = 0; x < width; x += step) {
                          const idx = (y * width + x) * 4;
                          const alpha = data[idx + 3];
                          if (alpha < 10) continue;
                          const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
                          const val = lum < 128 ? 0 : 1;
                          if (prev !== null && val !== prev) transitions++;
                          prev = val;
                          samples++;
                        }
                      }
                      const transitionRatio = transitions / Math.max(1, samples);
                      return transitionRatio > 0.18;
                    };

                    const looksLikeQrCanvas = (canvas) => {
                      try {
                        const size = 80;
                        const temp = document.createElement('canvas');
                        temp.width = size;
                        temp.height = size;
                        const ctx = temp.getContext('2d', { willReadFrequently: true });
                        if (!ctx) return false;
                        ctx.drawImage(canvas, 0, 0, size, size);
                        const data = ctx.getImageData(0, 0, size, size);
                        return analyzeBitmap(data);
                      } catch {
                        return false;
                      }
                    };

                    const looksLikeQrImage = async (img) => {
                      if (!img) return false;
                      const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
                      if (hasQrHintFromElement(img) || hasQrHintText(src)) return true;
                      try {
                        const size = 80;
                        const temp = document.createElement('canvas');
                        temp.width = size;
                        temp.height = size;
                        const ctx = temp.getContext('2d', { willReadFrequently: true });
                        if (!ctx) return false;
                        ctx.drawImage(img, 0, 0, size, size);
                        const data = ctx.getImageData(0, 0, size, size);
                        return analyzeBitmap(data);
                      } catch {
                        return false;
                      }
                    };

                    const findPaymentContainer = (orderNumber) => {
                      const nodes = Array.from(
                        document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="dialog"], [class*="popup"], [class*="drawer"]')
                      );
                      let best = null;
                      let bestLength = Number.POSITIVE_INFINITY;
                      for (const node of nodes) {
                        if (!isVisible(node)) continue;
                        const text = node.textContent || '';
                        if (text.includes('å®¢æ·é¡¾é®') || text.includes('service@inflyway')) continue;
                        if (!hasPaymentText(text) && (!orderNumber || !text.includes(orderNumber))) continue;
                        if (text.length < bestLength) {
                          best = node;
                          bestLength = text.length;
                        }
                      }
                      return best;
                    };

                    const getOrderUrl = () => {
                      const hash = window.location.hash || '';
                      const queryIndex = hash.indexOf('?');
                      const queryString = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
                      const params = new URLSearchParams(queryString);
                      const raw = params.get('orderUrl');
                      if (raw) return decodeURIComponent(raw);
                      const match = (window.location.href || '').match(/[?&]orderUrl=([^&]+)/);
                      return match ? decodeURIComponent(match[1]) : null;
                    };

                    for (let i = 0; i < 15; i++) {
                      const pageText = document.body.textContent || '';
                      const orderMatch = pageText.match(/FLY\d+/);
                      const orderNumber = orderMatch ? orderMatch[0] : 'UNKNOWN';
                      const bodyLooksPayment = hasPaymentText(pageText);
                      const container = findPaymentContainer(orderMatch ? orderMatch[0] : null);

                      const svg = container?.querySelector('svg#my-svg')
                        || (bodyLooksPayment ? document.querySelector('svg#my-svg') : null);
                      if (svg && isVisible(svg)) {
                        const rect = svg.getBoundingClientRect();
                        if (rect.width >= 120 && rect.height >= 120) {
                          console.log('æ¾å°SVGäºç»´ç ?);

                          // å°SVGè½¬æ¢ä¸ºPNG
                          const canvas = document.createElement('canvas');
                          canvas.width = 300;
                          canvas.height = 300;
                          const ctx = canvas.getContext('2d');

                          const svgData = new XMLSerializer().serializeToString(svg);
                          const img = new Image();
                          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                          const url = URL.createObjectURL(svgBlob);

                          await new Promise((res) => {
                            img.onload = () => {
                              ctx.drawImage(img, 0, 0, 300, 300);
                              URL.revokeObjectURL(url);
                              res();
                            };
                            img.src = url;
                          });

                          const qrCodeUrl = canvas.toDataURL('image/png');
                          resolve({ success: true, qrCodeUrl, orderNumber });
                          return;
                        }
                      }

                      const canvases = Array.from(container?.querySelectorAll('canvas') || []);
                      for (const canvas of canvases) {
                        if (!isVisible(canvas) || canvas.width < 120 || canvas.height < 120) continue;
                        if (!looksLikeQrCanvas(canvas)) continue;
                        const qrCodeUrl = canvas.toDataURL('image/png');
                        resolve({ success: true, qrCodeUrl, orderNumber });
                        return;
                      }

                      const images = Array.from(container?.querySelectorAll('img') || []);
                      for (const img of images) {
                        if (!isVisible(img) || img.width < 120 || img.height < 120) continue;
                        if (!await looksLikeQrImage(img)) continue;
                        const src = img.currentSrc || img.src;
                        if (!src) continue;
                        resolve({ success: true, qrCodeUrl: src, orderNumber });
                        return;
                      }

                      await wait(500);
                    }

                    resolve({ success: false, error: 'æªæ¾å°æ¯ä»äºç»´ç ', orderUrl: getOrderUrl() });
                  }

                  createOrder(amt).catch(e => resolve({ success: false, error: e.message }));
                });
              },
              args: [message.amount]
            });

            let response = results[0].result;
            console.log('æ§è¡ç»æ:', response);

            const orderUrlFromResponse = response?.orderUrl || null;
            const orderUrlFromTab = orderUrlFromResponse ? null : await fetchOrderUrlFromTab(tab.id);
            const paymentLinkFromTab = await fetchPaymentLinkFromTab(tab.id);
            const paymentLinkUrl = paymentLinkFromTab || orderUrlFromResponse || orderUrlFromTab;
            if (paymentLinkUrl) {
              response = {
                success: true,
                orderNumber: response?.orderNumber ?? message.orderNumber,
                paymentLinkUrl,
                qrCodeUrl: response?.qrCodeUrl,
              };
            }

            sendResponse(response);
          } catch (error) {
            console.error('åéæ¶æ¯éè¯?', error);
            sendResponse({ success: false, error: error.message });
          }
        }
      } catch (error) {
        console.error('å¤çéè¯¯:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  } else if ((message.type === 'CHECK_PAYMENT_STATUS' || message.type === 'CHECK_PAYMENT_STATUS_INTERNAL') && message.orderNumber) {
    chrome.tabs.query({ url: 'https://*.inflyway.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CHECK_PAYMENT_STATUS',
          orderNumber: message.orderNumber
        }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ isPaid: false });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ isPaid: false });
      }
    });
    return true;
  }
};

chrome.runtime.onMessage.addListener(onMessageHandler);

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('Background æ¶å°å¤é¨æ¶æ¯:', message, 'from:', sender);

  // PING æ¶æ¯ç¨äºæ£æ¥è¿æ?  if (message.type === 'PING') {
    sendResponse({ success: true });
    return true;
  }

  return onMessageHandler(message, sender, sendResponse);
});


