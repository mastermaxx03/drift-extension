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

  // Sound selection inputs - NEW
  const tabDriftSoundSelect = document.getElementById("tabDriftSoundSelect");
  const videoPauseSoundSelect = document.getElementById(
    "videoPauseSoundSelect"
  );
  const idleMinutesInput = document.getElementById("idleMinutesInput");
  const idleSecondsInput = document.getElementById("idleSecondsInput");
  const idleNudgeSoundSelect = document.getElementById("idleNudgeSoundSelect");

  const saveSettingsButton = document.getElementById("saveSettingsButton");
  const settingsStatusMessage = document.getElementById(
    "settingsStatusMessage"
  );

  // Default values for timers
  const DEFAULT_DRIFT_TOTAL_SECONDS = 15;
  const DEFAULT_VIDEO_PAUSE_TOTAL_SECONDS = 10;
  const MINIMUM_TOTAL_SECONDS = 5; // Minimum allowed drift/pause time in seconds

  // Default values for sound choices (should match <option value="..."> in popup.html and keys in SOUND_OPTIONS in background.js)
  const DEFAULT_TAB_DRIFT_SOUND_KEY = "nudge1";
  const DEFAULT_VIDEO_PAUSE_SOUND_KEY = "quietNudge4";
  const DEFAULT_IDLE_TOTAL_SECONDS = 60; // Default 1 minute for idle nudge delay
  const DEFAULT_IDLE_NUDGE_SOUND_KEY = "nudge2"; // Or your preferred default for idle
  // Adjust MINIMUM_TOTAL_SECONDS if needed, or add a specific MINIMUM_IDLE_SECONDS (e.g., 15s)
  const MINIMUM_IDLE_SECONDS = 15; // Min additional delay after Chrome's idle detection (must be >= 1 for alarms if using delayInMinutes > 0)

  // Load saved settings when popup opens
  chrome.storage.local.get(
    [
      "focusTabId",
      "focusTabUrl",
      "totalDriftSeconds",
      "totalVideoPauseSeconds",
      "tabDriftSoundChoice", // Storage key for tab drift sound
      "videoPauseSoundChoice", // Storage key for video pause sound
      "totalIdleSeconds",
      "idleNudgeSoundChoice",
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

      // Populate Sound Selectors
      tabDriftSoundSelect.value =
        result.tabDriftSoundChoice || DEFAULT_TAB_DRIFT_SOUND_KEY;
      videoPauseSoundSelect.value =
        result.videoPauseSoundChoice || DEFAULT_VIDEO_PAUSE_SOUND_KEY;
      let currentIdleTotalSeconds = result.totalIdleSeconds;
      if (
        typeof currentIdleTotalSeconds !== "number" ||
        isNaN(currentIdleTotalSeconds)
      ) {
        currentIdleTotalSeconds = DEFAULT_IDLE_TOTAL_SECONDS;
      }
      idleMinutesInput.value = Math.floor(currentIdleTotalSeconds / 60);
      idleSecondsInput.value = currentIdleTotalSeconds % 60;

      // Populate Idle Nudge Sound Selector
      idleNudgeSoundSelect.value =
        result.idleNudgeSoundChoice || DEFAULT_IDLE_NUDGE_SOUND_KEY;
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

    const selectedTabDriftSound = tabDriftSoundSelect.value;
    const selectedVideoPauseSound = videoPauseSoundSelect.value;

    const idleMins = parseInt(idleMinutesInput.value, 10);
    const idleSecs = parseInt(idleSecondsInput.value, 10);
    const selectedIdleNudgeSound = idleNudgeSoundSelect.value;

    // Validate Drift Timer
    if (
      isNaN(driftMins) ||
      driftMins < 0 ||
      isNaN(driftSecs) ||
      driftSecs < 0 ||
      driftSecs > 59
    ) {
      settingsStatusMessage.textContent =
        "Please enter valid numbers for Drift Timer.";
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
        "Please enter valid numbers for Video Pause Timer.";
      settingsStatusMessage.style.color = "red";
      return;
    }
    const totalVideoPauseSeconds = videoMins * 60 + videoSecs;
    if (totalVideoPauseSeconds < MINIMUM_TOTAL_SECONDS) {
      settingsStatusMessage.textContent = `Minimum Video Pause Timer is ${MINIMUM_TOTAL_SECONDS} seconds.`;
      settingsStatusMessage.style.color = "red";
      return;
    }
    if (
      isNaN(idleMins) ||
      idleMins < 0 ||
      isNaN(idleSecs) ||
      idleSecs < 0 ||
      idleSecs > 59
    ) {
      settingsStatusMessage.textContent =
        "Please enter valid numbers for Idle Timer.";
      settingsStatusMessage.style.color = "red";
      return;
    }
    const totalIdleSeconds = idleMins * 60 + idleSecs;
    if (totalIdleSeconds < MINIMUM_IDLE_SECONDS) {
      settingsStatusMessage.textContent = `Minimum Idle Timer is ${MINIMUM_IDLE_SECONDS} seconds.`;
      settingsStatusMessage.style.color = "red";
      return;
    }

    // Save all settings
    chrome.storage.local.set(
      {
        totalDriftSeconds: totalDriftSeconds,
        totalVideoPauseSeconds: totalVideoPauseSeconds,
        tabDriftSoundChoice: selectedTabDriftSound,
        videoPauseSoundChoice: selectedVideoPauseSound,
        totalIdleSeconds: totalIdleSeconds,
        idleNudgeSoundChoice: selectedIdleNudgeSound,
      },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error saving settings:", chrome.runtime.lastError);
          settingsStatusMessage.textContent = "Error saving settings.";
          settingsStatusMessage.style.color = "red";
        } else {
          console.log(
            `Settings saved: Drift ${totalDriftSeconds}s (Sound: ${selectedTabDriftSound}), Video Pause ${totalVideoPauseSeconds}s (Sound: ${selectedVideoPauseSound}) Idle ${totalIdleSeconds}s (Sound: ${selectedIdleNudgeSound}).`
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
