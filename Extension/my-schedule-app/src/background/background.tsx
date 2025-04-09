

// chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
//     if (message.type === 'SCRAPE_TEXT') {
//       // Send message to the active tab to run content script scraping
//       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         if (tabs[0].id) {
//           chrome.tabs.sendMessage(tabs[0].id, { type: 'SCRAPE_NOW' }, (response) => {
//             console.log('[Background] Got scraped text:', response?.text)
//             sendResponse(response)
//           })
//         }
//       })
  
//       // Required for async sendResponse
//       return true
//     }
//   })
  


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_TEXT') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]?.id) {
        sendResponse({ text: 'No active tab found' })
        return
      }

      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            // ⬇️ This is your inline scrapePage logic (must be serializable)
            const pageContent: any = {
              url: window.location.href,
              title: document.title,
              text: document.body.innerText,
              html: document.documentElement.innerHTML,
              timestamp: new Date().toISOString(),
            }

            if (window.location.hostname.includes("mail.google.com")) {
              pageContent.emails = Array.from(document.querySelectorAll(".zA")).map((el) => ({
                subject: el.querySelector(".bog")?.textContent,
                sender: el.querySelector(".zF")?.textContent,
                snippet: el.querySelector(".y2")?.textContent,
              }))
            }

            if (window.location.hostname.includes("slack.com")) {
              pageContent.messages = Array.from(document.querySelectorAll(".c-message")).map((el) => ({
                sender: el.querySelector(".c-message__sender")?.textContent,
                content: el.querySelector(".c-message__body")?.textContent,
                timestamp: el.querySelector(".c-timestamp")?.textContent,
              }))
            }

            return pageContent
          },
        })

        const scrapedData = results[0].result
        console.log('[Background] Scraped data:', scrapedData)
        sendResponse({ text: JSON.stringify(scrapedData, null, 2) })
      } catch (err) {
        console.error('[Background] Failed to scrape:', err)
        sendResponse({ text: 'Failed to scrape page' })
      }
    })

    return true
  }
})
