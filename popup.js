// popup.js
document.addEventListener("DOMContentLoaded", function () {
  const activateButton = document.getElementById("activateButton");
  const statusMessage = document.getElementById("statusMessage");

  // ... (other element getters: driftMinutesInput, etc. ... sound selectors ...)
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

  // ... (DEFAULT constants as before) ...
  const DEFAULT_DRIFT_TOTAL_SECONDS = 15;
  const DEFAULT_VIDEO_PAUSE_TOTAL_SECONDS = 10;
  const DEFAULT_IDLE_TOTAL_SECONDS = 60;
  const MINIMUM_IDLE_SECONDS = 15;
  const MINIMUM_FOCUS_SECONDS = 5;

  const DEFAULT_TAB_DRIFT_SOUND_KEY = "nudge1";
  const DEFAULT_VIDEO_PAUSE_SOUND_KEY = "quietNudge4";
  const DEFAULT_IDLE_NUDGE_SOUND_KEY = "nudge2";

  // No need for currentFocusTabId as a global in popup.js if we always rely on updatePopupUI and its storage check.

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

  // Initial load of settings and UI state
  loadAndApplySettings();

  // ---> ADD THIS LISTENER FOR STORAGE CHANGES <---
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === "local") {
      // Check if focusTabId or focusTabUrl was changed (especially if cleared)
      // Or if any setting the popup displays was changed by another source (less likely for this extension)
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
        loadAndApplySettings(); // Reload all settings and update UI
      }
    }
  });
  // ---> END OF STORAGE CHANGE LISTENER <---

  activateButton.addEventListener("click", function () {
    const isActiveNow = activateButton.dataset.active === "true";
    if (isActiveNow) {
      // DEACTIVATE
      chrome.storage.local.remove(
        [
          "focusTabId",
          "focusTabUrl" /*, 'anyOtherSessionSpecificKeysLikeIsReadingMode'*/,
        ],
        function () {
          if (chrome.runtime.lastError) {
            /* ... error handling ... */ return;
          }
          // updatePopupUI(false); // UI will update via onChanged listener
          console.log("Drift deactivated by popup. Sending stopMonitoring.");
          chrome.runtime.sendMessage(
            { action: "stopMonitoring" },
            function (response) {
              /* ... */
            }
          );
        }
      );
    } else {
      // ACTIVATE
      // ... (existing activation logic from Step 20, Part 1 is good)
      // Ensure it calls updatePopupUI(true, tabUrl) on successful activation.
      // For brevity, not re-pasting the full activation block here, it remains the same.
      // Just make sure that if it sets storage, the onChanged listener will pick it up,
      // or call updatePopupUI directly after successful storage.set as well.
      // The original logic did this, which is fine.
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length === 0 || !tabs[0].id) {
          /* ... */ return;
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
          statusMessage.style.color = "red";
          setTimeout(() => {
            loadAndApplySettings();
            statusMessage.style.color = "";
          }, 3000); // Revert to actual state
          return;
        }

        chrome.storage.local.set(
          { focusTabId: tabId, focusTabUrl: tabUrl },
          function () {
            if (chrome.runtime.lastError) {
              /* ... */
            } else {
              // updatePopupUI(true, tabUrl); // UI will update via onChanged, or call directly for immediate feedback
              console.log(`Drift activated on tab ${tabId} with URL ${tabUrl}`);
              chrome.runtime.sendMessage(
                { action: "startMonitoring", tabId: tabId, tabUrl: tabUrl },
                function (response) {
                  /* ... */
                }
              );
            }
          }
        );
      });
    }
  });

  saveSettingsButton.addEventListener("click", function () {
    // ... (Existing save settings logic from Step 20, Part 1 is good)
    // This will also trigger the onChanged listener if the popup is still open,
    // which will re-run loadAndApplySettings - this is fine.
    // For brevity, not re-pasting the full save logic here.
    const driftMins = parseInt(driftMinutesInput.value, 10); /* ... */
    const driftSecs = parseInt(driftSecondsInput.value, 10); /* ... */
    const videoMins = parseInt(videoPauseMinutesInput.value, 10); /* ... */
    const videoSecs = parseInt(videoPauseSecondsInput.value, 10); /* ... */
    const idleMins = parseInt(idleMinutesInput.value, 10); /* ... */
    const idleSecs = parseInt(idleSecondsInput.value, 10); /* ... */
    const selectedTabDriftSound = tabDriftSoundSelect.value; /* ... */
    const selectedVideoPauseSound = videoPauseSoundSelect.value; /* ... */
    const selectedIdleNudgeSound = idleNudgeSoundSelect.value; /* ... */

    // Validations...
    const totalDriftSeconds = driftMins * 60 + driftSecs;
    if (totalDriftSeconds < MINIMUM_FOCUS_SECONDS) {
      /* ... error ... */ return;
    }
    const totalVideoPauseSeconds = videoMins * 60 + videoSecs;
    if (totalVideoPauseSeconds < MINIMUM_FOCUS_SECONDS) {
      /* ... error ... */ return;
    }
    const totalIdleSeconds = idleMins * 60 + idleSecs;
    if (totalIdleSeconds < MINIMUM_IDLE_SECONDS) {
      /* ... error ... */ return;
    }

    chrome.storage.local.set(
      {
        totalDriftSeconds,
        totalVideoPauseSeconds,
        totalIdleSeconds,
        tabDriftSoundChoice: selectedTabDriftSound,
        videoPauseSoundChoice: selectedVideoPauseSound,
        idleNudgeSoundChoice: selectedIdleNudgeSound,
      },
      function () {
        /* ... success/error message ... */
      }
    );
  });
});
