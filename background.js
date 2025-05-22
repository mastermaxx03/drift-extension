// background.js

let focusTabId = null;
let focusTabUrl = null; // We'll store the URL to show in the notification

const DRIFT_ALARM_NAME = "driftAlarm";
const NOTIFICATION_ID = "driftNotification";
const TEST_DELAY_MILLISECONDS = 10000; // 10 seconds for testing

console.log(
  "Background script loaded. Test delay for drift: ",
  TEST_DELAY_MILLISECONDS / 1000,
  "seconds"
);

// Listener for messages from other parts of the extension (e.g., popup)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log("Message received in background:", request);
  if (request.action === "startMonitoring") {
    focusTabId = request.tabId;
    focusTabUrl = request.tabUrl; // Store the URL
    console.log(
      `Background script now monitoring focusTabId: ${focusTabId} (${focusTabUrl})`
    );

    // Clear any existing alarm when starting new monitoring
    chrome.alarms.clear(DRIFT_ALARM_NAME, (wasCleared) => {
      if (wasCleared)
        console.log("Cleared existing drift alarm on new activation.");
    });

    sendResponse({ status: "Monitoring started for tab " + focusTabId });
    return true; // Indicates you wish to send a response asynchronously
  }
  // Add other actions here later, like "stopMonitoring"
  return false; // Default if no async response planned for this message
});

// Listener for when the active tab changes
chrome.tabs.onActivated.addListener(function (activeInfo) {
  // activeInfo contains tabId and windowId
  console.log("Tab activated:", activeInfo);

  if (focusTabId === null) {
    // console.log("Drift is not active on any tab, ignoring tab switch.");
    return; // Drift not active
  }

  if (activeInfo.tabId === focusTabId) {
    console.log("Switched TO the focus tab:", focusTabId);
    // Clear the drift alarm
    chrome.alarms.clear(DRIFT_ALARM_NAME, function (wasCleared) {
      if (wasCleared) {
        console.log("Drift alarm cleared because user returned to focus tab.");
      }
    });

    // Clear the notification if it's visible
    chrome.notifications.clear(NOTIFICATION_ID, function (wasCleared) {
      if (wasCleared) {
        console.log(
          "Drift notification cleared because user returned to focus tab."
        );
      }
    });
  } else {
    console.log(
      `Switched AWAY from focus tab ${focusTabId} to tab ${activeInfo.tabId}`
    );

    // Get stored total seconds or use a default
    chrome.storage.local.get(["totalDriftSeconds"], function (result) {
      let actualDriftSeconds = result.totalDriftSeconds;

      // TEST_DELAY_MILLISECONDS was 10 seconds.
      // MINIMUM_TOTAL_SECONDS in popup is 5 seconds.
      // Default to TEST_DELAY_MILLISECONDS / 1000 if nothing valid is found.
      const defaultSecondsForAlarm = TEST_DELAY_MILLISECONDS / 1000;

      if (
        typeof actualDriftSeconds !== "number" ||
        isNaN(actualDriftSeconds) ||
        actualDriftSeconds < defaultSecondsForAlarm / 2
      ) {
        // ensure it's a reasonable minimum
        actualDriftSeconds = defaultSecondsForAlarm;
        console.log(
          `Using default/test delay of ${actualDriftSeconds} seconds because no valid user setting found or setting was too small.`
        );
      }

      const delayInMilliseconds = actualDriftSeconds * 1000;

      console.log(
        `Setting drift alarm for ${actualDriftSeconds} seconds (when: ${
          Date.now() + delayInMilliseconds
        }).`
      );
      chrome.alarms.create(DRIFT_ALARM_NAME, {
        when: Date.now() + delayInMilliseconds,
      }); // Closes chrome.alarms.create
    }); // Closes callback for chrome.storage.local.get
  } // Closes 'else' block
}); // Closes chrome.tabs.onActivated.addListener

// Listener for when an alarm goes off
chrome.alarms.onAlarm.addListener(function (alarm) {
  console.log("Alarm fired:", alarm);
  if (alarm.name === DRIFT_ALARM_NAME) {
    console.log("Drift alarm triggered!");
    if (focusTabUrl) {
      chrome.notifications.create(
        NOTIFICATION_ID,
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
              "Notification error:",
              chrome.runtime.lastError.message
            );
          } else {
            console.log("Drift notification shown:", notificationId);
          }
        }
      );
    } else {
      console.log(
        "FocusTabUrl not set (or Drift deactivated), so not showing notification from alarm."
      );
    }
  }
});

// Listener for when a tab is closed
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  if (tabId === focusTabId) {
    console.log(
      `Focus tab ${focusTabId} was closed. Stopping monitoring and clearing alarm.`
    );
    focusTabId = null;
    focusTabUrl = null;
    chrome.alarms.clear(DRIFT_ALARM_NAME);
    chrome.notifications.clear(NOTIFICATION_ID);
    chrome.storage.local.remove(["focusTabId", "focusTabUrl"], function () {
      if (chrome.runtime.lastError) {
        console.error(
          "Error removing focus tab from storage:",
          chrome.runtime.lastError.message
        );
      } else {
        console.log("Focus tab data cleared from storage as tab was closed.");
      }
    });
  }
});

// Listener for when the focus tab URL changes
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (tabId === focusTabId && changeInfo.url) {
    console.log(`Focus tab ${tabId} URL updated to: ${changeInfo.url}`);
    focusTabUrl = changeInfo.url;
  }
});
