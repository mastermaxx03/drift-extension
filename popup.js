// popup.js
document.addEventListener("DOMContentLoaded", function () {
  const activateButton = document.getElementById("activateButton");
  const statusMessage = document.getElementById("statusMessage");

  const driftMinutesInput = document.getElementById("driftMinutesInput");
  const driftSecondsInput = document.getElementById("driftSecondsInput");
  const saveSettingsButton = document.getElementById("saveSettingsButton");
  const settingsStatusMessage = document.getElementById(
    "settingsStatusMessage"
  );

  const DEFAULT_TOTAL_SECONDS = 15; // Default to 15 seconds
  const MINIMUM_TOTAL_SECONDS = 5; // Minimum allowed drift time in seconds

  // Load saved settings when popup opens
  chrome.storage.local.get(
    ["focusTabId", "focusTabUrl", "totalDriftSeconds"],
    function (result) {
      if (result.focusTabId && result.focusTabUrl) {
        statusMessage.textContent = `Drift is active on: ${result.focusTabUrl.substring(
          0,
          50
        )}...`;
      } else {
        statusMessage.textContent = "Drift is inactive.";
      }

      let currentTotalSeconds = result.totalDriftSeconds;
      if (
        typeof currentTotalSeconds !== "number" ||
        isNaN(currentTotalSeconds)
      ) {
        currentTotalSeconds = DEFAULT_TOTAL_SECONDS;
      }

      driftMinutesInput.value = Math.floor(currentTotalSeconds / 60);
      driftSecondsInput.value = currentTotalSeconds % 60;
    }
  );

  activateButton.addEventListener("click", function () {
    // ... (activation logic remains the same as before) ...
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
            console.error(
              "Error setting focus tab storage:",
              chrome.runtime.lastError
            );
            statusMessage.textContent = "Error activating Drift.";
          } else {
            console.log(`Drift activated on tab ${tabId} with URL ${tabUrl}`);
            statusMessage.textContent = `Drift activated on: ${tabUrl.substring(
              0,
              50
            )}...`;

            chrome.runtime.sendMessage(
              {
                action: "startMonitoring",
                tabId: tabId,
                tabUrl: tabUrl,
              },
              function (response) {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error sending startMonitoring message:",
                    chrome.runtime.lastError.message
                  );
                } else if (response && response.status) {
                  console.log(
                    "Message response from background:",
                    response.status
                  );
                }
              }
            );
          }
        }
      );
    });
  });

  saveSettingsButton.addEventListener("click", function () {
    const minutes = parseInt(driftMinutesInput.value, 10);
    const seconds = parseInt(driftSecondsInput.value, 10);

    if (
      isNaN(minutes) ||
      minutes < 0 ||
      isNaN(seconds) ||
      seconds < 0 ||
      seconds > 59
    ) {
      settingsStatusMessage.textContent =
        "Please enter valid numbers (minutes >= 0, seconds 0-59).";
      settingsStatusMessage.style.color = "red";
      return;
    }

    const totalDriftSeconds = minutes * 60 + seconds;

    if (totalDriftSeconds < MINIMUM_TOTAL_SECONDS) {
      settingsStatusMessage.textContent = `Minimum drift time is ${MINIMUM_TOTAL_SECONDS} seconds.`;
      settingsStatusMessage.style.color = "red";
      return;
    }

    chrome.storage.local.set(
      { totalDriftSeconds: totalDriftSeconds },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error saving settings:", chrome.runtime.lastError);
          settingsStatusMessage.textContent = "Error saving settings.";
          settingsStatusMessage.style.color = "red";
        } else {
          console.log(`Drift duration saved: ${totalDriftSeconds} seconds.`);
          settingsStatusMessage.textContent = "Settings saved!";
          settingsStatusMessage.style.color = "green";
          setTimeout(() => {
            settingsStatusMessage.textContent = "";
          }, 3000);
        }
      }
    );
  });
});
