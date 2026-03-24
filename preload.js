const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  minimize: () => ipcRenderer.send("win:minimize"),
  close: () => ipcRenderer.send("win:close"),
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  openInExplorer: (p) => ipcRenderer.send("shell:openFolder", p),
  startDownload: (opts) => ipcRenderer.invoke("download:start", opts),
  onDownloadEvent: (cb) => {
    ipcRenderer.on("download:event", (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("download:event");
  },
});
