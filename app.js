const status = document.getElementById("status");
const result = document.getElementById("result");
const scanButton = document.getElementById("scanButton");

let scanner = null;

scanButton.addEventListener("click", async () => {

  result.textContent = "";
  status.textContent = "Starting camera...";

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.textContent = "Camera is not supported on this device.";
    return;
  }

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      }
    });

    stream.getTracks().forEach(track => track.stop());

    status.textContent = "Camera permission granted.";

    startScanner();

  } catch (error) {

    console.error(error);

    status.textContent =
      "Camera permission is required to scan coupons.";

  }

});

function startScanner() {

  if (scanner) {
    scanner.stop().catch(() => {});
  }

  scanner = document.createElement("video");

  scanner.setAttribute("autoplay", "");
  scanner.setAttribute("playsinline", "");

  scanner.style.width = "100%";
  scanner.style.maxWidth = "500px";

  document.getElementById("reader").innerHTML = "";
  document.getElementById("reader").appendChild(scanner);

  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" }
    }
  }).then(stream => {

    scanner.srcObject = stream;

    status.textContent =
      "Camera active. QR scanning will be added next.";

  }).catch(error => {

    console.error(error);

    status.textContent =
      "Unable to access camera.";

  });
}

if ("serviceWorker" in navigator) {

  window.addEventListener("load", () => {

    navigator.serviceWorker.register("sw.js")
      .then(() => {
        console.log("Service worker registered");
      })
      .catch(error => {
        console.error(
          "Service worker registration failed:",
          error
        );
      });

  });

}
