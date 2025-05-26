const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'groupTabs') {
    groupTabs(message.tabs, message.existingGroups)
      .then(result => sendResponse({ success: true }))
      .catch(error => {
        console.error('Error in groupTabs:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  }
});

/**
 * Main function to analyze tabs and group them
 */
async function groupTabs(tabs, existingGroups) {
  try {
    // Step 1: Get group assignments from LLM
    const groupAssignments = await getGroupAssignmentsFromLLM(tabs, existingGroups);
    
    // Step 2: Create new tab groups and get references to existing ones
    const groupMap = await setupTabGroups(groupAssignments);
    
    // Step 3: Assign each tab to its proper group
    await assignTabsToGroups(tabs, groupAssignments, groupMap);
    
    return true;
  } catch (error) {
    console.error('Error in tab grouping process:', error);
    throw error;
  }
}

/**
 * Call the LLM to determine appropriate tab groupings
 */
async function getGroupAssignmentsFromLLM(tabs, existingGroups) {
  try {
    const storage = await chrome.storage.local.get(['mistralApiKey']);
    const MISTRAL_API_KEY = storage.mistralApiKey;
    console.log(`[Background] Using Mistral API key: ${MISTRAL_API_KEY}`);
    
    if (!MISTRAL_API_KEY) throw new Error("Mistral API key not set!");
    const llmInput = {
      model: "mistral-large-latest",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
    You are an AI assistant that categorizes browser tabs based on their title, URL, description, and keyword content.
    
    Your task is to group tabs into meaningful, **broad yet specific categories** that reflect their main purpose or theme.
    
    ### 🧠 Grouping Rules
    1. Use broad categories unless more than 3 tabs clearly belong to the same specific topic, then create a dedicated group for that topic.
    2 If a tab fits an existing group name (≥80% semantic similarity), assign it to that group.
    3. Otherwise, create a new **descriptive** and **concise** group name (1–3 words max).
    4. Avoid using exact tab names as group names. Generalize when possible.
    5. Group similar tools or platforms under functional themes. Examples:
       - ChatGPT, Groq, Gemini → **"AI Tools"**
       - LinkedIn, WhatsApp, Gmail → **"Communication"** or **"Social Media"**
       - Medium, YouTube, Blogs → **"Content"**
    6. Use high-level buckets like: "Learning", "AI Tools", "Coding", "Communication", "Social Media", "Entertainment", "Docs", "Research", "News", etc.
    7. Output must be a **JSON array** of objects with format: { "tabId": <number>, "groupName": "<string>" }
    8. Do not include any commentary or additional text — return only the JSON array.
    9. Reuse group names from: **${existingGroups.length > 0 ? existingGroups.join(', ') : 'None'}**
    
    ### ✅ Few-Shot Examples
    
    **Example 1:**
    
    **Input Tabs:**
    [
      { "tabId": 1, "title": "ChatGPT - OpenAI", "url": "https://chat.openai.com" },
      { "tabId": 2, "title": "Groq - Blazing Fast AI", "url": "https://groq.com" },
      { "tabId": 3, "title": "LinkedIn: Login or Sign Up", "url": "https://linkedin.com" }
    ]
    
    **Output:**
    [
      { "tabId": 1, "groupName": "AI Tools" },
      { "tabId": 2, "groupName": "AI Tools" },
      { "tabId": 3, "groupName": "Social Media" }
    ]
    
    **Example 2:**
    
    **Input Tabs:**
    [
      { "tabId": 4, "title": "YouTube - Travel Vlog", "url": "https://youtube.com/watch?v=xyz" },
      { "tabId": 5, "title": "Medium – 10 Productivity Hacks", "url": "https://medium.com/..." }
    ]
    
    **Output:**
    [
      { "tabId": 4, "groupName": "Entertainment" },
      { "tabId": 5, "groupName": "Content" }
    ]
    
    Now analyze the following tabs and assign a \`groupName\` to each:
    `
        },
        {
          role: "user",
          content: `
    Here are the tabs to group:
    ${JSON.stringify(tabs, null, 2)}
    
    Respond ONLY with a JSON array of objects like: [{ "tabId": ..., "groupName": "..." }]
          `
        }
      ]
    };
    

    // Call the Mistral API
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify(llmInput)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`LLM API error: ${errorData.error?.message || response.statusText}`);
    }

    const responseData = await response.json();
    const groupAssignments = JSON.parse(responseData.choices[0].message.content);
    console.log('LLM response:', groupAssignments);
    if (!Array.isArray(groupAssignments)) {
      throw new Error('Invalid LLM response format');
    }
    
    return groupAssignments;
  } catch (error) {
    console.error('Error calling LLM:', error);
    throw error;
  }
}

/**
 * Create new tab groups and collect references to existing ones
 */
async function setupTabGroups(groupAssignments) {
  // Extract unique group names
  const uniqueGroups = [...new Set(groupAssignments.map(item => item.groupName))];
  
  // Get current window ID
  const windows = await chrome.windows.getCurrent();
  const windowId = windows.id;
  
  // Get existing groups
  const existingGroups = await chrome.tabGroups.query({ windowId });
  
  // Map to hold group IDs by name
  const groupMap = {};
  
  // Add existing groups to the map
  for (const group of existingGroups) {
    if (group.title && uniqueGroups.includes(group.title)) {
      groupMap[group.title] = group.id;
    }
  }

  let i=0;
  const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
  // Create new groups for any that don't exist yet
  for (const groupName of uniqueGroups) {
    if (!groupMap[groupName]) {
      // Choose a random color for the new group
      const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
      // const randomColor = colors[Math.floor(Math.random() * colors.length)];

      
      // Create a new group with a single tab (we'll add the actual tabs later)
      // Find a tab that will be in this group
      const tabInGroup = groupAssignments.find(item => item.groupName === groupName);
      if (tabInGroup) {
        const groupId = await chrome.tabs.group({
          tabIds: [tabInGroup.tabId]
        });
        
        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: colors[i % colors.length] 
          
        });
        
        groupMap[groupName] = groupId;
        i++;
      }
    }
  }
  
  return groupMap;
}

/**
 * Assign each tab to its corresponding group
 */
async function assignTabsToGroups(tabs, groupAssignments, groupMap) {
  const tabGroupMap = {};

  for (const assignment of groupAssignments) {
    const { tabId, groupName } = assignment;
    if (groupMap[groupName]) {
      tabGroupMap[tabId] = groupMap[groupName];
    }
  }

  const groupsToTabIds = {};

  for (const [tabId, groupId] of Object.entries(tabGroupMap)) {
    if (!groupsToTabIds[groupId]) {
      groupsToTabIds[groupId] = [];
    }
    groupsToTabIds[groupId].push(parseInt(tabId));
  }

  for (const [groupId, tabIds] of Object.entries(groupsToTabIds)) {
    const groupIntId = parseInt(groupId);

    // Get all tabs already in that group
    const groupedTabs = await chrome.tabs.query({ groupId: groupIntId });

    const groupedTabIds = groupedTabs.map(tab => tab.id);
    const newTabs = tabIds.filter(id => !groupedTabIds.includes(id));

    if (newTabs.length > 0) {
      await chrome.tabs.group({
        tabIds: newTabs,
        groupId: groupIntId
      });
      console.log(`Grouped tabs ${newTabs.join(', ')} into group ${groupId}`);
    } else {
      console.log(`No new tabs to group into group ${groupId}`);
    }
  }
}
