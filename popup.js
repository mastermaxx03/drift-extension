document.addEventListener("DOMContentLoaded", function () {
  const activateButton = document.getElementById("activateButton");
  const statusMessage = document.getElementById("statusMessage");

  // Check initial state when popup opens (optional, for later)
  // chrome.storage.local.get(['focusTabId', 'focusTabUrl'], function(result) {
  //   if (result.focusTabId) {
  //     statusMessage.textContent = `Drift is active on: ${result.focusTabUrl}`;
  //     activateButton.textContent = 'Deactivate Drift'; // Basic toggle idea
  //   } else {
  //     statusMessage.textContent = 'Drift is inactive.';
  //   }
  // });

  activateButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length === 0) {
        console.error("No active tab found.");
        statusMessage.textContent = "Error: No active tab found.";
        return;
      }
      const currentTab = tabs[0];
      const tabId = currentTab.id;
      const tabUrl = currentTab.url;

      chrome.storage.local.set(
        { focusTabId: tabId, focusTabUrl: tabUrl },
        function () {
          if (chrome.runtime.lastError) {
            console.error("Error setting storage:", chrome.runtime.lastError);
            statusMessage.textContent = "Error activating Drift.";
          } else {
            console.log(`Drift activated on tab ${tabId} with URL ${tabUrl}`);
            statusMessage.textContent = `Drift activated on: ${tabUrl.substring(
              0,
              100
            )}`;

            // ---> ADD THIS LINE <---
            chrome.runtime.sendMessage(
              {
                action: "startMonitoring",
                tabId: tabId,
                tabUrl: tabUrl,
              },
              function (response) {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error sending message:",
                    chrome.runtime.lastError.message
                  );
                } else if (response && response.status) {
                  console.log(
                    "Message response from background:",
                    response.status
                  );
                } else {
                  console.log(
                    "No specific response or error from background for startMonitoring."
                  );
                }
              }
            ); // Show part of the URL
            // activateButton.textContent = 'Deactivate Drift'; // For future toggle

            // TODO: Send a message to background.js to start monitoring this tabId
            // For now, we're just saving it.
          }
        }
      );
    });
  });
});
