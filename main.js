const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 600,
    minHeight: 480,
    frame: false,
    backgroundColor: "#0c0c0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());

ipcMain.on("win:minimize", () => mainWindow.minimize());
ipcMain.on("win:close", () => mainWindow.close());

ipcMain.handle("dialog:openFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    defaultPath: path.join(os.homedir(), "Downloads"),
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.on("shell:openFolder", (_, folderPath) => {
  shell.openPath(folderPath);
});

ipcMain.handle("download:start", async (event, { url, outputPath, update }) => {
  return new Promise((resolve) => {
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, "downloader.py")
      : path.join(__dirname, "downloader.py");

    const resolvedOutput = outputPath || path.join(os.homedir(), "Downloads");
    const args = ["--url", url, "--output", resolvedOutput];
    if (update) args.push("--update");

    const py = spawn("python", [scriptPath, ...args]);

    py.stdout.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          mainWindow.webContents.send("download:event", parsed);
        } catch (_) {}
      }
    });

    py.stderr.on("data", (data) => {
      mainWindow.webContents.send("download:event", {
        type: "log",
        msg: data.toString().trim(),
      });
    });

    py.on("close", (code) => resolve({ code }));
  });
});
