document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
  
    // Load saved key on page load
    chrome.storage.local.get('mistralApiKey', (data) => {
      if (data.mistralApiKey) {
        apiKeyInput.value = data.mistralApiKey;
      }
    });
  
    saveBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        status.textContent = 'API key cannot be empty.';
        status.style.color = 'red';
        return;
      }
  
      // Save the API key
      chrome.storage.local.set({ mistralApiKey: key }, () => {
        status.textContent = 'API key saved successfully!';
        status.style.color = 'green';
  
        // Clear the status message after 3 seconds
        setTimeout(() => {
          status.textContent = '';
        }, 3000);
      });
    });
  });
  