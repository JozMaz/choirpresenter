# ChoirPresenter — Cloud Data Worker

Cloudflare Worker + R2 backend pro hosting písní, biblí a kázání pro ChoirPresenter Electron app.

## Co to dělá

- `GET /manifest.json` — vrátí aktuální verzi + hash všech souborů (Electron tohle volá při startu pro detekci updates)
- `GET /data/{path}` — vrátí jeden datový JSON (bible, kázání, songbook)
- `PUT /data/songs/{path}` — uloží píseň (vyžaduje `Authorization: Bearer <token>`)

R2 bucket `choirpresenter-data` slouží jako blob storage.

## Setup (jednou)

### 1. Instalace deps

```bash
cd cloud-data-worker
npm install
```

### 2. Login do Cloudflare

```bash
npx wrangler login
```

Otevře browser, schválíš access.

### 3. Vytvoř R2 bucket

```bash
npx wrangler r2 bucket create choirpresenter-data
```

(Nebo přes Cloudflare dashboard → R2 → Create bucket → název `choirpresenter-data`)

### 4. Deploy Worker

```bash
npm run deploy
```

Po deployi ti wrangler vypíše URL, něco jako:
```
https://choirpresenter-data.<your-subdomain>.workers.dev
```

Tu URL si poznamenej — Electron appka ji bude potřebovat.

### 5. Nahraj data do R2

```bash
node scripts/upload-to-r2.mjs
```

Vezme všechny JSONy z `../electron-next-app/api/{Bibles,Messages,SongBooks}/` a uploadne je do R2, plus vygeneruje `manifest.json`.

Trvá to chvilku (přes 500 souborů kázání + ostatní). Sleduj progress.

### 6. Otestuj

V prohlížeči zkus:
- `https://<your-worker>.workers.dev/` → JSON s info o servisu
- `https://<your-worker>.workers.dev/manifest.json` → seznam všech uploadovaných souborů
- `https://<your-worker>.workers.dev/data/bibles/gdanska.json` → bible Gdańská

Pokud všechno funguje → backend je hotový, můžeš pokračovat na refactor Electron appky.

## Phase 2: Write tokens

Až budeš mít writes hotové, nastav allowed write tokeny:

```bash
npx wrangler secret put WRITE_TOKENS
```

Wrangler tě poprosí o hodnotu — zadej čárkami oddělené tokeny:

```
tok-josh-abc123,tok-pastor-xyz789
```

Token = libovolný náhodný řetězec (např. `openssl rand -hex 24`). Pošli každému uživateli jeho token a oni si ho vloží do ChoirPresenter Settings.

Token sám o sobě je identifikátor + secret zároveň. Když chceš někomu odebrat write přístup → znovu nastav `WRITE_TOKENS` bez jeho tokenu, deploy proběhne automaticky.

## Update dat

Když chceš nahrát novou verzi dat (např. po opravě nějaké písně):

```bash
node scripts/upload-to-r2.mjs
```

Manifest dostane novou `version` (timestamp). Electron appky to detekují přes manifest poll a nabídnou "Update available".

## Useful commands

```bash
npm run dev     # lokální dev server (http://localhost:8787)
npm run deploy  # deploy do production
npm run logs    # streaming logs z live workeru (debug)
```

## Bucket size / costs

Free tier: 10 GB storage, **neomezený egress** (zdarma), 1M class A operations (uploads), 10M class B operations (downloads) měsíčně.

Současné data ~50 MB → 0.5 % free tieru. Klidně další roky bez výdajů.
