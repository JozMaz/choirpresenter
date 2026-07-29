# ChoirPresenter

Electron + Next.js presentation app for songs, Bible verses and sermons.
Two independent fullscreen outputs: main projection (Local) and a stream
lower-third for vMix (Stream). Data lives in Cloudflare R2 behind a Worker
(`../cloud-data-worker`) and is cached locally in `userData/data/` on first
run.

## Development

```bash
npm install
npm run electron:dev   # Next dev server (port 3002) + Electron
```

## Build installers

```bash
npm run dist:mac   # dmg (x64 + arm64)
npm run dist:win   # NSIS installer
```

Releases are built by GitHub Actions on pushing a `v*.*.*` tag
(`.github/workflows/release.yml`).

## Data

- Cloud: Cloudflare Worker `choirpresenter-data` + R2 bucket (see
  `../cloud-data-worker/README.md`).
- Local cache: `userData/data/` (macOS:
  `~/Library/Application Support/ChoirPresenter/data/`).
- Song edits: saved locally always; synced to cloud via PUT when a write
  token is set in Settings.
- Original source JSONs (bibles, sermons, songbooks) are not in the repo —
  backup lives in `~/Documents/ChoirPresenter-data-backup-2026-07-29/` and
  the authoritative copy is in R2 (`cloud-data-worker/scripts/sync-down.mjs`
  downloads it).

See `BUILD.md` for historical build notes.
