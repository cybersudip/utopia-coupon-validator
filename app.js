const DB_NAME = "UtopiaCouponValidator";
const DB_VERSION = 1;
const STORE_NAME = "redeemed";

let video = null;
let canvas = null;
let ctx = null;
let stream = null;
let scanning = false;
let lastScanned = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function () {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "couponId" });
      }
    };

    request.onsuccess = function () {
      resolve(request.result);
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
}

async function isRedeemed(couponId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(couponId);

    request.onsuccess = function () {
      resolve(!!request.result);
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
}

async function markRedeemed(couponId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const request = store.put({
      couponId: couponId,
      redeemedAt: new Date().toISOString()
    });

    request.onsuccess = function () {
      resolve();
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
}

async function startScanner() {

  const reader = document.getElementById("reader");

  reader.innerHTML = "";

  video = document.createElement("video");
  video.setAttribute("playsinline", "");

  reader.appendChild(video);

  canvas = document.createElement("canvas");
  ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  try {

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "environment"
        }
      },
      audio: false
    });

    video.srcObject = stream;

    await video.play();

    scanning = true;

    requestAnimationFrame(scanFrame);

  } catch (error) {

    reader.innerHTML = "<p>Camera access failed.</p>";

    console.error(error);
  }
}

function scanFrame() {

  if (!scanning) return;

  if (
    video &&
    video.readyState === video.HAVE_ENOUGH_DATA
  ) {

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const code = jsQR(
      imageData.data,
      imageData.width,
      imageData.height
    );

    if (code && code.data) {

      handleQRCode(code.data);

      return;
    }
  }

  requestAnimationFrame(scanFrame);
}

async function handleQRCode(qrContent) {

  if (lastScanned === qrContent) return;

  lastScanned = qrContent;

  stopCamera();

  showMessage(
    "QR code detected.",
    "QR CONTENT: " + escapeHtml(qrContent)
  );

  /*
   * Stage 2A validation
   */

  if (!qrContent.startsWith("UD26|")) {

    showInvalid();

    return;
  }

  const parts = qrContent.split("|");

  if (parts.length < 2) {

    showInvalid();

    return;
  }

  const couponId = parts[1];

  if (!couponId) {

    showInvalid();

    return;
  }

  const alreadyRedeemed =
    await isRedeemed(couponId);

  if (alreadyRedeemed) {

    showAlreadyRedeemed();

    return;
  }

  await markRedeemed(couponId);

  showValid(couponId);
}

function showValid(couponId) {

  showMessage(
    "VALID COUPON",
    "Coupon ID: " + escapeHtml(couponId)
  );
}

function showAlreadyRedeemed() {

  showMessage(
    "ALREADY REDEEMED",
    "This coupon has already been used."
  );
}

function showInvalid() {

  showMessage(
    "INVALID COUPON",
    "The QR code is not a valid Utopia coupon."
  );
}

function showMessage(title, text) {

  const reader = document.getElementById("reader");
  reader.innerHTML = "";

  const result = document.getElementById("result");

  const scanButton = document.getElementById("scanButton");

  if (scanButton) {
  scanButton.disabled = true;
  scanButton.style.visibility = "hidden";
}

  result.innerHTML =
    "<h2>" +
    escapeHtml(title) +
    "</h2>" +
    "<p>" +
    text +
    "</p>" +
    '<button onclick="resetScanner()">SCAN AGAIN</button>';
}

function stopCamera() {

  scanning = false;

  if (stream) {

    stream
      .getTracks()
      .forEach(track => track.stop());

    stream = null;
  }

  if (video) {

    video.srcObject = null;
  }
}

function resetScanner() {

  lastScanned = null;

  const result = document.getElementById("result");
  result.innerHTML = "";

  const scanButton = document.getElementById("scanButton");

  if (scanButton) {
  scanButton.disabled = false;
  scanButton.style.visibility = "visible";
}

  startScanner();
}

function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* SCAN COUPON button */

document
  .getElementById("scanButton")
  .addEventListener(
    "click",
    startScanner
  );
