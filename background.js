const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'groupTabs') {
    groupTabs(message.tabs, message.existingGroups, message.groupingMode)
      .then(result => sendResponse({ success: true }))
      .catch(error => {
        console.error('Error in groupTabs:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async sendResponse
  } else if (message.action === 'deleteAllGroups') {
    deleteAllGroups()
      .then(result => sendResponse({ success: true }))
      .catch(error => {
        console.error('Error in deleteAllGroups:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

/**
 * Main function to analyze tabs and group them
 */
async function groupTabs(tabs, existingGroups, groupingMode = 'passive') {
  try {
    // Step 1: Get group assignments from LLM
    const groupAssignments = await getGroupAssignmentsFromLLM(tabs, existingGroups, groupingMode);
    
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
 * Delete all tab groups in the current window
 */
async function deleteAllGroups() {
  try {
    const windows = await chrome.windows.getCurrent();
    const windowId = windows.id;
    
    // Get all existing groups
    const existingGroups = await chrome.tabGroups.query({ windowId });
    
    // Ungroup all tabs from each group
    for (const group of existingGroups) {
      const groupedTabs = await chrome.tabs.query({ groupId: group.id });
      if (groupedTabs.length > 0) {
        const tabIds = groupedTabs.map(tab => tab.id);
        await chrome.tabs.ungroup(tabIds);
      }
    }
    
    console.log(`Deleted ${existingGroups.length} tab groups`);
    return true;
  } catch (error) {
    console.error('Error deleting all groups:', error);
    throw error;
  }
}

/**
 * Call the LLM to determine appropriate tab groupings
 */
async function getGroupAssignmentsFromLLM(tabs, existingGroups, groupingMode) {
  try {
    const storage = await chrome.storage.local.get(['mistralApiKey']);
    const MISTRAL_API_KEY = storage.mistralApiKey;
    console.log(`[Background] Using Mistral API key: ${MISTRAL_API_KEY}`);
    
    if (!MISTRAL_API_KEY) throw new Error("Mistral API key not set!");

    // Build system prompt based on grouping mode
    const baseSystemPrompt = `
You are an AI assistant that categorizes browser tabs based on their title, URL, description, and keyword content.

Your task is to group tabs into meaningful categories that reflect their main purpose or theme.

### 🎯 Preferred Category Anchors
If in doubt, prefer these broad useful buckets:
"AI Tools", "Social Media", "Productivity", "Entertainment", "Learning", "Coding", "Docs", "News", "Company Websites", "E-commerce", "Search", "Chat", "Blog", "Dev Tools", "Communication", "Design", "Finance", "Health", "Travel", "Gaming"

🧠 GENERAL GROUPING GUIDELINES
1. Only group tabs when they clearly share a common theme, purpose, or activity.
2. If a tab fits an existing group name (≥80% semantic similarity), assign it to that group.
3. Otherwise, create a new **descriptive** and **concise** group name (1–3 words max).
4. Group names must reflect the topic, not just the website (e.g. "Music", not "YouTube").
5. Do not create a group based on platform alone — two YouTube or Medium tabs may belong to different groups.
6. Avoid using exact tab titles as group names. Use general, descriptive terms and generalize when possible.
7. Use "AI Tools", "Productivity", "Docs", "Entertainment", etc. — not "ChatGPT", "Jira", or "YouTube".
8. Tabs from platforms like YouTube, Medium, Gmail, Notion, or GitHub must be grouped based on content purpose.
9. Group similar tools or platforms under functional themes. Examples:
   - ChatGPT, Groq, Gemini → **"AI Tools"**
   - LinkedIn, WhatsApp, Gmail → **"Communication"** or **"Social Media"**
   - Medium, YouTube, Blogs → **"Content"**
10. If no obvious group is present (and you're in passive mode), label the tab with groupName: "UNGROUP".
11. Output must be a **JSON array** of objects with format: { "tabId": <number>, "groupName": "<string>" }
12. Do not include any commentary or additional text — return only the JSON array.
13. Reuse existing group names from this list (≥80% similarity): \${existingGroups.length > 0 ? existingGroups.join(', ') : 'None'}
`;

    let modeSpecificPrompt = '';
    
    if (groupingMode === 'aggressive') {
      modeSpecificPrompt = `
### 🔥 AGGRESSIVE MODE - Every Tab Must Be Grouped
- **MANDATORY**: Every single tab MUST be assigned to a group. No exceptions.
- Create groups even for single tabs if necessary (e.g., "GitHub", "YouTube", "Gmail").
- If a tab doesn't fit existing categories, create a new specific group for it.
- Prefer creating more granular groups rather than leaving tabs ungrouped.
- Examples of solo groups: "Wikipedia", "Stack Overflow", "Netflix", "Amazon"
`;
    } else {
      modeSpecificPrompt = `
### 🎯 PASSIVE MODE - Only Group Clear Relationships
- Group only when there are at least 2 or more tabs that clearly share a theme or purpose.
- Do NOT create a group that contains only a single tab.
- Assign any tab that does not share a theme with any other tab to groupName: "UNGROUP".
- Be conservative - only create groups when there's obvious thematic connection.
- Prefer quality groupings over quantity. Better to have fewer, more meaningful groups.
- Use "UNGROUP" for tabs that don't have clear companions.
`;
    }

    const systemPrompt = baseSystemPrompt + modeSpecificPrompt + `

📦 Example 1:
Input:
[
  { "tabId": 1, "title": "ChatGPT - OpenAI", "url": "https://chat.openai.com" },
  { "tabId": 2, "title": "Groq - AI Inference", "url": "https://groq.com" },
  { "tabId": 3, "title": "YouTube - React Crash Course", "url": "https://youtube.com/watch?v=abc123" }
]

Output:
[
  { "tabId": 1, "groupName": "AI Tools" },
  { "tabId": 2, "groupName": "AI Tools" },
  { "tabId": 3, "groupName": "Learning" }
]

📦 Example 2:
Input:
[
  { "tabId": 4, "title": "Medium - Top 10 Books", "url": "https://medium.com" },
  { "tabId": 5, "title": "YouTube - Chill Jazz", "url": "https://youtube.com" }
]

Output:
[
  { "tabId": 4, "groupName": "Entertainment" },
  { "tabId": 5, "groupName": "Entertainment" }
]

📦 Example 3:
Input:
[
  { "tabId": 6, "title": "Jira - Sprint Board", "url": "https://jira.company.com" },
  { "tabId": 7, "title": "Keka - Leave Management", "url": "https://keka.com" }
]

Output:
[
  { "tabId": 6, "groupName": "Productivity" },
  { "tabId": 7, "groupName": "Productivity" }
]

📦 Example 4:
Input:
[
  { "tabId": 8, "title": "Gmail - Inbox", "url": "https://mail.google.com" },
  { "tabId": 9, "title": "Netflix - Stranger Things", "url": "https://netflix.com" }
]

Output:
[
  \${groupingMode === 'aggressive' ? \`{ "tabId": 8, "groupName": "Communication" },
  { "tabId": 9, "groupName": "Entertainment" }\` : \`{ "tabId": 8, "groupName": "UNGROUP" },
  { "tabId": 9, "groupName": "UNGROUP" }\`}
]

Now analyze the following tabs and assign a \`groupName\` to each:
`;

    const llmInput = {
      model: "mistral-large-latest",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt
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
    
    // Filter out UNGROUP assignments for passive mode
    const filteredAssignments = groupAssignments.filter(assignment => 
      assignment.groupName !== "UNGROUP"
    );

    if (groupingMode === 'passive') {
      const groupCounts = {};
      for (const item of filteredAssignments) {
        groupCounts[item.groupName] = (groupCounts[item.groupName] || 0) + 1;
      }

      return filteredAssignments.filter(
        item => item.groupName !== 'UNGROUP' && groupCounts[item.groupName] >= 2
      );
      } 
    
    return filteredAssignments;
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

  let i = 0;
  const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
  
  // Create new groups for any that don't exist yet
  for (const groupName of uniqueGroups) {
    if (!groupMap[groupName]) {
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