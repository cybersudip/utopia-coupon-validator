const status = document.getElementById("status");
const result = document.getElementById("result");
const scanButton = document.getElementById("scanButton");
const reader = document.getElementById("reader");

let scanning = false;
let stream = null;
let animationFrame = null;

scanButton.addEventListener("click", startScanner);

async function startScanner() {

  if (scanning) return;

  result.textContent = "";
  reader.innerHTML = "";

  scanButton.disabled = true;
  scanButton.textContent = "SCANNING...";

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
      <video
        id="video"
        autoplay
        playsinline
        muted
        style="
          width:100%;
          max-width:500px;
          border-radius:10px;
        ">
      </video>

      <canvas id="canvas" style="display:none;"></canvas>
    `;

    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d", {
      willReadFrequently: true
    });

    video.srcObject = stream;

    status.textContent = "Point camera at coupon QR code";

    video.addEventListener("loadedmetadata", () => {
      scanFrame(video, canvas, context);
    });

  } catch (error) {

    console.error(error);

    status.textContent = "Camera access failed.";
    result.textContent = error.message;

    resetScanner();

  }
}


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

  animationFrame = requestAnimationFrame(() =>
    scanFrame(video, canvas, context)
  );
}


function handleQRCode(data) {

  stopCamera();

  status.textContent = "QR code detected.";

  result.innerHTML = `
    <div style="
      margin-top:20px;
      padding:20px;
      border-radius:10px;
      background:#f2f2f2;
      word-break:break-word;
    ">
      <div style="font-size:16px;margin-bottom:10px;">
        QR CONTENT
      </div>

      <div style="font-size:22px;">
        ${escapeHtml(data)}
      </div>
    </div>
  `;

  scanButton.disabled = false;
  scanButton.textContent = "SCAN AGAIN";
}


function stopCamera() {

  scanning = false;

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  if (stream) {

    stream.getTracks().forEach(track => {
      track.stop();
    });

    stream = null;
  }

  reader.innerHTML = "";
}


function resetScanner() {

  stopCamera();

  scanButton.disabled = false;
  scanButton.textContent = "SCAN COUPON";
}


function escapeHtml(value) {

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
