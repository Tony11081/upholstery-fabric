"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";

type ChromeMessageResponse = {
  success?: boolean;
  orderNumber?: string;
  qrCodeUrl?: string;
  paymentLinkUrl?: string;
  inflywayOrderId?: string;
  jobId?: string;
  status?: string;
  queued?: boolean;
  error?: string;
  queue?: SyncQueueItem[];
  syncQueue?: number;
  autoMode?: boolean;
  baseUrl?: string | null;
  logs?: ExtensionLogEntry[];
};

type ChromePort = {
  name?: string;
  postMessage: (message: Record<string, unknown>) => void;
  disconnect: () => void;
  onDisconnect: { addListener: (callback: () => void) => void };
  onMessage?: { addListener: (callback: (message: unknown) => void) => void };
};

type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: Record<string, unknown>,
    callback: (response?: ChromeMessageResponse) => void,
  ) => void;
  connect: (extensionId: string, connectInfo?: { name?: string }) => ChromePort;
  lastError?: { message?: string };
};

declare const chrome: {
  runtime: ChromeRuntime;
};

type PendingOrderItem = {
  qty: number;
  price: number;
  currency: string | null;
  titleSnapshot?: string | null;
  product?: {
    titleEn?: string | null;
    slug?: string | null;
  } | null;
};

type PendingOrder = {
  id: string;
  orderNumber: string;
  total: string;
  currency: string;
  createdAt: string;
  inflywayOrderId?: string | null;
  paymentLinkUrl?: string | null;
  paypalInvoiceUrl?: string | null;
  paymentQrCode?: string | null;
  email?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  items?: PendingOrderItem[];
  customer: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
  } | null;
};

type SyncQueueItem = {
  orderNumber: string;
  attempts: number;
  lastError?: string | null;
  updatedAt?: number | null;
  hasLink?: boolean;
  hasQr?: boolean;
};

type ExtensionLogEntry = {
  ts: string;
  level?: string;
  message?: string;
  data?: unknown;
};

type OrderResult = {
  orderId: string;
  success: boolean;
  inflywayOrderId?: string;
  qrCodeUrl?: string;
  paymentLinkUrl?: string;
  error?: string;
};

const REQUEST_TIMEOUT_MS = 180000;
const MAX_PENDING_ORDERS = 100;
const ORDER_STATUS_POLL_MS = 2000;
const ORDER_STATUS_MAX_ATTEMPTS = Math.ceil(REQUEST_TIMEOUT_MS / ORDER_STATUS_POLL_MS);
const DEFAULT_EXTENSION_ID = "gfecpempdkjbofcacodbnghjfdlbgifp";
const TEST_EXTENSION_ID = "nkkjieipgllgfafamnjbchdeejmbjmfh";
const EXTENSION_ORDER_SYNC_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_EXTENSION_ORDER_SYNC === "1" ||
  process.env.NEXT_PUBLIC_ENABLE_EXTENSION_ORDER_SYNC === "true";

const resolveExtensionId = () => {
  const envId = process.env.NEXT_PUBLIC_INFLYWAY_EXTENSION_ID?.trim();
  if (envId && envId !== TEST_EXTENSION_ID) return envId;
  return DEFAULT_EXTENSION_ID;
};

const normalizeText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const pickAddressValue = (address: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!address) return "";
  for (const key of keys) {
    const raw = address[key];
    const normalized = normalizeText(raw);
    if (normalized) return normalized;
  }
  return "";
};

const buildShippingAddress = (order: PendingOrder) => {
  const address = order.shippingAddress ?? null;
  const email = normalizeText(order.email ?? order.customer?.email ?? address?.email);
  const fullName = normalizeText(
    address?.fullName ?? address?.name ?? address?.recipient ?? order.customer?.name,
  );
  const phone = normalizeText(address?.phone ?? order.customer?.phone);
  const country = pickAddressValue(address, [
    "country",
    "countryRegion",
    "countryName",
    "billingCountry",
  ]);
  const address1 = pickAddressValue(address, [
    "address1",
    "line1",
    "addressLine1",
    "street",
    "street1",
    "address",
  ]);
  const address2 = pickAddressValue(address, [
    "address2",
    "line2",
    "addressLine2",
    "street2",
    "addressExtra",
  ]);
  const city = pickAddressValue(address, ["city", "town", "addressCity"]);
  const state = pickAddressValue(address, [
    "state",
    "province",
    "region",
    "stateProvince",
    "addressState",
  ]);
  const postalCode = pickAddressValue(address, [
    "postalCode",
    "zip",
    "zipCode",
    "postcode",
    "postal",
  ]);
  return {
    email,
    fullName,
    phone,
    country,
    address1,
    address2,
    city,
    state,
    postalCode,
  };
};

const buildItemsPayload = (order: PendingOrder) => {
  return (order.items ?? []).map((item) => ({
    title: item.titleSnapshot ?? item.product?.titleEn ?? "Item",
    quantity: item.qty ?? 1,
    price: Number(item.price ?? 0),
    currency: item.currency ?? order.currency ?? "USD",
  }));
};

const buildOrderNote = (
  order: PendingOrder,
  items: ReturnType<typeof buildItemsPayload>,
  shippingAddress: ReturnType<typeof buildShippingAddress>,
) => {
  const lines = [
    `Order: ${order.orderNumber}`,
    shippingAddress.email ? `Email: ${shippingAddress.email}` : null,
    shippingAddress.fullName ? `Name: ${shippingAddress.fullName}` : null,
    shippingAddress.phone ? `Phone: ${shippingAddress.phone}` : null,
    items.length
      ? `Items: ${items.map((item) => `${item.title} x${item.quantity}`).join(" | ")}`
      : null,
    `Total: ${order.total} ${order.currency}`,
  ].filter(Boolean);
  return lines.join("\n").trim();
};

const buildSyncPayload = (order: PendingOrder) => {
  const shippingAddress = buildShippingAddress(order);
  const items = buildItemsPayload(order);
  const orderNote = buildOrderNote(order, items, shippingAddress);
  return {
    amount: String(order.total),
    orderNumber: order.orderNumber,
    currency: order.currency,
    orderNote,
    shippingAddress,
    items,
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldPollStatus = (response?: ChromeMessageResponse) => {
  if (!response) return true;
  if (response.queued) return true;
  if (response.status === "queued" || response.status === "processing") return true;
  return !(response.paymentLinkUrl || response.qrCodeUrl);
};

const pollOrderStatus = async (
  runtime: ChromeRuntime,
  extensionId: string,
  jobId: string
) => {
  for (let attempt = 0; attempt < ORDER_STATUS_MAX_ATTEMPTS; attempt += 1) {
    const { response, error } = await new Promise<{
      response?: ChromeMessageResponse;
      error?: string;
    }>((resolve) => {
      runtime.sendMessage(extensionId, { type: "GET_ORDER_STATUS", jobId }, (result) => {
        const lastError = runtime.lastError;
        resolve({ response: result, error: lastError?.message });
      });
    });

    if (error) {
      return { success: false, error };
    }

    if (response?.status === "error") {
      return response;
    }

    if (response?.paymentLinkUrl || response?.qrCodeUrl || response?.status === "success") {
      return response;
    }

    await sleep(ORDER_STATUS_POLL_MS);
  }

  return { success: false, error: "Timeout waiting for order status" };
};

export default function OrderSyncPage() {
  if (!EXTENSION_ORDER_SYNC_ENABLED) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-3">订单同步 - Inflyway</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Extension order sync is disabled. Set
          {" "}
          <code>NEXT_PUBLIC_ENABLE_EXTENSION_ORDER_SYNC=true</code>
          {" "}
          and
          {" "}
          <code>ENABLE_EXTENSION_ORDER_SYNC=true</code>
          {" "}
          to re-enable this legacy workflow.
        </div>
      </div>
    );
  }

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [results, setResults] = useState<OrderResult[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [extensionId, setExtensionId] = useState(resolveExtensionId());
  const [connected, setConnected] = useState(false);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [adminToken, setAdminToken] = useState("");
  const [logEntries, setLogEntries] = useState<ExtensionLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const keepAlivePortRef = useRef<ChromePort | null>(null);
  const autoRunCooldownRef = useRef(0);

  const syncQueueMap = useMemo(() => {
    return syncQueue.reduce<Record<string, SyncQueueItem>>((acc, item) => {
      acc[item.orderNumber] = item;
      return acc;
    }, {});
  }, [syncQueue]);

  const ordersMissingPayment = useMemo(() => {
    return orders.filter(
      (order) => !order.paymentLinkUrl && !order.paypalInvoiceUrl && !order.paymentQrCode
    );
  }, [orders]);

  const logText = useMemo(() => {
    if (!logEntries.length) return "";
    return logEntries
      .map((entry) => {
        const level = entry.level || "info";
        const message = entry.message || "";
        const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
        return `${entry.ts} [${level}] ${message}${data}`;
      })
      .join("\n");
  }, [logEntries]);

  useEffect(() => {
    if (!extensionId) return;
    const runtimeMaybe = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    const runtimeConnect = runtimeMaybe?.connect;
    if (!runtimeMaybe || !runtimeConnect) return;
    const runtime = runtimeMaybe as ChromeRuntime;
    const boundConnect = runtimeConnect.bind(runtime);
    const boundSendMessage = runtime.sendMessage.bind(runtime);
    let port: ChromePort | null = null;
    let intervalId: number | null = null;
    let reconnectTimer: number | null = null;
    let backoffMs = 2000;
    let stopped = false;

    const clearTimers = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const sendKeepAlive = () => {
      try {
        port?.postMessage({ type: "KEEPALIVE" });
      } catch {
        // ignore keepalive errors
      }
    };

    const sendSyncConfig = () => {
      try {
        boundSendMessage(
          extensionId,
          {
            type: "SET_SYNC_CONFIG",
            config: {
              baseUrl: typeof window !== "undefined" ? window.location.origin : "",
              autoMode,
              adminToken: adminToken || null,
            },
          },
          () => {}
        );
      } catch {
        // ignore sync config errors
      }
    };

    const fetchSyncStatus = () => {
      try {
        boundSendMessage(extensionId, { type: "GET_SYNC_STATUS" }, (response) => {
          if (runtime.lastError) return;
          if (Array.isArray(response?.queue)) {
            setSyncQueue(response.queue);
          }
        });
      } catch {
        // ignore
      }
    };

    const pingExtension = () => {
      boundSendMessage(extensionId, { type: "PING" }, (response) => {
        if (runtime.lastError) {
          setConnected(false);
          return;
        }
        setConnected(response?.success === true);
      });
    };

    const connect = () => {
      if (stopped) return;
      clearTimers();
      try {
        port = boundConnect(extensionId, { name: "ORDER_SYNC_KEEPALIVE" });
        keepAlivePortRef.current = port;
        backoffMs = 2000;
        sendKeepAlive();
        intervalId = window.setInterval(sendKeepAlive, 25000);
        sendSyncConfig();
        fetchSyncStatus();
        pingExtension();
        port.onDisconnect.addListener(() => {
          if (keepAlivePortRef.current === port) {
            keepAlivePortRef.current = null;
          }
          if (stopped) return;
          const delay = Math.min(backoffMs, 60000);
          backoffMs = Math.min(backoffMs * 2, 60000);
          reconnectTimer = window.setTimeout(connect, delay);
        });
      } catch {
        const delay = Math.min(backoffMs, 60000);
        backoffMs = Math.min(backoffMs * 2, 60000);
        reconnectTimer = window.setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      stopped = true;
      clearTimers();
      try {
        port?.disconnect();
      } catch {
        // ignore disconnect failures
      }
      if (keepAlivePortRef.current === port) {
        keepAlivePortRef.current = null;
      }
    };
  }, [adminToken, autoMode, extensionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("orderSyncAdminToken");
    if (stored) {
      setAdminToken(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("orderSyncExtensionId");
    if (stored) {
      setExtensionId(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("orderSyncAutoMode");
    if (stored !== null) {
      setAutoMode(stored === "true");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (adminToken) {
      window.localStorage.setItem("orderSyncAdminToken", adminToken);
    } else {
      window.localStorage.removeItem("orderSyncAdminToken");
    }
  }, [adminToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (extensionId) {
      window.localStorage.setItem("orderSyncExtensionId", extensionId);
    }
  }, [extensionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("orderSyncAutoMode", String(autoMode));
  }, [autoMode]);

  // 获取待处理订单
  const fetchOrders = useCallback(async () => {
    try {
      const headers: HeadersInit = {};
      if (adminToken) {
        headers["x-admin-token"] = adminToken;
      }
      const res = await fetch("/api/admin/orders/pending-payment", { headers });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("获取订单失败:", error);
    }
  }, [adminToken]);

  // 轮询获取订单
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // 每5秒检查一次
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // 检查插件连接
  const checkExtension = useCallback(() => {
    if (!extensionId) return;
    try {
      const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
      if (!runtime?.sendMessage) {
        setConnected(false);
        return;
      }
      runtime.sendMessage(extensionId, { type: "PING" }, (response) => {
        if (runtime.lastError) {
          setConnected(false);
          return;
        }
        setConnected(response?.success === true);
      });
    } catch {
      setConnected(false);
    }
  }, [extensionId]);

  useEffect(() => {
    if (extensionId) {
      checkExtension();
      const interval = setInterval(checkExtension, 10000);
      return () => clearInterval(interval);
    }
  }, [extensionId, checkExtension]);

  const syncConfigToExtension = useCallback(() => {
    if (!extensionId) return;
    try {
      const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
      if (!runtime?.sendMessage) return;
      runtime.sendMessage(
        extensionId,
        {
          type: "SET_SYNC_CONFIG",
          config: {
            baseUrl: typeof window !== "undefined" ? window.location.origin : "",
            autoMode,
            adminToken: adminToken || null,
          },
        },
        () => {}
      );
    } catch {
      // ignore
    }
  }, [adminToken, autoMode, extensionId]);

  useEffect(() => {
    syncConfigToExtension();
  }, [syncConfigToExtension]);

  const refreshSyncStatus = useCallback(() => {
    if (!extensionId || !connected) return;
    try {
      const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
      if (!runtime?.sendMessage) return;
      runtime.sendMessage(extensionId, { type: "GET_SYNC_STATUS" }, (response) => {
        if (runtime.lastError) return;
        if (Array.isArray(response?.queue)) {
          setSyncQueue(response.queue);
        }
      });
    } catch {
      // ignore
    }
  }, [connected, extensionId]);

  useEffect(() => {
    if (!connected) return;
    refreshSyncStatus();
    const interval = setInterval(refreshSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [connected, refreshSyncStatus]);

  const fetchExtensionLogs = useCallback(() => {
    if (!extensionId) return;
    try {
      const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
      if (!runtime?.sendMessage) {
        setLogError("未检测到插件");
        return;
      }
      setLogLoading(true);
      setLogError(null);
      runtime.sendMessage(extensionId, { type: "GET_LOGS" }, (response) => {
        setLogLoading(false);
        if (runtime.lastError) {
          setLogError(runtime.lastError.message || "获取日志失败");
          return;
        }
        if (!response?.success) {
          setLogError(response?.error || "获取日志失败");
          return;
        }
        setLogEntries(response.logs || []);
      });
    } catch (error) {
      setLogLoading(false);
      setLogError(error instanceof Error ? error.message : "获取日志失败");
    }
  }, [extensionId]);

  const clearExtensionLogs = useCallback(() => {
    if (!extensionId) return;
    try {
      const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
      if (!runtime?.sendMessage) {
        setLogError("未检测到插件");
        return;
      }
      setLogLoading(true);
      setLogError(null);
      runtime.sendMessage(extensionId, { type: "CLEAR_LOGS" }, (response) => {
        setLogLoading(false);
        if (runtime.lastError) {
          setLogError(runtime.lastError.message || "清空日志失败");
          return;
        }
        if (!response?.success) {
          setLogError(response?.error || "清空日志失败");
          return;
        }
        setLogEntries([]);
      });
    } catch (error) {
      setLogLoading(false);
      setLogError(error instanceof Error ? error.message : "清空日志失败");
    }
  }, [extensionId]);

  const queueOrdersForSync = useCallback(
    (ordersToQueue: PendingOrder[]) => {
      if (!extensionId) return;
      try {
        const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
        if (!runtime?.sendMessage) return;
        runtime.sendMessage(
          extensionId,
          {
            type: "SYNC_PENDING_ORDERS",
            orders: ordersToQueue.map(buildSyncPayload),
          },
          () => {}
        );
      } catch {
        // ignore
      }
    },
    [extensionId]
  );

  // 处理单个订单
  const processOrder = async (order: PendingOrder) => {
    if (!extensionId) {
      alert("请先输入插件 ID");
      return;
    }

    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!runtime?.sendMessage) {
      setResults((prev) => [
        ...prev,
        {
          orderId: order.id,
          success: false,
          error: "未检测到 Chrome 插件，请确认已安装并启用",
        },
      ]);
      return;
    }

    setProcessing(order.id);
    let responded = false;
    const timeoutId = window.setTimeout(() => {
      if (responded) return;
      responded = true;
      setResults((prev) => [
        ...prev,
        {
          orderId: order.id,
          success: false,
          error: "插件无响应，请检查扩展是否启用",
        },
      ]);
      setProcessing(null);
    }, REQUEST_TIMEOUT_MS);

    try {
      // 发送消息给 Chrome 插件
      const payload = buildSyncPayload(order);
      runtime.sendMessage(
        extensionId,
        {
          type: "CREATE_ORDER",
          ...payload,
        },
        async (response) => {
          if (responded) return;
          responded = true;
          window.clearTimeout(timeoutId);
          const lastError = runtime.lastError;
          try {
            if (lastError) {
              setResults((prev) => [
                ...prev,
                {
                  orderId: order.id,
                  success: false,
                  error: lastError.message || "插件通信失败",
                },
              ]);
              return;
            }
            let finalResponse = response;
            if (shouldPollStatus(response)) {
              const jobId = response?.jobId ?? response?.orderNumber ?? order.orderNumber;
              if (jobId) {
                finalResponse = await pollOrderStatus(runtime, extensionId, jobId);
              }
            }
            if (finalResponse?.success) {
              // 更新数据库
              const resolvedLink = finalResponse.paymentLinkUrl ?? finalResponse.qrCodeUrl;
              if (!resolvedLink) {
                setResults((prev) => [
                  ...prev,
                  {
                    orderId: order.id,
                    success: false,
                    error: finalResponse?.error || "Failed to create checkout link.",
                  },
                ]);
                return;
              }
              const headers: HeadersInit = { "Content-Type": "application/json" };
              if (adminToken) {
                headers["x-admin-token"] = adminToken;
              }
              const res = await fetch("/api/admin/orders/pending-payment", {
                method: "POST",
                headers,
                body: JSON.stringify({
                  orderId: order.id,
                  inflywayOrderId: finalResponse.orderNumber ?? response?.orderNumber,
                  paymentLinkUrl: resolvedLink,
                }),
              });
              if (!res.ok) {
                throw new Error("更新订单状态失败");
              }

              setResults((prev) => [
                ...prev,
                {
                  orderId: order.id,
                  success: true,
                  inflywayOrderId: finalResponse.orderNumber ?? response?.orderNumber,
                  paymentLinkUrl: resolvedLink,
                },
              ]);
              fetchOrders(); // 刷新列表
            } else {
              setResults((prev) => [
                ...prev,
                {
                  orderId: order.id,
                  success: false,
                  error: finalResponse?.error || "Failed to create checkout link.",
                },
              ]);
            }
          } catch (error) {
            setResults((prev) => [
              ...prev,
              {
                orderId: order.id,
                success: false,
                error: error instanceof Error ? error.message : "处理失败",
              },
            ]);
          } finally {
            setProcessing(null);
          }
        }
      );
    } catch (error) {
      window.clearTimeout(timeoutId);
      setResults((prev) => [
        ...prev,
        {
          orderId: order.id,
          success: false,
          error: error instanceof Error ? error.message : "处理失败",
        },
      ]);
      setProcessing(null);
    }
  };

  const clearPendingOrders = useCallback(async () => {
    try {
      const headers: HeadersInit = {};
      if (adminToken) {
        headers["x-admin-token"] = adminToken;
      }
      const res = await fetch("/api/admin/orders/pending-payment", {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        throw new Error("Failed to clear pending orders");
      }
      setOrders([]);
      fetchOrders();
    } catch (error) {
      console.error("清空待处理订单失败:", error);
    }
  }, [adminToken, fetchOrders]);

  // 自动处理模式
  const getNextAutoOrder = useCallback(() => {
    return ordersMissingPayment.find(
      (order) =>
        !syncQueueMap[order.orderNumber] &&
        processing !== order.id
    );
  }, [ordersMissingPayment, processing, syncQueueMap]);

  useEffect(() => {
    if (!autoMode || !extensionId) return;

    const tick = () => {
      if (!connected || processing) return;
      const now = Date.now();
      if (now - autoRunCooldownRef.current < 2000) return;
      const nextOrder = getNextAutoOrder();
      if (!nextOrder) return;
      autoRunCooldownRef.current = now;
      processOrder(nextOrder);
    };

    tick();
    const intervalId = window.setInterval(tick, 2000);
    return () => window.clearInterval(intervalId);
  }, [autoMode, connected, extensionId, getNextAutoOrder, processing]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">订单同步 - Inflyway</h1>

      {/* 插件配置 */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="font-semibold mb-2">Chrome 插件配置</h2>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="输入插件 ID"
            value={extensionId}
            onChange={(e) => setExtensionId(e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
          />
          <span
            className={`px-3 py-1 rounded text-sm ${
              connected ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {connected ? "已连接" : "未连接"}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          在 chrome://extensions/ 找到插件 ID
        </p>
        <div className="mt-3 flex gap-2 items-center">
          <input
            type="password"
            placeholder="Admin token (optional)"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            className="flex-1 px-3 py-2 border rounded"
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Optional: set ADMIN_PAYMENT_LINK_TOKEN on the server and paste it here to allow background sync without admin
          cookies.
        </p>
      </div>

      {/* 自动模式开关 */}
      <div className="flex items-center gap-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoMode}
            onChange={(e) => setAutoMode(e.target.checked)}
            className="w-5 h-5"
          />
          <span>自动处理新订单</span>
        </label>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          刷新
        </button>
        <button
          onClick={clearPendingOrders}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Clear pending
        </button>
        <button
          onClick={() => queueOrdersForSync(ordersMissingPayment)}
          className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
          disabled={!connected || ordersMissingPayment.length === 0}
          title="Resync missing payment links"
        >
          Resync missing
        </button>
      </div>

      {/* 待处理订单列表 */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">
          待处理订单 ({orders.length}/{MAX_PENDING_ORDERS})
        </h2>
        {orders.length === 0 ? (
          <p className="text-gray-500">暂无待处理订单</p>
        ) : (
          <div className="space-y-2">
            {
            orders.map((order) => {
              const syncInfo = syncQueueMap[order.orderNumber];
              const hasPayment = Boolean(
                order.paymentLinkUrl || order.paypalInvoiceUrl || order.paymentQrCode
              );
              const statusLabel = hasPayment
                ? "Ready"
                : processing === order.id
                  ? "Processing"
                  : syncInfo
                    ? "Retry " + syncInfo.attempts
                    : "Pending";
              const statusDetail = syncInfo?.lastError ? " - " + syncInfo.lastError : "";

              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 bg-white border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">
                      {order.customer?.email || "No email"} |{" "}
                      {new Date(order.createdAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Status: {statusLabel}{statusDetail}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">
                      {order.currency} {order.total}
                    </span>
                    <button
                      onClick={() => processOrder(order)}
                      disabled={processing === order.id}
                      className={`px-4 py-2 rounded ${
                        processing === order.id
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-green-500 text-white hover:bg-green-600"
                      }`}
                    >
                      {processing === order.id ? "Processing..." : "Create payment"}
                    </button>
                    {!hasPayment && (
                      <button
                        onClick={() => queueOrdersForSync([order])}
                        className="px-4 py-2 rounded bg-gray-900 text-white hover:bg-gray-800"
                      >
                        Resync
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          }
          </div>
        )}
      </div>

      {/* 处理结果 */}
      {results.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">处理结果</h2>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded ${
                  result.success ? "bg-green-100" : "bg-red-100"
                }`}
              >
                {result.success ? (
                  <div>
                    <span className="text-green-700">✓ 成功</span>
                    {result.inflywayOrderId && (
                      <span className="ml-2">
                        Inflyway 订单: {result.inflywayOrderId}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-red-700">✗ 失败: {result.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-slate-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">插件日志</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchExtensionLogs}
              className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
              disabled={logLoading}
            >
              {logLoading ? "加载中..." : "刷新日志"}
            </button>
            <button
              onClick={clearExtensionLogs}
              className="px-3 py-1 text-sm rounded bg-gray-900 text-white hover:bg-gray-800"
              disabled={logLoading}
            >
              清空日志
            </button>
          </div>
        </div>
        {logError && <p className="text-sm text-red-600 mb-2">{logError}</p>}
        <div className="max-h-80 overflow-auto text-xs bg-white border rounded p-3 font-mono whitespace-pre-wrap">
          {logText || "暂无日志"}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold mb-2">使用说明</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>确保 Chrome 插件已安装并启用</li>
          <li>在另一个标签页打开 inflyway.com 并保持登录</li>
          <li>输入插件 ID 并确认连接状态为"已连接"</li>
          <li>开启"自动处理新订单"或手动点击"Create payment"</li>
        </ol>
      </div>
    </div>
  );
}
