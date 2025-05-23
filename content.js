// content.js

console.log("Drift: content.js - Script started.");

let videoPauseTimer = null;
const VIDEO_PAUSE_TIMEOUT_MS = 7000; // 7 seconds for testing

function findVideoElement() {
  // console.log("Drift: content.js - Attempting to find video element with 'video.html5-main-video'.");
  const videoElement = document.querySelector("video.html5-main-video");
  // if (videoElement) console.log("Drift: content.js - Found video element:", videoElement);
  // else console.log("Drift: content.js - Video element 'video.html5-main-video' NOT found.");
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
    // Clear any existing timer just in case
    if (videoPauseTimer) {
      clearTimeout(videoPauseTimer);
    }
    // Start a new timer
    videoPauseTimer = setTimeout(function () {
      console.log(
        "Drift: content.js - Video pause timeout reached. Sending message to background."
      );
      chrome.runtime.sendMessage(
        {
          action: "videoPausedTooLong",
          videoUrl: window.location.href, // Send current video URL
        },
        function (response) {
          if (chrome.runtime.lastError) {
            console.warn(
              "Drift: content.js - Error sending videoPausedTooLong message:",
              chrome.runtime.lastError.message
            );
          } else {
            // console.log("Drift: content.js - Message sent, response from background:", response);
          }
        }
      );
    }, VIDEO_PAUSE_TIMEOUT_MS);
  });

  videoElement.addEventListener("play", function () {
    console.log("Drift: content.js - Event: Video PLAYING/RESUMED!");
    if (videoPauseTimer) {
      clearTimeout(videoPauseTimer);
      console.log("Drift: content.js - Video pause timer cleared."); // Good to keep this log for now
    }
    // ---> ADDED THIS BLOCK TO SEND A MESSAGE WHEN VIDEO PLAYS <---
    chrome.runtime.sendMessage(
      {
        action: "videoPlayed", // New action type
        videoUrl: window.location.href,
      },
      function (response) {
        if (chrome.runtime.lastError) {
          console.warn(
            "Drift: content.js - Error sending videoPlayed message:",
            chrome.runtime.lastError.message
          );
        } else {
          // console.log("Drift: content.js - videoPlayed message sent, response:", response);
        }
      }
    );
    // ---> END OF ADDED BLOCK <---
  });

  videoElement.dataset.driftListenersAttached = "true";
  console.log("Drift: content.js - Listeners attached and marker set.");
}

const observer = new MutationObserver(function (
  mutationsList,
  observerInstance
) {
  const video = findVideoElement();
  if (video && video.dataset.driftListenersAttached !== "true") {
    // console.log("Drift: content.js - MutationObserver found video, attempting to attach listeners.");
    attachToVideo(video);
  }
});

// console.log("Drift: content.js - Setting up MutationObserver.");
observer.observe(document.body, { childList: true, subtree: true });

const initialVideo = findVideoElement();
if (initialVideo) {
  // console.log("Drift: content.js - Video element found on initial script load, attempting to attach listeners.");
  attachToVideo(initialVideo);
} else {
  // console.log("Drift: content.js - Main video element not found on initial script load. Observer is active.");
}
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // console.log("Drift: content.js - Message received:", request); // For debugging if needed
  if (request.action === "cancelVideoPauseTimer") {
    if (videoPauseTimer) {
      clearTimeout(videoPauseTimer);
      videoPauseTimer = null; // Reset the timer ID
      console.log(
        "Drift: content.js - Video pause timer cancelled by background (due to tab switch/deactivation)."
      );
      // sendResponse({status: "video pause timer cancelled"}); // Optional: if background needs confirmation
    }
  }
  // If you use sendResponse, you might need to return true for asynchronous responses,
  // but for this simple cancel action, it's likely not strictly needed unless background waits.
  // For now, we'll assume background doesn't wait for a response here.
});
// ---> END OF NEW MESSAGE LISTENER <---
