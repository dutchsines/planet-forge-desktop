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

**Title:** Planet Forge: a free sandbox where you grow a whole world from molten rock to oceans, life, nations and spaceflight (browser, PC, Android, live wallpaper)

---

**What is it?**

Planet Forge is a world-building sandbox. Every time you start, it generates a brand-new planet and then simulates its entire story in real time, from a molten ball of rock cooling into oceans and continents, to life taking hold, to nations rising, trading, fighting and eventually reaching for the stars. Nothing is scripted. Every world is different, and some are barren, frozen or burning.

You mostly watch, speed time up, read the maps and graphs, and sometimes poke the world: drop a comet, trigger a volcano, warm the sun.

**What does it do?**

- **A living planet:** drifting tectonic plates, volcanoes, asteroid impacts, weather, seasons, and a climate that actually moves heat around. Oceans, rivers, clouds, auroras, lightning, wildfires and dust storms.
- **Life:** only appears when conditions allow, branches into species (there's a tree of life you can open), and survives or doesn't survive mass extinctions.
- **Minds:** rare. When they arise, nations grow, trade, build cities you can see glowing on the night side, invent things, and go to war.
- **Wars:** armies, fleets, missiles, lasers and orbital weapons. Wars have fronts, winners and losers. A nation that falls blows up with its capital and leaves a skull and crossbones.
- **Air and sea traffic:** planes with weather-following contrails, cargo ships, cruise liners, sail boats and warships on real sea routes. Commercial flights avoid war zones.
- **Space age:** satellites, moon bases, shuttles, and (if everything goes right) megastructures and ascension.
- **Looks:** shaders aimed at SpaceEngine-style visuals, with 4K option and a lot of settings to tune it to your hardware.
- **Maps and graphs:** many map views, nation cards, and live graphs for life, temperature, pollution and history.

**Where can I play?**

- In a browser (single HTML page, nothing to install)
- Desktop app for Windows and Linux (with a real live-wallpaper mode)
- Android app and Android live wallpaper (low-graphics mode for phones)
- Wallpaper Engine / Lively kit
- The desktop and Android apps can update themselves from inside the game.

*(Download link: PUT LINK HERE)*

**How to play**

1. Press **Play** and read the welcome box. A world starts forming straight away.
2. **Drag** to turn the planet, **mouse wheel** to zoom (zoom right in for plants, cities and ships).
3. Speed things up with the **Time** buttons at the bottom (Fast x3 and more), or press **Space** to pause.
4. Watch the graphs. Early worlds are just rock, heat and impacts. Life needs liquid water, a decent atmosphere and time.
5. If minds appear, open **Nations (O)** to see who is who, what era they are in, how healthy they are and who is at war. Nation dots are split: era colour on the bottom, health on top, pulsing red at war.
6. Poke the world from the Controls panel (**Tab**): impacts, volcanoes, solar changes, climate sliders and more.
7. Press **R** for a new world whenever you like.

**Handy keys**

| Key | What it does |
|---|---|
| Drag / Wheel | turn / zoom |
| Space | pause |
| R | new world |
| E | endless mode on/off |
| S / P | spin / pause evolution |
| F | look at the sun |
| V | next map view |
| I / J / O | info / graphs / nations |
| Tab or G | controls and settings |
| H | hide the interface (screenshot mode) |
| U | change temperature unit |
| ? | full key guide |

**Endless mode**

Endless mode (E) lets a world run on without ever restarting by itself, and makes it possible for any world to eventually grow minds, however long that takes. *(The public version ships with Endless mode off: each world plays for a while and then a new one is rolled. Press E to turn it on.)*

**Tips**

- If it runs slowly, lower the quality preset in Settings, which has presets from Minimum (phones) to Ultra+.
- Zoom in at night on a world with nations to see city lights, shipping lanes and light pollution.
- Most worlds never get minds. That's part of it. Hit R and try another.

**Feedback**

I'm actively updating it, and the welcome screen lists what's new in each update. Bugs, ideas, weird worlds and screenshots are all welcome in the comments.

*(Screenshots here)*
