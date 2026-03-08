const waitForTabComplete = (tabId, timeoutMs = 15000) => new Promise((resolve) => {
  let timeoutId = null;
  let done = false;
  const finish = (value) => {
    if (done) return;
    done = true;
    if (timeoutId) clearTimeout(timeoutId);
    chrome.tabs.onUpdated.removeListener(listener);
    resolve(value);
  };
  const listener = (updatedTabId, info) => {
    if (updatedTabId === tabId && info.status === 'complete') {
      finish(true);
    }
  };
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      finish(false);
      return;
    }
    if (tab?.status === 'complete') {
      finish(true);
      return;
    }
    chrome.tabs.onUpdated.addListener(listener);
    timeoutId = setTimeout(() => finish(false), timeoutMs);
  });
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

const INFLOW_READY_TIMEOUT_MS = 15000;
const waitForInflywayReady = async (tabId, timeoutMs = INFLOW_READY_TIMEOUT_MS) => {
  try {
    const results = await executeScriptWithRetry({
      target: { tabId },
      func: (timeout) => {
        return new Promise((resolve) => {
          let done = false;
          const finish = (payload) => {
            if (done) return;
            done = true;
            if (observer) observer.disconnect();
            clearTimeout(timer);
            resolve(payload);
          };
          const hasLoginForm = () => {
            if (document.querySelector('input[type="password"]')) return true;
            const text = document.body?.innerText || '';
            return /login|sign in|log in|password|閻ц缍峾閻у妾皘鐠愶箑褰縷鐎靛棛鐖?i.test(text);
          };
          const hasReadyUi = () => {
            const keywords = [
              '闁瀚ㄩ崯鍡楁惂',
              '濞ｈ濮為崯鍡楁惂',
              '閸掓稑缂撹箛顐ｅ祹鐠併垹宕?,
              '閸掓稑缂撶拋銏犲礋',
              'Select product',
              'Select goods',
              'Add product',
              'Add goods',
              'Create order',
              'Quick order',
              'Create quick order',
            ];
            const nodes = document.querySelectorAll('button, a, .el-button, .el-link, span');
            for (const node of nodes) {
              const text = (node.textContent || '').trim();
              if (!text) continue;
              if (keywords.some((keyword) => text.includes(keyword))) return true;
            }
            if (document.querySelector('.table-row-info') || document.querySelector('.table-row-add')) {
              return true;
            }
            if (document.querySelector('.el-form') && document.querySelector('textarea')) {
              return true;
            }
            return false;
          };
          const check = () => {
            if (hasLoginForm()) {
              finish({ ready: false, reason: 'login' });
              return;
            }
            if (hasReadyUi()) {
              finish({ ready: true });
            }
          };
          const root = document.body || document.documentElement;
          const observer = new MutationObserver(() => {
            check();
          });
          if (root) {
            observer.observe(root, { childList: true, subtree: true, attributes: true });
          }
          const timeoutMs = typeof timeout === 'number' && timeout > 0 ? timeout : 15000;
          const timer = setTimeout(() => finish({ ready: false, reason: 'timeout' }), timeoutMs);
          check();
        });
      },
      args: [timeoutMs],
    });
    const result = results?.[0]?.result;
    if (result && typeof result === 'object') return result;
    return { ready: false, reason: 'no_result' };
  } catch (error) {
    return { ready: false, reason: 'inject_failed', error: error?.message || String(error) };
  }
};

const LOG_STORAGE_KEY = 'orderSyncLogs';
const LOG_MAX = 200;
let logBuffer = [];
let logBufferLoaded = false;

const normalizeLogData = (data) => {
  if (data === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    return String(data);
  }
};

const trimLogs = (logs) => {
  if (!Array.isArray(logs)) return [];
  return logs.length > LOG_MAX ? logs.slice(-LOG_MAX) : logs;
};

const recordLog = (level, message, data) => {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    data: normalizeLogData(data),
  };

  if (!chrome?.storage?.local) {
    logBuffer = trimLogs([...logBuffer, entry]);
    logBufferLoaded = true;
    return;
  }

  if (!logBufferLoaded) {
    logBufferLoaded = true;
    logBuffer = trimLogs([...logBuffer, entry]);
    chrome.storage.local.get(LOG_STORAGE_KEY, (result) => {
      const stored = Array.isArray(result?.[LOG_STORAGE_KEY]) ? result[LOG_STORAGE_KEY] : [];
      const merged = trimLogs([...stored, ...logBuffer]);
      logBuffer = merged;
      chrome.storage.local.set({ [LOG_STORAGE_KEY]: merged });
    });
    return;
  }

  logBuffer = trimLogs([...logBuffer, entry]);
  chrome.storage.local.set({ [LOG_STORAGE_KEY]: logBuffer });
};

const respondWithLogs = (sendResponse) => {
  if (!chrome?.storage?.local) {
    sendResponse({ success: true, logs: logBuffer });
    return;
  }
  chrome.storage.local.get(LOG_STORAGE_KEY, (result) => {
    const stored = Array.isArray(result?.[LOG_STORAGE_KEY]) ? result[LOG_STORAGE_KEY] : logBuffer;
    sendResponse({ success: true, logs: stored });
  });
};

const clearLogs = (sendResponse) => {
  logBuffer = [];
  logBufferLoaded = true;
  if (!chrome?.storage?.local) {
    sendResponse({ success: true });
    return;
  }
  chrome.storage.local.set({ [LOG_STORAGE_KEY]: [] }, () => {
    sendResponse({ success: true });
  });
};

const CREATE_ORDER_QUEUE_LIMIT = 100;
const CREATE_ORDER_CONCURRENCY = 5;
const CREATE_ORDER_TIMEOUT_MS = 180000;
const CREATE_ORDER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CREATE_ORDER_CACHE_MAX = 100;
const createOrderQueue = [];
const inFlightOrders = new Map();
const inFlightPayloads = new Map();
const orderResultCache = new Map();
const orderSyncMeta = new Map();
const syncConfig = {
  baseUrl: '',
  autoMode: false,
  adminToken: ''
};
const STATE_STORAGE_KEY = 'orderSyncState';
const STATE_SAVE_DEBOUNCE_MS = 1000;
const ORDER_LOCK_TTL_MS = CREATE_ORDER_TIMEOUT_MS + 60000;
const HEARTBEAT_ALARM = 'ORDER_SYNC_HEARTBEAT';
const HEARTBEAT_INTERVAL_MINUTES = 1;
let stateReady = false;
let stateRestorePromise = null;
let stateSaveTimer = null;
let createOrderQueueRunning = false;
let createOrderWorkers = 0;
let lastInflywayTabId = null;
const REUSE_INFLYWAY_TAB = CREATE_ORDER_CONCURRENCY <= 1;

const normalizeStateValue = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
};

const buildStatePayload = () => {
  return {
    version: 1,
    syncConfig: { ...syncConfig },
    queue: createOrderQueue.map((item) => ({
      orderKey: item?.orderKey || '',
      message: normalizeStateValue(item?.message) || null,
    })),
    inflight: Array.from(inFlightPayloads.entries()).map(([orderKey, message]) => ({
      orderKey,
      message: normalizeStateValue(message) || null,
    })),
    meta: Array.from(orderSyncMeta.entries()).map(([orderKey, meta]) => ({
      orderKey,
      meta: normalizeStateValue(meta) || null,
    })),
    cache: Array.from(orderResultCache.entries()).map(([orderKey, entry]) => ({
      orderKey,
      result: normalizeStateValue(entry?.result) || null,
      timestamp: entry?.timestamp || 0,
    })),
  };
};

const scheduleStateSave = () => {
  if (!stateReady || !chrome?.storage?.local) return;
  if (stateSaveTimer) clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(() => {
    chrome.storage.local.set({ [STATE_STORAGE_KEY]: buildStatePayload() });
  }, STATE_SAVE_DEBOUNCE_MS);
};

const restoreStateFromStorage = () => {
  if (stateRestorePromise) return stateRestorePromise;
  stateRestorePromise = new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      stateReady = true;
      resolve();
      return;
    }
    chrome.storage.local.get(STATE_STORAGE_KEY, (result) => {
      const stored = result?.[STATE_STORAGE_KEY];
      if (stored?.syncConfig) {
        syncConfig.baseUrl = typeof stored.syncConfig.baseUrl === 'string' ? stored.syncConfig.baseUrl : '';
        syncConfig.autoMode = Boolean(stored.syncConfig.autoMode);
        syncConfig.adminToken = typeof stored.syncConfig.adminToken === 'string' ? stored.syncConfig.adminToken : '';
      }

      if (Array.isArray(stored?.meta)) {
        stored.meta.forEach((entry) => {
          if (!entry?.orderKey || !entry?.meta) return;
          orderSyncMeta.set(entry.orderKey, entry.meta);
        });
      }

      if (Array.isArray(stored?.cache)) {
        stored.cache.forEach((entry) => {
          if (!entry?.orderKey || !entry?.result || !entry?.timestamp) return;
          const age = Date.now() - entry.timestamp;
          if (age > CREATE_ORDER_CACHE_TTL_MS) return;
          orderResultCache.set(entry.orderKey, { result: entry.result, timestamp: entry.timestamp });
        });
      }

      const restoredKeys = new Set();
      const enqueueRestored = (payload, status) => {
        const message = payload?.message;
        const orderKey = payload?.orderKey || normalizeOrderKey(message);
        if (!orderKey || restoredKeys.has(orderKey)) return;
        if (message && !message.amount) return;
        const meta = orderSyncMeta.get(orderKey);
        if (meta?.status === 'success' || meta?.hasLink || meta?.paymentLinkUrl) return;
        updateOrderMeta(orderKey, { status, lastError: null });
        createOrderQueue.push({
          message,
          sender: null,
          orderKey,
          resolve: () => {},
          reject: () => {},
          restored: true,
        });
        restoredKeys.add(orderKey);
      };

      if (Array.isArray(stored?.queue)) {
        stored.queue.forEach((entry) => enqueueRestored(entry, 'queued'));
      }
      if (Array.isArray(stored?.inflight)) {
        stored.inflight.forEach((orderKey) => enqueueRestored({ orderKey }, 'queued'));
      }

      stateReady = true;
      if (createOrderQueue.length > 0) {
        processCreateOrderQueue();
      }
      scheduleStateSave();
      resolve();
    });
  });
  return stateRestorePromise;
};

const ensureStateReady = () => {
  if (stateReady) return Promise.resolve();
  return restoreStateFromStorage();
};
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
let circuitBreakerFailures = 0;
let circuitBreakerOpenUntil = 0;
const WARM_INFLYWAY_URL = 'https://inflyway.com/kamelnet/#/kn/fly-link/orders/add';
const WARM_TAB_POOL_SIZE = 2;
const KEEPALIVE_PORT_NAME = 'ORDER_SYNC_KEEPALIVE';
const OFFSCREEN_KEEPALIVE_PORT_NAME = 'OFFSCREEN_KEEPALIVE';
const keepAlivePorts = new Set();
const internalKeepAlivePorts = new Set();
const warmInflywayTabs = new Map();
let prewarmInProgress = false;
let offscreenCreating = false;
const getCircuitBreakerState = () => {
  const now = Date.now();
  if (circuitBreakerOpenUntil && now < circuitBreakerOpenUntil) {
    return { isOpen: true, retryAfter: circuitBreakerOpenUntil - now };
  }
  if (circuitBreakerOpenUntil && now >= circuitBreakerOpenUntil) {
    circuitBreakerOpenUntil = 0;
    circuitBreakerFailures = 0;
  }
  return { isOpen: false, retryAfter: 0 };
};
const recordCircuitBreakerFailure = (orderKey, error) => {
  circuitBreakerFailures += 1;
  if (circuitBreakerFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    recordLog('warn', 'circuit_breaker_open', { orderNumber: orderKey, error });
  }
};
const recordCircuitBreakerSuccess = () => {
  circuitBreakerFailures = 0;
  circuitBreakerOpenUntil = 0;
};
const ensureOffscreenDocument = async () => {
  if (!chrome.offscreen?.createDocument) return;
  if (offscreenCreating) return;
  offscreenCreating = true;
  try {
    const hasDocument = typeof chrome.offscreen.hasDocument === 'function'
      ? await chrome.offscreen.hasDocument()
      : false;
    if (hasDocument) return;
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Keep order sync responsive'
    });
  } catch (error) {
    recordLog('warn', 'offscreen_create_failed', { error: String(error) });
  } finally {
    offscreenCreating = false;
  }
};

const ensureInflywayTabReady = async (tabId) => {
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.id) return null;
  const currentUrl = tab.url || '';
  if (!currentUrl.includes('/orders/add')) {
    await chrome.tabs.update(tab.id, { url: WARM_INFLYWAY_URL, active: false });
  }
  await waitForTabComplete(tab.id, 20000);
  const readyState = await waitForInflywayReady(tab.id, 20000);
  if (!readyState?.ready) {
    recordLog('warn', 'inflyway_not_ready', {
      reason: readyState?.reason,
      url: currentUrl || WARM_INFLYWAY_URL
    });
  }
  return tab.id;
};

const ensureWarmTabPool = async () => {
  if (prewarmInProgress) return;
  prewarmInProgress = true;
  try {
    const existingTabs = Array.from(warmInflywayTabs.keys());
    for (const tabId of existingTabs) {
      try {
        const readyId = await ensureInflywayTabReady(tabId);
        if (!readyId) {
          warmInflywayTabs.delete(tabId);
        }
      } catch {
        warmInflywayTabs.delete(tabId);
      }
    }

    while (warmInflywayTabs.size < WARM_TAB_POOL_SIZE) {
      const tab = await chrome.tabs.create({ url: WARM_INFLYWAY_URL, active: false });
      if (!tab?.id) break;
      warmInflywayTabs.set(tab.id, { busy: false });
      await ensureInflywayTabReady(tab.id);
    }
  } finally {
    prewarmInProgress = false;
  }
};

const acquireWarmTab = async () => {
  await ensureWarmTabPool();
  for (const [tabId, state] of warmInflywayTabs.entries()) {
    if (!state?.busy) {
      state.busy = true;
      warmInflywayTabs.set(tabId, state);
      return { id: tabId, url: WARM_INFLYWAY_URL };
    }
  }
  return null;
};

const releaseWarmTab = (tabId) => {
  if (!tabId) return;
  const entry = warmInflywayTabs.get(tabId);
  if (entry) entry.busy = false;
};

const schedulePrewarm = () => {
  ensureStateReady().catch(() => {});
  ensureOffscreenDocument().catch(() => {});
  ensureWarmTabPool().catch(() => {
    setTimeout(() => { ensureWarmTabPool().catch(() => {}); }, 5000);
  });
};

const scheduleHeartbeat = () => {
  if (!chrome?.alarms) return;
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_INTERVAL_MINUTES });
};

chrome.runtime.onInstalled.addListener(() => {
  schedulePrewarm();
  scheduleHeartbeat();
});
chrome.runtime.onStartup.addListener(() => {
  schedulePrewarm();
  scheduleHeartbeat();
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (warmInflywayTabs.has(tabId)) {
    warmInflywayTabs.delete(tabId);
    schedulePrewarm();
  }
});

chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (!alarm || alarm.name !== HEARTBEAT_ALARM) return;
  schedulePrewarm();
  if (createOrderQueue.length > 0 && !createOrderQueueRunning) {
    processCreateOrderQueue();
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (!port || port.name !== OFFSCREEN_KEEPALIVE_PORT_NAME) return;
  internalKeepAlivePorts.add(port);
  schedulePrewarm();

  port.onMessage.addListener((payload) => {
    if (payload?.type === 'KEEPALIVE') {
      schedulePrewarm();
    }
  });

  port.onDisconnect.addListener(() => {
    internalKeepAlivePorts.delete(port);
  });
});

chrome.runtime.onConnectExternal.addListener((port) => {
  if (!port || port.name !== KEEPALIVE_PORT_NAME) return;
  keepAlivePorts.add(port);
  schedulePrewarm();

  port.onMessage.addListener((payload) => {
    if (payload?.type === 'KEEPALIVE') {
      schedulePrewarm();
    }
  });

  port.onDisconnect.addListener(() => {
    keepAlivePorts.delete(port);
  });
});


const normalizeOrderKey = (message) => {
  const raw = message?.orderNumber
    ?? message?.orderKey
    ?? message?.jobId
    ?? message?.clientRequestId
    ?? message?.orderId;
  if (raw === undefined || raw === null) return '';
  return String(raw).trim();
};

const getOrCreateOrderKey = (message) => {
  let orderKey = normalizeOrderKey(message);
  if (!orderKey) {
    orderKey = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (message && typeof message === 'object') {
      message.clientRequestId = orderKey;
    }
  }
  return orderKey;
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
  scheduleStateSave();
};

const ensureOrderMeta = (orderKey) => {
  if (!orderKey) return null;
  let meta = orderSyncMeta.get(orderKey);
  if (!meta) {
    meta = {
      attempts: 0,
      lastError: null,
      updatedAt: Date.now(),
      hasLink: false,
      hasQr: false,
      status: 'idle',
      paymentLinkUrl: null,
      qrCodeUrl: null,
      inflywayOrderNumber: null
    };
    orderSyncMeta.set(orderKey, meta);
  }
  return meta;
};

const updateOrderMeta = (orderKey, patch) => {
  const meta = ensureOrderMeta(orderKey);
  if (!meta) return;
  Object.assign(meta, patch || {});
  meta.updatedAt = Date.now();
  scheduleStateSave();
};

const buildQueueSnapshot = () => {
  const queue = [];
  const seen = new Set();
  const pushItem = (orderKey) => {
    if (!orderKey || seen.has(orderKey)) return;
    const meta = orderSyncMeta.get(orderKey);
    queue.push({
      orderNumber: orderKey,
      attempts: meta?.attempts ?? 0,
      lastError: meta?.lastError ?? null,
      updatedAt: meta?.updatedAt ?? null,
      hasLink: Boolean(meta?.hasLink),
      hasQr: Boolean(meta?.hasQr),
      status: meta?.status ?? 'unknown'
    });
    seen.add(orderKey);
  };

  createOrderQueue.forEach((item) => pushItem(item.orderKey));
  Array.from(inFlightOrders.keys()).forEach((orderKey) => pushItem(orderKey));
  return queue;
};

const getOrderStatusPayload = (orderKey) => {
  if (!orderKey) {
    return { success: false, status: 'unknown', error: 'Missing order key' };
  }
  const cached = getCachedOrderResult(orderKey);
  if (cached?.success) {
    return {
      success: true,
      jobId: orderKey,
      status: 'success',
      orderNumber: cached.orderNumber ?? orderKey,
      paymentLinkUrl: cached.paymentLinkUrl ?? cached.orderUrl ?? null,
      qrCodeUrl: cached.qrCodeUrl ?? null,
      error: null,
    };
  }
  const meta = orderSyncMeta.get(orderKey);
  if (!meta) {
    return { success: false, jobId: orderKey, status: 'unknown', error: 'Order not found' };
  }
  return {
    success: meta.status !== 'error',
    jobId: orderKey,
    status: meta.status ?? 'unknown',
    orderNumber: meta.inflywayOrderNumber ?? orderKey,
    paymentLinkUrl: meta.paymentLinkUrl ?? null,
    qrCodeUrl: meta.qrCodeUrl ?? null,
    error: meta.lastError ?? null,
  };
};

const isOrderLocked = (orderKey) => {
  if (!orderKey) return false;
  const meta = orderSyncMeta.get(orderKey);
  if (!meta || meta.status !== 'processing') return false;
  return Date.now() - (meta.updatedAt ?? 0) < ORDER_LOCK_TTL_MS;
};

const buildQueuedResponse = (orderKey, status = 'queued') => {
  const payload = getOrderStatusPayload(orderKey);
  return {
    ...payload,
    queued: true,
    status: status || payload.status || 'queued',
  };
};

const isAlreadyQueued = (orderKey) => {
  if (!orderKey) return false;
  return createOrderQueue.some((item) => item?.orderKey === orderKey);
};

const enqueueCreateOrder = (message, sender) => {
  const orderKey = getOrCreateOrderKey(message);
  const cached = getCachedOrderResult(orderKey);
  if (cached) {
    updateOrderMeta(orderKey, {
      status: 'success',
      lastError: null,
      paymentLinkUrl: cached.paymentLinkUrl ?? cached.orderUrl ?? null,
      qrCodeUrl: cached.qrCodeUrl ?? null,
      inflywayOrderNumber: cached.orderNumber ?? null,
      hasLink: Boolean(cached.paymentLinkUrl || cached.orderUrl),
      hasQr: Boolean(cached.qrCodeUrl),
    });
    recordLog('info', 'cache_hit', { orderNumber: orderKey });
    return Promise.resolve(cached);
  }

  if (orderKey && isOrderLocked(orderKey)) {
    updateOrderMeta(orderKey, { status: 'processing' });
    recordLog('info', 'order_locked', { orderNumber: orderKey });
    return Promise.resolve(buildQueuedResponse(orderKey, 'processing'));
  }

  if (orderKey && isAlreadyQueued(orderKey)) {
    updateOrderMeta(orderKey, { status: 'queued' });
    recordLog('info', 'already_queued', { orderNumber: orderKey });
    return Promise.resolve(buildQueuedResponse(orderKey, 'queued'));
  }

  if (orderKey && inFlightOrders.has(orderKey)) {
    updateOrderMeta(orderKey, { status: 'processing' });
    recordLog('info', 'in_flight', { orderNumber: orderKey });
    return inFlightOrders.get(orderKey);
  }

  const breaker = getCircuitBreakerState();
  if (breaker.isOpen) {
    updateOrderMeta(orderKey, { lastError: 'Circuit breaker open', status: 'error' });
    recordLog('warn', 'circuit_open', { orderNumber: orderKey, retryInMs: breaker.retryInMs });
    return Promise.resolve({ success: false, error: 'Circuit breaker open' });
  }

  if (createOrderQueue.length >= CREATE_ORDER_QUEUE_LIMIT) {
    updateOrderMeta(orderKey, { lastError: 'Queue full', status: 'error' });
    recordLog('warn', 'queue_full', { orderNumber: orderKey, size: createOrderQueue.length });
    return Promise.resolve({ success: false, error: 'Queue full' });
  }

  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  if (orderKey) {
    inFlightOrders.set(orderKey, promise);
    inFlightPayloads.set(orderKey, message);
    scheduleStateSave();
  }

  updateOrderMeta(orderKey, { lastError: null, status: 'queued' });
  createOrderQueue.push({ message, sender, orderKey, resolve: resolvePromise, reject: rejectPromise });
  scheduleStateSave();
  recordLog('info', 'queue_add', {
    orderNumber: orderKey,
    amount: message?.amount,
    queueSize: createOrderQueue.length
  });
  processCreateOrderQueue();
  return promise;
};

const processQueueItem = async (item) => {
  if (!item) return;
  const { message, sender, orderKey, resolve } = item;

  if (orderKey) {
    const meta = ensureOrderMeta(orderKey);
    const attempts = (meta?.attempts || 0) + 1;
    updateOrderMeta(orderKey, { attempts, lastError: null, status: 'processing' });
  }

  recordLog('info', 'process_start', { orderNumber: orderKey, amount: message?.amount });

  const response = await new Promise((done) => {
    let finished = false;
    const timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      const timeoutResponse = { success: false, error: '婢跺嫮鎮婄搾鍛' };
      recordLog('error', 'process_timeout', { orderNumber: orderKey, amount: message?.amount });
      resolve(timeoutResponse);
      done(timeoutResponse);
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
      done(response);
    });
  });

  

  const paymentLinkUrl = response?.paymentLinkUrl ?? response?.orderUrl ?? null;
  const qrCodeUrl = response?.qrCodeUrl ?? null;
  const success = Boolean(response?.success || paymentLinkUrl || qrCodeUrl);

  if (success) {
    recordCircuitBreakerSuccess();
  } else {
    recordCircuitBreakerFailure(orderKey, response?.error);
  }

  if (orderKey) {
    updateOrderMeta(orderKey, {
      status: success ? 'success' : 'error',
      lastError: success ? null : (response?.error || 'Failed to create order'),
      paymentLinkUrl,
      qrCodeUrl,
      inflywayOrderNumber: response?.orderNumber ?? null,
      hasLink: Boolean(paymentLinkUrl),
      hasQr: Boolean(qrCodeUrl)
    });
  }

  if (orderKey) {
    inFlightOrders.delete(orderKey);
    inFlightPayloads.delete(orderKey);
    scheduleStateSave();
  }
};

const processCreateOrderQueue = () => {
  if (createOrderQueueRunning) return;
  createOrderQueueRunning = true;

  const runNext = () => {
    while (createOrderWorkers < CREATE_ORDER_CONCURRENCY && createOrderQueue.length > 0) {
      const item = createOrderQueue.shift();
      if (!item) break;
      createOrderWorkers += 1;
      processQueueItem(item)
        .catch(() => {})
        .finally(() => {
          createOrderWorkers -= 1;
          runNext();
          if (createOrderQueue.length === 0 && createOrderWorkers === 0) {
            createOrderQueueRunning = false;
          }
        });
    }

    if (createOrderQueue.length === 0 && createOrderWorkers === 0) {
      createOrderQueueRunning = false;
    }
  };

  runNext();
};

const extractQrFromOrderUrl = async (orderUrl) => {
  if (!orderUrl) return null;
  const previousTab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const existingTab = REUSE_INFLYWAY_TAB && lastInflywayTabId
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
  if (!tabStillExists) return { success: false, error: '鐠併垹宕熸い闈涘嚒閸忔娊妫? };
  await waitForTabComplete(tabId, 30000);
  await sleep(1200);

  let result = null;
  try {
    const results = await executeScriptWithRetry({
      target: { tabId, allFrames: true },
      func: () => {
        return new Promise((resolve) => {
          const wait = (ms) => new Promise(r => setTimeout(r, ms));
          const waitFor = (predicate, options = {}) => {
            const { timeout = 8000, root = document.body } = options;
            return new Promise((resolve) => {
              let done = false;
              let running = false;
              const finish = (value) => {
                if (done) return;
                done = true;
                if (observer) observer.disconnect();
                clearTimeout(timer);
                resolve(value);
              };
              const check = async () => {
                if (done || running) return;
                running = true;
                try {
                  const result = await predicate();
                  if (result) finish(result);
                } catch {}
                finally {
                  running = false;
                }
              };
              check();
              const observer = new MutationObserver(() => {
                check();
              });
              if (root) {
                observer.observe(root, { childList: true, subtree: true, attributes: true });
              }
              const timer = setTimeout(() => finish(null), timeout);
            });
          };

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
            if (raw.includes('娴滃瞼娣惍?) || raw.includes('閹殿偆鐖?) || raw.includes('閺€顖欑帛娴滃瞼娣惍?)) {
              return true;
            }
            return raw.includes('娴滃瞼娣惍?) || raw.includes('閹殿偆鐖?);
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
                || text.includes('閹殿偆鐖?)
                || text.includes('娴滃瞼娣惍?)
                || text.includes('閺€顖欑帛娴滃瞼娣惍?)
                || text.includes('閹殿偆鐖?)
                || text.includes('娴滃瞼娣惍?);
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
              btn.textContent.includes('娴滃瞼娣惍浣稿瀻娴?)
            );
            if (!qrShareBtn) {
              qrShareBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find((btn) => {
                const text = (btn.textContent || '').trim();
                return text.includes('娴滃瞼娣惍浣稿瀻娴?)
                  || text.includes('娴滃瞼娣惍?)
                  || /qr/i.test(text)
                  || text.includes('濞存粌鐬煎ǎ?);
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
            resolve({ success: false, error: '閺堫亝澹橀崚鐗堟暜娴犳ü绨╃紒瀵哥垳', orderNumber });
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

  if (orderUrl) {
    const orderNumber = result?.orderNumber ?? orderUrl.match(/FLY\\d+/)?.[0] ?? "UNKNOWN";
    if (result?.success || orderNumber) {
      return { success: true, paymentLinkUrl: orderUrl, orderNumber };
    }
  }
  return result;
};

// 閻╂垵鎯夐弶銉ㄥ殰 content scripts 閻ㄥ嫭绉烽幁?
const onMessageHandler = (message, sender, sendResponse) => {
  console.log('Background 閺€璺哄煂濞戝牊浼?', message, 'from:', sender);
  if (!stateReady) {
    ensureStateReady().then(() => onMessageHandler(message, sender, sendResponse));
    return true;
  }
  if (message?.type === 'PING' || message?.type === 'GET_SYNC_STATUS' || message?.type === 'SET_SYNC_CONFIG') {
    schedulePrewarm();
  }

  if (message.type === 'GET_LOGS') {
    respondWithLogs(sendResponse);
    return true;
  }

  if (message.type === 'CLEAR_LOGS') {
    clearLogs(sendResponse);
    return true;
  }

  if (message.type === 'SET_SYNC_CONFIG') {
    const config = message?.config || {};
    syncConfig.baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl : '';
    syncConfig.autoMode = Boolean(config.autoMode);
    syncConfig.adminToken = typeof config.adminToken === 'string' ? config.adminToken : '';
    scheduleStateSave();
    sendResponse({ success: true, ...syncConfig });
    return true;
  }

  if (message.type === 'GET_SYNC_STATUS') {
    sendResponse({
      success: true,
      queue: buildQueueSnapshot(),
      autoMode: syncConfig.autoMode,
      baseUrl: syncConfig.baseUrl || null
    });
    return true;
  }

  if (message.type === 'GET_ORDER_STATUS') {
    const orderKey = normalizeOrderKey(message);
    sendResponse(getOrderStatusPayload(orderKey));
    return true;
  }

  if (message.type === 'SYNC_PENDING_ORDERS') {
    const orders = Array.isArray(message?.orders) ? message.orders : [];
    orders.forEach((order) => {
      if (!order || !order.amount) return;
      enqueueCreateOrder(order, sender);
    });
    sendResponse({ success: true, queued: orders.length });
    return true;
  }

  if (message.type === 'CREATE_ORDER' && message.amount) {
    const orderKey = getOrCreateOrderKey(message);
    enqueueCreateOrder(message, sender).catch(() => {});
    sendResponse(getOrderStatusPayload(orderKey));
    return true;
  }

  if (message.type === 'CREATE_ORDER_INTERNAL' && message.amount) {
    (async () => {
      let warmTabId = null;
      try {
        const targetUrl = 'https://inflyway.com/kamelnet/#/kn/fly-link/orders/add';
        const allowReuseTab = REUSE_INFLYWAY_TAB;
        const warmTab = await acquireWarmTab();
        warmTabId = warmTab?.id ?? null;
        const warmTabInfo = warmTabId ? await chrome.tabs.get(warmTabId).catch(() => null) : null;
        let tabs = warmTabInfo ? [warmTabInfo] : (allowReuseTab ? await chrome.tabs.query({ url: targetUrl }) : []);

        if (allowReuseTab && tabs.length === 0) {
          tabs = await chrome.tabs.query({ url: 'https://*.inflyway.com/*' });
          if (tabs.length === 0) {
            tabs = await chrome.tabs.query({ url: 'https://inflyway.com/*' });
          }
          if (tabs.length > 0) {
            const tabId = tabs[0].id;
            if (tabId) {
              console.log('閸掑洦宕查崚鏉垮灡瀵ら缚顓归崡鏇€夐棃?);
              await chrome.tabs.update(tabId, { url: targetUrl, active: false });
              await waitForTabComplete(tabId);
            }
          }
        }

        if (tabs.length > 0) {
          const targetTab = tabs[0];
          const targetTabId = targetTab.id;
          const targetUrl = 'https://inflyway.com/kamelnet/#/kn/fly-link/orders/add';
          const currentUrl = targetTab.url || '';
          console.log('閹垫儳鍩?inflyway 閺嶅洨顒锋い?', targetTabId, 'URL:', currentUrl);
          if (allowReuseTab && targetTabId) {
            lastInflywayTabId = targetTabId;
          }

          if (!currentUrl.includes('/orders/add')) {
            console.log('閸掑洦宕查崚鏉垮灡瀵ら缚顓归崡鏇€夐棃?);
            await chrome.tabs.update(targetTabId, { url: targetUrl, active: false });
            await waitForTabComplete(targetTabId);
          }

          const readyState = await waitForInflywayReady(targetTabId, 20000);
          if (!readyState?.ready) {
            recordLog('warn', 'inflyway_not_ready', { reason: readyState?.reason, url: targetUrl, orderNumber: message.orderNumber });
            sendResponse({
              success: false,
              error: readyState?.reason === 'login'
                ? 'Inflyway login required'
                : 'Create order page not ready'
            });
            return;
          }

          try {
            const results = await executeScriptWithRetry({
              target: { tabId: targetTabId },
              func: (amt, note, items) => {
                return new Promise((resolve) => {
                  async function createOrder(amount, orderNote, lineItems) {
                    const wait = (ms) => new Promise(r => setTimeout(r, ms));
                    const waitFor = (predicate, options = {}) => {
                      const { timeout = 8000, root = document.body } = options;
                      return new Promise((resolve) => {
                        let done = false;
                        let running = false;
                        const finish = (value) => {
                          if (done) return;
                          done = true;
                          if (observer) observer.disconnect();
                          clearTimeout(timer);
                          resolve(value);
                        };
                        const check = async () => {
                          if (done || running) return;
                          running = true;
                          try {
                            const result = await predicate();
                            if (result) finish(result);
                          } catch {}
                          finally {
                            running = false;
                          }
                        };
                        check();
                        const observer = new MutationObserver(() => {
                          check();
                        });
                        if (root) {
                          observer.observe(root, { childList: true, subtree: true, attributes: true });
                        }
                        const timer = setTimeout(() => finish(null), timeout);
                      });
                    };
                    const setInputValue = (input, value) => {
                      if (!input) return;
                      const proto = Object.getPrototypeOf(input);
                      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                      if (setter) {
                        setter.call(input, value);
                      } else {
                        input.value = value;
                      }
                      const inputEvent =
                        typeof InputEvent === 'function'
                          ? new InputEvent('input', { bubbles: true })
                          : new Event('input', { bubbles: true });
                      input.dispatchEvent(inputEvent);
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                      input.dispatchEvent(new Event('blur', { bubbles: true }));
                    };
                    const isElementVisible = (el) => {
                      if (!el) return false;
                      const style = window.getComputedStyle(el);
                      if (style.display === 'none' || style.visibility === 'hidden') return false;
                      const rect = el.getBoundingClientRect();
                      return rect.width > 0 && rect.height > 0;
                    };
                    const findQuantityDialog = () => {
                      const candidates = Array.from(
                        document.querySelectorAll(
                          '.el-popover, .el-dialog__wrapper, .el-message-box__wrapper, .el-overlay, .el-drawer__wrapper'
                        )
                      );
                      return candidates.find(isElementVisible) || null;
                    };
                    const findQuantityInput = (root = document) => {
                      const inputs = Array.from(
                        root.querySelectorAll(
                          'input[role="spinbutton"], input[type="number"], .el-input-number input, input.el-input__inner'
                        )
                      );
                      return inputs.find(isElementVisible) || null;
                    };
                    const findPrimaryButton = (root) => {
                      if (!root) return null;
                      const buttons = Array.from(root.querySelectorAll('button'));
                      const byText = buttons.find((btn) =>
                        /纭畾|纭|confirm/i.test((btn.textContent || '').trim())
                      );
                      if (byText) return byText;
                      return buttons.find((btn) => btn.classList.contains('el-button--primary')) || null;
                    };
                    const findTextareaByLabel = (labels) => {
                      const labelList = Array.isArray(labels) ? labels : [labels];
                      const nodes = Array.from(document.querySelectorAll('label, span, div'));
                      const label = nodes.find((node) => {
                        const text = (node.textContent || '').trim();
                        return labelList.some((labelText) => text.includes(labelText));
                      });
                      const container = label?.closest('.el-form-item') || label?.parentElement;
                      return container?.querySelector('textarea') || null;
                    };
                    const buildFallbackNote = (noteText, itemsList) => {
                      const itemText = Array.isArray(itemsList) && itemsList.length
                        ? `Items: ${itemsList
                            .map((item) => `${(item && item.title) ? item.title : 'Item'} x${item.quantity}`)
                            .join(' | ')}`
                        : '';
                      const cleanNote = (noteText || '').trim();
                      if (cleanNote && itemText) {
                        const withoutItems = cleanNote
                          .split(/\r?\n/)
                          .filter((line) => !line.trim().startsWith('Items:'))
                          .join('\n')
                          .trim();
                        return withoutItems ? `${withoutItems}\n${itemText}` : itemText;
                      }
                      if (cleanNote) return cleanNote;
                      return itemText;
                    };
                    const fillOrderNote = async (noteText) => {
                      const text = (noteText || '').trim();
                      if (!text) return;
                      const textarea = findTextareaByLabel(['订单说明', '订单描述', 'Order description', 'Order Description', 'Order note', 'Order Note']) || document.querySelector('textarea');
                      if (textarea) {
                        setInputValue(textarea, text.slice(0, 500));
                        await wait(200);
                      }
                    };

                    console.log('瀵?婵鍨卞楦款吂閸楁洩绱濋柌鎴︻杺:', amount);
                    await wait(500);

                    // 1. 閻愮懓鍤?闁瀚ㄩ崯鍡楁惂"
                    let buttons = Array.from(document.querySelectorAll('button'));
                    const selectBtn = buttons.find((el) => /选择商品|select\s+product|select\s+item/i.test((el.textContent || "").trim()));
                    if (selectBtn) {
                      console.log('閻愮懓鍤柅澶嬪閸熷棗鎼?);
                      selectBtn.click();
                      const amountValue = Number(String(amount || '').replace(/[^0-9.-]/g, ''));
                      const targetQty = Number.isFinite(amountValue)
                        ? Math.max(1, Math.round(amountValue))
                        : 1;
                      const productReady = await waitFor(() => {
                        const rows = document.querySelectorAll('.table-row-info');
                        const addBtns = document.querySelectorAll('.table-row-add');
                        if (rows.length > 0 && addBtns.length > 0) {
                          return { addBtns: Array.from(addBtns) };
                        }
                        return null;
                      }, { timeout: 8000 });
                      const addBtns = productReady ? productReady.addBtns : [];

                      // 2. 閸︺劍濞婄仦澶夎厬閺屻儲澹橀崯鍡楁惂閻?+"閹稿鎸?
                      if (addBtns.length > 0) {
                        console.log('閹垫儳鍩岄崣顖?澶婃櫌閸濅緤绱濋悙鐟板毊缁楊兛绔存稉?);
                        addBtns[0].click();

                        // 閻愮懓鍤弫浼村櫤闁瀚ㄥ鍦崶閻?绾喖鐣?
                        const popover = await waitFor(() => findQuantityDialog(), { timeout: 4000 });
                        const quantityRoot = popover || document;
                        const popoverInput = findQuantityInput(quantityRoot);
                        if (popoverInput) {
                          popoverInput.focus();
                          setInputValue(popoverInput, String(targetQty));
                          popoverInput.blur();
                          await wait(200);
                        }
                        const popoverConfirm = findPrimaryButton(popover);
                        if (popoverConfirm) {
                          console.log('Confirm quantity');
                          popoverConfirm.click();
                          await wait(800);
                        }
                        const added = await waitFor(() => {
                          const pageText = document.body.textContent || '';
                          if (pageText.match(/閸忚精顓竆s*\d+\s*娑擃亜鏅㈤崫?) && !pageText.includes('閸忚精顓?0 娑擃亜鏅㈤崫?)) {
                            return true;
                          }
                          return null;
                        }, { timeout: 4000 });
                        if (added) {
                          console.log('閸熷棗鎼у鍙夊潑閸?);
                        }
                      } else {
                        resolve({ success: false, error: 'product_list_not_ready' });
                        return;
                      }

                      // 3. 閻愮懓鍤涵顔肩暰閸忔娊妫撮幎钘夌溄
                      buttons = Array.from(document.querySelectorAll('button'));
                      const confirmBtn = buttons.find(btn => /确定|确认|confirm/i.test((btn.textContent || "").trim()));
                      if (confirmBtn) {
                        confirmBtn.click();
                        await wait(1500);
                      }
                      const qtyInput = document.querySelector('.el-input-number input, input[role="spinbutton"], input[type="number"]');
                      if (qtyInput) {
                        qtyInput.focus();
                        setInputValue(qtyInput, String(targetQty));
                        qtyInput.blur();
                        await wait(300);
                      }
                    }

                    // 4. 婵夘偄鍟撶拋銏犲礋閹顤?
                    const noteToUse = buildFallbackNote(orderNote, lineItems);
                    await fillOrderNote(noteToUse);                    const allInputs = Array.from(document.querySelectorAll('input'));
                    for (const input of allInputs) {
                      const parent = input.closest('div');
                      const labelText = ${parent?.textContent || ''}  ;
                      if (
                        labelText.includes('订单总额') ||
                        labelText.includes('订单金额') ||
                        labelText.toLowerCase().includes('total')
                      ) {
                        console.log('填写订单总额:', amount);
                        input.focus();
                        input.value = amount;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.blur();
                        await wait(500);
                        break;
                      }
                    }
                    }

                    // 5. 閻愮懓鍤?閸掓稑缂撹箛顐ｅ祹鐠併垹宕?
                    buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find((btn) => /创建快捷订单|创建订单|create\s+order/i.test((btn.textContent || "").trim()));
                    if (!submitBtn) {
                      resolve({ success: false, error: '閺堫亝澹橀崚鏉垮灡瀵ゅ搫鎻╅幑鐤吂閸楁洘瀵滈柦? });
                      return;
                    }

                    submitBtn.click();
                    console.log('瀹歌尙鍋ｉ崙璇插灡瀵ゅ搫鎻╅幑鐤吂閸?);
                    await wait(1500);

                    // 6. 閺屻儲澹橀弨顖欑帛娴滃瞼娣惍?
                    console.log('閺屻儲澹橀弨顖欑帛娴滃瞼娣惍?);
                    await wait(500);

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
                      btn.textContent.includes('娴滃瞼娣惍浣稿瀻娴?)
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
                        || text.includes('閹殿偆鐖?)
                        || text.includes('閺€顖欑帛娴滃瞼娣惍?);
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
                        || /qr\\s*code/.test(text)
                        || /\\bqr\\b/.test(text)) {
                        return true;
                      }
                      return raw.includes('娴滃瞼娣惍?) || raw.includes('閹殿偆鐖?);
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
                        if (text.includes('鐎广垺鍩涙い楣冩６') || text.includes('service@inflyway')) continue;
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

                    const qrResult = await waitFor(async () => {
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
                          console.log('閹垫儳鍩孲VG娴滃瞼娣惍?);

                          // 鐏忓摖VG鏉烆剚宕叉稉绡淣G
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

                          return { success: true, paymentLinkUrl: getOrderUrl(), orderNumber };
                        }
                      }

                      const canvases = Array.from(container?.querySelectorAll('canvas') || []);
                      for (const canvas of canvases) {
                        if (!isVisible(canvas) || canvas.width < 120 || canvas.height < 120) continue;
                        if (!looksLikeQrCanvas(canvas)) continue;
                        return { success: true, paymentLinkUrl: getOrderUrl(), orderNumber };
                      }

                      const images = Array.from(container?.querySelectorAll('img') || []);
                      for (const img of images) {
                        if (!isVisible(img) || img.width < 120 || img.height < 120) continue;
                        if (!await looksLikeQrImage(img)) continue;
                        const src = img.currentSrc || img.src;
                        if (!src) continue;
                        return { success: true, paymentLinkUrl: getOrderUrl(), orderNumber };
                      }

                      return null;
                    }, { timeout: 7500 });

                    if (qrResult) {
                      resolve(qrResult);
                      return;
                    }

                    const fallbackUrl = getOrderUrl();
                    if (fallbackUrl) {
                      const fallbackOrder = fallbackUrl.match(/FLY\d+/)?.[0] ?? 'UNKNOWN';
                      resolve({
                        success: true,
                        paymentLinkUrl: fallbackUrl,
                        orderUrl: fallbackUrl,
                        qrCodeUrl: fallbackUrl,
                        orderNumber: fallbackOrder
                      });
                      return;
                    }
                    resolve({ success: false, error: '閺堫亝澹橀崚鐗堟暜娴犳ü绨╃紒瀵哥垳', orderUrl: null });
                  }

                  createOrder(amt, note, items).catch(e => resolve({ success: false, error: e.message }));
                });
              },
              args: [message.amount, message.orderNote || '', message.items || []]
            });

            let response = results[0].result;
            console.log('閹笛嗩攽缂佹挻鐏?', response);

            if (!response?.success && response?.orderUrl) {
              const fallbackOrder = response.orderUrl.match(/FLY\d+/)?.[0] ?? 'UNKNOWN';
              response = {
                ...response,
                success: true,
                paymentLinkUrl: response.orderUrl,
                qrCodeUrl: response.orderUrl,
                orderNumber: response.orderNumber ?? fallbackOrder
              };
            }

            if (response.needNewWindow) {
              // 缁涘绶熼弬鎵崶閸欙絾澧﹀?
              await new Promise(resolve => setTimeout(resolve, 2000));

              // 閺屻儲澹橀弬鐗堝ⅵ瀵?閻ㄥ嫮鐛ラ崣?
              const allTabs = await chrome.tabs.query({});
              console.log('閹?閺堝鐖ｇ粵楣冦€?', allTabs.map(t => ({ id: t.id, url: t.url })));
              const newTab = allTabs.find(t => t.url && t.url.includes('inflyway.com') && t.id !== tabs[0].id);
              console.log('閸樼喐鐖ｇ粵楣冦€?ID:', tabs[0].id);
              console.log('閹垫儳鍩岄惃鍕煀缁愭褰?', newTab);

              if (newTab) {
                console.log('閹垫儳鍩岄弬鎵崶閸?', newTab.id);

                // 閸︺劍鏌婄粣妤€褰涙稉顓烇綖閸愭瑥鏅㈤崫浣蜂繆閹?
                const productResult = await executeScriptWithRetry({
                  target: { tabId: newTab.id },
                  func: () => {
                    return new Promise((resolve) => {
                      async function fillProduct() {
                        const wait = (ms) => new Promise(r => setTimeout(r, ms));
                        const waitFor = (predicate, options = {}) => {
                          const { timeout = 8000, root = document.body } = options;
                          return new Promise((resolve) => {
                            let done = false;
                            let running = false;
                            const finish = (value) => {
                              if (done) return;
                              done = true;
                              if (observer) observer.disconnect();
                              clearTimeout(timer);
                              resolve(value);
                            };
                            const check = async () => {
                              if (done || running) return;
                              running = true;
                              try {
                                const result = await predicate();
                                if (result) finish(result);
                              } catch {}
                              finally {
                                running = false;
                              }
                            };
                            check();
                            const observer = new MutationObserver(() => {
                              check();
                            });
                            if (root) {
                              observer.observe(root, { childList: true, subtree: true, attributes: true });
                            }
                            const timer = setTimeout(() => finish(null), timeout);
                          });
                        };
                        await wait(1000);

                        // 婵夘偄鍟撻弫浼村櫤
                        const inputs = document.querySelectorAll('input[type="number"]');
                        if (inputs.length > 0) {
                          inputs[0].value = '1';
                          inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                          console.log('婵夘偄鍟撻弫浼村櫤: 1');
                          await wait(500);
                        }

                        // 閻愮懓鍤涵顔肩暰
                        const buttons = Array.from(document.querySelectorAll('button'));
                      const confirmBtn = buttons.find(btn => /确定|确认|confirm/i.test((btn.textContent || "").trim()));
                        if (confirmBtn) {
                          console.log('閻愮懓鍤涵顔肩暰');
                          confirmBtn.click();
                          await wait(1000);
                        }

                        resolve({ success: true });
                      }
                      fillProduct().catch(e => resolve({ success: false, error: e.message }));
                    });
                  }
                });

                console.log('閸熷棗鎼ч崚娑樼紦缂佹挻鐏?', productResult[0].result);

                // 閸忔娊妫撮弬鎵崶閸?
                await chrome.tabs.remove(newTab.id);
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 缂佈呯敾閸︺劌甯粣妤€褰涙繅顐㈠晸鐠併垹宕?
                const finalResult = await executeScriptWithRetry({
                  target: { tabId: tabs[0].id },
                  func: (amt, note, items) => {
                    return new Promise((resolve) => {
                      async function completeOrder(amount, orderNote, lineItems) {
                        const wait = (ms) => new Promise(r => setTimeout(r, ms));
                        const waitFor = (predicate, options = {}) => {
                          const { timeout = 8000, root = document.body } = options;
                          return new Promise((resolve) => {
                            let done = false;
                            let running = false;
                            const finish = (value) => {
                              if (done) return;
                              done = true;
                              if (observer) observer.disconnect();
                              clearTimeout(timer);
                              resolve(value);
                            };
                            const check = async () => {
                              if (done || running) return;
                              running = true;
                              try {
                                const result = await predicate();
                                if (result) finish(result);
                              } catch {}
                              finally {
                                running = false;
                              }
                            };
                            check();
                            const observer = new MutationObserver(() => {
                              check();
                            });
                            if (root) {
                              observer.observe(root, { childList: true, subtree: true, attributes: true });
                            }
                            const timer = setTimeout(() => finish(null), timeout);
                          });
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
                        const setInputValue = (input, value) => {
                          if (!input) return;
                          const proto = Object.getPrototypeOf(input);
                          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                          if (setter) {
                            setter.call(input, value);
                          } else {
                            input.value = value;
                          }
                          const inputEvent =
                            typeof InputEvent === 'function'
                              ? new InputEvent('input', { bubbles: true })
                              : new Event('input', { bubbles: true });
                          input.dispatchEvent(inputEvent);
                          input.dispatchEvent(new Event('change', { bubbles: true }));
                          input.dispatchEvent(new Event('blur', { bubbles: true }));
                        };
                        const findTextareaByLabel = (labels) => {
                          const labelList = Array.isArray(labels) ? labels : [labels];
                          const nodes = Array.from(document.querySelectorAll('label, span, div'));
                          const label = nodes.find((node) => {
                            const text = (node.textContent || '').trim();
                            return labelList.some((labelText) => text.includes(labelText));
                          });
                          const container = label?.closest('.el-form-item') || label?.parentElement;
                          return container?.querySelector('textarea') || null;
                        };
                        const buildFallbackNote = (noteText, itemsList) => {
                          const itemText = Array.isArray(itemsList) && itemsList.length
                            ? `Items: ${itemsList
                                .map((item) => `${(item && item.title) ? item.title : 'Item'} x${item.quantity}`)
                                .join(' | ')}`
                            : '';
                          const cleanNote = (noteText || '').trim();
                          if (cleanNote && itemText) {
                            const withoutItems = cleanNote
                              .split(/\r?\n/)
                              .filter((line) => !line.trim().startsWith('Items:'))
                              .join('\n')
                              .trim();
                            return withoutItems ? `${withoutItems}\n${itemText}` : itemText;
                          }
                          if (cleanNote) return cleanNote;
                          return itemText;
                        };
                        const fillOrderNote = async (noteText) => {
                          const text = (noteText || '').trim();
                          if (!text) return;
                          const textarea = findTextareaByLabel(['订单说明', '订单描述', 'Order description', 'Order Description', 'Order note', 'Order Note']) || document.querySelector('textarea');
                          if (textarea) {
                            setInputValue(textarea, text.slice(0, 500));
                            await wait(200);
                          }
                        };

                        // 婵夘偄鍟撶拋銏犲礋閹顤?
                        await wait(500);
                        const noteToUse = buildFallbackNote(orderNote, lineItems);
                        await fillOrderNote(noteToUse);                    const allInputs = Array.from(document.querySelectorAll('input'));
                    for (const input of allInputs) {
                      const parent = input.closest('div');
                      const labelText = ${parent?.textContent || ''}  ;
                      if (
                        labelText.includes('订单总额') ||
                        labelText.includes('订单金额') ||
                        labelText.toLowerCase().includes('total')
                      ) {
                        console.log('填写订单总额:', amount);
                        input.focus();
                        input.value = amount;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.blur();
                        await wait(500);
                        break;
                      }
                    }
                        }

                        // 閻愮懓鍤?閸掓稑缂撹箛顐ｅ祹鐠併垹宕?
                        const buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find((btn) => /创建快捷订单|创建订单|create\s+order/i.test((btn.textContent || "").trim()));
                        if (!submitBtn) {
                          resolve({ success: false, error: '閺堫亝澹橀崚鏉垮灡瀵ゅ搫鎻╅幑鐤吂閸楁洘瀵滈柦? });
                          return;
                        }

                        submitBtn.click();
                        console.log('瀹歌尙鍋ｉ崙璇插灡瀵ゅ搫鎻╅幑鐤吂閸?);
                        await wait(3000);

                        // 閺屻儲澹橀弨顖欑帛娴滃瞼娣惍浣告嫲鐠併垹宕熼崣?
                        const qrResult = await waitFor(() => {
                          const dialogs = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="dialog"]');

                          for (const dialog of dialogs) {
                            const style = window.getComputedStyle(dialog);
                            if (style.display === 'none' || style.visibility === 'hidden') continue;
                            if (dialog.textContent.includes('鐎广垺鍩涙い楣冩６') || dialog.textContent.includes('service@inflyway')) continue;

                            const orderMatch = dialog.textContent.match(/FLY\d+/);
                            if (orderMatch) {
                              const imgs = dialog.querySelectorAll('img, canvas');
                              for (const img of imgs) {
                                if (img.width >= 150 && img.height >= 150) {
                                  if (img.tagName === 'IMG' && img.src.includes('qrcode-fp')) continue;

                                  const qrUrl = img.tagName === 'CANVAS' ? img.toDataURL() : img.src;
                                  console.log('閹垫儳鍩岄弨顖欑帛娴滃瞼娣惍渚婄礉鐠併垹宕熼崣?', orderMatch[0]);
                                  return { success: true, paymentLinkUrl: getOrderUrl(), orderNumber: orderMatch[0] };
                                }
                              }
                            }
                          }

                          return null;
                        }, { timeout: 8000 });

                        if (qrResult) {
                          resolve(qrResult);
                          return;
                        }

                        const fallbackUrl = getOrderUrl();
                        if (fallbackUrl) {
                          const fallbackOrder = fallbackUrl.match(/FLY\d+/)?.[0] ?? 'UNKNOWN';
                          resolve({
                            success: true,
                            paymentLinkUrl: fallbackUrl,
                            orderUrl: fallbackUrl,
                            qrCodeUrl: fallbackUrl,
                            orderNumber: fallbackOrder
                          });
                          return;
                        }
                        resolve({ success: false, error: '閺堫亝澹橀崚鐗堟暜娴犳ü绨╃紒瀵哥垳', orderUrl: null });
                      }
                      completeOrder(amt, note, items).catch(e => resolve({ success: false, error: e.message }));
                    });
                  },
                  args: [message.amount, message.orderNote || '', message.items || []]
                });

                sendResponse(finalResult[0].result);
              } else {
                sendResponse({ success: false, error: '閺堫亝澹橀崚鐗堟煀缁愭褰? });
              }
            } else {
              sendResponse(response);
            }
          } catch (error) {
            console.error('閹笛嗩攽闁挎瑨顕?', error);
            sendResponse({ success: false, error: error.message });
          }
        } else {
          console.log('閺堫亝澹橀崚?inflyway 閺嶅洨顒锋い纰夌礉閸掓稑缂撻弬鐗堢垼缁涢箖銆?);
          const tab = await chrome.tabs.create({
            url: 'https://inflyway.com/kamelnet/#/kn/fly-link/orders/add',
            active: false
          });
          if (allowReuseTab && tab?.id) {
            lastInflywayTabId = tab.id;
          }

          await waitForTabComplete(tab.id);
          await sleep(1200);

          try {
            const results = await executeScriptWithRetry({
              target: { tabId: tab.id },
              func: (amt, note, items) => {
                return new Promise((resolve) => {
                  async function createOrder(amount, orderNote, lineItems) {
                    const wait = (ms) => new Promise(r => setTimeout(r, ms));
                    const waitFor = (predicate, options = {}) => {
                      const { timeout = 8000, root = document.body } = options;
                      return new Promise((resolve) => {
                        let done = false;
                        let running = false;
                        const finish = (value) => {
                          if (done) return;
                          done = true;
                          if (observer) observer.disconnect();
                          clearTimeout(timer);
                          resolve(value);
                        };
                        const check = async () => {
                          if (done || running) return;
                          running = true;
                          try {
                            const result = await predicate();
                            if (result) finish(result);
                          } catch {}
                          finally {
                            running = false;
                          }
                        };
                        check();
                        const observer = new MutationObserver(() => {
                          check();
                        });
                        if (root) {
                          observer.observe(root, { childList: true, subtree: true, attributes: true });
                        }
                        const timer = setTimeout(() => finish(null), timeout);
                      });
                    };
                    const setInputValue = (input, value) => {
                      if (!input) return;
                      const proto = Object.getPrototypeOf(input);
                      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                      if (setter) {
                        setter.call(input, value);
                      } else {
                        input.value = value;
                      }
                      const inputEvent =
                        typeof InputEvent === 'function'
                          ? new InputEvent('input', { bubbles: true })
                          : new Event('input', { bubbles: true });
                      input.dispatchEvent(inputEvent);
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                      input.dispatchEvent(new Event('blur', { bubbles: true }));
                    };
                    const findTextareaByLabel = (labels) => {
                      const labelList = Array.isArray(labels) ? labels : [labels];
                      const nodes = Array.from(document.querySelectorAll('label, span, div'));
                      const label = nodes.find((node) => {
                        const text = (node.textContent || '').trim();
                        return labelList.some((labelText) => text.includes(labelText));
                      });
                      const container = label?.closest('.el-form-item') || label?.parentElement;
                      return container?.querySelector('textarea') || null;
                    };
                    const buildFallbackNote = (noteText, itemsList) => {
                      const itemText = Array.isArray(itemsList) && itemsList.length
                        ? `Items: ${itemsList
                            .map((item) => `${(item && item.title) ? item.title : 'Item'} x${item.quantity}`)
                            .join(' | ')}`
                        : '';
                      const cleanNote = (noteText || '').trim();
                      if (cleanNote && itemText) {
                        const withoutItems = cleanNote
                          .split(/\r?\n/)
                          .filter((line) => !line.trim().startsWith('Items:'))
                          .join('\n')
                          .trim();
                        return withoutItems ? `${withoutItems}\n${itemText}` : itemText;
                      }
                      if (cleanNote) return cleanNote;
                      return itemText;
                    };
                    const fillOrderNote = async (noteText) => {
                      const text = (noteText || '').trim();
                      if (!text) return;
                      const textarea = findTextareaByLabel(['订单说明', '订单描述', 'Order description', 'Order Description', 'Order note', 'Order Note']) || document.querySelector('textarea');
                      if (textarea) {
                        setInputValue(textarea, text.slice(0, 500));
                        await wait(200);
                      }
                    };

                    console.log('瀵?婵鍨卞楦款吂閸楁洩绱濋柌鎴︻杺:', amount);
                    await wait(500);

                    // 1. 閻愮懓鍤?闁瀚ㄩ崯鍡楁惂"
                    let buttons = Array.from(document.querySelectorAll('button'));
                    const selectBtn = buttons.find((el) => /选择商品|select\s+product|select\s+item/i.test((el.textContent || "").trim()));
                    if (selectBtn) {
                      console.log('閻愮懓鍤柅澶嬪閸熷棗鎼?);
                      selectBtn.click();
                      const amountValue = Number(String(amount || '').replace(/[^0-9.-]/g, ''));
                      const targetQty = Number.isFinite(amountValue)
                        ? Math.max(1, Math.round(amountValue))
                        : 1;
                      const productReady = await waitFor(() => {
                        const rows = document.querySelectorAll('.table-row-info');
                        const addBtns = document.querySelectorAll('.table-row-add');
                        if (rows.length > 0 && addBtns.length > 0) {
                          return { addBtns: Array.from(addBtns) };
                        }
                        return null;
                      }, { timeout: 8000 });
                      const addBtns = productReady ? productReady.addBtns : [];

                      // 2. 閸︺劍濞婄仦澶夎厬閺屻儲澹橀崯鍡楁惂閻?+"閹稿鎸?
                      if (addBtns.length > 0) {
                        console.log('閹垫儳鍩岄崣顖?澶婃櫌閸濅緤绱濋悙鐟板毊缁楊兛绔存稉?);
                        addBtns[0].click();

                        // 閻愮懓鍤弫浼村櫤闁瀚ㄥ鍦崶閻?绾喖鐣?
                        const popover = await waitFor(() => findQuantityDialog(), { timeout: 4000 });
                        const quantityRoot = popover || document;
                        const popoverInput = findQuantityInput(quantityRoot);
                        if (popoverInput) {
                          popoverInput.focus();
                          setInputValue(popoverInput, String(targetQty));
                          popoverInput.blur();
                          await wait(200);
                        }
                        const popoverConfirm = findPrimaryButton(popover);
                        if (popoverConfirm) {
                          console.log('Confirm quantity');
                          popoverConfirm.click();
                          await wait(800);
                        }
                        const added = await waitFor(() => {
                          const pageText = document.body.textContent || '';
                          if (pageText.match(/閸忚精顓竆s*\d+\s*娑擃亜鏅㈤崫?) && !pageText.includes('閸忚精顓?0 娑擃亜鏅㈤崫?)) {
                            return true;
                          }
                          return null;
                        }, { timeout: 4000 });
                        if (added) {
                          console.log('閸熷棗鎼у鍙夊潑閸?);
                        }
                      } else {
                        resolve({ success: false, error: 'product_list_not_ready' });
                        return;
                      }

                      // 3. 閻愮懓鍤涵顔肩暰閸忔娊妫撮幎钘夌溄
                      buttons = Array.from(document.querySelectorAll('button'));
                      const confirmBtn = buttons.find(btn => /确定|确认|confirm/i.test((btn.textContent || "").trim()));
                      if (confirmBtn) {
                        confirmBtn.click();
                        await wait(1500);
                      }
                      const qtyInput = document.querySelector('.el-input-number input, input[role="spinbutton"], input[type="number"]');
                      if (qtyInput) {
                        qtyInput.focus();
                        setInputValue(qtyInput, String(targetQty));
                        qtyInput.blur();
                        await wait(300);
                      }
                    }

                    // 4. 婵夘偄鍟撶拋銏犲礋閹顤?
                    const noteToUse = buildFallbackNote(orderNote, lineItems);
                    await fillOrderNote(noteToUse);                    const allInputs = Array.from(document.querySelectorAll('input'));
                    for (const input of allInputs) {
                      const parent = input.closest('div');
                      const labelText = ${parent?.textContent || ''}  ;
                      if (
                        labelText.includes('订单总额') ||
                        labelText.includes('订单金额') ||
                        labelText.toLowerCase().includes('total')
                      ) {
                        console.log('填写订单总额:', amount);
                        input.focus();
                        input.value = amount;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.blur();
                        await wait(500);
                        break;
                      }
                    }
                    }

                    // 5. 閻愮懓鍤?閸掓稑缂撹箛顐ｅ祹鐠併垹宕?
                    buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find((btn) => /创建快捷订单|创建订单|create\s+order/i.test((btn.textContent || "").trim()));
                    if (!submitBtn) {
                      resolve({ success: false, error: '閺堫亝澹橀崚鏉垮灡瀵ゅ搫鎻╅幑鐤吂閸楁洘瀵滈柦? });
                      return;
                    }

                    submitBtn.click();
                    console.log('瀹歌尙鍋ｉ崙璇插灡瀵ゅ搫鎻╅幑鐤吂閸?);
                    await wait(1500);

                    // 6. 閺屻儲澹橀弨顖欑帛娴滃瞼娣惍?
                    console.log('閺屻儲澹橀弨顖欑帛娴滃瞼娣惍?);
                    await wait(800);

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
                      btn.textContent.includes('娴滃瞼娣惍浣稿瀻娴?)
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
                        || text.includes('閹殿偆鐖?)
                        || text.includes('閺€顖欑帛娴滃瞼娣惍?);
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
                        || /qr\\s*code/.test(text)
                        || /\\bqr\\b/.test(text)) {
                        return true;
                      }
                      return raw.includes('娴滃瞼娣惍?) || raw.includes('閹殿偆鐖?);
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
                        if (text.includes('鐎广垺鍩涙い楣冩６') || text.includes('service@inflyway')) continue;
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

                    const qrResult = await waitFor(async () => {
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
                          console.log('閹垫儳鍩孲VG娴滃瞼娣惍?);

                          // 鐏忓摖VG鏉烆剚宕叉稉绡淣G
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

                          return { success: true, paymentLinkUrl: getOrderUrl(), orderNumber };
                        }
                      }

                      const canvases = Array.from(container?.querySelectorAll('canvas') || []);
                      for (const canvas of canvases) {
                        if (!isVisible(canvas) || canvas.width < 120 || canvas.height < 120) continue;
                        if (!looksLikeQrCanvas(canvas)) continue;
                        return { success: true, paymentLinkUrl: getOrderUrl(), orderNumber };
                      }

                      const images = Array.from(container?.querySelectorAll('img') || []);
                      for (const img of images) {
                        if (!isVisible(img) || img.width < 120 || img.height < 120) continue;
                        if (!await looksLikeQrImage(img)) continue;
                        const src = img.currentSrc || img.src;
                        if (!src) continue;
                        return { success: true, paymentLinkUrl: getOrderUrl(), orderNumber };
                      }

                      return null;
                    }, { timeout: 7500 });

                    if (qrResult) {
                      resolve(qrResult);
                      return;
                    }

                    resolve({ success: false, error: '閺堫亝澹橀崚鐗堟暜娴犳ü绨╃紒瀵哥垳', orderUrl: getOrderUrl() });
                  }

                  createOrder(amt, note, items).catch(e => resolve({ success: false, error: e.message }));
                });
              },
              args: [message.amount, message.orderNote || '', message.items || []]
            });

            let response = results[0].result;
            console.log('閹笛嗩攽缂佹挻鐏?', response);

            if (!response?.success && response?.orderUrl) {
              const fallbackOrder = response.orderUrl.match(/FLY\d+/)?.[0] ?? 'UNKNOWN';
              response = {
                ...response,
                success: true,
                paymentLinkUrl: response.orderUrl,
                qrCodeUrl: response.orderUrl,
                orderNumber: response.orderNumber ?? fallbackOrder
              };
            }

            sendResponse(response);
          } catch (error) {
            console.error('閸欐垿?浣圭Х閹垶鏁婄拠?', error);
            sendResponse({ success: false, error: error.message });
          }
          finally {
            if (!allowReuseTab && tab?.id) {
              chrome.tabs.remove(tab.id).catch(() => {});
            }
          }
        }
      } catch (error) {
        console.error('婢跺嫮鎮婇柨娆掝嚖:', error);
        sendResponse({ success: false, error: error.message });
      } finally {
        if (warmTabId) {
          releaseWarmTab(warmTabId);
        }
        schedulePrewarm();
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
  console.log('Background 閺€璺哄煂婢舵牠鍎村☉鍫熶紖:', message, 'from:', sender);

  // PING 濞戝牊浼呴悽銊ょ艾濡?閺屻儴绻涢幒?
  if (message.type === 'PING') {
    schedulePrewarm();
    sendResponse({ success: true });
    return true;
  }

  return onMessageHandler(message, sender, sendResponse);
});







