const status = document.getElementById("status");
const result = document.getElementById("result");
const scanButton = document.getElementById("scanButton");
const reader = document.getElementById("reader");

let scanning = false;
let stream = null;
let animationFrame = null;

const DB_NAME = "UtopiaCouponValidator";
const DB_VERSION = 1;
const STORE_NAME = "redeemed";


/* =========================
   DATABASE
========================= */

function openDatabase() {

  return new Promise((resolve, reject) => {

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function(event) {

      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {

        db.createObjectStore(STORE_NAME, {
          keyPath: "couponId"
        });

      }
    };

    request.onsuccess = function(event) {
      resolve(event.target.result);
    };

    request.onerror = function() {
      reject(request.error);
    };

  });

}


async function isRedeemed(couponId) {

  const db = await openDatabase();

  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(couponId);

    request.onsuccess = function() {
      resolve(!!request.result);
    };

    request.onerror = function() {
      reject(request.error);
    };

  });

}


async function markRedeemed(couponId) {

  const db = await openDatabase();

  return new Promise((resolve, reject) => {

    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store = transaction.objectStore(STORE_NAME);

    store.put({
      couponId: couponId,
      redeemedAt: new Date().toISOString()
    });

    transaction.oncomplete = function() {
      resolve();
    };

    transaction.onerror = function() {
      reject(transaction.error);
    };

  });

}


/* =========================
   SCANNER
========================= */

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

    const context = canvas.getContext(
      "2d",
      { willReadFrequently: true }
    );

    video.srcObject = stream;

    status.textContent =
      "Point camera at coupon QR code";

    video.addEventListener(
      "loadedmetadata",
      () => {
        scanFrame(video, canvas, context);
      }
    );

  } catch (error) {

    console.error(error);

    status.textContent =
      "Camera access failed.";

    result.textContent =
      error.message;

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

    const imageData =
      context.getImageData(
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

  animationFrame =
    requestAnimationFrame(() =>
      scanFrame(
        video,
        canvas,
        context
      )
    );

}


/* =========================
   QR PROCESSING
========================= */

async function handleQRCode(data) {

  stopCamera();

  status.textContent =
    "QR code detected.";

  /*
     STAGE 2 TEST FORMAT

     Expected:

     UD26|TEST-0001
  */

  if (!data.startsWith("UD26|")) {

    showResult(
      "INVALID COUPON",
      "Unrecognized coupon format.",
      "invalid"
    );

    return;
  }


  const parts = data.split("|");

  const couponId = parts[1];


  if (!couponId) {

    showResult(
      "INVALID COUPON",
      "Coupon ID missing.",
      "invalid"
    );

    return;
  }


  try {

    const alreadyRedeemed =
      await isRedeemed(couponId);

    if (alreadyRedeemed) {

      showResult(
        "ALREADY REDEEMED",
        couponId,
        "duplicate"
      );

      return;
    }


    await markRedeemed(couponId);


    showResult(
      "VALID COUPON",
      couponId,
      "valid"
    );

  } catch (error) {

    console.error(error);

    showResult(
      "VALIDATION ERROR",
      "Unable to access local database.",
      "invalid"
    );

  }

}


/* =========================
   RESULT DISPLAY
========================= */

function showResult(
  heading,
  details,
  type
) {

  let background = "#f2f2f2";

  if (type === "valid") {
    background = "#e8f5e9";
  }

  if (type === "duplicate") {
    background = "#fff3cd";
  }

  if (type === "invalid") {
    background = "#fdecea";
  }

  result.innerHTML = `

    <div style="
      margin-top:20px;
      padding:20px;
      border-radius:10px;
      background:${background};
      word-break:break-word;
    ">

      <div style="
        font-size:26px;
        font-weight:bold;
        margin-bottom:10px;
      ">
        ${escapeHtml(heading)}
      </div>

      <div style="
        font-size:20px;
      ">
        ${escapeHtml(details)}
      </div>

    </div>
  `;

  scanButton.disabled = false;
  scanButton.textContent = "SCAN AGAIN";

}


/* =========================
   CAMERA CONTROL
========================= */

function stopCamera() {

  scanning = false;

  if (animationFrame) {

    cancelAnimationFrame(
      animationFrame
    );

    animationFrame = null;
  }

  if (stream) {

    stream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    stream = null;
  }

  reader.innerHTML = "";

}


function resetScanner() {

  stopCamera();

  scanButton.disabled = false;

  scanButton.textContent =
    "SCAN COUPON";

}


/* =========================
   HTML SAFETY
========================= */

function escapeHtml(value) {

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}
