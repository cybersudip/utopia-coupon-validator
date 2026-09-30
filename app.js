document.getElementById("status").textContent =
  "Validator ready.";

document.getElementById("scanButton").addEventListener("click", () => {
  document.getElementById("result").textContent =
    "QR scanner will be added in the next step.";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(() => {
        console.log("Service worker registered");
      })
      .catch(error => {
        console.error("Service worker registration failed:", error);
      });
  });
}
