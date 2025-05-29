/*
 * Enhanced Popup Script - Tab Grouping Assistant Extension
 *
 * Description:
 * This script runs in the popup of a Chrome extension. It provides multiple grouping modes:
 * - Aggressive: Every tab gets grouped, even solo ones 
 * - Passive: Only clearly related tabs are grouped, others stay free
 * - Delete All Groups: Removes all tab groups and ungroups tabs
 *
 * Main Flow:
 * - Waits for the DOM to load and attaches listeners to all buttons
 * - On grouping button click:
 *    1. Disables all buttons and shows loading spinner
 *    2. Retrieves all tabs in the current Chrome window
 *    3. Retrieves any existing tab groups to avoid duplication or reuse group names
 *    4. Extracts necessary info from each tab (id, title, URL, keywords, description)
 *    5. Sends tab data with grouping mode to the background script
 *    6. Receives grouping results and shows status to the user
 *    7. Re-enables buttons and hides spinner
 *
 * Features:
 * - Two grouping modes with different strategies
 * - Bulk group deletion functionality
 * - Enhanced UI with better visual feedback
 * - Improved error handling and status messages
 *
 * Author: Ajinkya Walunj (Enhanced)
 * Date: 2025-05-28
 */

document.addEventListener('DOMContentLoaded', () => {
  
  const aggressiveGroupBtn = document.getElementById('aggressiveGroup');
  const passiveGroupBtn = document.getElementById('passiveGroup');
  const deleteAllGroupsBtn = document.getElementById('deleteAllGroups');
  const statusElement = document.getElementById('status');
  const spinner = document.getElementById('spinner');

  // Check if API key is set
  chrome.storage.local.get('mistralApiKey', (data) => {
    const apiKey = data.mistralApiKey;

    if (!apiKey) {
      // If key is not set, hide grouping buttons and show setup message
      document.getElementById('mainUI').style.display = 'none';
      document.body.innerHTML += `
        <div style="
          background-color: #fff8e1;
          border: 1px solid #ffecb3;
          color: #6d4c41;
          padding: 16px;
          border-radius: 8px;
          font-family: 'Segoe UI', sans-serif;
          max-width: 240px;
          margin: 20px auto;
          text-align: center;
          font-size: 14px;
        ">
          <p style="margin-bottom: 10px;">Please set your API key first</p>
          <a href="options.html" target="_blank" style="color: #d17b00; text-decoration: underline;">
            Click here to set your Mistral API key
          </a>
        </div>
      `;

      return;
    }

    // Set up event listeners for grouping buttons if API key exists
    setupGroupingListeners();
  });

  // Always enable delete groups functionality
  deleteAllGroupsBtn.addEventListener('click', handleDeleteAllGroups);

  function setupGroupingListeners() {
    aggressiveGroupBtn.addEventListener('click', () => handleGroupTabs('aggressive'));
    passiveGroupBtn.addEventListener('click', () => handleGroupTabs('passive'));
  }

  async function handleGroupTabs(mode) {
    try {
      setLoadingState(true);
      statusElement.textContent = 'Analyzing tabs...';
      statusElement.className = '';

      const tabs = await chrome.tabs.query({ currentWindow: true });
      const existingGroups = await chrome.tabGroups.query({ windowId: tabs[0].windowId });
      const existingGroupNames = existingGroups.map(group => group.title);

      // Filter only ungrouped tabs
      const ungroupedTabs = tabs.filter(tab => tab.groupId === -1);
      
      if (ungroupedTabs.length === 0) {
        statusElement.textContent = 'No ungrouped tabs to organize!';
        statusElement.className = 'status-error';
        setLoadingState(false);
        return;
      }

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

      // Extract tab information with metadata
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

      const modeText = mode === 'aggressive' ? 'aggressively grouping' : 'selectively grouping';
      statusElement.textContent = `Hang tight! AI is ${modeText} your tabs...`;

      chrome.runtime.sendMessage({
        action: 'groupTabs',
        tabs: tabsInfo,
        existingGroups: existingGroupNames,
        groupingMode: mode
      }, (response) => {
        if (response && response.success) {
          const successText = mode === 'aggressive' 
            ? 'All tabs grouped successfully!' 
            : 'Related tabs grouped successfully!';
          statusElement.textContent = successText;
          statusElement.className = 'status-success';
        } else {
          console.error('[Popup] Error from background:', response?.error);
          statusElement.textContent = `${response?.error || 'Error grouping tabs'}`;
          statusElement.className = 'status-error';
        }

        setLoadingState(false);
        clearStatusAfterDelay();
      });

    } catch (error) {
      console.error('[Popup] Error in popup script:', error);
      statusElement.textContent = `Error: ${error.message}`;
      statusElement.className = 'status-error';
      setLoadingState(false);
      clearStatusAfterDelay();
    }
  }

  async function handleDeleteAllGroups() {
    try {
      setLoadingState(true, false); // Don't disable delete button for this action
      statusElement.textContent = 'Removing all tab groups...';
      statusElement.className = '';

      chrome.runtime.sendMessage({
        action: 'deleteAllGroups'
      }, (response) => {
        if (response && response.success) {
          statusElement.textContent = 'All groups deleted successfully!';
          statusElement.className = 'status-success';
        } else {
          console.error('[Popup] Error deleting groups:', response?.error);
          statusElement.textContent = `${response?.error || 'Error deleting groups'}`;
          statusElement.className = 'status-error';
        }

        setLoadingState(false);
        clearStatusAfterDelay();
      });

    } catch (error) {
      console.error('[Popup] Error deleting groups:', error);
      statusElement.textContent = `Error: ${error.message}`;
      statusElement.className = 'status-error';
      setLoadingState(false);
      clearStatusAfterDelay();
    }
  }

  function setLoadingState(loading, disableDelete = true) {
    aggressiveGroupBtn.disabled = loading;
    passiveGroupBtn.disabled = loading;
    if (disableDelete) {
      deleteAllGroupsBtn.disabled = loading;
    }
    
    if (loading) {
      spinner.style.display = 'block';
    } else {
      spinner.style.display = 'none';
    }
  }

  function clearStatusAfterDelay() {
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = '';
    }, 4000);
  }

});