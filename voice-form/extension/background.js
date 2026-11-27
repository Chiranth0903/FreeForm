chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const url = new URL(tab.url || 'about:blank');
  const allowed = (url.hostname === 'form.123formbuilder.com' && /^\/7008640\/health-insurance-enrollment-form\/?$/.test(url.pathname)) || ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!allowed) {
    await chrome.action.setBadgeText({tabId: tab.id, text: 'SITE'});
    await chrome.action.setTitle({tabId: tab.id, title: 'Open your enrollment form or the localhost demo first.'});
    return;
  }
  try {
    await chrome.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN', files: ['voice-session.js','assistant.js']});
    await chrome.action.setBadgeText({tabId: tab.id, text: ''});
  } catch (error) {
    console.error('FreeForm AI:', error);
    await chrome.action.setBadgeText({tabId: tab.id, text: 'ERR'});
  }
});
