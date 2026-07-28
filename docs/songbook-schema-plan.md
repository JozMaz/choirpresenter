# Přepis songbooků na čisté schéma

## Kontext

Appka je prezentační nástroj pro sbor: jeden operátor, dva výstupy (projektory/HDMI + broadcast). Data písní pocházejí z VideoPsalm — 5 knih, **1220 písní** — a nesou spoustu balastu, který appka vůbec nečte, plus několik vad, které se projevují jako nespolehlivost při hraní.

Auditem dat a kódu jsem zjistil konkrétní problémy, které nové schéma odstraňuje:

| # | Problém | Rozsah |
|---|---|---|
| 1 | PL a EN se přenášejí jako **jeden string slepený `"\n\n"`** a rozpojují `.split("\n\n")` na 4 místech | prázdný řádek v textu = angličtina zmizí |
| 2 | `extractSongParts` neumí rozlousknout token `V102` ani `B*` → slide se **tiše zahodí** | 36 písní |
| 3 | Dvojjazyčná cesta ignoruje `verse.Text` → verše se ztratí | 2 písně (6 z 10 veršů) |
| 4 | Nerozdělené oddělovače `-----` zůstaly v textu | 87 veršů |
| 5 | `"Translation:"` se maže jen na Output 2, na Output 1 a HDMI 1 je vidět | 191 výskytů |
| 6 | `generateSequence` spojuje `", "`, ale ukládá se `" "` | rozbil by parser |
| 7 | Editace písně zničí `Verse.Style`, `Capo`, `Alias` | každý save |
| 8 | `children` chybí v `BILINGUAL_TARGETS` → nejde uložit dvojjazyčnou píseň | celá kniha |
| 9 | HDMI HTML se injektuje přes `innerHTML` **bez escapování** | XSS/rozbité vykreslení |
| 10 | `refused: true` z `write-songbook` není v typech a nikdo ho neošetřuje | odmítnutý zápis vypadá jako úspěch |

Cíl: jedno schéma, které je zároveň jednoduché i jednoznačné, a v appce jedna cesta místo dvou (mono/bilingual).

---

## Cílové schéma

```jsonc
{
  "name": "Śpiewnik dziecięcy",
  "songs": [{
    "id": "uuid-v4",
    "number": 42,                    // null když kniha čísla nemá
    "key": "Cm",                     // mezinárodně, 12 dur + 12 moll, nebo null
    "title": "Źródełko",
    "sequence": "V1 C V2 C C2",      // ODVOZENO z text[0].verses
    "text": [                        // 1..2 jazyky; [0] = zpívaný originál
      { "isTranslation": false, "verses": [
          { "order": 1, "type": "verse",  "number": 1, "part": 1, "lines": ["…","…"] },
          { "order": 2, "type": "verse",  "number": 1, "part": 2, "lines": ["…"] },
          { "order": 3, "type": "chorus", "number": 1,            "lines": ["…"] }
      ]},
      { "isTranslation": true, "verses": [ /* páruje se přes order */ ] }
    ]
  }]
}
```

### Pravidla (odsouhlasená)

- **`text[0].verses` JE pořadí klikání dolů.** Nic se neslučuje ani nezahazuje. Refrén zopakovaný mezi slokami zůstává jako samostatné záznamy se stejným `type`+`number`, ale jiným `order`.
- `order` je unikátní v rámci jazyka. `text[1]` **dědí `order`** párového záznamu z `text[0]` — proto může být řídké (verš bez překladu prostě chybí).
- `part` rozlišuje po sobě jdoucí záznamy se stejným `type`+`number` ale jiným textem. Vynechá se, když je běh dlouhý 1.
- `sequence` se **celá dopočítá** z `text[0].verses`: projdi v pořadí, slij po sobě jdoucí stejné `(type, number)` do jednoho tokenu. Původní `Sequence` z VideoPsalm se zahodí (u 91 písní stejně neodpovídá realitě). Tokeny: `V1`, `C`/`C2`, `B`/`B2`, `E`/`E2` — **č.1 bez čísla**, spojeno jednou mezerou.
- `lines` je **pole řetězců** bez trailing mezer a bez prázdných položek. Appka si udělá `join("\n")`. Tím padá celé křehké `"\n\n"` balení.
- `id` = nové `crypto.randomUUID()` pro všech 1220 písní. Mapa `_source Guid → uuid` se uloží do `_idmap.json` a **commitne**, aby další běh skriptu id neměnil.
- `key` mezinárodně (`C C# D Eb E F F# G Ab A Bb B` × `{"", "m"}`). Parsuje se **primárně z názvu** (pokrývá ~880 písní, včetně polských zápisů `H`→`B`, `c-moll`→`Cm`, i překlepů `c-mol`/`h-mol`), fallback pole `Key` (536 písní). 51 neshod jde do reportu. **Frontend zobrazuje polsky/německy** přes explicitní 24-řádkovou tabulku.
- Typy sekcí: `verse`, `chorus`, `bridge`, `ending`. Zdroj: `Tag:1`→chorus, `Tag:3`→ending, jinak verse. `Tag:2` se v datech nevyskytuje, ale editor bridge nabízí.
- `isTranslation` je **per jazyk per píseň**: když se marker objeví kdekoli, celý jazyk je nezpívatelný překlad. Slovo `Translation:`/`Translations:` se z `lines` **vyřízne** — appka popisek vykreslí sama nad blokem a blok dá kurzívou.
- `text[0]` je vždy zpívaný originál — 8 písní v roboczy (EN-first, jedna RU/PL) se prohodí.
- **Dělení dlouhých slok se materializuje při konverzi** přesně podle dnešních tabulek v `verseSplitting.ts` (≤4 řádky mono, ≤3 dvojjazyčně). Na plátně se tedy nic nezmění, ale data = to, co je vidět, a špatné dělení jde opravit v editoru.
- Zahozeno: `Capo`, `Style` (song i verse), `Description`, `Copyright`, `Alias`, `VideoDuration`, `IsCompressed`, `VersionDate`, původní `Guid`, původní `Sequence`. Placeholdery `"..."` a prázdné písně se nezapíšou.

---

## Postup

### Fáze 1 — Konverze dat

**`scripts/lib/vpsalm.mjs`** — tolerantní parser. Převezmi `escapeNewlinesInStrings` + BOM strip ze [scripts/convert-songbooks.mjs:33-76](electron-next-app/scripts/convert-songbooks.mjs#L33-L76) beze změny. Kopii v [electron/main.js:298-335](electron-next-app/electron/main.js#L298-L335) nesjednocuj (zabalený Electron neimportuje ze `scripts/`) — jen do obou dej komentář s odkazem.

**`scripts/lib/schema.mjs`** — čisté funkce sdílené s appkou: `sequenceToken`, `deriveSequence`, `assignOrderAndParts`, `sectionLabel`, `groupIntoSections`.

**`scripts/lib/split.mjs`** — tabulky dělení **doslova opsané** z [app/lib/verseSplitting.ts](electron-next-app/app/lib/verseSplitting.ts) (obě funkce) plus `alignEnToPlParts` z [app/lib/songProcessing.ts:252-270](electron-next-app/app/lib/songProcessing.ts#L252-L270).

**`scripts/build-songbooks.mjs`** — hlavní skript, čte `api/SongBooks/_source/*.json`, píše `api/SongBooks/{book}.json`. Pořadí kroků:

1. Parse (BOM + escape + `vm.runInNewContext`).
2. Zahodit písně, které jsou po odstranění markupu prázdné.
3. **Rozdělit jazyky.** Oddělovač = řádek, jehož obsah po odstranění tagů odpovídá `^[-–—_=.·]{5,}$`. Měřeno: každý skutečný oddělovač má ≥10 znaků, jediné 3-znakové běhy jsou placeholdery `...` — nehrozí záměna. Pozor: dnešní regex `[.\-]{3,}` **míjí 12 em-dash oddělovačů v roboczy**. Tagy `<sN>` přesahují přes oddělovač → dělit na surovém textu, tagy strhávat až per blok.
4. **Strip markupu** — plošně `<[^>]{0,60}>`. Dnešní `removeStyleTags` míjí `<b>`, `<u>`, `<cFF00F200>`. Pak split na `\n`, `trimEnd()` každý řádek, zahodit prázdné. Blok, který je celý `^[.\s\-–—…]*$`, se zahodí jako placeholder (67 v pl-gb).
5. **Jazyky.** `isTranslation` per jazyk per píseň podle markeru; pak marker vyříznout. **Flip**: když je `isTranslation[0]` a ne `[1]` → prohodit (chytí 2 z 8); jinak skóre podle hustoty diakritiky. Zbylé případy zamknout přes `FORCE_FLIP` set _source Guidů na začátku skriptu po přečtení reportu.
6. **Klasifikace + číslování.** `type` z `Tag`; `number = ID || 1` (verše nikdy nemají ID 0 ani 1, refrény používají 0 pro 1). Pak běhy po sobě jdoucích stejných `(type, number)` → `part = 1..n`.
7. **Materializace dělení** (`split.mjs`) — rozděl jazyk 0, jazyk 1 rozděl na stejný počet dílů proporčně. Přečísluj `part`.
8. **`order`** = index+1 v jazyce 0; jazyk 1 dědí.
9. **Metadata** — `id` z `_idmap.json`, `number` z `Song.ID` (null pro children/roboczy), `title` (strip markupu → newline na mezeru → odstranit koncovku `(Key) N` **gated na seznam tónin**, aby přežilo `(Litwa)`; pro children navíc VERZÁLKY→věta přes `toLocaleLowerCase("pl")`), `key`, `sequence` z `deriveSequence`.
10. Emit `JSON.stringify({name, songs}, null, 2)`. `name` z 5-položkové konstanty (přesun z [app/lib/songProcessing.ts:125-132](electron-next-app/app/lib/songProcessing.ts#L125-L132)).

> **Pozor na `pielgrzym`**: koncovka názvu je `"  (G) "` bez čísla — dnešní `stripTitleSuffix` vyžaduje číslo, takže pro tuhle knihu nikdy nesepne. Číslo musí být volitelné.

**`scripts/validate-songbooks.mjs`** — tvrdé invarianty, exit 1 při selhání. Klíčové: `id` unikátní **napříč všemi 5 soubory**; `order` v jazyce 0 souvislé `1..n`; každý `order` v jazyce 1 existuje v jazyce 0 a má shodné `(type, number, part)`; žádný řádek neodpovídá `<[^>]{0,60}>`, `[-–—_=.·]{5,}` ani `/translations?\s*:/i`; `lines` neprázdné, bez `\n`/`\r`/`\t` a bez okrajových mezer; `part` je v každém běhu přesně `1..k` a chybí právě když `k===1`; **`sequence` znovu odvozená stejnou funkcí se rovná uložené**; `key` z povolených 24 nebo null; klíče písně přesně `id, number, key, title, sequence, text` a nic víc.

**`_source/_report.md`** — pro ruční kontrolu (znáš každou píseň): prohozené jazyky (8), písně které přišly o jazyk (~67 placeholderů), neshody odvozené vs. původní sequence (91), sekce se ≥3 díly = pravděpodobně špatně otagované sloky (4), všech 8 `ending` sekcí, neshody tóniny název vs. `Key` (51) + tóniny parsované z polského zápisu, duplicitní čísla v pl-gb (10), převody VERZÁLEK (23+5) `PŘED → Po`, názvy s newline (15), automatická dělení (zvlášť ta s jednořádkovým ocasem), částečné translation markery (7), zahozené písně.

**Iterace:** build → validate → přečteš report → opravy se zapíšou do override tabulek na začátku `build-songbooks.mjs` → rebuild (id se drží přes `_idmap.json`) → validate.

### Fáze 2 — Přepis appky

Pořadí je dané závislostmi. **Začni `types.ts`** — TypeScript ti pak vyjmenuje každé místo k opravě.

1. **[app/lib/types.ts](electron-next-app/app/lib/types.ts)** — smaž `Verse`, `Song`, `VerseParts`. Přidej `VerseEntry`, `LangBlock`, `SongEntry`, `Songbook`. `ApiItem` přepiš na **slide-centric**: `{ id: string, number, title, key, sequence, source, bookName, secondaryIsTranslation, sections: Section[], slides: Slide[], searchIndex, fullText }`, kde `Slide = { sectionIndex, label, primary: string[], secondary?: string[] }`. Smaž `ApiItem.text` (duplikát `title`), `.selected` (zapisuje se, nikdy nečte), `.guid`. Oprav návratový typ `writeSongBook` o `refused?: boolean`.
   - **Sémantika**: *sekce* = běh po sobě jdoucích veršů se stejným `(type, number)`; *slide* = jeden `VerseEntry`. Output 1/HDMI 1 kreslí celou sekci, Output 2/HDMI 2 aktuální slide — přesně jak to dnes dělá `output1Text`/`output2Text`.
   - **Párování**: `secondary = text[1].verses.find(v => v.order === primary.order)?.lines`. Řídký jazyk 1 → `undefined` → preview kreslí jednojazyčně bez dělící čáry. Tím padají vady **1** a **3**.
2. **`app/lib/songSchema.ts`** (nový) — přesná zrcadlová kopie `scripts/lib/schema.mjs`.
3. **`app/lib/musicKeys.ts`** (nový) — 24 hodnot + explicitní `KEY_LABEL_PL` (`B→"H"`, `Bb→"B"`, `Cm→"c-moll"`, `Bm→"h-moll"`, …). Smaž `MUSICAL_KEYS` z [app/lib/constants.ts:7-20](electron-next-app/app/lib/constants.ts#L7-L20) (má jen 12 dur a žádné moll).
4. **`app/lib/songAdapter.ts`** nahrazuje [app/lib/songProcessing.ts](electron-next-app/app/lib/songProcessing.ts) — jediný vstup `toApiItem(song, source, bookName)`, **žádné parsování textu**. Smaž `processPlOnlySongbook`, `processBilingualSongbook`, `isBilingualSource`, `getDisplayTitle`, `getVerseText`, `extractSongParts`, `getAllPartsFlat`, `isPlaceholderText`, `alignEnToPlParts`, `processAllVersesForPLEN`, `stripKeyFromTitle` — ~330 ze 428 řádků. `buildSongFooter` přepiš na `KEY_LABEL_PL` + `bookName`.
5. **[app/lib/textUtils.ts](electron-next-app/app/lib/textUtils.ts)** — smaž `removeStyleTags` a `stripTitleSuffix` (teď starost konvertoru; obě jsou navíc chybné). Ponech `normalizeSearch`, `buildSearchIndex`.
6. **[app/lib/sequence.ts](electron-next-app/app/lib/sequence.ts)** — smazat celý (vada 6 zaniká, `autoDetectSequence` netřeba — `sequence` je vždy v datech).
7. **[app/lib/verseSplitting.ts](electron-next-app/app/lib/verseSplitting.ts)** — smaž `splitVerseIntoPartsForPLEN`; přejmenuj na `app/lib/bibleSlides.ts`, kde `splitVerseIntoParts` zůstává **jen pro biblické kapitoly** (ty nejsou autorovaná data). Zprávy jsou předchunkované.
8. **[app/hooks/useSongPlayer.ts](electron-next-app/app/hooks/useSongPlayer.ts)** — 380 → ~90 řádků. Stav je `{ item, slideIndex }`, zbytek jsou selektory nad `item.slides`. Rozdvojení mono/bilingual mizí. Smaž `buildOutput2` a `stripTranslationPrefix` (vada **5** je nadále nemožná). Zachovej skok na začátek sekce při navigaci zpět (3 řádky). Output 1 i 2 vracejí `{ primary: string[], secondary?: string[] }` — **nikdy slepený string**.
9. **[app/hooks/useSongbooks.ts](electron-next-app/app/hooks/useSongbooks.ts)** — stav `Record<SongBookKey, Songbook>`; `SONGBOOKS` ztrácí `label` i `bilingual` (název jde z `Songbook.name`); `findSong`/`findSongByGuid` → jedno `findSongById(book, id)`; `upsertSong`/`deleteSongById` zapisují `{ name, songs }` a matchují jen na `id`; ošetři `refused`.
10. **[LocalPreview.tsx](electron-next-app/app/components/LocalPreview.tsx) + [StreamPreview.tsx](electron-next-app/app/components/StreamPreview.tsx)** — props берou strukturu, ne string. **Smaž `output1Text.split("\n\n")` na [LocalPreview.tsx:43](electron-next-app/app/components/LocalPreview.tsx#L43) a [StreamPreview.tsx:42](electron-next-app/app/components/StreamPreview.tsx#L42)**. `bilingual = !!secondary` per slide. Když `secondaryIsTranslation`, vykresli popisek `Tłumaczenie:` nad druhým blokem a blok kurzívou — popisek je nově chrome, ne data.
11. **[app/lib/hdmiHtml.ts](electron-next-app/app/lib/hdmiHtml.ts)** — smaž obě `split("\n\n")` (ř. 59 a 96). Přidej `escapeHtml` a **prožeň jím každou interpolaci** (text, popisky, sequence, patičku); řádky skládej `lines.map(escapeHtml).join("<br>")`. Tím padá vada **9**, aniž se sahá na `innerHTML` v [electron/hdmi.html:189](electron-next-app/electron/hdmi.html#L189).
12. **Editor** ([songSerialize.ts](electron-next-app/app/lib/songSerialize.ts), [SongEditor.tsx](electron-next-app/app/components/SongEditor.tsx), [SectionsList.tsx](electron-next-app/app/components/SectionsList.tsx)) — `EditorSection` = `{ id, type, number, lines, altLines, showAlt }` (řádek = jeden slide). `part` není ovládací prvek, dopočítá se. Smaž `BILINGUAL_BOOKS` a `BILINGUAL_TARGETS`/`MONOLINGUAL_TARGETS` — každá kniha nese 1–2 jazyky, takže vada **8** zaniká a cíl uložení nabízí všechny knihy. Smaž hack na zachování `existing.Sequence` ([songSerialize.ts:63-68](electron-next-app/app/lib/songSerialize.ts#L63-L68)). Přejmenuj popisky „Polish/English" → **„Originál / Překlad"** (data obsahují i RU/PL). Přidej `ending` do výběru typu. Přidej tlačítko **„Rozdělit sekci"**, které pustí stejné tabulky klientsky — vždy jen na výslovné kliknutí, nikdy automaticky, jinak by data přestala odpovídat obrazu. Vada **7** je strukturálně nemožná, protože `Capo`/`Style`/`Alias` už neexistují.
13. **[app/page.tsx](electron-next-app/app/page.tsx)** — bible/message staví `ApiItem` přímo se `sections`/`slides`; `id` je string. Smaž `buildApiItemForCustom` (ř. 613-680) — vlastní písně jdou stejnou cestou. Ošetři `result.refused`. Zvedni `LS_KEYS.selectedItems` i `customSongs` na `:v2`.
14. **Smaž mrtvý kód**: `SongLists.tsx`, `PlaylistsPanel.tsx`, `usePlaylists.ts` (nula importérů; oprav zmínku v komentáři v `Library.tsx:9`).

### Fáze 3 — Přepnutí

1. `git mv api/SongBooks/{5 knih}.json api/SongBooks/_source/`; `git rm api/SongBooks/*-converted.json`.
2. **[electron/main.js](electron-next-app/electron/main.js)**: `SONGBOOK_BUNDLE_PATHS` (ř. 38-48) → `api/SongBooks/{stem}.json`; `SONGBOOK_CACHE_KEYS` (ř. 50-56) → `data/songs/{stem}.json`; **v `write-songbook` (ř. 465 a 480) `data.Songs` → `data.songs`** — když se to opomene, `newCount` je vždy 0 a **10× pojistka odmítne každý zápis**, přičemž UI to ukáže jako neškodné „Local only". Vracej `refused`.
3. **Reset lokální cache.** Stará cache drží `*-converted.json` a `data-has-local` kontroluje jen `manifest.json` → stávající uživatel by nabootoval s **pěti prázdnými zpěvníky a bez chyby**. Přidej `DATA_EPOCH = 2` do `userData/config.json`; při startu, když je uložená epocha nižší, smaž cache adresář a nech `bootstrap()` stáhnout vše znovu.
4. **Migrace vlastních písní**: `customSongs` v localStorage jsou plné staré `ApiItem`. Jednorázové `migrateLegacyCustomSongs()` přemapuje `:v1` → `:v2` a `:v1` nechá ležet. `selectedItems` se migrovat nemusí.
5. **[cloud-data-worker/scripts/upload-to-r2.mjs](cloud-data-worker/scripts/upload-to-r2.mjs)**: filtr `n.endsWith("-converted.json")` (ř. 51) → explicitní whitelist 5 jmen.
6. **Smaž staré objekty v R2** — žádný skript remote klíče nemaže a `upload-to-r2.mjs:182` manifest **slučuje**, takže by `*-converted.json` žily věčně a každý klient by stahoval ~2 MB mrtvých dat. `wrangler r2 object delete` ×5, pak jedním autentizovaným PUT donuť worker přegenerovat manifest z živého listingu ([cloud-data-worker/src/index.ts:115](cloud-data-worker/src/index.ts#L115)).
7. `ALLOWED_PUT_PREFIX` = `data/songs/` platí dál; uprav jen komentář v [cloud-data-worker/src/index.ts:15](cloud-data-worker/src/index.ts#L15).
8. **Pořadí nasazení**: nejdřív nahrát nová data do R2 → smazat stará → přegenerovat manifest → **až pak** vydat appku. Opačně by klienti vymazali cache a stáhli manifest, který nová data ještě nezná.

---

## Ověření

```bash
cd electron-next-app
node scripts/build-songbooks.mjs      # + přečíst _source/_report.md
node scripts/validate-songbooks.mjs   # musí projít bez chyby
npx tsc --noEmit                      # vyjmenuje zbylá místa po smazání typů
npm run build
```

Ruční průchod v běžící appce (`/run`) — po jednom vzorku z každé kategorie:

- mono píseň s díly — `pielgrzym` #2
- dvojjazyčná — `new-song-pl-gb` #1
- překlad — `children` „Źródełko": kurzíva, vykreslený popisek, **žádné `Translation:` v textu**
- jedna z 8 prohozených písní v `roboczy` + ta rusko-polská
- píseň s `ending` sekcí (typ, který appka nikdy nekreslila)
- dvojice se stejným číslem v pl-gb
- biblická kapitola a kázání (nesmí je zasáhnout)
- **edit → save → reload na každé z 5 knih** + kontrola diffu objektu v R2
- oba HDMI výstupy včetně blackoutu
- **stará instalace → nová**: pusť starý build, nech stáhnout data, nainstaluj nový a spusť online i offline (tohle je nejpravděpodobnější tichá regrese)

## Rizika

- **`data.Songs` → `data.songs`** v `write-songbook` — jediný řádek, který tiše zablokuje veškeré ukládání.
- **Stará cache** — projev je „prázdné zpěvníky bez chybové hlášky". Řeší epocha, ale musí se otestovat.
- **Churn `id`** — bez commitnutého `_idmap.json` každý další běh skriptu zneplatní výběry a `upsertSong` začne přidávat místo přepisovat.
- **Odvozená `sequence` se u 91 písní bude lišit** od původní. Je to záměr (původní byla chybná), ale v reportu to musí být vidět, jinak to vypadá jako regrese.
- **Převod VERZÁLEK u children** sáhne na 23 z 24 názvů a z výstupu se nedá vrátit — projít v reportu řádek po řádku.
- **Tabulky dělení** se musí opsat přesně; nepřesnost změní tvar stovek slidů naráz.
- **Escapování HDMI** je oprava, ale je vidět: text s `<` nebo `&` se dosud kreslil rozbitě, nově se zobrazí doslova.
