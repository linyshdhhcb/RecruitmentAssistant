const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  listWebsites: (search) => ipcRenderer.invoke("websites:list", search),
  createWebsite: (payload) => ipcRenderer.invoke("websites:create", payload),
  updateWebsite: (payload) => ipcRenderer.invoke("websites:update", payload),
  deleteWebsite: (id) => ipcRenderer.invoke("websites:delete", id),
  reorderWebsites: (ids) => ipcRenderer.invoke("websites:reorder", ids),
  touchVisited: (id) => ipcRenderer.invoke("websites:touchVisited", id),
  exportWebsites: () => ipcRenderer.invoke("websites:export"),
  importWebsites: () => ipcRenderer.invoke("websites:import"),
  openExternal: (url) => ipcRenderer.invoke("system:openExternal", url)
});
