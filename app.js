const status = document.getElementById("status");
const result = document.getElementById("result");
const scanButton = document.getElementById("scanButton");
const reader = document.getElementById("reader");

let scanning = false;
let stream = null;
let animationFrame = null;

if (typeof jsQR !== "function") {
  document.getElementById("status").textContent =
    "ERROR: QR decoder library not loaded";
}
scanButton.addEventListener("click", async () => {
  if (scanning) return;

  result.textContent = "";
  status.textContent = "Starting camera...";

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    scanning = true;

    reader.innerHTML = `
      <video id="video"
             autoplay
             playsinline
             muted
             style="width:100%;max-width:500px;border-radius:10px;">
      </video>
      <canvas id="canvas" style="display:none;"></canvas>
    `;

    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    video.srcObject = stream;

    status.textContent = "Point camera at coupon QR code";

    video.addEventListener("loadedmetadata", () => {
      scanFrame(video, canvas, context);
    });

  } catch (error) {
    console.error(error);
    status.textContent = "Camera access failed.";
    result.textContent = error.message;
  }
});


function scanFrame(video, canvas, context) {

  if (!scanning) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const code = jsQR(
      imageData.data,
      imageData.width,
      imageData.height,
      {
        inversionAttempts: "attemptBoth"
      }
    );

    if (code) {
      handleQRCode(code.data);
      return;
    }
  }

  animationFrame = requestAnimationFrame(
    () => scanFrame(video, canvas, context)
  );
}


function handleQRCode(data) {

  stopScanner();

  status.textContent = "QR code detected.";

  result.textContent = data;
}


function stopScanner() {

  scanning = false;

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}
