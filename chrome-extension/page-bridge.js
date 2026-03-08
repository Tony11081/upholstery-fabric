// 监听页面的消息
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'CREATE_ORDER_REQUEST') {
    console.log('Page bridge 收到创建订单请求:', event.data);

    try {
      // 转发到 background
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_ORDER',
        amount: event.data.amount,
        orderNote: event.data.orderNote,
        shippingAddress: event.data.shippingAddress,
        items: event.data.items
      });

      console.log('Background 响应:', response);

      // 发送响应回页面
      window.postMessage({
        type: 'ORDER_RESPONSE',
        ...response
      }, '*');
    } catch (error) {
      console.error('Background 错误:', error);
      window.postMessage({
        type: 'ORDER_RESPONSE',
        success: false,
        error: error.message
      }, '*');
    }
  } else if (event.data.type === 'CHECK_PAYMENT_REQUEST') {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_PAYMENT_STATUS',
        orderNumber: event.data.orderNumber
      });

      window.postMessage({
        type: 'PAYMENT_STATUS_RESPONSE',
        ...response
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'PAYMENT_STATUS_RESPONSE',
        isPaid: false
      }, '*');
    }
  }
});

console.log('Page bridge 已加载');
