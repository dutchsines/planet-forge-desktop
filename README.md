# Planet Forge — desktop app

A native window (and a real desktop wallpaper mode) around planet_forge, built with Electron.
Nothing is downloaded at run time; the planet code is in `app/index.html`.

## Run it
    npm install        # once (downloads Electron, ~100 MB)
    npm start          # normal window
    npm run wallpaper  # starts as wallpaper

## Make an installer / portable app
    npm run dist:linux   # AppImage, .deb and Arch .pkg.tar.zst  (run on Linux)
    npm run dist:win     # installer and portable .exe          (run on Windows)
    npm run dist:mac     # .dmg                                 (run on a Mac)
Results land in `dist/`. (electron-builder can only build for the system it runs on.)

## What's new
- Tray menu: new world every N minutes, sun follows your clock, wallpaper on every monitor (own world each), pause while a game or
  video is fullscreen (needs `xprop` on Linux: `sudo pacman -S xorg-xprop`; Windows uses a PowerShell check), screenshots at current size / 4K / 8K,
  video recording, open captures folder. Captures are saved in ~/Pictures/Planet Forge.
- In the game (Settings): Temporal anti-aliasing, High-detail ocean & clouds, a new Ultra+ quality preset, Sun follows my clock,
  Save PNG / PNG 4K / PNG 8K (rendered in tiles, so huge pictures are safe), Record video, and Saved worlds (seed + age).
- Auto quality now also sheds effects (glow, shadows, sample counts, lens, TAA) if resolution scaling alone cannot hold the frame rate.

## Using it
- Window mode: F11 full screen, Ctrl/Cmd+R new random world, Ctrl/Cmd+Shift+W switch to wallpaper.
- Tray icon (right-click): run as wallpaper / back to window, frame rate (15/24/30/60), less power on battery,
  start with the computer, close button hides to tray, quit.
- Ctrl+Alt+W toggles wallpaper mode from anywhere, even when the wallpaper window can't take focus.
- Options: `--wallpaper`  `--windowed`  `--fps=24`  `--seed=1234`
- Settings are saved per user (window size, full screen, frame rate, wallpaper on/off).

See WINDOWS.md for the Windows build (GitHub Actions workflow included).

## Wallpaper mode, honestly
- Linux (X11, and KDE/GNOME under XWayland): uses a "desktop"-type window below everything, click-through, no taskbar entry.
- macOS: sits at desktop level on all spaces.
- Windows: the window is re-parented into the desktop's WorkerW layer (via PowerShell), so it draws behind the icons. If that fails it
  stays a bottom-most click-through window (`--no-attach` forces that). The Wallpaper Engine / Lively kit (wallpaper_kit.zip) is the fallback.
- Pure Wayland compositors (Hyprland, Sway...) have no "desktop window" type. There, run `--windowed` fullscreen, or put the
  window on the background layer with your compositor's own rules.

## Status
Written and syntax-checked in a sandbox with no network, so Electron itself was NOT run here. Expect to fix small things on
first launch; tell me what you see.
