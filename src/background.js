// Firefox compatibility - use browserAction if action is not available
const actionAPI = chrome.action || chrome.browserAction;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateBadge') {
    const count = message.count || 0;
    
    // Set badge text
    if (count > 0) {
      actionAPI.setBadgeText({ text: count.toString() });
      actionAPI.setBadgeBackgroundColor({ color: '#6b4c7a' });
      actionAPI.setBadgeTextColor({ color: '#ffffff' });
    } else {
      actionAPI.setBadgeText({ text: '' });
    }
    
    sendResponse({ success: true });
  }
  
  return true;
});

// Set initial badge state
actionAPI.setBadgeText({ text: '' });

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: 'https://www.bat.org/ss/pool.php?s=3' });
});