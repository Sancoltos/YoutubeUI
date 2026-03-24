const os = { homedir: () => "" };

// Elements
const urlInput = document.getElementById("url-input");
const outputInput = document.getElementById("output-input");
const browseBtn = document.getElementById("browse-btn");
const updateCheck = document.getElementById("update-check");
const downloadBtn = document.getElementById("download-btn");
const progressBar = document.getElementById("progress-bar");
const progressStats = document.getElementById("progress-stats");
const logBox = document.getElementById("log-box");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const openFolderBtn = document.getElementById("open-folder-btn");

// Window controls
document.getElementById("btn-min").onclick = () => window.api.minimize();
document.getElementById("btn-close").onclick = () => window.api.close();

// Default output path
outputInput.value = "";
outputInput.placeholder = "Click Browse or defaults to ~/Downloads";

// Browse
browseBtn.onclick = async () => {
  const folder = await window.api.openFolder();
  if (folder) outputInput.value = folder;
};

// Open folder
openFolderBtn.onclick = () => {
  const p = outputInput.value || (navigator.userAgent.includes("Win") ? "%USERPROFILE%\\Downloads" : "~/Downloads");
  window.api.openInExplorer(p);
};

let logEmpty = true;

function appendLog(text, cls = "") {
  if (logEmpty) {
    logBox.innerHTML = "";
    logEmpty = false;
  }
  const line = document.createElement("div");
  line.className = "log-line" + (cls ? " " + cls : "");
  line.textContent = text;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

function setStatus(state, text) {
  statusDot.className = "dot " + state;
  statusText.textContent = text;
}

function resetProgress() {
  progressBar.style.width = "0%";
  progressBar.className = "progress-bar-fill";
  progressStats.textContent = "";
}

// Download
downloadBtn.onclick = async () => {
  const url = urlInput.value.trim();
  if (!url) {
    appendLog("✗ No URL provided.", "error");
    return;
  }

  const outputPath = outputInput.value.trim() || null;

  // Reset UI
  logBox.innerHTML = "";
  logEmpty = false;
  resetProgress();
  openFolderBtn.classList.remove("visible");
  downloadBtn.disabled = true;
  setStatus("busy", "Downloading...");
  appendLog("→ Starting download...", "accent");

  const cleanup = window.api.onDownloadEvent((evt) => {
    switch (evt.type) {
      case "log":
        appendLog(evt.msg);
        break;
      case "info":
        appendLog(`▸ ${evt.title}`, "info");
        if (evt.duration) {
          const m = Math.floor(evt.duration / 60);
          const s = String(evt.duration % 60).padStart(2, "0");
          appendLog(`  Duration: ${m}:${s}`, "dim");
        }
        break;
      case "progress": {
        const pct = Math.round(evt.percent);
        progressBar.style.width = pct + "%";
        const parts = [];
        if (evt.speed) parts.push(evt.speed);
        if (evt.eta && evt.eta !== "Unknown ETA") parts.push(`ETA ${evt.eta}`);
        if (evt.downloaded && evt.total) parts.push(`${evt.downloaded} / ${evt.total}`);
        progressStats.textContent = parts.join("  ·  ");
        break;
      }
      case "finished":
        appendLog(`✔ ${evt.msg}`, "success");
        progressBar.style.width = "100%";
        break;
      case "done":
        appendLog("✔ All done!", "success");
        progressBar.className = "progress-bar-fill success";
        progressBar.style.width = "100%";
        setStatus("ready", "Done");
        downloadBtn.disabled = false;
        openFolderBtn.classList.add("visible");
        cleanup();
        break;
      case "error":
        appendLog(`✗ ${evt.msg}`, "error");
        progressBar.className = "progress-bar-fill error";
        setStatus("error", "Error");
        downloadBtn.disabled = false;
        cleanup();
        break;
    }
  });

  const result = await window.api.startDownload({
    url,
    outputPath: outputPath,
    update: updateCheck.checked,
  });

  // Fallback if events didn't fire done/error
  if (result.code !== 0 && !downloadBtn.disabled === false) {
    setStatus("error", "Failed");
    downloadBtn.disabled = false;
  }
};

// Allow Enter key on URL input
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") downloadBtn.click();
});
