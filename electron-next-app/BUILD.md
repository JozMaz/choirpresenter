# Build & Distribution

## Setup

### Icons (povinné pro produkční build)

Vytvoř ikony a vlož do `build/`:
- `build/icon.icns` — macOS (1024×1024 px, ICNS formát)
- `build/icon.ico` — Windows (256×256 px multi-resolution ICO)
- `build/icon.png` — Linux (512×512 px)

**Tip:** Stačí mít jeden PNG `1024×1024` a vygenerovat ostatní přes online konvertory nebo `electron-icon-builder`:

```bash
npm install --save-dev electron-icon-builder
npx electron-icon-builder --input=./icon.png --output=./build
```

Bez ikon build běží, ale použije se default Electron logo.

## Build commands

### Development
```bash
npm run electron:dev
```
Spustí Next.js dev server (port 3002) + Electron okno.

### Production build
```bash
npm run build          # next build → produkuje out/ folder
npm run pack           # postaví .app/.exe bez instaleru (rychlý test)
npm run dist:mac       # postaví DMG instaler (macOS)
npm run dist:win       # postaví NSIS instaler (Windows) — vyžaduje Wine na Macu
npm run dist:all       # oba (Mac + Windows naraz)
```

Výstup je v `dist/`.

### Windows build z macOS

electron-builder potřebuje Wine na Macu:

```bash
brew install --cask wine-stable
```

Poté `npm run dist:win` funguje.

**Alternativa:** GitHub Actions s Windows runnerem (doporučeno pro CI):

```yaml
# .github/workflows/build.yml
name: Build
on: push
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - run: npx electron-builder --publish=never
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}
          path: dist/*.{dmg,exe,zip}
```

## Architektura

### Static export
`next.config.ts` má `output: "export"` — Next.js produkuje statické HTML/JS/CSS
do `out/`. Žádný runtime server v packed app.

### Path detection
`electron/main.js` rozliší dev vs packaged:
```js
if (app.isPackaged) {
  win.loadFile(path.join(__dirname, "..", "out", "index.html"));
} else {
  win.loadURL("http://localhost:3002");
}
```

### Asset paths
V produkci `assetPrefix: "./"` — relativní cesty pro file:// loading.

### API data (JSONs)
`api/Bibles/`, `api/SongBooks/*-converted.json`, `api/Messages/pl-*.json`
jsou zahrnuty v build. `asarUnpack: ["api/**/*"]` znamená, že se rozbalí
mimo `app.asar` archive — povolí čtení i potenciální zápis.

**Aktuálně app v packed režimu je read-only** — kliknutí na Save v editoru
nevyhodí chybu (IPC write zkusí, případně tiše selže). Pro plný read/write
v produkci viz "User data storage" níže.

## Auto-update

Vyžaduje `electron-updater`:

```bash
npm install electron-updater
```

A přidat do `electron/main.js`:

```js
import { autoUpdater } from "electron-updater";
app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});
```

Plus do `package.json` "build" sekce:

```json
"publish": [{
  "provider": "github",
  "owner": "tvoje-username",
  "repo": "tvoj-repo"
}]
```

Pak release na GitHub Releases → app se sám aktualizuje při startu.

## User data storage (TODO)

Pro plnou read/write podporu v packed app je třeba kopírovat JSONs
do `app.getPath('userData')` při prvním spuštění a všechny operace
číst/psát odsud:

```js
import fs from "fs";
import { app } from "electron";

function getUserApiPath() {
  const userPath = path.join(app.getPath("userData"), "api");
  if (!fs.existsSync(userPath)) {
    // Copy bundled data → user data folder
    copyRecursive(
      path.join(process.resourcesPath, "app.asar.unpacked", "api"),
      userPath,
    );
  }
  return userPath;
}
```

Standardní cesty:
- macOS: `~/Library/Application Support/ChoirPresenter/api/`
- Windows: `%APPDATA%/ChoirPresenter/api/`

## Code signing (pro distribuci bez warningů)

### macOS
1. Apple Developer account ($99/rok)
2. Certifikát "Developer ID Application" v Keychain
3. V `package.json`:
   ```json
   "mac": {
     "identity": "Developer ID Application: Your Name (TEAMID)",
     "hardenedRuntime": true
   }
   ```
4. Notarizace přes `notarize.js` script

### Windows
1. Code signing certificate ($100-300/rok od DigiCert/Sectigo)
2. V `package.json`:
   ```json
   "win": {
     "certificateFile": "cert.pfx",
     "certificatePassword": "..."
   }
   ```

Bez podpisu app půjde nainstalovat, ale Mac varuje "unidentified developer"
(uživatel musí pravým tlačítkem → Open) a Windows varuje SmartScreen.
