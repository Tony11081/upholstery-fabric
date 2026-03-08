(() => {
  const KEEPALIVE_INTERVAL_MS = 25000;
  const RECONNECT_DELAY_MS = 1000;
  let port = null;
  let intervalId = null;

  const sendKeepalive = () => {
    try {
      port?.postMessage({ type: "KEEPALIVE" });
    } catch {
      // ignore
    }
  };

  const clearIntervalIfAny = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const connect = () => {
    clearIntervalIfAny();
    try {
      port = chrome.runtime.connect({ name: "OFFSCREEN_KEEPALIVE" });
      port.onDisconnect.addListener(() => {
        port = null;
        clearIntervalIfAny();
        setTimeout(connect, RECONNECT_DELAY_MS);
      });
      sendKeepalive();
      intervalId = setInterval(sendKeepalive, KEEPALIVE_INTERVAL_MS);
    } catch {
      setTimeout(connect, RECONNECT_DELAY_MS);
    }
  };

  connect();
})();
