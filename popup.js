/*
 * Popup Script - Tab Grouping Assistant Extension
 *
 * Description:
 * This script runs in the popup of a Chrome extension. It allows the user to
 * automatically group open tabs in the current window based on their content
 * (title,URL, keywords and description), with the help of an LLM (Language Model) via the background script.
 *
 * Main Flow:
 * - Waits for the DOM to load and attaches a click listener to the "Group Tabs" button.
 * - On click:
 *    1. Disables the button and shows a loading spinner.
 *    2. Retrieves all tabs in the current Chrome window.
 *    3. Retrieves any existing tab groups to avoid duplication or reuse group names.
 *    4. Extracts necessary info from each tab (id, title, and URL).
 *    5. Sends tab data to the background script to process via an LLM.
 *    6. Receives grouping instructions from the background script and shows status to the user.
 *    7. Re-enables the button and hides the spinner.
 *
 * Assumptions:
 * - The background script handles LLM interaction and tab grouping logic.
 * - A `groupTabs` button, `status` text area, and `spinner` element exist in the popup HTML.
 * - The extension has the "tabs" and "tabGroups" permissions.
 *
 * Author: Ajinkya Walunj
 * Date: 2025-05-21
 */



document.addEventListener('DOMContentLoaded', () => {
  const groupTabsButton = document.getElementById('groupTabs');
  const statusElement = document.getElementById('status');
  const spinner = document.getElementById('spinner');

  chrome.storage.local.get('mistralApiKey', (data) => {
    const apiKey = data.mistralApiKey;

    if (!apiKey) {
      // If key is not set, we show message and hide group button
      groupTabsButton.style.display = 'none';
      statusElement.innerHTML = `
        <div style="
          background-color: #fff8e1;
          border: 1px solid #ffecb3;
          color: #6d4c41;
          padding: 16px;
          border-radius: 8px;
          font-family: 'Segoe UI', sans-serif;
          max-width: 400px;
          margin: 20px auto;
          text-align: center;
        ">
          <p style="font-size: 16px; margin: 0 0 10px;">
            Please set your API key first
          </p>
          <a href="options.html" target="_blank" style="
            color: #d17b00;
            font-weight: 500;
            text-decoration: underline;
          ">
            Click here to set your Mistral API key
          </a>
        </div>
      `;
      return;
    }
    

  groupTabsButton.addEventListener('click', async () => {
    try {
      groupTabsButton.disabled = true;
      spinner.style.display = 'block';
      statusElement.textContent = 'Analyzing tabs...';

      const tabs = await chrome.tabs.query({ currentWindow: true });

      const existingGroups = await chrome.tabGroups.query({ windowId: tabs[0].windowId });

      const existingGroupNames = existingGroups.map(group => group.title);

      // Helper to check if URL is safe to inject script into
      const isInjectableUrl = (url) => {
        return url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('file://');
      };

      // Function to extract meta keywords and description with 2-second timeout
      const getMetaTags = (tabId) => {
        return new Promise((resolve) => {
          let isResolved = false;

          const timeoutId = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              resolve({ keywords: '', description: '' });
            }
          }, 2000);

          chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const metas = document.getElementsByTagName('meta');
              let keywords = '';
              let description = '';
              for (let meta of metas) {
                const name = meta.getAttribute('name');
                if (name === 'keywords') {
                  keywords = meta.getAttribute('content') || '';
                }
                if (name === 'description') {
                  description = meta.getAttribute('content') || '';
                }
              }
              return { keywords, description };
            }
          }, (results) => {
            if (!isResolved) {
              clearTimeout(timeoutId);
              isResolved = true;
              if (chrome.runtime.lastError || !results || !results[0]) {
                console.warn(`[Popup] Meta tag extraction failed for tab ${tabId}`, chrome.runtime.lastError);
                resolve({ keywords: '', description: '' });
              } else {
                resolve(results[0].result);
              }
            }
          });
        });
      };
      const ungroupedTabs = tabs.filter(tab => tab.groupId === -1);
      // Only try to get meta tags from tabs with injectable URLs
      const tabsInfo = await Promise.all(ungroupedTabs.map(async (tab) => {
        if (!isInjectableUrl(tab.url)) {
          return {
            id: tab.id,
            title: tab.title || '',
            url: tab.url || '',
            keywords: '',
            description: ''
          };
        }
        const meta = await getMetaTags(tab.id);
        return {
          id: tab.id,
          title: tab.title || '',
          url: tab.url || '',
          keywords: meta.keywords,
          description: meta.description
        };
      }));

      statusElement.textContent = 'Hang tight! Grouping tabs...';

      chrome.runtime.sendMessage({
        action: 'groupTabs',
        tabs: tabsInfo,
        existingGroups: existingGroupNames
      }, (response) => {

        if (response && response.success) {
          statusElement.textContent = 'Tabs grouped successfully!';
        } else {
          console.error('[Popup] Error from background:', response?.error);
          statusElement.textContent = response?.error || 'Error grouping tabs';
        }

        groupTabsButton.disabled = false;
        spinner.style.display = 'none';

        setTimeout(() => {
          statusElement.textContent = '';
        }, 3000);
      });

    } catch (error) {
      console.error('[Popup] Error in popup script:', error);
      statusElement.textContent = 'Error: ' + error.message;
      groupTabsButton.disabled = false;
      spinner.style.display = 'none';
    }
  });
});
});
