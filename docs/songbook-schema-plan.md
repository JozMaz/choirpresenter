# Rewriting the songbooks to a clean schema

## Context

The app is a presentation tool for a congregation: one operator, two outputs (projectors/HDMI + broadcast). Song data comes from VideoPsalm — 5 books, **1220 songs** — and carries a lot of ballast the app never reads, plus several defects that show up as unreliability during playback.

An audit of the data and code surfaced concrete problems the new schema eliminates:

| # | Problem | Scope |
|---|---|---|
| 1 | PL and EN travel as **a single string glued with `"\n\n"`** and are re-split via `.split("\n\n")` in 4 places | a blank line in the text = the English disappears |
| 2 | `extractSongParts` cannot parse the `V102` token or `B*` → the slide is **silently dropped** | 36 songs |
| 3 | The bilingual path ignores `verse.Text` → verses get lost | 2 songs (6 of 10 verses) |
| 4 | Unsplit `-----` separators remained in the text | 87 verses |
| 5 | `"Translation:"` is stripped only on Output 2; it is visible on Output 1 and HDMI 1 | 191 occurrences |
| 6 | `generateSequence` joins with `", "` but `" "` is what gets stored | would break the parser |
| 7 | Editing a song destroys `Verse.Style`, `Capo`, `Alias` | every save |
| 8 | `children` is missing from `BILINGUAL_TARGETS` → a bilingual song cannot be saved | the whole book |
| 9 | HDMI HTML is injected via `innerHTML` **without escaping** | XSS/broken rendering |
| 10 | `refused: true` from `write-songbook` is not in the types and nobody handles it | a rejected write looks like success |

Goal: one schema that is both simple and unambiguous, and one code path in the app instead of two (mono/bilingual).

---

## Target schema

```jsonc
{
  "name": "Śpiewnik dziecięcy",
  "songs": [{
    "id": "uuid-v4",
    "number": 42,                    // null when the book has no numbers
    "key": "Cm",                     // international, 12 major + 12 minor, or null
    "title": "Źródełko",
    "sequence": "V1 C V2 C C2",      // DERIVED from text[0].verses
    "text": [                        // 1..2 languages; [0] = the sung original
      { "isTranslation": false, "verses": [
          { "order": 1, "type": "verse",  "number": 1, "part": 1, "lines": ["…","…"] },
          { "order": 2, "type": "verse",  "number": 1, "part": 2, "lines": ["…"] },
          { "order": 3, "type": "chorus", "number": 1,            "lines": ["…"] }
      ]},
      { "isTranslation": true, "verses": [ /* paired via order */ ] }
    ]
  }]
}
```

### Rules (agreed)

- **`text[0].verses` IS the click-down order.** Nothing is merged or dropped. A chorus repeated between verses stays as separate entries with the same `type`+`number` but a different `order`.
- `order` is unique within a language. `text[1]` **inherits the `order`** of the paired entry from `text[0]` — which is why it may be sparse (a verse without a translation is simply absent).
- `part` distinguishes consecutive entries with the same `type`+`number` but different text. It is omitted when the run has length 1.
- `sequence` is **fully derived** from `text[0].verses`: walk in order, merge consecutive identical `(type, number)` into one token. The original `Sequence` from VideoPsalm is discarded (for 91 songs it doesn't match reality anyway). Tokens: `V1`, `C`/`C2`, `B`/`B2`, `E`/`E2` — **no. 1 without the number**, joined by a single space.
- `lines` is an **array of strings** with no trailing spaces and no empty entries. The app does `join("\n")` itself. That kills the entire fragile `"\n\n"` packing.
- `id` = a fresh `crypto.randomUUID()` for all 1220 songs. The `_source Guid → uuid` map is written to `_idmap.json` and **committed**, so the next script run doesn't change ids.
- `key` is international (`C C# D Eb E F F# G Ab A Bb B` × `{"", "m"}`). It is parsed **primarily from the title** (covers ~880 songs, including Polish notation `H`→`B`, `c-moll`→`Cm`, and typos `c-mol`/`h-mol`), with the `Key` field as fallback (536 songs). 51 mismatches go into the report. **The frontend displays Polish/German names** via an explicit 24-row table.
- Section types: `verse`, `chorus`, `bridge`, `ending`. Source: `Tag:1`→chorus, `Tag:3`→ending, otherwise verse. `Tag:2` never occurs in the data, but the editor offers bridge.
- `isTranslation` is **per language per song**: if the marker appears anywhere, the whole language is a non-singable translation. The word `Translation:`/`Translations:` is **cut out** of `lines` — the app renders the label itself above the block and italicizes the block.
- `text[0]` is always the sung original — 8 songs in roboczy (EN-first, one RU/PL) get swapped.
- **Splitting of long verses is materialized during conversion** exactly per today's tables in `verseSplitting.ts` (≤4 lines mono, ≤3 bilingual). Nothing changes on the canvas, but data = what is on screen, and a bad split can be fixed in the editor.
- Dropped: `Capo`, `Style` (song and verse), `Description`, `Copyright`, `Alias`, `VideoDuration`, `IsCompressed`, `VersionDate`, the original `Guid`, the original `Sequence`. `"..."` placeholders and empty songs are not written.

---

## Plan

### Phase 1 — Data conversion

**`scripts/lib/vpsalm.mjs`** — tolerant parser. Take `escapeNewlinesInStrings` + BOM strip from [scripts/convert-songbooks.mjs:33-76](electron-next-app/scripts/convert-songbooks.mjs#L33-L76) unchanged. Do not unify the copy in [electron/main.js:298-335](electron-next-app/electron/main.js#L298-L335) (packaged Electron doesn't import from `scripts/`) — just add a cross-referencing comment to both.

**`scripts/lib/schema.mjs`** — pure functions shared with the app: `sequenceToken`, `deriveSequence`, `assignOrderAndParts`, `sectionLabel`, `groupIntoSections`.

**`scripts/lib/split.mjs`** — the splitting tables **copied verbatim** from [app/lib/verseSplitting.ts](electron-next-app/app/lib/verseSplitting.ts) (both functions) plus `alignEnToPlParts` from [app/lib/songProcessing.ts:252-270](electron-next-app/app/lib/songProcessing.ts#L252-L270).

**`scripts/build-songbooks.mjs`** — the main script, reads `api/SongBooks/_source/*.json`, writes `api/SongBooks/{book}.json`. Step order:

1. Parse (BOM + escape + `vm.runInNewContext`).
2. Drop songs that are empty after markup removal.
3. **Split languages.** Separator = a line whose content, after tag stripping, matches `^[-–—_=.·]{5,}$`. Measured: every real separator has ≥10 characters; the only 3-character runs are `...` placeholders — no risk of confusion. Note: today's regex `[.\-]{3,}` **misses 12 em-dash separators in roboczy**. `<sN>` tags span across the separator → split on raw text, strip tags per block afterwards.
4. **Strip markup** — blanket `<[^>]{0,60}>`. Today's `removeStyleTags` misses `<b>`, `<u>`, `<cFF00F200>`. Then split on `\n`, `trimEnd()` each line, drop empty ones. A block that is entirely `^[.\s\-–—…]*$` is dropped as a placeholder (67 in pl-gb).
5. **Languages.** `isTranslation` per language per song based on the marker; then cut the marker out. **Flip**: when `isTranslation[0]` and not `[1]` → swap (catches 2 of 8); otherwise score by diacritics density. Lock the remaining cases via a `FORCE_FLIP` set of `_source` Guids at the top of the script after reading the report.
6. **Classification + numbering.** `type` from `Tag`; `number = ID || 1` (verses never have ID 0 or 1; choruses use 0 for 1). Then runs of consecutive identical `(type, number)` → `part = 1..n`.
7. **Materialize splitting** (`split.mjs`) — split language 0, split language 1 into the same number of parts proportionally. Renumber `part`.
8. **`order`** = index+1 in language 0; language 1 inherits.
9. **Metadata** — `id` from `_idmap.json`, `number` from `Song.ID` (null for children/roboczy), `title` (strip markup → newline to space → remove the `(Key) N` suffix **gated on the key list** so `(Litwa)` survives; for children additionally ALL-CAPS→sentence case via `toLocaleLowerCase("pl")`), `key`, `sequence` from `deriveSequence`.
10. Emit `JSON.stringify({name, songs}, null, 2)`. `name` comes from a 5-entry constant (moved from [app/lib/songProcessing.ts:125-132](electron-next-app/app/lib/songProcessing.ts#L125-L132)).

> **Watch out for `pielgrzym`**: the title suffix is `"  (G) "` with no number — today's `stripTitleSuffix` requires a number, so it never fires for this book. The number must be optional.

**`scripts/validate-songbooks.mjs`** — hard invariants, exit 1 on failure. Key ones: `id` unique **across all 5 files**; `order` in language 0 contiguous `1..n`; every `order` in language 1 exists in language 0 with matching `(type, number, part)`; no line matches `<[^>]{0,60}>`, `[-–—_=.·]{5,}` or `/translations?\s*:/i`; `lines` non-empty, free of `\n`/`\r`/`\t` and edge whitespace; `part` in each run is exactly `1..k` and is absent exactly when `k===1`; **`sequence` re-derived by the same function equals the stored one**; `key` is one of the allowed 24 or null; song keys are exactly `id, number, key, title, sequence, text` and nothing more.

**`_source/_report.md`** — for manual review (you know every song): swapped languages (8), songs that lost a language (~67 placeholders), derived-vs-original sequence mismatches (91), sections with ≥3 parts = probably mistagged verses (4), all 8 `ending` sections, title-vs-`Key` mismatches (51) + keys parsed from Polish notation, duplicate numbers in pl-gb (10), ALL-CAPS conversions (23+5) `BEFORE → After`, titles with a newline (15), automatic splits (especially those with a one-line tail), partial translation markers (7), dropped songs.

**Iteration:** build → validate → read the report → fixes go into override tables at the top of `build-songbooks.mjs` → rebuild (ids persist via `_idmap.json`) → validate.

### Phase 2 — App rewrite

The order is dictated by dependencies. **Start with `types.ts`** — TypeScript will then enumerate every place to fix.

1. **[app/lib/types.ts](electron-next-app/app/lib/types.ts)** — delete `Verse`, `Song`, `VerseParts`. Add `VerseEntry`, `LangBlock`, `SongEntry`, `Songbook`. Rewrite `ApiItem` to be **slide-centric**: `{ id: string, number, title, key, sequence, source, bookName, secondaryIsTranslation, sections: Section[], slides: Slide[], searchIndex, fullText }`, where `Slide = { sectionIndex, label, primary: string[], secondary?: string[] }`. Delete `ApiItem.text` (duplicate of `title`), `.selected` (written, never read), `.guid`. Fix the return type of `writeSongBook` to include `refused?: boolean`.
   - **Semantics**: a *section* = a run of consecutive verses with the same `(type, number)`; a *slide* = one `VerseEntry`. Output 1/HDMI 1 draws the whole section, Output 2/HDMI 2 the current slide — exactly what `output1Text`/`output2Text` do today.
   - **Pairing**: `secondary = text[1].verses.find(v => v.order === primary.order)?.lines`. Sparse language 1 → `undefined` → the preview renders monolingually without the divider line. That kills defects **1** and **3**.
2. **`app/lib/songSchema.ts`** (new) — an exact mirror of `scripts/lib/schema.mjs`.
3. **`app/lib/musicKeys.ts`** (new) — 24 values + explicit `KEY_LABEL_PL` (`B→"H"`, `Bb→"B"`, `Cm→"c-moll"`, `Bm→"h-moll"`, …). Delete `MUSICAL_KEYS` from [app/lib/constants.ts:7-20](electron-next-app/app/lib/constants.ts#L7-L20) (it has only 12 majors and no minors).
4. **`app/lib/songAdapter.ts`** replaces [app/lib/songProcessing.ts](electron-next-app/app/lib/songProcessing.ts) — single entry point `toApiItem(song, source, bookName)`, **no text parsing**. Delete `processPlOnlySongbook`, `processBilingualSongbook`, `isBilingualSource`, `getDisplayTitle`, `getVerseText`, `extractSongParts`, `getAllPartsFlat`, `isPlaceholderText`, `alignEnToPlParts`, `processAllVersesForPLEN`, `stripKeyFromTitle` — ~330 of 428 lines. Rewrite `buildSongFooter` to use `KEY_LABEL_PL` + `bookName`.
5. **[app/lib/textUtils.ts](electron-next-app/app/lib/textUtils.ts)** — delete `removeStyleTags` and `stripTitleSuffix` (now the converter's job; both are also buggy). Keep `normalizeSearch`, `buildSearchIndex`.
6. **[app/lib/sequence.ts](electron-next-app/app/lib/sequence.ts)** — delete the whole file (defect 6 disappears; `autoDetectSequence` is unnecessary — `sequence` is always present in the data).
7. **[app/lib/verseSplitting.ts](electron-next-app/app/lib/verseSplitting.ts)** — delete `splitVerseIntoPartsForPLEN`; rename to `app/lib/bibleSlides.ts`, where `splitVerseIntoParts` remains **only for Bible chapters** (those are not authored data). Sermons are pre-chunked.
8. **[app/hooks/useSongPlayer.ts](electron-next-app/app/hooks/useSongPlayer.ts)** — 380 → ~90 lines. State is `{ item, slideIndex }`; the rest are selectors over `item.slides`. The mono/bilingual fork disappears. Delete `buildOutput2` and `stripTranslationPrefix` (defect **5** becomes impossible). Keep the jump-to-section-start on backward navigation (3 lines). Outputs 1 and 2 both return `{ primary: string[], secondary?: string[] }` — **never a glued string**.
9. **[app/hooks/useSongbooks.ts](electron-next-app/app/hooks/useSongbooks.ts)** — state `Record<SongBookKey, Songbook>`; `SONGBOOKS` loses `label` and `bilingual` (the name comes from `Songbook.name`); `findSong`/`findSongByGuid` → a single `findSongById(book, id)`; `upsertSong`/`deleteSongById` write `{ name, songs }` and match on `id` only; handle `refused`.
10. **[LocalPreview.tsx](electron-next-app/app/components/LocalPreview.tsx) + [StreamPreview.tsx](electron-next-app/app/components/StreamPreview.tsx)** — props take the structure, not a string. **Delete `output1Text.split("\n\n")` at [LocalPreview.tsx:43](electron-next-app/app/components/LocalPreview.tsx#L43) and [StreamPreview.tsx:42](electron-next-app/app/components/StreamPreview.tsx#L42)**. `bilingual = !!secondary` per slide. When `secondaryIsTranslation`, render the `Tłumaczenie:` label above the second block and italicize the block — the label is now chrome, not data.
11. **[app/lib/hdmiHtml.ts](electron-next-app/app/lib/hdmiHtml.ts)** — delete both `split("\n\n")` calls (lines 59 and 96). Add `escapeHtml` and **run every interpolation through it** (text, labels, sequence, footer); assemble lines as `lines.map(escapeHtml).join("<br>")`. That kills defect **9** without touching `innerHTML` in [electron/hdmi.html:189](electron-next-app/electron/hdmi.html#L189).
12. **Editor** ([songSerialize.ts](electron-next-app/app/lib/songSerialize.ts), [SongEditor.tsx](electron-next-app/app/components/SongEditor.tsx), [SectionsList.tsx](electron-next-app/app/components/SectionsList.tsx)) — `EditorSection` = `{ id, type, number, lines, altLines, showAlt }` (one row = one slide). `part` is not a control; it is derived. Delete `BILINGUAL_BOOKS` and `BILINGUAL_TARGETS`/`MONOLINGUAL_TARGETS` — every book carries 1–2 languages, so defect **8** disappears and the save target offers all books. Delete the hack preserving `existing.Sequence` ([songSerialize.ts:63-68](electron-next-app/app/lib/songSerialize.ts#L63-L68)). Rename the "Polish/English" labels to **"Original / Translation"** (the data also contains RU/PL). Add `ending` to the type picker. Add a **"Split section"** button that runs the same tables client-side — always on explicit click, never automatically, otherwise data would stop matching the screen. Defect **7** is structurally impossible because `Capo`/`Style`/`Alias` no longer exist.
13. **[app/page.tsx](electron-next-app/app/page.tsx)** — Bible/sermon build `ApiItem` directly with `sections`/`slides`; `id` is a string. Delete `buildApiItemForCustom` (lines 613-680) — custom songs go through the same path. Handle `result.refused`. Bump `LS_KEYS.selectedItems` and `customSongs` to `:v2`.
14. **Delete dead code**: `SongLists.tsx`, `PlaylistsPanel.tsx`, `usePlaylists.ts` (zero importers; fix the mention in the comment in `Library.tsx:9`).

### Phase 3 — Cutover

1. `git mv api/SongBooks/{5 books}.json api/SongBooks/_source/`; `git rm api/SongBooks/*-converted.json`.
2. **[electron/main.js](electron-next-app/electron/main.js)**: `SONGBOOK_BUNDLE_PATHS` (lines 38-48) → `api/SongBooks/{stem}.json`; `SONGBOOK_CACHE_KEYS` (lines 50-56) → `data/songs/{stem}.json`; **in `write-songbook` (lines 465 and 480) change `data.Songs` → `data.songs`** — if this is missed, `newCount` is always 0 and the **10× safeguard rejects every write**, while the UI shows it as a harmless "Local only". Return `refused`.
3. **Reset the local cache.** The old cache holds `*-converted.json` and `data-has-local` checks only `manifest.json` → an existing user would boot with **five empty songbooks and no error**. Add `DATA_EPOCH = 2` to `userData/config.json`; on startup, when the stored epoch is lower, delete the cache directory and let `bootstrap()` re-download everything.
4. **Custom song migration**: `customSongs` in localStorage are full of old `ApiItem`s. A one-off `migrateLegacyCustomSongs()` remaps `:v1` → `:v2` and leaves `:v1` in place. `selectedItems` needs no migration.
5. **[cloud-data-worker/scripts/upload-to-r2.mjs](cloud-data-worker/scripts/upload-to-r2.mjs)**: the `n.endsWith("-converted.json")` filter (line 51) → an explicit whitelist of the 5 names.
6. **Delete the old R2 objects** — no script deletes remote keys and `upload-to-r2.mjs:182` **merges** the manifest, so `*-converted.json` would live forever and every client would download ~2 MB of dead data. `wrangler r2 object delete` ×5, then force the worker to regenerate the manifest from a live listing with a single authenticated PUT ([cloud-data-worker/src/index.ts:115](cloud-data-worker/src/index.ts#L115)).
7. `ALLOWED_PUT_PREFIX` = `data/songs/` remains valid; only update the comment in [cloud-data-worker/src/index.ts:15](cloud-data-worker/src/index.ts#L15).
8. **Deployment order**: first upload the new data to R2 → delete the old → regenerate the manifest → **only then** release the app. The other way round, clients would wipe their cache and download a manifest that doesn't know the new data yet.

---

## Verification

```bash
cd electron-next-app
node scripts/build-songbooks.mjs      # + read _source/_report.md
node scripts/validate-songbooks.mjs   # must pass without errors
npx tsc --noEmit                      # enumerates leftovers after deleting the types
npm run build
```

Manual pass in the running app (`/run`) — one sample from each category:

- mono song with parts — `pielgrzym` #2
- bilingual — `new-song-pl-gb` #1
- translation — `children` "Źródełko": italics, rendered label, **no `Translation:` in the text**
- one of the 8 swapped songs in `roboczy` + the Russian-Polish one
- a song with an `ending` section (a type the app never rendered before)
- the pair with the same number in pl-gb
- a Bible chapter and a sermon (must be untouched)
- **edit → save → reload on each of the 5 books** + diff check of the object in R2
- both HDMI outputs including blackout
- **old install → new**: run the old build, let it download data, install the new one and launch both online and offline (this is the most likely silent regression)

## Risks

- **`data.Songs` → `data.songs`** in `write-songbook` — the single line that silently blocks all saving.
- **Old cache** — the symptom is "empty songbooks with no error message". The epoch solves it, but it must be tested.
- **`id` churn** — without a committed `_idmap.json`, every further script run invalidates selections and `upsertSong` starts adding instead of overwriting.
- **The derived `sequence` will differ for 91 songs** from the original. That is intentional (the original was wrong), but it must be visible in the report, otherwise it looks like a regression.
- **The ALL-CAPS conversion for children** touches 23 of 24 titles and cannot be reversed from the output — review the report line by line.
- **The splitting tables** must be copied exactly; any inaccuracy changes the shape of hundreds of slides at once.
- **HDMI escaping** is a fix, but a visible one: text with `<` or `&` used to render broken; now it displays literally.
