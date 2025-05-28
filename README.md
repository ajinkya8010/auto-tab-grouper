# 🔖 Tab Grouper – Smart Tab Organizer using LLM

Tab Grouper is a Chrome extension that intelligently organizes your open tabs into semantic groups using a Language Model (LLM). With a single click, it classifies your tabs into meaningful categories like “AI Tools”, “News”, “Docs”, “Entertainment”, and more — all based on tab titles, URLs, and embedded page metadata like keywords and descriptions. Note that it can also be used with brave browser but with some limitations

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
- ✅ Has two modes, aggressive grouping and passive grouping

---

## 🧠 How It Works

1. Reads tab title, URL, and metadata (keywords + description).
2. Sends this info to an LLM (Mistral) using your API key.
3. Gets back suggested group assignments (e.g. `{ tabId: 1, groupName: "Learning" }`).
4. Uses the Chrome Tab Groups API to apply these labels and colors.

All intelligence is handled in-browser via Chrome’s extension APIs.

---

## 📸 Demo

![Tab Grouper demo](./assets/tab-grouper.gif)

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

1. Open multiple tabs (e.g., blogs, AI tools, docs, news, etc.)
2. Click the extension icon
3. Choose a mode:
4. Aggressive Grouping – Every tab is grouped, even solo ones
5. Passive Grouping – Only tabs with clear companions are grouped
6. Optionally, delete all groups using the 🗑️ button
7. Your tabs are grouped smartly in real time

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

## 🧠 LLM Prompt Strategy

- Tabs are grouped by semantic similarity, not just keywords.
- Built-in prompt ensures group reuse (≥80% similarity), avoids overfitting.
- Uses few-shot logic to improve grouping accuracy.

---

## ⚙️ Features

- ✅ One-click tab grouping
- ✅ Mistral API integration
- ✅ Real tab metadata parsing
- ✅ Reuses or creates smart group names
- ✅ Fast + efficient with caching
- ✅ No external server required

---

## 🙌 Credits

Developed with 💻 by [Ajinkya Walunj](https://github.com/ajinkya8010)  
Prompt Engineering + Tab UX Inspired by real-life browser chaos 😅