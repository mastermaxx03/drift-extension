// content.js

console.log("Drift: content.js - Script started.");

let videoPauseTimer = null;
// Remove or comment out: const VIDEO_PAUSE_TIMEOUT_MS = 7000;
const DEFAULT_VIDEO_PAUSE_SECONDS_CONTENT_SCRIPT = 10; // Fallback in content script if no setting found

function findVideoElement() {
  // console.log("Drift: content.js - Attempting to find video element with 'video.html5-main-video'.");
  const videoElement = document.querySelector("video.html5-main-video");
  return videoElement;
}

function attachToVideo(videoElement) {
  if (!videoElement) {
    console.error(
      "Drift: content.js - attachToVideo called with null videoElement."
    );
    return;
  }
  if (videoElement.dataset.driftListenersAttached === "true") {
    return;
  }

  console.log(
    "Drift: content.js - Attaching listeners to video element:",
    videoElement
  );

  videoElement.addEventListener("pause", function () {
    console.log("Drift: content.js - Event: Video PAUSED!");
    if (videoPauseTimer) {
      clearTimeout(videoPauseTimer);
    }

    // ---> MODIFIED PART: Fetch custom duration from storage <---
    chrome.storage.local.get(["totalVideoPauseSeconds"], function (result) {
      let pauseTimeoutSeconds = result.totalVideoPauseSeconds;

      if (
        typeof pauseTimeoutSeconds !== "number" ||
        isNaN(pauseTimeoutSeconds) ||
        pauseTimeoutSeconds < 1
      ) {
        // Use a default if not set, not a number, or less than 1 second
        pauseTimeoutSeconds = DEFAULT_VIDEO_PAUSE_SECONDS_CONTENT_SCRIPT;
        console.log(
          `Drift: content.js - Using default video pause timeout: ${pauseTimeoutSeconds}s`
        );
      } else {
        console.log(
          `Drift: content.js - Using stored video pause timeout: ${pauseTimeoutSeconds}s`
        );
      }

      const videoPauseTimeoutMs = pauseTimeoutSeconds * 1000; // Convert to milliseconds

      videoPauseTimer = setTimeout(function () {
        console.log(
          "Drift: content.js - Video pause timeout reached. Sending message to background."
        );
        chrome.runtime.sendMessage(
          {
            action: "videoPausedTooLong",
            videoUrl: window.location.href,
          },
          function (response) {
            if (chrome.runtime.lastError) {
              console.warn(
                "Drift: content.js - Error sending videoPausedTooLong message:",
                chrome.runtime.lastError.message
              );
            }
          }
        );
      }, videoPauseTimeoutMs); // Use the fetched or default duration in MS
    });
    // ---> END OF MODIFIED PART <---
  });

  videoElement.addEventListener("play", function () {
    console.log("Drift: content.js - Event: Video PLAYING/RESUMED!");
    if (videoPauseTimer) {
      clearTimeout(videoPauseTimer);
      console.log("Drift: content.js - Video pause timer cleared.");
    }
    chrome.runtime.sendMessage(
      {
        action: "videoPlayed",
        videoUrl: window.location.href,
      },
      function (response) {
        if (chrome.runtime.lastError) {
          console.warn(
            "Drift: content.js - Error sending videoPlayed message:",
            chrome.runtime.lastError.message
          );
        }
      }
    );
  });

  videoElement.dataset.driftListenersAttached = "true";
  console.log("Drift: content.js - Listeners attached and marker set.");
}

// ... (MutationObserver and initial video finding logic remain the same) ...
const observer = new MutationObserver(function (
  mutationsList,
  observerInstance
) {
  const video = findVideoElement();
  if (video && video.dataset.driftListenersAttached !== "true") {
    attachToVideo(video);
  }
});
observer.observe(document.body, { childList: true, subtree: true });

const initialVideo = findVideoElement();
if (initialVideo) {
  attachToVideo(initialVideo);
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "cancelVideoPauseTimer") {
    if (videoPauseTimer) {
      clearTimeout(videoPauseTimer);
      videoPauseTimer = null;
      console.log(
        "Drift: content.js - Video pause timer cancelled by background (due to tab switch/deactivation)."
      );
    }
  }
  return false; // Not sending an async response from this listener
});
