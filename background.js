// background.js

let focusTabId = null;
let focusTabUrl = null;

const DRIFT_ALARM_NAME = "driftAlarm";
const NOTIFICATION_ID = "driftNotification"; // For tab drift
const VIDEO_PAUSE_NOTIFICATION_ID = "videoPauseNotification"; // For video pause
const IDLE_ALARM_NAME = "idleReturnAlarm";
const IDLE_RETURN_NOTIFICATION_ID = "idleReturnNotification";
const IDLE_STATE_DETECTION_INTERVAL_SECONDS = 60;

const TEST_DELAY_MILLISECONDS = 10000;

// --- SOUND CONFIGURATION ---
const SOUND_OPTIONS = {
  none: null,
  nudge1: "sounds/nudge1.wav",
  nudge2: "sounds/nudge2.wav",
  nudge3: "sounds/nudge3.wav",
  quietNudge4: "sounds/quiet_nudge4.wav",
  whistleNudge5: "sounds/whistle_nudge5.wav",
};
const DEFAULT_TAB_DRIFT_SOUND_KEY = "nudge1";
const DEFAULT_VIDEO_PAUSE_SOUND_KEY = "quietNudge4";
const DEFAULT_IDLE_NUDGE_SOUND_KEY = "nudge2";
// --- END OF SOUND CONFIGURATION ---

// --- OFFSCREEN DOCUMENT CONFIGURATION ---
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
let creatingOffscreenDocument = false;

console.log(
  "Background script loaded. Initial test delay for tab drift: ",
  TEST_DELAY_MILLISECONDS / 1000,
  "seconds"
);
console.log(
  `Drift: Idle detection interval will be set to ${IDLE_STATE_DETECTION_INTERVAL_SECONDS} seconds.`
);

// --- Initialize Idle Detection Interval ---
try {
  chrome.idle.setDetectionInterval(IDLE_STATE_DETECTION_INTERVAL_SECONDS);
  console.log(
    `Drift: Idle detection interval successfully set to ${IDLE_STATE_DETECTION_INTERVAL_SECONDS} seconds.`
  );
} catch (e) {
  console.error("Drift: Error setting idle detection interval:", e);
}

// --- FUNCTIONS FOR OFFSCREEN DOCUMENT AUDIO PLAYBACK ---
async function hasOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return contexts.length > 0;
  } else {
    const views = chrome.extension.getViews({ type: "OFFSCREEN_DOCUMENT" });
    return views.some(
      (view) =>
        view.location.href === chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)
    );
  }
}

async function setupOffscreenDocument() {
  if (creatingOffscreenDocument) {
    return;
  }
  if (await hasOffscreenDocument()) {
    return;
  }
  creatingOffscreenDocument = true;
  console.log("Drift Offscreen: Creating document...");
  await chrome.offscreen
    .createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "To play audio notifications for Drift extension.",
    })
    .then(() => {
      console.log("Drift Offscreen: Document created successfully.");
    })
    .catch((error) => {
      console.error("Drift Offscreen: Error creating document:", error);
    })
    .finally(() => {
      creatingOffscreenDocument = false;
    });
}

async function playSoundViaOffscreen(soundFilePathKey, nudgeType) {
  const soundFileName = SOUND_OPTIONS[soundFilePathKey];
  if (!soundFileName) {
    console.log(
      "Drift: No sound file mapped for key:",
      soundFilePathKey,
      "for nudge type:",
      nudgeType
    );
    return;
  }
  const fullSoundPath = chrome.runtime.getURL(soundFileName);
  await setupOffscreenDocument();
  setTimeout(() => {
    chrome.runtime
      .sendMessage({
        action: "playSoundOffscreen",
        soundPath: fullSoundPath,
      })
      .catch((e) =>
        console.warn(
          "Drift background: Error sending playSoundOffscreen message:",
          e.message
        )
      );
  }, 100);
}

function playSoundForNudge(nudgeType) {
  let soundSettingStorageKey;
  let defaultSoundKey;
  if (nudgeType === "tabDrift") {
    soundSettingStorageKey = "tabDriftSoundChoice";
    defaultSoundKey = DEFAULT_TAB_DRIFT_SOUND_KEY;
  } else if (nudgeType === "videoPause") {
    soundSettingStorageKey = "videoPauseSoundChoice";
    defaultSoundKey = DEFAULT_VIDEO_PAUSE_SOUND_KEY;
  } else if (nudgeType === "idleNudge") {
    soundSettingStorageKey = "idleNudgeSoundChoice";
    defaultSoundKey = DEFAULT_IDLE_NUDGE_SOUND_KEY;
  } else {
    console.warn("Drift: Unknown nudge type for sound:", nudgeType);
    return;
  }
  chrome.storage.local.get([soundSettingStorageKey], function (settings) {
    const selectedSoundKey =
      settings[soundSettingStorageKey] || defaultSoundKey;
    if (selectedSoundKey && selectedSoundKey !== "none") {
      playSoundViaOffscreen(selectedSoundKey, nudgeType);
    } else {
      console.log(
        "Drift: No sound selected (or 'none') for nudge type:",
        nudgeType
      );
    }
  });
}
// --- END OF FUNCTIONS FOR OFFSCREEN DOCUMENT ---

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Message received in background:", request);
  if (request.action === "startMonitoring") {
    focusTabId = request.tabId;
    focusTabUrl = request.tabUrl;
    console.log(
      `Background script now monitoring focusTabId: ${focusTabId} (${focusTabUrl})`
    );
    chrome.alarms.clear(DRIFT_ALARM_NAME, (wasCleared) => {
      if (wasCleared)
        console.log("Cleared existing drift alarm on new activation.");
    });
    chrome.alarms.clear(IDLE_ALARM_NAME, (wasCleared) => {
      if (wasCleared)
        console.log("Cleared existing idle alarm on new activation.");
    });
    sendResponse({ status: "Monitoring started for tab " + focusTabId });
    return true;
  } else if (request.action === "videoPausedTooLong") {
    console.log(
      "Background: Received videoPausedTooLong for URL:",
      request.videoUrl
    );
    if (focusTabId && sender.tab && sender.tab.id === focusTabId) {
      playSoundForNudge("videoPause");
      const notificationOptions = {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Video Paused",
        message: `Still watching? Your video on ${
          request.videoUrl
            ? request.videoUrl.substring(0, 50) + "..."
            : "the page"
        } is paused.`,
        priority: 1,
      };
      chrome.notifications.create(
        VIDEO_PAUSE_NOTIFICATION_ID,
        notificationOptions,
        function (notificationId) {
          if (chrome.runtime.lastError) {
            console.error(
              "Video Pause Notification error (from callback):",
              chrome.runtime.lastError.message
            );
          } else {
            console.log("Video pause notification shown:", notificationId);
          }
        }
      );
      sendResponse({ status: "Video pause notification triggered." });
    } else {
      console.log(
        "Background: videoPausedTooLong ignored - not current focus tab or Drift not active."
      );
      sendResponse({ status: "Video pause ignored." });
    }
    return true;
  } else if (request.action === "videoPlayed") {
    console.log("Background: Received videoPlayed for URL:", request.videoUrl);
    chrome.notifications.clear(
      VIDEO_PAUSE_NOTIFICATION_ID,
      function (wasCleared) {
        if (wasCleared)
          console.log(
            "Background: Video pause notification cleared because video was played."
          );
      }
    );
    (async () => {
      if (await hasOffscreenDocument()) {
        chrome.runtime
          .sendMessage({ action: "stopSoundOffscreen" })
          .catch((e) =>
            console.warn(
              "Background: Error sending stopSoundOffscreen message:",
              e.message
            )
          );
      }
    })();
    sendResponse({
      status: "Video pause notification clear and sound stop attempt.",
    });
    return true;
  } else if (request.action === "stopMonitoring") {
    console.log(
      "Background: Received stopMonitoring. Clearing focus and alarms."
    );
    focusTabId = null;
    focusTabUrl = null;
    chrome.alarms.clearAll(function (wasCleared) {
      if (wasCleared)
        console.log("Drift: All alarms cleared due to stopMonitoring.");
      else
        console.log(
          "Drift: No alarms to clear or failed to clear alarms on stopMonitoring."
        );
    });
    chrome.notifications.clear(NOTIFICATION_ID, function (wasCleared) {
      if (wasCleared) console.log("Cleared tab drift notification.");
    });
    chrome.notifications.clear(
      VIDEO_PAUSE_NOTIFICATION_ID,
      function (wasCleared) {
        if (wasCleared) console.log("Cleared video pause notification.");
      }
    );
    chrome.notifications.clear(
      IDLE_RETURN_NOTIFICATION_ID,
      function (wasCleared) {
        if (wasCleared) console.log("Cleared idle return notification.");
      }
    );
    console.log("Drift: All monitoring stopped.");
    sendResponse({ status: "Monitoring stopped successfully." });
    return true;
  }
  return false;
});

// --- IDLE STATE CHANGE LISTENER ---
chrome.idle.onStateChanged.addListener(function (newState) {
  console.log(`Drift: Idle state changed to: ${newState}`);
  if (focusTabId === null) {
    chrome.alarms.clear(IDLE_ALARM_NAME);
    chrome.notifications.clear(IDLE_RETURN_NOTIFICATION_ID);
    return;
  }
  if (newState === "active") {
    console.log("Drift: User became active. Clearing idle alarm.");
    chrome.alarms.clear(IDLE_ALARM_NAME);
    if (focusTabId !== null) {
      chrome.tabs.query(
        { active: true, currentWindow: true },
        function (activeTabs) {
          if (chrome.runtime.lastError) {
            console.warn(
              "Drift: Error querying active tab upon becoming active:",
              chrome.runtime.lastError.message
            );
            chrome.notifications.clear(
              IDLE_RETURN_NOTIFICATION_ID,
              (wasCleared) => {
                if (wasCleared)
                  console.log(
                    "Drift: Idle notification cleared due to activity (active tab query error)."
                  );
              }
            );
            return;
          }
          if (
            activeTabs &&
            activeTabs.length > 0 &&
            activeTabs[0].id === focusTabId
          ) {
            console.log(
              "Drift: User became active AND is on the focus tab. Clearing idle notification."
            );
            chrome.notifications.clear(
              IDLE_RETURN_NOTIFICATION_ID,
              (wasCleared) => {
                if (wasCleared)
                  console.log("Drift: Idle notification cleared.");
              }
            );
          } else {
            console.log(
              "Drift: User became active BUT is NOT on the focus tab. Idle notification will remain (if visible)."
            );
          }
        }
      );
    } else {
      chrome.notifications.clear(IDLE_RETURN_NOTIFICATION_ID, (wasCleared) => {
        if (wasCleared)
          console.log(
            "Drift: Idle notification cleared (no focus tab ID during active state check)."
          );
      });
    }
  } else if (newState === "idle" || newState === "locked") {
    chrome.tabs.get(focusTabId, function (tab) {
      if (chrome.runtime.lastError) {
        console.warn(
          "Drift: Could not get focus tab details for idle check:",
          chrome.runtime.lastError.message
        );
      }
      if (tab && tab.audible) {
        console.log(
          "Drift: User is idle/locked, but focus tab is playing audio. Idle nudge suppressed."
        );
        chrome.alarms.clear(IDLE_ALARM_NAME);
        chrome.notifications.clear(IDLE_RETURN_NOTIFICATION_ID);
        return;
      }
      console.log(
        `Drift: User is ${newState} and focus tab is not audible (or tab info unavailable).`
      );
      chrome.storage.local.get(["totalIdleSeconds"], function (result) {
        let actualIdleSeconds = result.totalIdleSeconds;
        const defaultSystemIdleNudgeSeconds = 60;
        if (
          typeof actualIdleSeconds !== "number" ||
          isNaN(actualIdleSeconds) ||
          actualIdleSeconds < 15
        ) {
          actualIdleSeconds = defaultSystemIdleNudgeSeconds;
          console.log(
            `Drift: Using default idle nudge delay of ${actualIdleSeconds}s.`
          );
        }
        const delayInMinutes = actualIdleSeconds / 60.0;
        console.log(
          `Drift: Setting idle return alarm for ${delayInMinutes.toFixed(
            2
          )} minute(s).`
        );
        chrome.alarms.create(IDLE_ALARM_NAME, {
          delayInMinutes: delayInMinutes,
        });
      });
    });
  }
});

// --- TAB ACTIVATED LISTENER ---
chrome.tabs.onActivated.addListener(function (activeInfo) {
  console.log("Tab activated:", activeInfo);
  if (focusTabId === null) return;
  if (activeInfo.tabId === focusTabId) {
    console.log("Switched TO the focus tab:", focusTabId);
    chrome.alarms.clear(DRIFT_ALARM_NAME, function (wasCleared) {
      if (wasCleared)
        console.log("Drift alarm cleared (returned to focus tab).");
    });
    chrome.alarms.clear(IDLE_ALARM_NAME, function (wasCleared) {
      if (wasCleared)
        console.log("Drift: Idle alarm cleared (returned to focus tab).");
    });
    chrome.notifications.clear(NOTIFICATION_ID, function (wasCleared) {
      if (wasCleared)
        console.log("Drift notification cleared (returned to focus tab).");
    });
    chrome.notifications.clear(
      VIDEO_PAUSE_NOTIFICATION_ID,
      function (wasCleared) {
        if (wasCleared)
          console.log(
            "Background: Video pause notification cleared as user returned to focus tab."
          );
      }
    );
    chrome.notifications.clear(
      IDLE_RETURN_NOTIFICATION_ID,
      function (wasCleared) {
        if (wasCleared)
          console.log(
            "Background: Idle notification cleared as user returned to focus tab."
          );
      }
    );
  } else {
    console.log(
      `Switched AWAY from focus tab ${focusTabId} to tab ${activeInfo.tabId}`
    );
    chrome.storage.local.get(["totalDriftSeconds"], function (result) {
      let actualDriftSeconds = result.totalDriftSeconds;
      const defaultSecondsForAlarm = TEST_DELAY_MILLISECONDS / 1000;
      if (
        typeof actualDriftSeconds !== "number" ||
        isNaN(actualDriftSeconds) ||
        actualDriftSeconds < 1
      ) {
        actualDriftSeconds = defaultSecondsForAlarm;
        console.log(
          `Using default/test delay of ${actualDriftSeconds}s for tab drift.`
        );
      }
      const delayInMilliseconds = actualDriftSeconds * 1000;
      console.log(`Setting tab drift alarm for ${actualDriftSeconds}s.`);
      chrome.alarms.create(DRIFT_ALARM_NAME, {
        when: Date.now() + delayInMilliseconds,
      });
    });
    if (focusTabId !== null) {
      chrome.tabs
        .sendMessage(focusTabId, { action: "cancelVideoPauseTimer" })
        .catch((e) => {
          /*ignore if tab doesn't exist or no listener*/
        });
    }
  }
});

// --- ALARM LISTENER ---
chrome.alarms.onAlarm.addListener(function (alarm) {
  console.log("Alarm fired:", alarm);
  if (alarm.name === DRIFT_ALARM_NAME) {
    console.log("Tab Drift alarm triggered!");
    if (focusTabUrl) {
      playSoundForNudge("tabDrift");
      const notificationOptions = {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Stay Focused!",
        message: `Time to return to: ${focusTabUrl.substring(0, 100)}`,
        priority: 2,
      };
      chrome.notifications.create(
        NOTIFICATION_ID,
        notificationOptions,
        function (notificationId) {
          if (chrome.runtime.lastError) {
            console.error(
              "Tab Drift Notification error (from callback):",
              chrome.runtime.lastError.message
            );
          } else {
            console.log("Tab Drift notification shown:", notificationId);
          }
        }
      );
    } else {
      console.log("FocusTabUrl not set, not showing tab drift notification.");
    }
  } else if (alarm.name === IDLE_ALARM_NAME) {
    console.log("Drift: Idle/Return alarm triggered!");
    if (focusTabUrl) {
      playSoundForNudge("idleNudge");
      const notificationOptions = {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Still There?",
        message: `It seems you've been away. Ready to get back to: ${focusTabUrl.substring(
          0,
          100
        )}?`,
        priority: 2,
      };
      chrome.notifications.create(
        IDLE_RETURN_NOTIFICATION_ID,
        notificationOptions,
        function (id) {
          if (chrome.runtime.lastError) {
            console.error(
              "Drift: Idle Notification error:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log("Drift: Idle return notification shown:", id);
          }
        }
      );
    } else {
      console.log(
        "Drift: Idle alarm fired, but no focus URL. Not showing notification."
      );
    }
  }
});

// --- TAB REMOVED/UPDATED LISTENERS ---
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  if (tabId === focusTabId) {
    console.log(`Focus tab ${focusTabId} was closed. Stopping monitoring.`);
    focusTabId = null;
    focusTabUrl = null;
    chrome.alarms.clear(DRIFT_ALARM_NAME);
    chrome.alarms.clear(IDLE_ALARM_NAME);
    chrome.notifications.clear(NOTIFICATION_ID);
    chrome.notifications.clear(VIDEO_PAUSE_NOTIFICATION_ID);
    chrome.notifications.clear(IDLE_RETURN_NOTIFICATION_ID);
    chrome.storage.local.remove(["focusTabId", "focusTabUrl"], () => {
      if (chrome.runtime.lastError)
        console.error(
          "Error clearing storage:",
          chrome.runtime.lastError.message
        );
      else console.log("Focus tab data cleared from storage.");
    });
  }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (tabId === focusTabId && changeInfo.url) {
    console.log(`Focus tab ${tabId} URL updated to: ${changeInfo.url}`);
    focusTabUrl = changeInfo.url;
  }
});

// --- NEW LISTENER FOR NOTIFICATION CLICKS (Step 20.2) ---
chrome.notifications.onClicked.addListener(function (notificationId) {
  console.log("Drift: Notification clicked:", notificationId);

  if (
    (notificationId === NOTIFICATION_ID ||
      notificationId === VIDEO_PAUSE_NOTIFICATION_ID ||
      notificationId === IDLE_RETURN_NOTIFICATION_ID) &&
    focusTabId !== null
  ) {
    chrome.tabs.get(focusTabId, function (tab) {
      if (chrome.runtime.lastError || !tab) {
        console.warn(
          "Drift: Clicked notification for focus tab, but tab not found (maybe closed or an error occurred):",
          focusTabId,
          chrome.runtime.lastError
            ? chrome.runtime.lastError.message
            : "Tab query returned no tab."
        );
        chrome.notifications.clear(notificationId); // Still clear the clicked notification
        return;
      }

      if (tab) {
        chrome.windows.update(tab.windowId, { focused: true }, function () {
          if (chrome.runtime.lastError) {
            console.warn(
              "Drift: Error focusing window:",
              tab.windowId,
              chrome.runtime.lastError.message
            );
          }
          chrome.tabs.update(focusTabId, { active: true }, function () {
            if (chrome.runtime.lastError) {
              console.warn(
                "Drift: Error activating tab:",
                focusTabId,
                chrome.runtime.lastError.message
              );
            } else {
              console.log(
                "Drift: Switched to focus tab:",
                focusTabId,
                "after notification click."
              );
            }
            // The general clear below will handle this notificationId
          });
        });
      }
    });
  }
  // Always clear the specific notification that was clicked if it's one of ours.
  if (
    notificationId === NOTIFICATION_ID ||
    notificationId === VIDEO_PAUSE_NOTIFICATION_ID ||
    notificationId === IDLE_RETURN_NOTIFICATION_ID
  ) {
    chrome.notifications.clear(notificationId, function (wasCleared) {
      // console.log("Drift: Clicked notification", notificationId, "cleared status:", wasCleared);
    });
  }
});
// --- END OF NOTIFICATION CLICK LISTENER ---
