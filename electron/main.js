const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const db = require("./db");

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true
    }
  });

  if (isDev) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function registerIpc() {
  ipcMain.handle("websites:list", (_, search) => db.listWebsites(search));
  ipcMain.handle("websites:create", (_, payload) => db.createWebsite(payload));
  ipcMain.handle("websites:update", (_, payload) => db.updateWebsite(payload));
  ipcMain.handle("websites:delete", (_, id) => {
    db.deleteWebsite(id);
    return true;
  });
  ipcMain.handle("websites:reorder", (_, ids) => db.reorderWebsites(ids));
  ipcMain.handle("websites:touchVisited", (_, id) => {
    db.touchVisited(id);
    return true;
  });
  ipcMain.handle("websites:export", async (event) => {
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "导出网站配置",
      defaultPath: "websites-backup.json",
      filters: [{ name: "JSON Files", extensions: ["json"] }]
    });
    if (canceled || !filePath) {
      return { canceled: true };
    }
    fs.writeFileSync(filePath, JSON.stringify(db.exportWebsites(), null, 2), "utf8");
    return { canceled: false, filePath };
  });
  ipcMain.handle("websites:import", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
      title: "导入网站配置",
      properties: ["openFile"],
      filters: [{ name: "JSON Files", extensions: ["json"] }]
    });
    if (canceled || !filePaths?.length) {
      return { canceled: true };
    }
    const payload = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
    const list = Array.isArray(payload) ? payload : [];
    const next = db.replaceAllWebsites(list);
    return { canceled: false, total: next.length };
  });
}

app.whenReady().then(() => {
  db.initDb();
  registerIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
