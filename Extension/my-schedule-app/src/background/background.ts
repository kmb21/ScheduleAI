chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed!');
});

(chrome as any).sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_TEXT') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        sendResponse({ error: 'No active tab found' });
        return;
      }
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const pageContent: any = {
              url: window.location.href,
              title: document.title,
              text: document.body.innerText,
              html: document.documentElement.innerHTML,
              timestamp: new Date().toISOString(),
            };

            // 👇 SPECIAL CASE: If on Gmail, scrape emails!
            if (window.location.hostname.includes("mail.google.com")) {
              pageContent.emails = Array.from(document.querySelectorAll(".zA")).map((el) => {
                const metaEl = el.querySelector('[data-legacy-thread-id]');
                return {
                  subject: el.querySelector(".bog")?.textContent || '',
                  sender: el.querySelector(".zF")?.textContent || '',
                  snippet: el.querySelector(".y2")?.textContent || '',
                  gmailThread: metaEl?.getAttribute("data-legacy-thread-id") || '',
                };
              });
            }
            

            return pageContent;
          }
        });
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        console.log('timezone', userTimeZone);
        const scrapedData = results[0]?.result;
        console.log('[Background] Scraped data:', scrapedData);
        sendResponse({ text: scrapedData });
      } catch (error) {
        console.error('[Background] Failed to scrape:', error);
        sendResponse({ error: 'Failed to scrape page' });
      }
    });

    return true;
  }

  if (message.type === 'PARSED_EVENTS') {
    console.log('[Background] Parsed Events:', message.events);
  }
});
