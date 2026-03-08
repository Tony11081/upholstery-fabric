(() => {
  const logPrefix = "[Inflyway content]";
  const log = (...args) => console.log(logPrefix, ...args);
  log("loaded", window.location.href);

  const waitFor = (predicate, options = {}) =>
    new Promise((resolve) => {
      const { timeout = 8000, root = document.body } = options;
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (observer) observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      };
      const check = () => {
        try {
          const result = predicate();
          if (result) finish(result);
        } catch {
          // ignore
        }
      };
      const observer = new MutationObserver(() => {
        check();
      });
      if (root) {
        observer.observe(root, { childList: true, subtree: true, attributes: true });
      }
      const timer = setTimeout(() => finish(null), timeout);
      check();
    });

  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const isPaidText = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    const patterns = [
      /\bpaid\b/i,
      /\bcomplete(?:d)?\b/i,
      /\bpayment\s+received\b/i,
      /\u5df2\u652f\u4ed8/,
      /\u5df2\u5b8c\u6210/,
      /\u652f\u4ed8\u6210\u529f/,
    ];
    return patterns.some((pattern) => pattern.test(normalized));
  };

  const findOrderRow = (orderNumber) => {
    if (!orderNumber) return null;
    const rows = Array.from(document.querySelectorAll("tr"));
    const row = rows.find((item) =>
      normalizeText(item.textContent || "").includes(orderNumber),
    );
    if (row) return row;
    const candidates = Array.from(document.querySelectorAll("div, li"));
    return (
      candidates.find((item) =>
        normalizeText(item.textContent || "").includes(orderNumber),
      ) || null
    );
  };

  const checkPaymentStatus = async (orderNumber) => {
    const row = await waitFor(() => findOrderRow(orderNumber), { timeout: 6000 });
    if (!row) return { isPaid: false };
    if (isPaidText(row.textContent || "")) return { isPaid: true };
    const cells = row.querySelectorAll("td, .el-table__cell, .cell, span, div");
    for (const cell of cells) {
      if (isPaidText(cell.textContent || "")) return { isPaid: true };
    }
    return { isPaid: false };
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "CHECK_PAYMENT_STATUS") {
      checkPaymentStatus(message.orderNumber)
        .then((result) => sendResponse(result))
        .catch(() => sendResponse({ isPaid: false }));
      return true;
    }
    if (message?.type === "PING") {
      sendResponse({ success: true });
      return true;
    }
    return false;
  });
})();
