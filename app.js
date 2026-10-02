const DB_NAME = "UtopiaCouponValidator";
const DB_VERSION = 1;
const STORE_NAME = "redeemed";

let video = null;
let canvas = null;
let ctx = null;
let stream = null;
let scanning = false;
let lastScanned = null;


// ===============================
// IndexedDB
// ===============================

function openDatabase() {

  return new Promise((resolve, reject) => {

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function () {

      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "couponId"
        });
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

    const transaction =
      db.transaction(STORE_NAME, "readonly");

    const store =
      transaction.objectStore(STORE_NAME);

    const request =
      store.get(couponId);

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

    const transaction =
      db.transaction(STORE_NAME, "readwrite");

    const store =
      transaction.objectStore(STORE_NAME);

    const request =
      store.put({
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


// ===============================
// Base64 conversion
// ===============================

function base64ToArrayBuffer(base64) {

  const binaryString = atob(base64);

  const bytes =
    new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;

}


// ===============================
// Import RSA public key
// ===============================

async function importPublicKey() {

  const keyData =
    base64ToArrayBuffer(PUBLIC_KEY_BASE64);

  return await crypto.subtle.importKey(
    "spki",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

}


// ===============================
// Verify RSA signature
// ===============================

async function verifyCouponSignature(
  couponData,
  signatureBase64
) {

  try {

    const publicKey =
      await importPublicKey();

    const signature =
      base64ToArrayBuffer(signatureBase64);

    const data =
      new TextEncoder().encode(couponData);

    return await crypto.subtle.verify(
      {
        name: "RSASSA-PKCS1-v1_5"
      },
      publicKey,
      signature,
      data
    );

  } catch (error) {

    console.error(
      "Signature verification error:",
      error
    );

    return false;

  }

}


// ===============================
// Scanner
// ===============================

async function startScanner() {

  const reader =
    document.getElementById("reader");

  reader.innerHTML = "";

  video =
    document.createElement("video");

  video.setAttribute("playsinline", "");

  reader.appendChild(video);

  canvas =
    document.createElement("canvas");

  ctx =
    canvas.getContext("2d", {
      willReadFrequently: true
    });

  try {

    stream =
      await navigator.mediaDevices.getUserMedia({
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

    reader.innerHTML =
      "<p>Camera access failed.</p>";

    console.error(error);

  }

}


function scanFrame() {

  if (!scanning) {
    return;
  }

  if (
    video &&
    video.readyState === video.HAVE_ENOUGH_DATA
  ) {

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const code =
      jsQR(
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


// ===============================
// QR processing
// ===============================

async function handleQRCode(qrContent) {

  if (lastScanned === qrContent) {
    return;
  }

  lastScanned = qrContent;

  stopCamera();

  showMessage(
    "VERIFYING COUPON...",
    "Please wait."
  );

  // Expected format:
  //
  // UD26|TEST-0001|<RSA SIGNATURE>

  const parts =
    qrContent.split("|");

  if (parts.length !== 3) {

    showInvalid();

    return;
  }

  const eventCode = parts[0];
  const couponId = parts[1];
  const signature = parts[2];

  // Check event code
  if (eventCode !== "UD26") {

    showInvalid();

    return;
  }

  // Check coupon ID
  if (!couponId) {

    showInvalid();

    return;
  }

  // Check signature
  if (!signature) {

    showInvalid();

    return;
  }

  const couponData =
    eventCode + "|" + couponId;

  const validSignature =
    await verifyCouponSignature(
      couponData,
      signature
    );

  if (!validSignature) {

    showInvalid();

    return;
  }

  // Signature is valid.
  // Now check whether coupon was already redeemed.

  const alreadyRedeemed =
    await isRedeemed(couponId);

  if (alreadyRedeemed) {

    showAlreadyRedeemed();

    return;
  }

  // First valid redemption
  await markRedeemed(couponId);

  showValid(couponId);

}


// ===============================
// Result screens
// ===============================

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

  const reader =
    document.getElementById("reader");

  reader.innerHTML = "";

  const result =
    document.getElementById("result");

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

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;
  }

  if (video) {
    video.srcObject = null;
  }

}


function resetScanner() {

  lastScanned = null;

  const result =
    document.getElementById("result");

  result.innerHTML = "";

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
