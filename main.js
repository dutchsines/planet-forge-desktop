"use strict";
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, powerMonitor, screen, ipcMain, Notification, shell } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

/* ---------- command line: --wallpaper  --windowed  --fps=30  --seed=123 ---------- */
const argv = process.argv.slice(1);
const flag = n => argv.includes("--" + n);
const val = n => { const a = argv.find(x => x.startsWith("--" + n + "=")); return a ? a.split("=")[1] : null; };

// GPU: ask Chromium for the fast path. A planet shader this size wants the real GPU, not a fallback.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");   // keep rendering when another window covers us (wallpaper mode)
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");        // ambient sound without a click

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

const cfgFile = path.join(app.getPath("userData"), "settings.json");
let cfg = { wallpaper: false, fps: 30, bounds: null, fullscreen: false, login: false, pauseOnBattery: true, display: 0,
  autoPause: true, exitBtn: true, zoom: 1, worldMins: 30, monitors: "primary", realSun: false, trayClose: false };
try { Object.assign(cfg, JSON.parse(fs.readFileSync(cfgFile, "utf8"))); } catch (e) {}
const save = () => { try { fs.mkdirSync(path.dirname(cfgFile), { recursive: true }); fs.writeFileSync(cfgFile, JSON.stringify(cfg)); } catch (e) {} };
cfg.wallpaper = flag("wallpaper") && !flag("windowed");          // the app always opens as a normal window unless started with --wallpaper (wallpaper mode is no longer remembered between runs)
if (val("fps")) cfg.fps = Math.max(5, Math.min(120, +val("fps") || 30));

let wins = [], tray = null, onBattery = false, otherFullscreen = false, fsSupported = true, recording = false;
const primary = () => wins.find(w => !w.isDestroyed());
const live = () => wins.filter(w => !w.isDestroyed());
const INDEX = path.join(__dirname, "app", "index.html");
const eachPage = js => live().forEach(w => w.webContents.executeJavaScript(js).catch(() => {}));

function wallpaperFps() { return otherFullscreen && cfg.autoPause ? 2 : onBattery && cfg.pauseOnBattery ? Math.min(cfg.fps, 15) : cfg.fps; }
function pageQuery(first) {
  const q = {};
  if (cfg.wallpaper) { q.wallpaper = "1"; q.fps = String(wallpaperFps()); q.zoom = String(cfg.zoom); }
  if (val("seed") && first) q.seed = val("seed");
  return q;
}
function applyPageSettings(w) {                                    // things the tray controls but the page owns: world timer, real-time sun
  const secs = cfg.worldMins > 0 ? cfg.worldMins * 60 : 0;
  w.webContents.executeJavaScript(`try{S.endless=${secs === 0};${secs ? `S.endlessSecs=${secs};` : ""}S.realSun=${!!cfg.realSun};}catch(e){}`).catch(() => {});
}
function applyFps() { if (cfg.wallpaper) eachPage(`typeof WP!=="undefined"&&(WP.fps=${wallpaperFps()})`); syncControl(); }

/* ---------- windows ---------- */
function sendBehind(w, done) {                                     // X11 / XWayland: mark the window "below everything, on every desktop, not in the taskbar" before and just after it is shown
  const cb = () => done && done();
  if (process.platform !== "linux" || w.isDestroyed()) return cb();
  let id; try { id = "0x" + w.getNativeWindowHandle().readUInt32LE(0).toString(16); } catch (e) { return cb(); }
  execFile("xprop", ["-id", id, "-f", "_NET_WM_STATE", "32a", "-set", "_NET_WM_STATE", "_NET_WM_STATE_BELOW,_NET_WM_STATE_STICKY,_NET_WM_STATE_SKIP_TASKBAR,_NET_WM_STATE_SKIP_PAGER"], { timeout: 1500 }, () => {
    execFile("wmctrl", ["-i", "-r", id, "-b", "add,below,sticky,skip_taskbar,skip_pager"], { timeout: 1500 }, () => cb());         // after the window is mapped the window manager only listens to a message, which wmctrl sends (optional)
  });
}
/* Windows: re-parent the window into the desktop's wallpaper layer ("WorkerW"), so it draws behind the icons like a real wallpaper.
   Done with a tiny PowerShell helper (no native module needed). If anything fails the window simply stays a bottom-most, click-through window. */
const WIN_PS = `param([long]$h,[int]$x,[int]$y,[int]$w,[int]$ht)
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class PFW {
  public delegate bool EP(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string t);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EP cb, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  public static IntPtr Find() {
    IntPtr pm = FindWindow("Progman", null), r; SendMessageTimeout(pm, 0x052C, IntPtr.Zero, IntPtr.Zero, 0, 1000, out r);
    IntPtr ww = IntPtr.Zero;
    EnumWindows((hh, l) => { if (FindWindowEx(hh, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero) ww = FindWindowEx(IntPtr.Zero, hh, "WorkerW", null); return true; }, IntPtr.Zero);
    if (ww == IntPtr.Zero) ww = FindWindowEx(pm, IntPtr.Zero, "WorkerW", null);
    return ww;
  }
  public static bool Attach(IntPtr win, int x, int y, int w, int h) {
    IntPtr ww = Find(); if (ww == IntPtr.Zero) return false;
    SetParent(win, ww); return SetWindowPos(win, IntPtr.Zero, x, y, w, h, 0x0050);
  }
}
"@
if ([PFW]::Attach([IntPtr]$h,$x,$y,$w,$ht)) { "OK" } else { "FAIL" }
`;
function attachWin(w, d) {
  if (process.platform !== "win32" || w.isDestroyed() || flag("no-attach")) return;
  try {
    const h = w.getNativeWindowHandle(), id = h.length >= 8 ? h.readBigUInt64LE(0).toString() : String(h.readUInt32LE(0));
    const phys = screen.getAllDisplays().map(x => screen.dipToScreenRect(null, x.bounds)), minX = Math.min(...phys.map(r => r.x)), minY = Math.min(...phys.map(r => r.y)), r = screen.dipToScreenRect(null, d.bounds);
    const f = path.join(app.getPath("userData"), "attach.ps1"); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, WIN_PS);
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", f, id, String(r.x - minX), String(r.y - minY), String(r.width), String(r.height)], { timeout: 15000, windowsHide: true }, () => {});
  } catch (e) {}
}
function makeWindow(d, first) {
  const common = { backgroundColor: "#000000", show: false, autoHideMenuBar: true, title: "Planet Forge", icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !cfg.wallpaper, spellcheck: false } };
  let w;
  if (cfg.wallpaper) {
    // A borderless window the size of one screen, kept under everything else and click-through, with no taskbar entry.
    w = new BrowserWindow({ ...common, x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height, frame: false, transparent: false, resizable: false, movable: false,
      skipTaskbar: true, focusable: false, hasShadow: false, fullscreenable: false, type: process.platform === "linux" ? "desktop" : undefined, enableLargerThanScreen: true });
    w.setIgnoreMouseEvents(true);
    try { w.setAlwaysOnTop(false); w.setAlwaysOnBottom && w.setAlwaysOnBottom(true); } catch (e) {}
    if (process.platform === "darwin") { try { w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); w.setWindowButtonVisibility(false); } catch (e) {} }
  } else {
    const b = cfg.bounds || { width: 1280, height: 800 };
    w = new BrowserWindow({ ...common, ...b, minWidth: 640, minHeight: 420, fullscreen: !!cfg.fullscreen });
    w.on("close", e => { if (!app.isQuitting && cfg.trayClose) { e.preventDefault(); w.hide(); } });
    const keep = () => { if (!w.isDestroyed() && !w.isFullScreen() && !w.isMaximized() && !w.isMinimized()) { cfg.bounds = w.getBounds(); save(); } };
    w.on("resized", keep); w.on("moved", keep);
    w.on("enter-full-screen", () => { cfg.fullscreen = true; save(); }); w.on("leave-full-screen", () => { cfg.fullscreen = false; save(); });
  }
  w.once("ready-to-show", () => { if (!cfg.wallpaper) return w.show(); sendBehind(w, () => { if (!w.isDestroyed()) { w.showInactive(); setTimeout(() => sendBehind(w), 400); setTimeout(() => attachWin(w, d), 900); } }); });
  w.webContents.on("render-process-gone", () => { setTimeout(createWindows, 1500); });          // GPU or renderer crash: start again instead of leaving a dead window
  w.webContents.on("did-fail-load", () => setTimeout(() => !w.isDestroyed() && w.loadFile(INDEX, { query: pageQuery(first) }), 2000));
  w.webContents.on("did-finish-load", () => applyPageSettings(w));
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", e => e.preventDefault());
  w.loadFile(INDEX, { query: pageQuery(first) });
  return w;
}

function createWindows() {
  const old = live();                                              // build the new windows first, then retire the old ones, so the app never has zero windows
  const displays = screen.getAllDisplays(), prim = screen.getPrimaryDisplay();
  wins = [];
  if (cfg.wallpaper) {
    const list = cfg.monitors === "all" ? displays : [displays.find(x => x.id === prim.id) || displays[0]];
    list.forEach((d, i) => wins.push(makeWindow(d, i === 0)));      // every monitor gets its own world
  } else wins.push(makeWindow(prim, true));
  old.forEach(w => { w.removeAllListeners("close"); w.destroy(); });
  syncControl(); buildMenu();
}
/* a small always-on-top "Exit wallpaper" pill: the wallpaper itself is click-through, so this is the on-screen way back */
let ctl = null;
const CTL_HTML = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden;font:600 13px system-ui,sans-serif}
button{width:100%;height:100%;border:1px solid rgba(160,200,255,.45);border-radius:22px;background:rgba(10,16,32,.72);color:#d6e6ff;cursor:pointer;opacity:.38;transition:opacity .15s,background .15s;backdrop-filter:blur(6px)}
button:hover{opacity:1;background:rgba(30,60,120,.85)}</style><button id="b" title="Back to the normal window (Ctrl+Alt+W)">🖼 Exit wallpaper</button><script>document.getElementById("b").onclick=()=>window.pfApp&&window.pfApp.wallpaper(false)</script>`;
function syncControl() {
  const want = cfg.wallpaper && cfg.exitBtn;
  if (!want) { if (ctl && !ctl.isDestroyed()) ctl.destroy(); ctl = null; return; }
  if (!ctl || ctl.isDestroyed()) {
    const wa = screen.getPrimaryDisplay().workArea, W = 160, H = 38;
    ctl = new BrowserWindow({ width: W, height: H, x: wa.x + wa.width - W - 14, y: wa.y + wa.height - H - 14, frame: false, transparent: true, resizable: false, movable: false, alwaysOnTop: true, skipTaskbar: true,
      focusable: false, hasShadow: false, show: false, fullscreenable: false, webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    try { ctl.setAlwaysOnTop(true, "screen-saver"); } catch (e) {}
    ctl.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(CTL_HTML)); ctl.once("ready-to-show", () => { if (!ctl.isDestroyed() && !(otherFullscreen && cfg.autoPause)) ctl.showInactive(); });
  }
  if (!ctl.isDestroyed()) { if (otherFullscreen && cfg.autoPause) ctl.hide(); else if (ctl.isVisible() === false && ctl.webContents && !ctl.webContents.isLoading()) ctl.showInactive(); }   // never float over a fullscreen game or video
}
function setWallpaper(on) { cfg.wallpaper = !!on; save(); createWindows(); }
function newWorlds() { live().forEach((w, i) => w.loadFile(INDEX, { query: pageQuery(i === 0) })); }

/* ---------- pause while a game or video is fullscreen ---------- */
function probeFullscreen(cb) {
  if (process.platform === "linux") {                              // X11 / XWayland windows: ask the window manager which window is active and whether it is fullscreen
    execFile("xprop", ["-root", "_NET_ACTIVE_WINDOW"], { timeout: 1500 }, (e, out) => {
      if (e || !out) return cb(null);
      const m = /# (0x[0-9a-f]+)/i.exec(out); if (!m || /^0x0+$/.test(m[1])) return cb(false);
      execFile("xprop", ["-id", m[1], "_NET_WM_STATE", "_NET_WM_WINDOW_TYPE"], { timeout: 1500 }, (e2, o2) => cb(e2 ? null : /_NET_WM_STATE_FULLSCREEN/.test(o2) && !/_NET_WM_WINDOW_TYPE_DESKTOP/.test(o2)));
    });
  } else if (process.platform === "win32") {                       // QUNS_BUSY / RUNNING_D3D_FULL_SCREEN / PRESENTATION_MODE
    const ps = "Add-Type -MemberDefinition '[DllImport(\"shell32.dll\")] public static extern int SHQueryUserNotificationState(out int s);' -Name Q -Namespace W; $s=0; [W.Q]::SHQueryUserNotificationState([ref]$s) | Out-Null; $s";
    execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { timeout: 4000, windowsHide: true }, (e, out) => cb(e ? null : [2, 3, 4].includes(+String(out).trim())));
  } else cb(null);
}
let probing = false;
setInterval(() => {
  if (!cfg.wallpaper || !cfg.autoPause || probing) return; probing = true;
  probeFullscreen(r => { probing = false; if (r === null) { if (fsSupported) { fsSupported = false; buildMenu(); } return; } if (!fsSupported) { fsSupported = true; buildMenu(); } if (r !== otherFullscreen) { otherFullscreen = r; applyFps(); } });
}, 4000);

/* ---------- menus ---------- */
function gpuStatus() {                                           // chrome://gpu in its own window: shows whether WebGL2 is hardware accelerated and which GPU is in use
  const w = new BrowserWindow({ width: 1000, height: 800, title: "GPU status", autoHideMenuBar: true, webPreferences: { sandbox: true } }); w.loadURL("chrome://gpu");
}
const shot = (w, h) => eachFirst(`window.pfShot&&pfShot(${w},${h})`);
const eachFirst = js => { const w = primary(); if (w) w.webContents.executeJavaScript(js).catch(() => {}); };
function toggleRecord() { recording = !recording; eachFirst(`window.pfRecord&&pfRecord(${recording})`); buildMenu(); }

function buildMenu() {
  const radio = (arr, cur, fn, fmt) => arr.map(n => ({ label: fmt(n), type: "radio", checked: cur === n, click: () => fn(n) }));
  const tmpl = [
    { label: cfg.wallpaper ? "Switch to window" : "Run as wallpaper", click: () => setWallpaper(!cfg.wallpaper) },
    { label: "New random world now", click: newWorlds },
    { label: "New world every", submenu: radio([0, 5, 15, 30, 60, 120], cfg.worldMins, n => { cfg.worldMins = n; save(); live().forEach(applyPageSettings); buildMenu(); }, n => n ? n + " minutes" : "Never (endless)") },
    { label: "Sun follows my clock", type: "checkbox", checked: !!cfg.realSun, click: m => { cfg.realSun = m.checked; save(); live().forEach(applyPageSettings); } },
    { type: "separator" },
    { label: "Wallpaper on", submenu: radio(["primary", "all"], cfg.monitors, n => { cfg.monitors = n; save(); if (cfg.wallpaper) createWindows(); else buildMenu(); }, n => n === "all" ? "Every monitor (own world each)" : "Main monitor only") },
    { label: "Planet size in wallpaper", submenu: [[0.8, "Large"], [1, "Normal"], [1.25, "Small"], [1.5, "Smaller"], [1.8, "Tiny"]].map(([z, l]) => ({ label: l, type: "radio", checked: cfg.zoom === z, click: () => { cfg.zoom = z; save(); eachPage(`WP.zoom=${z};clearTimeout(WP.timer);wpDirector()`); buildMenu(); } })) },
    { label: "Wallpaper frame rate", submenu: radio([15, 24, 30, 60], cfg.fps, n => { cfg.fps = n; save(); applyFps(); buildMenu(); }, n => n + " fps") },
    { label: fsSupported ? "Pause while another app is fullscreen" : "Pause while fullscreen (needs xprop: sudo pacman -S xorg-xprop)", type: "checkbox", checked: !!cfg.autoPause, click: m => { cfg.autoPause = m.checked; save(); if (!m.checked) { otherFullscreen = false; applyFps(); } } },
    { label: "Show \"Exit wallpaper\" button", type: "checkbox", checked: !!cfg.exitBtn, click: m => { cfg.exitBtn = m.checked; save(); syncControl(); } },
    { label: "Use less power on battery", type: "checkbox", checked: cfg.pauseOnBattery, click: m => { cfg.pauseOnBattery = m.checked; save(); applyFps(); } },
    { type: "separator" },
    { label: "Save screenshot", submenu: [{ label: "Current size", click: () => shot(0, 0) }, { label: "4K (3840×2160)", click: () => shot(3840, 2160) }, { label: "8K (7680×4320)", click: () => shot(7680, 4320) }] },
    { label: recording ? "Stop recording" : "Record video", click: toggleRecord },
    { label: "Open captures folder", click: () => shell.openPath(captureDir()) },
    { type: "separator" },
    { label: "Close button hides to tray", type: "checkbox", checked: !!cfg.trayClose, click: m => { cfg.trayClose = m.checked; save(); } },
    { label: "Start with the computer", type: "checkbox", checked: !!cfg.login, click: m => { cfg.login = m.checked; save(); app.setLoginItemSettings({ openAtLogin: m.checked, args: cfg.wallpaper ? ["--wallpaper"] : [] }); } },
    { label: "GPU status", click: gpuStatus },
    { label: "Show window", click: () => { const w = primary(); if (cfg.wallpaper) setWallpaper(false); else if (w) { w.show(); w.focus(); } } },
    { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } }
  ];
  if (tray) tray.setContextMenu(Menu.buildFromTemplate(tmpl));
  const w = primary();
  if (!cfg.wallpaper && w) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "Planet Forge", submenu: [{ label: "Run as wallpaper", accelerator: "CmdOrCtrl+Shift+W", click: () => setWallpaper(true) }, { label: "Toggle full screen", accelerator: "F11", click: () => w.setFullScreen(!w.isFullScreen()) },
        { label: "Reload (new world)", accelerator: "CmdOrCtrl+R", click: newWorlds }, { type: "separator" }, { role: "quit" }] },
      { label: "Capture", submenu: [{ label: "Screenshot (current size)", click: () => shot(0, 0) }, { label: "Screenshot 4K", click: () => shot(3840, 2160) }, { label: "Screenshot 8K", click: () => shot(7680, 4320) },
        { label: recording ? "Stop recording" : "Record video", accelerator: "CmdOrCtrl+Shift+R", click: toggleRecord }, { label: "Open captures folder", click: () => shell.openPath(captureDir()) }] },
      { label: "View", submenu: [{ label: "GPU status", click: gpuStatus }, { role: "toggleDevTools" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }] }]));
  }
}

/* ---------- screenshots and video land in ~/Pictures/Planet Forge ---------- */
function captureDir() { const d = path.join(app.getPath("pictures"), "Planet Forge"); try { fs.mkdirSync(d, { recursive: true }); } catch (e) {} return d; }
function hookDownloads(ses) {
  ses.on("will-download", (e, item) => {
    const name = item.getFilename() || "planet_forge", file = path.join(captureDir(), name); item.setSavePath(file);
    item.once("done", (ev, state) => { if (state === "completed") { try { new Notification({ title: "Planet Forge", body: "Saved " + name, silent: true }).show(); } catch (er) {} } });
  });
}

ipcMain.on("pf-wallpaper", (e, on) => { if (!!on !== cfg.wallpaper) setWallpaper(!!on); });       // the in-game Wallpaper button / W key
ipcMain.on("pf-quit", () => { app.isQuitting = true; app.quit(); });                              // the title screen's Quit button
ipcMain.on("pf-recording", (e, on) => { recording = !!on; buildMenu(); });                          // the page tells us when a recording starts or stops

app.whenReady().then(() => {
  hookDownloads(require("electron").session.defaultSession);
  try { onBattery = powerMonitor.isOnBatteryPower(); powerMonitor.on("on-battery", () => { onBattery = true; applyFps(); }); powerMonitor.on("on-ac", () => { onBattery = false; applyFps(); }); } catch (e) {}
  try { const img = nativeImage.createFromPath(path.join(__dirname, "build", "icon.png")).resize({ width: 22, height: 22 }); tray = new Tray(img); tray.setToolTip("Planet Forge"); tray.on("click", () => { const w = primary(); if (!cfg.wallpaper && w) { w.isVisible() ? w.hide() : w.show(); } }); } catch (e) {}
  createWindows();
  try { console.log("GPU features:", JSON.stringify(app.getGPUFeatureStatus())); } catch (e) {}
  try { globalShortcut.register("CommandOrControl+Alt+W", () => setWallpaper(!cfg.wallpaper)); } catch (e) {}   // works even when the wallpaper window can't take focus
  screen.on("display-metrics-changed", () => { if (cfg.wallpaper) createWindows(); });
  screen.on("display-added", () => { if (cfg.wallpaper && cfg.monitors === "all") createWindows(); });
  screen.on("display-removed", () => { if (cfg.wallpaper && cfg.monitors === "all") createWindows(); });
  powerMonitor.on && powerMonitor.on("resume", () => { if (cfg.wallpaper) createWindows(); });
});
app.on("second-instance", (e, args) => {                            // launching the icon again: bring the window back, or honour --wallpaper / --windowed
  if (args.includes("--wallpaper") && !cfg.wallpaper) return setWallpaper(true);
  if (args.includes("--windowed") && cfg.wallpaper) return setWallpaper(false);
  const w = primary(); if (!w) createWindows(); else if (!cfg.wallpaper) { w.show(); w.focus(); } });
app.on("window-all-closed", () => { if (!cfg.trayClose) app.quit(); });          // closing the window ends the app, unless "close hides to tray" is on
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("before-quit", () => { app.isQuitting = true; });
