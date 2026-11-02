"use strict";
// The only things the page can do with the desktop app: ask for wallpaper mode, and say when a recording starts or stops.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pfApp", { isApp: true, wallpaper: on => ipcRenderer.send("pf-wallpaper", !!on), recording: on => ipcRenderer.send("pf-recording", !!on), quit: () => ipcRenderer.send("pf-quit") });
