// offscreen.js

console.log("Drift Offscreen: Script loaded and ready to play sounds.");

let currentAudio = null; // Variable to hold the currently playing audio object

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "playSoundOffscreen" && message.soundPath) {
    // If a sound is already playing, stop it before starting a new one
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0; // Reset for next time
      console.log("Drift Offscreen: Stopped previous sound to play new one.");
    }

    currentAudio = new Audio(message.soundPath);
    currentAudio
      .play()
      .then(() => {
        console.log("Drift Offscreen: Playing sound -", message.soundPath);
        currentAudio.onended = () => {
          // When sound finishes naturally
          // console.log("Drift Offscreen: Sound finished playing -", message.soundPath);
          currentAudio = null; // Clear reference once ended
        };
      })
      .catch((error) => {
        console.error(
          "Drift Offscreen: Error playing sound -",
          message.soundPath,
          error
        );
        currentAudio = null; // Clear reference on error too
      });
    // sendResponse({status: "Playback initiated"}); // Optional response
    return false;
  } else if (message.action === "stopSoundOffscreen") {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0; // Reset the playback position
      console.log("Drift Offscreen: Sound stopped via message.");
      currentAudio = null; // Clear the reference
      // sendResponse({status: "Sound stopped"}); // Optional response
    } else {
      // console.log("Drift Offscreen: No sound currently playing to stop.");
      // sendResponse({status: "No sound was playing"}); // Optional response
    }
    return false;
  }
  return false;
});
