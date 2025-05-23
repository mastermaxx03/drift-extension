// background.js

let focusTabId = null;
let focusTabUrl = null;

const DRIFT_ALARM_NAME = "driftAlarm";
const NOTIFICATION_ID = "driftNotification"; // For tab drift
const VIDEO_PAUSE_NOTIFICATION_ID = "videoPauseNotification"; // For video pause

const TEST_DELAY_MILLISECONDS = 10000; // Default test delay for tab drift if no user setting

console.log(
  "Background script loaded. Initial test delay for tab drift: ",
  TEST_DELAY_MILLISECONDS / 1000,
  "seconds"
);

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
    sendResponse({ status: "Monitoring started for tab " + focusTabId });
    return true; // Crucial for async sendResponse
  } else if (request.action === "videoPausedTooLong") {
    console.log(
      "Background: Received videoPausedTooLong for URL:",
      request.videoUrl
    );
    // Only show notification if Drift is active on the tab that sent the message
    if (focusTabId && sender.tab && sender.tab.id === focusTabId) {
      chrome.notifications.create(
        VIDEO_PAUSE_NOTIFICATION_ID,
        {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "Video Paused",
          message: `Still watching? Your video on ${
            request.videoUrl
              ? request.videoUrl.substring(0, 50) + "..."
              : "the page"
          } is paused.`,
          priority: 1,
        },
        function (notificationId) {
          if (chrome.runtime.lastError) {
            console.error(
              "Video Pause Notification error:",
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
    return true; // Crucial for async sendResponse
  } else if (request.action === "videoPlayed") {
    console.log("Background: Received videoPlayed for URL:", request.videoUrl);
    // Clear the "Video Paused" notification if it was showing
    chrome.notifications.clear(
      VIDEO_PAUSE_NOTIFICATION_ID,
      function (wasCleared) {
        if (wasCleared) {
          console.log(
            "Background: Video pause notification cleared because video was played."
          );
        }
      }
    );
    sendResponse({
      status: "Video pause notification clear attempt due to play.",
    });
    return true; // Crucial for async sendResponse
  }

  // If the message action isn't handled above, we don't need to keep the message channel open.
  // console.log("Background: Unhandled message action - ", request.action);
  // sendResponse({}); // Or don't sendResponse if not needed.
  return false; // Or let it be undefined if not returning true from any branch
});

// Listener for when the active tab changes (for tab drift)
chrome.tabs.onActivated.addListener(function (activeInfo) {
  // ... (existing initial console.log and focusTabId === null check) ...
  console.log("Tab activated:", activeInfo);

  if (focusTabId === null) {
    return; // Drift not active
  }

  if (activeInfo.tabId === focusTabId) {
    // ... (existing logic for switching TO the focus tab - no changes here) ...
    console.log("Switched TO the focus tab:", focusTabId);
    chrome.alarms.clear(DRIFT_ALARM_NAME, function (wasCleared) {
      /* ... */
    });
    chrome.notifications.clear(NOTIFICATION_ID, function (wasCleared) {
      /* ... */
    });
    chrome.notifications.clear(
      VIDEO_PAUSE_NOTIFICATION_ID,
      function (wasCleared) {
        // Also good to clear video pause notif here too
        if (wasCleared)
          console.log(
            "Background: Video pause notification cleared as user returned to focus tab (which might not be playing)."
          );
      }
    );
  } else {
    // User switched AWAY from the focus tab
    console.log(
      `Switched AWAY from focus tab ${focusTabId} to tab ${activeInfo.tabId}`
    );

    // Get stored duration for tab drift alarm and set it
    chrome.storage.local.get(["totalDriftSeconds"], function (result) {
      // ... (existing logic for setting the DRIFT_ALARM_NAME) ...
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

    // ---> ADD THIS BLOCK TO SEND A MESSAGE TO THE CONTENT SCRIPT OF THE (NOW INACTIVE) FOCUS TAB <---
    if (focusTabId !== null) {
      // Check again as focusTabId might have been cleared by another event rapidly
      chrome.tabs.sendMessage(
        focusTabId,
        { action: "cancelVideoPauseTimer" },
        function (response) {
          if (chrome.runtime.lastError) {
            // This error is expected if the content script isn't there (e.g., non-YouTube page, or tab closed rapidly)
            // or if the tab was a privileged page where content scripts can't run.
            // console.warn("Drift: background.js - Could not send cancelVideoPauseTimer to content script on tab", focusTabId, ":", chrome.runtime.lastError.message);
          } else {
            // console.log("Drift: background.js - Sent cancelVideoPauseTimer to content script on tab", focusTabId, "; Response:", response);
          }
        }
      );
    }
    // ---> END OF ADDED BLOCK <---
  }
});

// Listener for when alarms go off
chrome.alarms.onAlarm.addListener(function (alarm) {
  console.log("Alarm fired:", alarm);
  if (alarm.name === DRIFT_ALARM_NAME) {
    console.log("Tab Drift alarm triggered!");
    if (focusTabUrl) {
      chrome.notifications.create(
        NOTIFICATION_ID, // Use the tab drift notification ID
        {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "Stay Focused!",
          message: `Time to return to: ${focusTabUrl.substring(0, 100)}`,
          priority: 2,
        },
        function (notificationId) {
          if (chrome.runtime.lastError) {
            console.error(
              "Tab Drift Notification error:",
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
  }
});

// Listener for when a tab is closed
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  if (tabId === focusTabId) {
    console.log(`Focus tab ${focusTabId} was closed. Stopping monitoring.`);
    focusTabId = null;
    focusTabUrl = null;
    chrome.alarms.clear(DRIFT_ALARM_NAME);
    chrome.notifications.clear(NOTIFICATION_ID);
    chrome.notifications.clear(VIDEO_PAUSE_NOTIFICATION_ID); // Also clear video pause notif
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

// Listener for when the focus tab URL changes
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (tabId === focusTabId && changeInfo.url) {
    console.log(`Focus tab ${tabId} URL updated to: ${changeInfo.url}`);
    focusTabUrl = changeInfo.url;
    // Optionally update storage if popup relies on it for the most current URL
    // chrome.storage.local.set({ focusTabUrl: changeInfo.url });
  }
});
