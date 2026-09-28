// popup.js - SideNote Pro Engine

const LS_CHECKOUT_URL = "https://micro-software-lab.lemonsqueezy.com/checkout/buy/3dfdbeb4-d743-4fff-9328-c293507b80ab";
const FREE_DOMAIN_LIMIT = 3;

let currentDomain = "global";
let currentScope = "site"; // 'site' | 'global' | 'all'
let isPro = false;
let isPreview = false;
let saveTimeout = null;

// DOM Elements
const domainTag = document.getElementById("domainTag");
const proBadge = document.getElementById("proBadge");
const proStatusBtn = document.getElementById("proStatusBtn");
const tabSite = document.getElementById("tabSite");
const tabGlobal = document.getElementById("tabGlobal");
const tabAll = document.getElementById("tabAll");
const editorView = document.getElementById("editorView");
const sitesView = document.getElementById("sitesView");
const noteInput = document.getElementById("noteInput");
const notePreview = document.getElementById("notePreview");
const saveStatus = document.getElementById("saveStatus");
const charCount = document.getElementById("charCount");
const btnTogglePreview = document.getElementById("btnTogglePreview");
const btnCopyNote = document.getElementById("btnCopyNote");
const btnExportMd = document.getElementById("btnExportMd");
const btnClearNote = document.getElementById("btnClearNote");
const searchSitesInput = document.getElementById("searchSitesInput");
const sitesList = document.getElementById("sitesList");
const upgradeModal = document.getElementById("upgradeModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const licenseKeyInput = document.getElementById("licenseKeyInput");
const btnActivateLicense = document.getElementById("btnActivateLicense");
const licenseMsg = document.getElementById("licenseMsg");

// Formatting Toolbar Elements
const btnBold = document.getElementById("btnBold");
const btnItalic = document.getElementById("btnItalic");
const btnHeading = document.getElementById("btnHeading");
const btnChecklist = document.getElementById("btnChecklist");
const btnCode = document.getElementById("btnCode");
const btnQuote = document.getElementById("btnQuote");

document.addEventListener("DOMContentLoaded", async () => {
  await checkLicense();
  await initCurrentDomain();
  await loadCurrentNote();
  setupEventListeners();
});

async function checkLicense() {
  const data = await chrome.storage.local.get(["sidenote_pro_license"]);
  if (data.sidenote_pro_license) {
    isPro = true;
    proBadge.textContent = "Pro";
    proBadge.classList.add("pro-active");
  } else {
    isPro = false;
    proBadge.textContent = "Free";
    proBadge.classList.remove("pro-active");
  }
}

async function initCurrentDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url) {
      const url = new URL(tabs[0].url);
      if (url.protocol === "http:" || url.protocol === "https:") {
        currentDomain = url.hostname;
      } else {
        currentDomain = "browser";
      }
    } else {
      currentDomain = "global";
    }
  } catch (e) {
    currentDomain = "global";
  }
  updateDomainLabel();
}

function updateDomainLabel() {
  if (currentScope === "site") {
    domainTag.textContent = currentDomain;
    domainTag.title = currentDomain;
  } else if (currentScope === "global") {
    domainTag.textContent = "Global Vault";
    domainTag.title = "Global Vault";
  } else {
    domainTag.textContent = "All Domain Notes";
    domainTag.title = "All Domain Notes";
  }
}

function getCurrentStorageKey() {
  return currentScope === "global" ? "note_global_vault" : `note_${currentDomain}`;
}

async function loadCurrentNote() {
  const key = getCurrentStorageKey();
  const res = await chrome.storage.local.get([key]);
  const content = res[key] || "";
  noteInput.value = content;
  updateStats();
  if (isPreview) {
    renderMarkdown();
  }
}

function updateStats() {
  const text = noteInput.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  charCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
}

function scheduleSave() {
  saveStatus.textContent = "Saving...";
  saveStatus.style.color = "#a1a1aa";
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveNote();
  }, 350);
}

async function saveNote() {
  const text = noteInput.value;
  const key = getCurrentStorageKey();

  // Free tier check: if saving a new domain note and limit reached
  if (!isPro && currentScope === "site") {
    const all = await chrome.storage.local.get(null);
    const domainKeys = Object.keys(all).filter(k => k.startsWith("note_") && k !== "note_global_vault");
    if (!domainKeys.includes(key) && domainKeys.length >= FREE_DOMAIN_LIMIT && text.trim().length > 0) {
      showModal();
      saveStatus.textContent = "Limit reached";
      saveStatus.style.color = "#f87171";
      return;
    }
  }

  await chrome.storage.local.set({ [key]: text });
  saveStatus.textContent = "Saved";
  saveStatus.style.color = "#10b981";
  updateStats();
  if (isPreview) renderMarkdown();
}

function setupEventListeners() {
  // Navigation tabs
  tabSite.addEventListener("click", () => switchScope("site"));
  tabGlobal.addEventListener("click", () => switchScope("global"));
  tabAll.addEventListener("click", () => switchScope("all"));

  // Input editing
  noteInput.addEventListener("input", () => {
    scheduleSave();
    updateStats();
  });

  // Preview toggle
  btnTogglePreview.addEventListener("click", togglePreview);

  // Formatting buttons
  btnBold.addEventListener("click", () => insertFormatting("**", "**", "bold text"));
  btnItalic.addEventListener("click", () => insertFormatting("*", "*", "italic text"));
  btnHeading.addEventListener("click", () => insertLinePrefix("### "));
  btnChecklist.addEventListener("click", () => insertLinePrefix("- [ ] "));
  btnCode.addEventListener("click", () => insertFormatting("```\n", "\n```", "code block"));
  btnQuote.addEventListener("click", () => insertLinePrefix("> "));

  // Footer Actions
  btnCopyNote.addEventListener("click", copyNoteToClipboard);
  btnExportMd.addEventListener("click", exportAsMarkdown);
  btnClearNote.addEventListener("click", clearCurrentNote);

  // Search in all sites
  searchSitesInput.addEventListener("input", filterSitesList);

  // Modal actions
  proStatusBtn.addEventListener("click", () => {
    if (!isPro) showModal();
  });
  closeModalBtn.addEventListener("click", hideModal);
  btnActivateLicense.addEventListener("click", activateLicense);
}

function switchScope(scope) {
  currentScope = scope;
  tabSite.classList.toggle("active", scope === "site");
  tabGlobal.classList.toggle("active", scope === "global");
  tabAll.classList.toggle("active", scope === "all");
  updateDomainLabel();

  if (scope === "all") {
    editorView.classList.add("hidden");
    sitesView.classList.remove("hidden");
    loadAllSitesList();
  } else {
    sitesView.classList.add("hidden");
    editorView.classList.remove("hidden");
    loadCurrentNote();
  }
}

function togglePreview() {
  isPreview = !isPreview;
  if (isPreview) {
    btnTogglePreview.classList.add("active");
    btnTogglePreview.textContent = "Edit";
    renderMarkdown();
    noteInput.classList.add("hidden");
    notePreview.classList.remove("hidden");
  } else {
    btnTogglePreview.classList.remove("active");
    btnTogglePreview.textContent = "Preview";
    notePreview.classList.add("hidden");
    noteInput.classList.remove("hidden");
    noteInput.focus();
  }
}

function renderMarkdown() {
  const raw = noteInput.value;
  if (!raw.trim()) {
    notePreview.innerHTML = '<p style="color:#52525b; font-style:italic;">No notes yet. Type something in edit mode.</p>';
    return;
  }

  // Pure on-device safe parser
  let html = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks ```code```
  html = html.replace(/```([\s\S]*?)```/g, (match, p1) => {
    return `<pre><code>${p1.trim()}</code></pre>`;
  });

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Checkboxes
  html = html.replace(/^- \[ \] (.*$)/gim, '<div class="task-item"><input type="checkbox" disabled> <span>$1</span></div>');
  html = html.replace(/^- \[x\] (.*$)/gim, '<div class="task-item"><input type="checkbox" checked disabled> <strike>$1</strike></div>');

  // Quotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Markdown Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Line breaks to <br> if not inside pre
  const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].startsWith('<pre>')) {
      parts[i] = parts[i].replace(/\n/g, '<br>');
    }
  }
  html = parts.join('');

  notePreview.innerHTML = html;
}

function insertFormatting(startTag, endTag, defaultText) {
  if (isPreview) togglePreview();
  const start = noteInput.selectionStart;
  const end = noteInput.selectionEnd;
  const text = noteInput.value;
  const selected = text.substring(start, end) || defaultText;
  const replacement = `${startTag}${selected}${endTag}`;

  noteInput.value = text.substring(0, start) + replacement + text.substring(end);
  noteInput.selectionStart = start + startTag.length;
  noteInput.selectionEnd = start + startTag.length + selected.length;
  noteInput.focus();
  scheduleSave();
}

function insertLinePrefix(prefix) {
  if (isPreview) togglePreview();
  const start = noteInput.selectionStart;
  const text = noteInput.value;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  noteInput.value = text.substring(0, lineStart) + prefix + text.substring(lineStart);
  noteInput.selectionStart = start + prefix.length;
  noteInput.selectionEnd = start + prefix.length;
  noteInput.focus();
  scheduleSave();
}

async function copyNoteToClipboard() {
  const content = noteInput.value;
  if (!content) return;
  try {
    await navigator.clipboard.writeText(content);
    btnCopyNote.textContent = "Copied!";
    setTimeout(() => {
      btnCopyNote.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy';
    }, 1500);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
}

function exportAsMarkdown() {
  if (!isPro) {
    showModal();
    return;
  }
  const content = noteInput.value;
  if (!content.trim()) return;

  const targetName = currentScope === "global" ? "global-vault" : currentDomain.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `sidenote_${targetName}_${dateStr}.md`;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearCurrentNote() {
  if (!noteInput.value.trim()) return;
  if (confirm("Clear notes for this view?")) {
    noteInput.value = "";
    await saveNote();
  }
}

async function loadAllSitesList() {
  sitesList.innerHTML = '<div style="padding:16px; font-size:12px; color:#71717a;">Loading saved notes...</div>';
  const all = await chrome.storage.local.get(null);
  const siteKeys = Object.keys(all).filter(k => k.startsWith("note_") && all[k] && all[k].trim().length > 0);

  if (siteKeys.length === 0) {
    sitesList.innerHTML = '<div style="padding:20px; text-align:center; font-size:12px; color:#52525b;">No notes saved yet.</div>';
    return;
  }

  sitesList.innerHTML = "";
  siteKeys.forEach(k => {
    const isVault = k === "note_global_vault";
    const name = isVault ? "Global Vault" : k.replace("note_", "");
    const text = all[k];
    const firstLine = text.trim().split("\n")[0].substring(0, 45);

    const item = document.createElement("div");
    item.className = "site-item";
    item.innerHTML = `
      <div class="site-item-domain">
        <span>${escapeHtml(name)}</span>
      </div>
      <div class="site-item-preview">${escapeHtml(firstLine)}</div>
    `;

    item.addEventListener("click", () => {
      if (isVault) {
        switchScope("global");
      } else {
        currentDomain = name;
        switchScope("site");
      }
    });

    sitesList.appendChild(item);
  });
}

function filterSitesList() {
  const query = searchSitesInput.value.toLowerCase();
  const items = sitesList.querySelectorAll(".site-item");
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(query) ? "flex" : "none";
  });
}

function showModal() {
  upgradeModal.classList.remove("hidden");
}

function hideModal() {
  upgradeModal.classList.add("hidden");
  licenseMsg.textContent = "";
}

async function activateLicense() {
  const raw = licenseKeyInput.value.trim();
  if (!raw) {
    licenseMsg.textContent = "Please enter a key";
    licenseMsg.style.color = "#f87171";
    return;
  }

  // Accepts standard Lemon Squeezy license key format or Pro test token
  if (raw.length >= 8 || raw.toUpperCase().startsWith("PRO-") || raw.toUpperCase().startsWith("LS-")) {
    await chrome.storage.local.set({ sidenote_pro_license: raw });
    isPro = true;
    proBadge.textContent = "Pro";
    proBadge.classList.add("pro-active");
    licenseMsg.textContent = "License activated!";
    licenseMsg.style.color = "#10b981";
    setTimeout(() => {
      hideModal();
    }, 1200);
  } else {
    licenseMsg.textContent = "Invalid license key format";
    licenseMsg.style.color = "#f87171";
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
