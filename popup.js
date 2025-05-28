// popup.js
document.addEventListener("DOMContentLoaded", function () {
  const activateButton = document.getElementById("activateButton");
  const statusMessage = document.getElementById("statusMessage");

  const driftMinutesInput = document.getElementById("driftMinutesInput");
  const driftSecondsInput = document.getElementById("driftSecondsInput");
  const videoPauseMinutesInput = document.getElementById(
    "videoPauseMinutesInput"
  );
  const videoPauseSecondsInput = document.getElementById(
    "videoPauseSecondsInput"
  );
  const idleMinutesInput = document.getElementById("idleMinutesInput");
  const idleSecondsInput = document.getElementById("idleSecondsInput");

  const tabDriftSoundSelect = document.getElementById("tabDriftSoundSelect");
  const videoPauseSoundSelect = document.getElementById(
    "videoPauseSoundSelect"
  );
  const idleNudgeSoundSelect = document.getElementById("idleNudgeSoundSelect");

  const saveSettingsButton = document.getElementById("saveSettingsButton");
  const settingsStatusMessage = document.getElementById(
    "settingsStatusMessage"
  );

  const DEFAULT_DRIFT_TOTAL_SECONDS = 15;
  const DEFAULT_VIDEO_PAUSE_TOTAL_SECONDS = 10;
  const DEFAULT_IDLE_TOTAL_SECONDS = 60;
  const MINIMUM_IDLE_SECONDS = 15;
  const MINIMUM_FOCUS_SECONDS = 5;

  const DEFAULT_TAB_DRIFT_SOUND_KEY = "nudge1";
  const DEFAULT_VIDEO_PAUSE_SOUND_KEY = "quietNudge4";
  const DEFAULT_IDLE_NUDGE_SOUND_KEY = "nudge2";

  function updatePopupUI(isActive, url = "") {
    if (isActive && url) {
      statusMessage.textContent = `Drift is active on: ${url.substring(0, 70)}${
        url.length > 70 ? "..." : ""
      }`;
      activateButton.textContent = "Deactivate Drift";
      activateButton.dataset.active = "true";
    } else {
      statusMessage.textContent =
        "Drift is inactive. Activate on a site to begin.";
      activateButton.textContent = "Activate Drift on this Site";
      activateButton.dataset.active = "false";
    }
  }

  function loadAndApplySettings() {
    chrome.storage.local.get(
      [
        "focusTabId",
        "focusTabUrl",
        "totalDriftSeconds",
        "totalVideoPauseSeconds",
        "totalIdleSeconds",
        "tabDriftSoundChoice",
        "videoPauseSoundChoice",
        "idleNudgeSoundChoice",
      ],
      function (result) {
        updatePopupUI(!!result.focusTabId, result.focusTabUrl);

        let cDTS = result.totalDriftSeconds;
        driftMinutesInput.value = Math.floor(
          (typeof cDTS === "number" ? cDTS : DEFAULT_DRIFT_TOTAL_SECONDS) / 60
        );
        driftSecondsInput.value =
          (typeof cDTS === "number" ? cDTS : DEFAULT_DRIFT_TOTAL_SECONDS) % 60;

        let cVPTS = result.totalVideoPauseSeconds;
        videoPauseMinutesInput.value = Math.floor(
          (typeof cVPTS === "number"
            ? cVPTS
            : DEFAULT_VIDEO_PAUSE_TOTAL_SECONDS) / 60
        );
        videoPauseSecondsInput.value =
          (typeof cVPTS === "number"
            ? cVPTS
            : DEFAULT_VIDEO_PAUSE_TOTAL_SECONDS) % 60;

        let cITS = result.totalIdleSeconds;
        idleMinutesInput.value = Math.floor(
          (typeof cITS === "number" ? cITS : DEFAULT_IDLE_TOTAL_SECONDS) / 60
        );
        idleSecondsInput.value =
          (typeof cITS === "number" ? cITS : DEFAULT_IDLE_TOTAL_SECONDS) % 60;

        tabDriftSoundSelect.value =
          result.tabDriftSoundChoice || DEFAULT_TAB_DRIFT_SOUND_KEY;
        videoPauseSoundSelect.value =
          result.videoPauseSoundChoice || DEFAULT_VIDEO_PAUSE_SOUND_KEY;
        idleNudgeSoundSelect.value =
          result.idleNudgeSoundChoice || DEFAULT_IDLE_NUDGE_SOUND_KEY;
      }
    );
  }

  loadAndApplySettings();

  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === "local") {
      let needsUIRefresh = false;
      for (let key in changes) {
        if (
          key === "focusTabId" ||
          key === "focusTabUrl" ||
          key === "totalDriftSeconds" ||
          key === "totalVideoPauseSeconds" ||
          key === "totalIdleSeconds" ||
          key === "tabDriftSoundChoice" ||
          key === "videoPauseSoundChoice" ||
          key === "idleNudgeSoundChoice"
        ) {
          needsUIRefresh = true;
          break;
        }
      }
      if (needsUIRefresh) {
        console.log(
          "Drift Popup: Detected storage change, reloading settings and UI."
        );
        loadAndApplySettings();
      }
    }
  });

  activateButton.addEventListener("click", function () {
    const isActiveNow = activateButton.dataset.active === "true";
    if (isActiveNow) {
      // DEACTIVATE
      chrome.storage.local.remove(["focusTabId", "focusTabUrl"], function () {
        if (chrome.runtime.lastError) {
          console.error(
            "Error clearing focus tab storage:",
            chrome.runtime.lastError
          );
          statusMessage.textContent = "Error deactivating Drift."; // Show error
          return;
        }
        console.log("Drift deactivated by popup. Sending stopMonitoring.");
        chrome.runtime.sendMessage(
          { action: "stopMonitoring" },
          function (response) {
            if (chrome.runtime.lastError) {
              console.error(
                "Error sending stopMonitoring message:",
                chrome.runtime.lastError.message
              );
            } else if (response) {
              console.log(
                "Background response to stopMonitoring:",
                response.status
              );
            }
          }
        );
        // UI update will be handled by storage.onChanged listener -> loadAndApplySettings()
      });
    } else {
      // ACTIVATE
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length === 0 || !tabs[0].id) {
          console.error("No active tab found or tab has no ID.");
          statusMessage.textContent =
            "Error: Could not get current tab details.";
          return;
        }
        const currentTabToFocus = tabs[0];
        const tabId = currentTabToFocus.id;
        const tabUrl = currentTabToFocus.url;

        if (
          !tabUrl ||
          tabUrl.startsWith("chrome://") ||
          tabUrl.startsWith("brave://") ||
          tabUrl.startsWith("edge://")
        ) {
          statusMessage.textContent =
            "Cannot activate Drift on special browser pages.";
          settingsStatusMessage.classList.remove("success"); // Use settingsStatusMessage for this error
          settingsStatusMessage.classList.add("error");
          setTimeout(() => {
            settingsStatusMessage.textContent = "";
            settingsStatusMessage.classList.remove("error");
            loadAndApplySettings(); // Reload to show correct inactive state
          }, 3000);
          return;
        }

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
              // UI update handled by storage.onChanged or direct call below for immediate feedback
              updatePopupUI(true, tabUrl);
              chrome.runtime.sendMessage(
                { action: "startMonitoring", tabId: tabId, tabUrl: tabUrl },
                function (response) {
                  if (chrome.runtime.lastError) {
                    console.error(
                      "Error sending startMonitoring message:",
                      chrome.runtime.lastError.message
                    );
                  } else if (response) {
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
    }
  });

  saveSettingsButton.addEventListener("click", function () {
    settingsStatusMessage.textContent = ""; // Clear previous message
    settingsStatusMessage.classList.remove("success", "error"); // Clear previous classes

    const driftMins = parseInt(driftMinutesInput.value, 10);
    const driftSecs = parseInt(driftSecondsInput.value, 10);
    const videoMins = parseInt(videoPauseMinutesInput.value, 10);
    const videoSecs = parseInt(videoPauseSecondsInput.value, 10);
    const idleMins = parseInt(idleMinutesInput.value, 10);
    const idleSecs = parseInt(idleSecondsInput.value, 10);

    const selectedTabDriftSound = tabDriftSoundSelect.value;
    const selectedVideoPauseSound = videoPauseSoundSelect.value;
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
      settingsStatusMessage.classList.add("error");
      return;
    }
    const totalDriftSeconds = driftMins * 60 + driftSecs;
    if (totalDriftSeconds < MINIMUM_FOCUS_SECONDS) {
      settingsStatusMessage.textContent = `Minimum Drift Timer is ${MINIMUM_FOCUS_SECONDS} seconds.`;
      settingsStatusMessage.classList.add("error");
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
      settingsStatusMessage.classList.add("error");
      return;
    }
    const totalVideoPauseSeconds = videoMins * 60 + videoSecs;
    if (totalVideoPauseSeconds < MINIMUM_FOCUS_SECONDS) {
      settingsStatusMessage.textContent = `Minimum Video Pause Timer is ${MINIMUM_FOCUS_SECONDS} seconds.`;
      settingsStatusMessage.classList.add("error");
      return;
    }

    // Validate Idle Timer
    if (
      isNaN(idleMins) ||
      idleMins < 0 ||
      isNaN(idleSecs) ||
      idleSecs < 0 ||
      idleSecs > 59
    ) {
      settingsStatusMessage.textContent =
        "Please enter valid numbers for Idle Timer.";
      settingsStatusMessage.classList.add("error");
      return;
    }
    const totalIdleSeconds = idleMins * 60 + idleSecs;
    if (totalIdleSeconds < MINIMUM_IDLE_SECONDS) {
      settingsStatusMessage.textContent = `Minimum Idle Timer is ${MINIMUM_IDLE_SECONDS} seconds.`;
      settingsStatusMessage.classList.add("error");
      return;
    }

    chrome.storage.local.set(
      {
        totalDriftSeconds: totalDriftSeconds,
        totalVideoPauseSeconds: totalVideoPauseSeconds,
        totalIdleSeconds: totalIdleSeconds,
        tabDriftSoundChoice: selectedTabDriftSound,
        videoPauseSoundChoice: selectedVideoPauseSound,
        idleNudgeSoundChoice: selectedIdleNudgeSound,
      },
      function () {
        if (chrome.runtime.lastError) {
          console.error("Error saving settings:", chrome.runtime.lastError);
          settingsStatusMessage.textContent = "Error saving settings.";
          settingsStatusMessage.classList.add("error");
        } else {
          console.log(
            `Settings saved: Drift ${totalDriftSeconds}s (Sound: ${selectedTabDriftSound}), Video Pause ${totalVideoPauseSeconds}s (Sound: ${selectedVideoPauseSound}), Idle ${totalIdleSeconds}s (Sound: ${selectedIdleNudgeSound}).`
          );
          settingsStatusMessage.textContent = "Settings saved!";
          settingsStatusMessage.classList.add("success"); // Apply success class
          setTimeout(() => {
            settingsStatusMessage.textContent = "";
            settingsStatusMessage.classList.remove("success", "error"); // Clear classes
          }, 3000);
        }
      }
    );
  });
});
