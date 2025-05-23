// popup.js
document.addEventListener("DOMContentLoaded", function () {
  const activateButton = document.getElementById("activateButton");
  const statusMessage = document.getElementById("statusMessage");

  // Drift timer inputs
  const driftMinutesInput = document.getElementById("driftMinutesInput");
  const driftSecondsInput = document.getElementById("driftSecondsInput");

  // Video pause timer inputs
  const videoPauseMinutesInput = document.getElementById(
    "videoPauseMinutesInput"
  );
  const videoPauseSecondsInput = document.getElementById(
    "videoPauseSecondsInput"
  );

  const saveSettingsButton = document.getElementById("saveSettingsButton");
  const settingsStatusMessage = document.getElementById(
    "settingsStatusMessage"
  );

  const DEFAULT_DRIFT_TOTAL_SECONDS = 15;
  const DEFAULT_VIDEO_PAUSE_TOTAL_SECONDS = 10;
  const MINIMUM_TOTAL_SECONDS = 5; // Applies to both timers

  // Load saved settings when popup opens
  chrome.storage.local.get(
    [
      "focusTabId",
      "focusTabUrl",
      "totalDriftSeconds",
      "totalVideoPauseSeconds",
    ],
    function (result) {
      // Focus tab status
      if (result.focusTabId && result.focusTabUrl) {
        statusMessage.textContent = `Drift is active on: ${result.focusTabUrl.substring(
          0,
          50
        )}...`;
      } else {
        statusMessage.textContent = "Drift is inactive.";
      }

      // Populate Drift Timer
      let currentDriftTotalSeconds = result.totalDriftSeconds;
      if (
        typeof currentDriftTotalSeconds !== "number" ||
        isNaN(currentDriftTotalSeconds)
      ) {
        currentDriftTotalSeconds = DEFAULT_DRIFT_TOTAL_SECONDS;
      }
      driftMinutesInput.value = Math.floor(currentDriftTotalSeconds / 60);
      driftSecondsInput.value = currentDriftTotalSeconds % 60;

      // Populate Video Pause Timer
      let currentVideoPauseTotalSeconds = result.totalVideoPauseSeconds;
      if (
        typeof currentVideoPauseTotalSeconds !== "number" ||
        isNaN(currentVideoPauseTotalSeconds)
      ) {
        currentVideoPauseTotalSeconds = DEFAULT_VIDEO_PAUSE_TOTAL_SECONDS;
      }
      videoPauseMinutesInput.value = Math.floor(
        currentVideoPauseTotalSeconds / 60
      );
      videoPauseSecondsInput.value = currentVideoPauseTotalSeconds % 60;
    }
  );

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
    const driftMins = parseInt(driftMinutesInput.value, 10);
    const driftSecs = parseInt(driftSecondsInput.value, 10);

    const videoMins = parseInt(videoPauseMinutesInput.value, 10);
    const videoSecs = parseInt(videoPauseSecondsInput.value, 10);

    // Validate Drift Timer
    if (
      isNaN(driftMins) ||
      driftMins < 0 ||
      isNaN(driftSecs) ||
      driftSecs < 0 ||
      driftSecs > 59
    ) {
      settingsStatusMessage.textContent =
        "Please enter valid numbers for Drift Timer (mins >= 0, secs 0-59).";
      settingsStatusMessage.style.color = "red";
      return;
    }
    const totalDriftSeconds = driftMins * 60 + driftSecs;
    if (totalDriftSeconds < MINIMUM_TOTAL_SECONDS) {
      settingsStatusMessage.textContent = `Minimum Drift Timer is ${MINIMUM_TOTAL_SECONDS} seconds.`;
      settingsStatusMessage.style.color = "red";
      return;
    }

    // Validate Video Pause Timer
    if (
      isNaN(videoMins) ||
      videoMins < 0 ||
      isNaN(videoSecs) ||
      videoSecs < 0 ||
      videoSecs > 59
    ) {
      settingsStatusMessage.textContent =
        "Please enter valid numbers for Video Pause Timer (mins >= 0, secs 0-59).";
      settingsStatusMessage.style.color = "red";
      return;
    }
    const totalVideoPauseSeconds = videoMins * 60 + videoSecs;
    if (totalVideoPauseSeconds < MINIMUM_TOTAL_SECONDS) {
      settingsStatusMessage.textContent = `Minimum Video Pause Timer is ${MINIMUM_TOTAL_SECONDS} seconds.`;
      settingsStatusMessage.style.color = "red";
      return;
    }

    // Save both settings
    chrome.storage.local.set(
      {
        totalDriftSeconds: totalDriftSeconds,
        totalVideoPauseSeconds: totalVideoPauseSeconds,
      },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error saving settings:", chrome.runtime.lastError);
          settingsStatusMessage.textContent = "Error saving settings.";
          settingsStatusMessage.style.color = "red";
        } else {
          console.log(
            `Settings saved: Drift ${totalDriftSeconds}s, Video Pause ${totalVideoPauseSeconds}s.`
          );
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
