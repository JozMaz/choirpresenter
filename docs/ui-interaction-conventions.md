# UI interaction conventions

The app follows the **web convention**: anything clickable shows a pointer and reacts on hover.
The rules below are enforced globally in `app/globals.css` (`@layer base`), so components should
not repeat them.

## Cursor

| Element | Cursor | Where it comes from |
|---|---|---|
| `button`, `summary`, `a[href]`, `select`, checkbox/radio/range inputs | `pointer` | global base rule |
| `[role="button" \| "option" \| "tab"]` | `pointer` | global base rule |
| Anything `:disabled` or `aria-disabled="true"` | `not-allowed` | global base rule |
| `input`, `textarea` | `text` | browser default |
| Allotment sash between panes | `col-resize` / `row-resize` | Allotment CSS |
| Headings, labels, static text | default arrow | — |

The only place a component sets a cursor itself is a **clickable `div`** — list rows such as
`SongListRow`, the verse result row in `BibleBrowser`, and the message rows in `MessagesBrowser`.
They cannot become `role="button"` because they contain their own buttons (add to selection, edit,
remove), so they carry `cursor-pointer` explicitly, and `cursor-not-allowed` when the row is
unavailable.

## Hover

Hover backgrounds use the `surface-hover` token, never `border` or `surface-secondary`:
in the dark theme `--border` and `--surface-secondary` are the same colour, so
`bg-surface-secondary hover:bg-border` was a no-op.

| Element | Hover |
|---|---|
| List rows (songs, verses, messages, selection) | `hover:bg-surface-hover` |
| Songbook / Bible book headers | `hover:bg-surface-hover`, text lifts to `text-text-primary` |
| Icon buttons | `hover:bg-surface-hover hover:text-text-primary` |
| Destructive icon buttons | `hover:bg-danger hover:text-white` |
| Active / selected items | `hover:bg-primary-hover` — they must still react |
| Inputs and textareas | `hover:border-primary/60` |
| Bible book rows | stronger group tint via `--tint-hover` (see `lib/bibleGroups.ts`) |

Bible book rows cannot use a Tailwind hover background: the group colour is applied through inline
CSS variables, so `bibleGroupTint` exposes `--tint`, `--tint-hover` and `--tint-border`, and the
component references them with `bg-(--tint) hover:bg-(--tint-hover)`.

Every hovering element needs `transition-colors`.
