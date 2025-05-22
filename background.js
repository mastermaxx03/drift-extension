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
    // Set the drift alarm
    // Check if an alarm already exists to avoid resetting it unnecessarily if multiple 'away' events fire quickly (optional)
    // For simplicity now, we just create/replace it.
    console.log(
      `Setting drift alarm for ${TEST_DELAY_MILLISECONDS / 1000} seconds.`
    );
    chrome.alarms.create(DRIFT_ALARM_NAME, {
      when: Date.now() + TEST_DELAY_MILLISECONDS,
    });
  }
});

// Listener for when an alarm goes off
chrome.alarms.onAlarm.addListener(function (alarm) {
  console.log("Alarm fired:", alarm);
  if (alarm.name === DRIFT_ALARM_NAME) {
    console.log("Drift alarm triggered!");
    // Check if we are still supposed to be monitoring this tab
    // (e.g., user hasn't manually deactivated Drift or closed the tab)
    // For now, focusTabUrl check is a simple proxy for this.
    if (focusTabUrl) {
      chrome.notifications.create(
        NOTIFICATION_ID,
        {
          type: "basic",
          iconUrl: "icons/icon128.png", // Make sure this icon exists
          title: "Stay Focused!",
          message: `Time to return to: ${focusTabUrl.substring(0, 100)}`, // Show part of URL
          priority: 2, // Range from -2 to 2
          // requireInteraction: true, // Optional: makes notification stay until user interacts
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
    // Optional: After showing notification, do you want to clear focusTabId?
    // If so, the user would need to re-activate Drift.
    // focusTabId = null;
    // focusTabUrl = null;
    // chrome.storage.local.remove(['focusTabId', 'focusTabUrl']);
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
    chrome.alarms.clear(DRIFT_ALARM_NAME); // Clear the alarm
    // Also clear the notification if it happens to be showing (though less likely here)
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

// Listener for when the focus tab URL changes (e.g. navigation within the same tab)
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // We only care if the URL changes for our specific focusTabId
  if (tabId === focusTabId && changeInfo.url) {
    console.log(`Focus tab ${tabId} URL updated to: ${changeInfo.url}`);
    focusTabUrl = changeInfo.url;
    // If the popup is open, it will read from storage. If we want the background's version
    // of focusTabUrl to be the absolute source of truth for notifications, this is fine.
    // Optionally, update it in storage if other parts of the extension rely on storage for this.
    // chrome.storage.local.set({ focusTabUrl: changeInfo.url }, function() {
    //   if (chrome.runtime.lastError) {
    //     console.error("Error updating focusTabUrl in storage:", chrome.runtime.lastError.message);
    //   }
    // });
  }
});
