# Build & Distribution

## Setup

### Icons (required for production builds)

Create icons and put them in `build/`:
- `build/icon.icns` — macOS (1024×1024 px, ICNS format)
- `build/icon.ico` — Windows (256×256 px multi-resolution ICO)
- `build/icon.png` — Linux (512×512 px)

**Tip:** One 1024×1024 PNG is enough — generate the rest via online converters or `electron-icon-builder`:

```bash
npm install --save-dev electron-icon-builder
npx electron-icon-builder --input=./icon.png --output=./build
```

Without icons the build still runs, but the default Electron logo is used.

## Build commands

### Development
```bash
npm run electron:dev
```
Starts the Next.js dev server (port 3002) + an Electron window.

### Production build
```bash
npm run build          # next build → produces the out/ folder
npm run pack           # builds .app/.exe without an installer (quick test)
npm run dist:mac       # builds the DMG installer (macOS)
npm run dist:win       # builds the NSIS installer (Windows) — requires Wine on Mac
npm run dist:all       # both (Mac + Windows at once)
```

Output goes to `dist/`.

### Windows build from macOS

electron-builder needs Wine on the Mac:

```bash
brew install --cask wine-stable
```

After that `npm run dist:win` works.

**Alternative:** GitHub Actions with a Windows runner (recommended for CI):

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

## Architecture

### Static export
`next.config.ts` has `output: "export"` — Next.js produces static HTML/JS/CSS
into `out/`. No runtime server in the packed app.

### Path detection
`electron/main.js` distinguishes dev vs packaged:
```js
if (app.isPackaged) {
  win.loadFile(path.join(__dirname, "..", "out", "index.html"));
} else {
  win.loadURL("http://localhost:3002");
}
```

### Asset paths
In production `assetPrefix: "./"` — relative paths for file:// loading.

### API data (JSONs)
`api/Bibles/`, `api/SongBooks/*-converted.json`, `api/Messages/pl-*.json`
are included in the build. `asarUnpack: ["api/**/*"]` means they are unpacked
outside the `app.asar` archive — allowing reads and potential writes.

**Currently the packed app is read-only** — clicking Save in the editor
does not throw (the IPC write is attempted and may fail silently). For full
read/write in production see "User data storage" below.

## Auto-update

Requires `electron-updater`:

```bash
npm install electron-updater
```

And add to `electron/main.js`:

```js
import { autoUpdater } from "electron-updater";
app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});
```

Plus in the `package.json` "build" section:

```json
"publish": [{
  "provider": "github",
  "owner": "your-username",
  "repo": "your-repo"
}]
```

Then release on GitHub Releases → the app updates itself on startup.

## User data storage (TODO)

For full read/write support in the packed app, the JSONs need to be copied
to `app.getPath('userData')` on first launch and all operations must
read/write from there:

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

Standard paths:
- macOS: `~/Library/Application Support/ChoirPresenter/api/`
- Windows: `%APPDATA%/ChoirPresenter/api/`

## Code signing (for warning-free distribution)

### macOS
1. Apple Developer account ($99/year)
2. A "Developer ID Application" certificate in Keychain
3. In `package.json`:
   ```json
   "mac": {
     "identity": "Developer ID Application: Your Name (TEAMID)",
     "hardenedRuntime": true
   }
   ```
4. Notarization via a `notarize.js` script

### Windows
1. Code signing certificate ($100-300/year from DigiCert/Sectigo)
2. In `package.json`:
   ```json
   "win": {
     "certificateFile": "cert.pfx",
     "certificatePassword": "..."
   }
   ```

Without signing the app still installs, but macOS warns about an
"unidentified developer" (the user must right-click → Open) and Windows
shows a SmartScreen warning.
