# Tokens, organizations and published content

## Context

Today the cloud layer has no concept of a user:

- `WRITE_TOKENS` is a comma-separated list of secrets. A token grants write access and nothing
  else — no identity, no role, no organization.
- The app is fully usable without a token and downloads everything the manifest lists; there is
  no notion of choosing content.
- The token is stored in `userData/config.json` in plain text.

The goal: the token decides whether the app works at all and who you are, the admin is the only
author of shared content, and every user picks what to download.

## Roles

| Role | Sees | Cloud writes |
|---|---|---|
| `admin` (one token, mine) | everything | yes — adds and publishes songbooks |
| `org` (one token per organization, shared by its members) | everything the admin published | no |
| no token | nothing — the app stays inert | no |

A token identifies an organization, not a person. Five machines with the same token are the
same user.

Organizations do not author shared songbooks. When an organization wants a songbook added, it
sends the admin a JSON and the admin imports and publishes it. This is what keeps the whole
design small: there is exactly one writer, so there are no private namespaces, no per-org
visibility and nothing to merge.

Local songs stay local. The existing "My Songs" (localStorage) and the song editor keep
working for everyone with a token — that is how an organization prepares the JSON it sends in.
Those songs are never uploaded; Settings → Backup already exports them.

## Storage layout (R2) — unchanged

```
data/bibles/<bible>.json         public
data/messages/<date>.json        public
data/songs/<book>/<song>.json    public
manifest.json                    version + hash of every file
catalog.json                     what the app offers for download
```

Nothing is private, so reads stay unauthenticated and CDN-cacheable exactly as today. Only
writes change: `PUT` requires the admin token instead of any token from a list.

## Token registry (KV)

`TOKENS` namespace, keyed by `sha256(token)` so the plaintext secret is never stored:

```json
{
  "orgId": "org_7f3a",
  "name": "Zbór Jeffersonville",
  "role": "org",
  "createdAt": "2026-07-30T10:00:00Z",
  "revokedAt": null
}
```

A second key per organization (`org:<orgId>`) holds the same record so the admin can list
organizations. `WRITE_TOKENS` disappears once the registry is live.

Revoking an organization is one KV write; its machines fail the next `whoami` and the app locks
itself.

## Worker API

```
GET  /manifest.json            unchanged, unauthenticated
GET  /catalog.json             what is offered for download (public)
GET  /data/{path}              unchanged, unauthenticated
PUT  /data/songs/{path}        admin token only

GET  /auth/whoami              validates a token → { role, orgId, name }

Admin only:
GET   /admin/orgs              list organizations
POST  /admin/orgs              create one → returns the generated token once
PATCH /admin/orgs/{orgId}      rename or revoke
POST  /admin/orgs/{orgId}/token  issue a new token; the old one stops working
PATCH /admin/catalog           mark songbooks/Bibles as offered for download
```

Existing CORS headers stay. Tokens are 24 random bytes, so guessing one is not a practical
attack and no rate limiter is built; if tokens ever become shorter or human-chosen, that
changes.

## Catalog

`catalog.json` drives the download picker:

```json
{
  "version": "2026-07-30-10-00-00",
  "songbooks": [{ "key": "newSong", "name": "Nowa pieśń", "songs": 412 }],
  "bibles": [{ "key": "gdanska", "name": "Biblia Gdańska" },
             { "key": "warszawska", "name": "Biblia Warszawska" }],
  "messages": { "count": 534, "sizeMb": 41 }
}
```

Initially: `newSong`, both Bibles, and sermons as one all-or-nothing item.

## App flow

1. **Token gate.** No stored token → a modal asks for one, validated with `GET /auth/whoami`.
   Nothing else is reachable until it passes.
2. **Download picker.** Three sections — Songbooks, Bibles, Messages. Songbooks and Bibles are
   per-item checkboxes built from `catalog.json`; Messages is a single yes/no covering all
   sermons. The selection persists and stays editable in Settings.
3. **Download.** Only selected files are fetched; the manifest comparison works as today.
4. **New publications.** Later starts compare `catalog.json` with what is installed and offer
   anything published since.

### Gating rules

| State | Left library | Middle panel | Editing |
|---|---|---|---|
| No token | hidden | nothing | no |
| Token, nothing selected | hidden | can create local songbooks and type songs into them | local only |
| Token + selection | Songs / Bibles / Messages for what was downloaded | full | local only (admin: cloud too) |

### Client changes

- Token moves from plain text in `config.json` to Electron `safeStorage`, with a one-time
  migration of the existing value.
- All cloud traffic already goes through the main process (`data-fetch-cloud`,
  `data-fetch-manifest`), so the `Authorization` header is added in one place and the token is
  never exposed to the renderer. No change needed there.
- Downloaded songbooks render read-only for `org` tokens: no Edit, no add, no delete; the
  editor's target-book list offers only local songbooks.
- An **Admin** button inside the Settings modal, shown only for an admin token. It swaps the
  modal's own content for the admin view — organizations (create, rename, revoke), importing a
  songbook JSON, catalog flags — with a back button. No separate screen or window.
- The admin token works on any number of devices, exactly like an organization token: identity
  lives in the token, not in the machine.

## Phases

1. **Worker foundation** — ✅ done. KV registry, `/auth/whoami`, admin-only writes,
   `catalog.json`, admin endpoints for organizations and the catalog, `manage-tokens.mjs` for
   bootstrapping the first admin token. `WRITE_TOKENS` still works as an admin token so the
   current app keeps saving until phase 2 lands; it gets dropped then.
2. **Token gate + download picker** — ✅ done. `TokenGate` and `ContentPicker` screens, the
   selection filters both the first download and later updates, the local manifest holds only
   the downloaded subset (otherwise the integrity check re-downloads everything), library tabs
   follow the selection, Settings shows the identity and reopens the picker, and the token is
   encrypted with `safeStorage` (plaintext values migrate on first read).

   Two escape hatches, so nobody gets locked out of a running service: with `dataLocalMode`
   (dev with a local `api/` folder) the gate is skipped entirely, and if the token check fails
   because the network is down *or* the deployed Worker has no `/auth/whoami` yet, a previously
   validated identity plus a local cache is accepted.
3. **Read-only enforcement** — ✅ done. The pencil on a published song is hidden for `org`
   tokens, the editor offers only "My Songs" as a target, and `handleSave` refuses a non-local
   target as a second line of defence behind the Worker's 403.
4. **Admin panel** — ✅ done. A button in the Settings header (admin tokens only) swaps the
   modal body for `AdminPanel`: create organizations (the token is shown exactly once), revoke
   and restore them, choose what the catalog offers, and import a songbook JSON into any
   songbook. Import reuses the existing `write-songbook` path, so it writes the local cache and
   uploads in one step.
5. **Publication notices** — ✅ done. On start the app compares `catalog.json` with the local
   selection; anything offered but not downloaded shows as a bar at the bottom with a Download
   button that opens the picker. Dismissing stores the catalog version, so the same publication
   is not announced twice.

## Security notes

- The token is a bearer secret shared by an organization; anyone holding it has that
  organization's access. Revocation is per organization, not per person.
- Storing `sha256(token)` means a leaked KV dump hands out no working tokens.
- Data itself stays public. The token gates the app, not the bucket — someone who knows the
  Worker URL can still fetch `data/**` directly. Acceptable, because everything there is
  content the admin chose to publish. If that ever stops being true, reads have to become
  authenticated and the manifest scoped.
