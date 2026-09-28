// background.js - SideNote Pro Service Worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sidenote_append_selection",
    title: "Save selection to SideNote",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sidenote_append_selection" && info.selectionText && tab && tab.url) {
    try {
      const urlObj = new URL(tab.url);
      const domain = urlObj.hostname || "global";
      const key = `note_${domain}`;

      const res = await chrome.storage.local.get([key]);
      const existing = res[key] || "";
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const snippet = `\n\n> ${info.selectionText.trim()}\n*Captured at ${timestamp} from [${urlObj.pathname}](${tab.url})*\n`;
      
      const updated = existing ? existing + snippet : snippet.trim();
      await chrome.storage.local.set({ [key]: updated });
    } catch (err) {
      console.error("Failed to append selection to SideNote:", err);
    }
  }
});
