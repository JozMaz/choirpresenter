# ChoirPresenter — Cloud Data Worker

Cloudflare Worker + R2 backend hosting songs, Bibles and sermons for the ChoirPresenter Electron app.

## What it does

- `GET /manifest.json` — returns the current version + hash of every file (Electron calls this on startup to detect updates)
- `GET /data/{path}` — returns a single data JSON (Bible, sermon, songbook)
- `PUT /data/songs/{path}` — saves a song (requires `Authorization: Bearer <token>`)

The R2 bucket `choirpresenter-data` serves as blob storage.

## Setup (one-time)

### 1. Install deps

```bash
cd cloud-data-worker
npm install
```

### 2. Log in to Cloudflare

```bash
npx wrangler login
```

Opens a browser; approve access.

### 3. Create the R2 bucket

```bash
npx wrangler r2 bucket create choirpresenter-data
```

(Or via the Cloudflare dashboard → R2 → Create bucket → name `choirpresenter-data`)

### 4. Deploy the Worker

```bash
npm run deploy
```

After deploying, wrangler prints a URL, something like:
```
https://choirpresenter-data.<your-subdomain>.workers.dev
```

Note that URL down — the Electron app will need it.

### 5. Upload data to R2

```bash
node scripts/upload-to-r2.mjs
```

Takes every JSON from `../electron-next-app/api/{Bibles,Messages,SongBooks}/`, uploads them to R2, and generates `manifest.json`.

It takes a while (over 500 sermon files plus the rest). Watch the progress.

### 6. Test it

In a browser try:
- `https://<your-worker>.workers.dev/` → JSON with service info
- `https://<your-worker>.workers.dev/manifest.json` → list of all uploaded files
- `https://<your-worker>.workers.dev/data/bibles/gdanska.json` → the Gdańsk Bible

If everything works → the backend is done and you can move on to the Electron app refactor.

## Phase 2: Write tokens

Once writes are implemented, set the allowed write tokens:

```bash
npx wrangler secret put WRITE_TOKENS
```

Wrangler asks for the value — enter comma-separated tokens:

```
tok-josh-abc123,tok-pastor-xyz789
```

A token is any random string (e.g. `openssl rand -hex 24`). Send each user their token and they paste it into ChoirPresenter Settings.

The token is both the identifier and the secret. To revoke someone's write access → set `WRITE_TOKENS` again without their token; the deploy happens automatically.

## Updating data

When you want to upload a new version of the data (e.g. after fixing a song):

```bash
node scripts/upload-to-r2.mjs
```

The manifest gets a new `version` (timestamp). Electron apps detect it via the manifest poll and offer "Update available".

## Useful commands

```bash
npm run dev     # local dev server (http://localhost:8787)
npm run deploy  # deploy to production
npm run logs    # streaming logs from the live worker (debug)
```

## Bucket size / costs

Free tier: 10 GB storage, **unlimited egress** (free), 1M class A operations (uploads), 10M class B operations (downloads) per month.

Current data is ~50 MB → 0.5% of the free tier. Easily years ahead with zero cost.
