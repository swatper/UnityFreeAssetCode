//clipboard API는 백그라운드로 작업을 할 수 없어 분리 시킴
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "copyToClipboard") {
      navigator.clipboard.writeText(message.text).then(() => {
        sendResponse({ success: true });
      }).catch(() => {
        sendResponse({ success: false });
      });
      return true;
    }
  });