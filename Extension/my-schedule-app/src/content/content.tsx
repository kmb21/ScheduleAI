// // // src/content/content.tsx

// // console.log("[Smart Scheduler] Content script running...")

// // function scrapePageText(): string {
// //   const bodyText = document.body.innerText || ''
// //   console.log("[Smart Scheduler] Scraped text:", bodyText)

// //   document.body.style.border = '5px solid red'; // visible change

// //   return bodyText
// // }


// // scrapePageText()
// // // src/content/content.tsx

// // chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
// //     if (message.type === 'SCRAPE_NOW') {
// //       const bodyText = document.body.innerText || ''
// //       console.log('[Content] Scraped text:', bodyText)
  
// //       sendResponse({ text: bodyText })
// //       return true
// //     }
// //   })
// function scrapePage() {
//     // Basic example - customize for specific sites
//     const pageContent = {
//       url: window.location.href,
//       title: document.title,
//       text: document.body.innerText,
//       html: document.documentElement.innerHTML,
//       timestamp: new Date().toISOString()
//     };
    
//     // For specific sites like Gmail
//     if (window.location.hostname.includes('mail.google.com')) {
//       pageContent.emails = Array.from(document.querySelectorAll('.zA')).map(el => ({
//         subject: el.querySelector('.bog')?.textContent,
//         sender: el.querySelector('.zF')?.textContent,
//         snippet: el.querySelector('.y2')?.textContent
//       }));
//     }
    
//     // For Slack
//     if (window.location.hostname.includes('slack.com')) {
//       pageContent.messages = Array.from(document.querySelectorAll('.c-message')).map(el => ({
//         sender: el.querySelector('.c-message__sender')?.textContent,
//         content: el.querySelector('.c-message__body')?.textContent,
//         timestamp: el.querySelector('.c-timestamp')?.textContent
//       }));
//     }
    
//     return pageContent;
//   }
  
//   // Listen for scrape command
//   chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
//     if (request.action === 'scrape') {
//       sendResponse(scrapePage());
//     }
//   });

// content.tsx

function scrapePage() {
    const pageContent: any = {
      url: window.location.href,
      title: document.title,
      text: document.body.innerText,
      html: document.documentElement.innerHTML,
      timestamp: new Date().toISOString(),
    };
  
    if (window.location.hostname.includes("mail.google.com")) {
      pageContent.emails = Array.from(document.querySelectorAll(".zA")).map((el) => ({
        subject: el.querySelector(".bog")?.textContent,
        sender: el.querySelector(".zF")?.textContent,
        snippet: el.querySelector(".y2")?.textContent,
      }));
    }
  
    if (window.location.hostname.includes("slack.com")) {
      pageContent.messages = Array.from(document.querySelectorAll(".c-message")).map((el) => ({
        sender: el.querySelector(".c-message__sender")?.textContent,
        content: el.querySelector(".c-message__body")?.textContent,
        timestamp: el.querySelector(".c-timestamp")?.textContent,
      }));
    }
  
    return pageContent;
  }
  
  // This function must be exported to be used with `chrome.scripting.executeScript`
  export function scrapePageWrapper() {
    return scrapePage();
  }
  