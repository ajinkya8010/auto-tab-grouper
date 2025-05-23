# 🔖 Tab Grouper – Smart Tab Organizer using LLM

Tab Grouper is a Chrome extension that intelligently organizes your open tabs into semantic groups using a Language Model (LLM). With a single click, it classifies your tabs into meaningful categories like “AI Tools”, “News”, “Docs”, “Entertainment”, and more — all based on tab titles, URLs, and embedded page metadata like keywords and descriptions.

> Powered by the Mistral API. No server required — just your API key.

---

## 🚀 Why Tab Grouper?

Managing dozens of open tabs is overwhelming. Traditional tab managers only allow manual organization or keyword-based grouping.

Tab Grouper:
- ✅ Understands content semantically (e.g., ChatGPT + Groq → “AI Tools”)  
- ✅ Reads from page-level metadata for better accuracy  
- ✅ Automatically uses and reuses tab groups inside your browser  
- ✅ Requires no backend — just plug in your API key and go  
- ✅ Works locally and respects your privacy

---

## 🧠 How It Works

1. Reads tab title, URL, and metadata (keywords + description).
2. Sends this info to an LLM (Mistral) using your API key.
3. Gets back suggested group assignments (e.g. `{ tabId: 1, groupName: "Learning" }`).
4. Uses the Chrome Tab Groups API to apply these labels and colors.

All intelligence is handled in-browser via Chrome’s extension APIs.

---

## 📸 Demo

> Add a GIF or screenshot here showing tabs being grouped after clicking the extension.

---

## 🛠 Setup & Installation

### 1. Clone or Download

```bash
git clone https://github.com/ajinkya8010/auto-tab-grouper.git
cd auto-tab-grouper
```

## 🔧 2. Load the Extension

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the project directory

---

## 🔑 3. Set Your Mistral API Key

1. Click the extension → “Click here to set your Mistral API key”
2. Or go to:  
   `chrome-extension://<EXTENSION-ID>/options.html`
3. Paste your API key from [https://mistral.ai](https://mistral.ai) and click Save

---

## 💡 How to Use

1. Open multiple tabs (news, AI tools, blogs, GitHub, etc.)
2. Click the “Tab Grouper” extension icon.
3. Press the “Group Tabs” button.
4. ✅ Done! Tabs are organized into Chrome groups (with colors and titles).

---

## 🔐 Privacy & Security

- Your API key is stored locally in Chrome storage and never sent to any third-party server.
- Tab content is only accessed to read metadata (`<meta name="keywords">`, `<meta name="description">`)
- Only ungrouped tabs are processed; existing groupings remain intact.

---

## 🧩 Technologies Used

- Chrome Extensions API (Manifest V3)
- Chrome Tab Groups API
- Chrome Storage API
- Mistral LLM API
- HTML, JavaScript

---

## 📁 Project Structure

📦 tab-grouper/
├── popup.html ← UI shown when extension icon is clicked
├── popup.js ← Handles DOM + tab extraction + LLM messaging
├── options.html ← Page to configure API key
├── options.js ← Saves/retrieves API key using chrome.storage
├── background.js ← Calls LLM, handles tab group creation
├── manifest.json ← Chrome extension config

## 🧠 LLM Prompt Strategy

- Tabs are grouped by semantic similarity, not just keywords.
- Built-in prompt ensures group reuse (≥80% similarity), avoids overfitting.
- Uses few-shot logic to improve grouping accuracy.
- Examples: GitHub AI repo ≠ ChatGPT → handled with nuance.

---

## ⚙️ Features

- ✅ One-click tab grouping
- ✅ Mistral API integration
- ✅ Real tab metadata parsing
- ✅ Reuses or creates smart group names
- ✅ Fast + efficient with caching
- ✅ No external server required



## 🙌 Credits

Developed with 💻 by [Ajinkya Walunj](https://github.com/ajinkya8010)  
Prompt Engineering + Tab UX Inspired by real-life browser chaos 😅