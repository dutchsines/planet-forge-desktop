# Planet Forge for Windows

## Easiest: let GitHub build the .exe for you (no Windows needed on your side)
1. Make a new empty GitHub repo (e.g. `planet-forge-desktop`).
2. Put everything in this folder into it and push (`.github/workflows/windows.yml` is included).
3. Open the repo's **Actions** tab, then the latest **Build Windows app** run, and download the **PlanetForge-Windows** artifact.
   It holds an installer (`Planet Forge Setup 1.0.0.exe`) and a portable one (`Planet Forge 1.0.0.exe`, no install needed).
   Send either one to the Windows PC.

## On the Windows PC itself
- Installer: double-click, Next, done. A Start-menu entry is created.
- Windows may show "Windows protected your PC" because the app isn't code-signed: **More info → Run anyway**.

## Wallpaper mode
Tray icon (bottom-right, may be under the ^ arrow) → "Run as wallpaper", or start with `--wallpaper`. Ctrl+Alt+W toggles it.
On Windows the window is attached to the desktop's wallpaper layer, so it sits behind your icons. If that attach fails on a
particular setup, it falls back to a bottom-most click-through window; `--no-attach` forces that fallback.

## Build it yourself on Windows
    npm install
    npm run dist:win     (installer + portable in dist\)
    npm start            (just run it)

## Known unknowns
This was written without a Windows machine to test on. The wallpaper attach (PowerShell + WorkerW) is the part most likely to
need a tweak on Windows 11 24H2; tell me what you see.
