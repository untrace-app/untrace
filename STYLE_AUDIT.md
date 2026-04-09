# Untrace — Style Audit Report

Generated: 2026-04-09

---

## Constants (src/constants.ts)

| Token | Value | Usage |
|-------|-------|-------|
| `COLOR_BACKGROUND` | `#ffedcd` | Page background |
| `C_TEXT` | `#b17025` | UI text primary |
| `C_TEXT_SEC` | `#7f7c6c` | UI text secondary |
| `C_RECESSED` | `#f0d2a8` | Recessed bg / button bg |
| `C_PRIMARY` | `#fb5607` | Primary accent |
| `GRAD_PRIMARY` | `#fb5607` | Primary button bg (solid, not gradient) |
| `FONT` | `'Lexend', system-ui, sans-serif` | Body/labels |
| `FONT_HEADING` | `'Lexend', system-ui, sans-serif` | Headings (same as FONT) |

---

## 1. Splash Screen (index.html #splash)

| Element | Property | Value |
|---------|----------|-------|
| Container | background | `#ffedcd` |
| Container | layout | flex column, align-items:center, justify-content:flex-start |
| Container | padding-top | `35vh` |
| SVG logo | max-width | `80%` |
| SVG logo dots | fill | `#EEDACC` |
| SVG logo lines | stroke colors | `#FB5607`, `#8338EC`, `#3A86FF`, `#FFBE0B`, `#FF006E` |
| SVG logo lines | stroke-width | `10` |
| Loader dot | size | `8px` x `8px` |
| Loader dot | border-radius | `50%` |
| Loader dot | background | `#888780` |
| Loader dot | margin-top | `24px` |

### Inconsistencies
- **`#EEDACC`** (SVG dot fill) is not defined in constants.ts — close to but not the same as `C_RECESSED` (`#f0d2a8`)
- **`#888780`** (loader dot) is a hardcoded gray not in constants.ts

---

## 2. Main Menu (src/main.ts showMainMenu)

| Element | Property | Value |
|---------|----------|-------|
| Container | background | `#ffedcd` |
| Logo | position | absolute, top:35vh, left:50%, transform:translateX(-50%) |
| Logo | max-width | `80%` |
| "Tap to Begin" btn | font-family | `'Lexend',system-ui,sans-serif` (hardcoded) |
| "Tap to Begin" btn | font-size | `17px` |
| "Tap to Begin" btn | font-weight | `700` |
| "Tap to Begin" btn | color | `#ffffff` |
| "Tap to Begin" btn | background | `#fb5607` |
| "Tap to Begin" btn | border-radius | `9999px` |
| "Tap to Begin" btn | padding | `14px 44px` |
| "Tap to Begin" btn | box-shadow | `0 4px 12px rgba(0,0,0,0.10)` |
| Button wrapper | position | absolute, top:calc(35vh + 70px) |
| Footer line 1 | font-family | `'Lexend',system-ui,sans-serif` (hardcoded) |
| Footer line 1 | font-size | `11px` |
| Footer line 1 | font-weight | `400` |
| Footer line 1 | color | `rgba(177,112,37,0.4)` |
| Footer line 2 | font-size | `10px` |
| Footer line 2 | font-weight | `300` |
| Footer line 2 | color | `rgba(177,112,37,0.4)` |
| Footer | position | absolute, bottom:24px |

### Inconsistencies
- Font-family hardcoded as `'Lexend',system-ui,sans-serif` instead of using `FONT` constant (imported but not used here)
- `rgba(177,112,37,0.4)` is a translucent version of `C_TEXT` — not a constant

---

## 3. Tutorial (src/ui/tutorial.ts)

### Welcome Popup

| Element | Property | Value |
|---------|----------|-------|
| Backdrop | background | `rgba(255,237,205,0.85)` |
| Backdrop | backdrop-filter | `blur(20px)` |
| Card | background | `#feffe5` |
| Card | border-radius | `24px` |
| Card | padding | `28px 24px 24px` |
| Card | max-width | `280px` |
| Card | box-shadow | `0 8px 32px rgba(46,47,44,0.06)` |
| Title "Welcome" | font-family | FONT_HEADING |
| Title "Welcome" | font-size | `24px` |
| Title "Welcome" | font-weight | `700` |
| Title "Welcome" | color | C_TEXT (`#b17025`) |
| Subtitle | font-size | `15px` |
| Subtitle | font-weight | `400` |
| Subtitle | color | C_TEXT_SEC (`#7f7c6c`) |
| "Let's go" btn | background | `linear-gradient(135deg, #fb5607, #fb5607)` |
| "Let's go" btn | color | `#ffffff` |
| "Let's go" btn | font-size | `16px` |
| "Let's go" btn | font-weight | `600` |
| "Let's go" btn | border-radius | `9999px` |
| "Let's go" btn | padding | `14px 0` (full width) |

### Tutorial Bars

| Element | Property | Value |
|---------|----------|-------|
| Top bar | background | `#ffedcd` |
| Top bar | height | `52px` |
| Top bar | padding-top | `calc(env(safe-area-inset-top) + 12px)` |
| Top bar | padding-left/right | `16px` |
| "TUTORIAL" label | font-family | FONT_HEADING |
| "TUTORIAL" label | font-size | `16px` |
| "TUTORIAL" label | font-weight | `600` |
| "TUTORIAL" label | color | C_TEXT |
| Step label | font-family | FONT |
| Step label | font-size | `12px` |
| Step label | font-weight | `400` |
| Step label | color | C_TEXT_SEC |
| Bottom bar | background | `#ffedcd` |
| Bottom bar | height | `48px` |
| Bottom bar | padding-bottom | `calc(env(safe-area-inset-bottom) + 16px)` |
| Bottom bar | padding-left/right | `24px` |
| Inline buttons (undo/redo/reset) | size | `40px` x `40px` |
| Inline buttons | background | C_RECESSED (`#f0d2a8`) |
| Inline buttons | border-radius | `9999px` |
| Inline buttons | color | C_TEXT (`#b17025`) |
| Move counter | font-size | `14px` |
| Move counter | font-weight | `600` |
| Move counter | color | C_TEXT |

### Floating Tip

| Element | Property | Value |
|---------|----------|-------|
| Tip text | font-family | FONT |
| Tip text | font-size | `18px` (or `15px` if gap < 60px) |
| Tip text | font-weight | `600` |
| Tip text | color | C_TEXT |

### Completion Toast

| Element | Property | Value |
|---------|----------|-------|
| Card | background | `#feffe5` |
| Card | border-radius | `16px` |
| Card | padding | `16px 32px` |
| Card | box-shadow | `0 4px 16px rgba(0,0,0,0.08)` |
| Text | font-family | FONT_HEADING |
| Text | font-size | `22px` |
| Text | font-weight | `700` |
| Text | color | `#fb5607` (hardcoded as `C_SUCCESS`) |

### Inconsistencies
- Welcome card box-shadow (`0 8px 32px rgba(46,47,44,0.06)`) differs from completion toast (`0 4px 16px rgba(0,0,0,0.08)`)
- Welcome card border-radius `24px` vs completion toast `16px`
- "Let's go" button uses `linear-gradient(135deg, #fb5607, #fb5607)` — a gradient of a single color; should be solid `#fb5607` or use `GRAD_PRIMARY`
- `C_SUCCESS` (`#fb5607`) is defined locally, not in constants.ts — same value as `C_PRIMARY`

---

## 4. Level Select (src/ui/level-select.ts)

### Overlay Container

| Element | Property | Value |
|---------|----------|-------|
| Overlay | background | `#e8a8a0` |

**Flag:** `#e8a8a0` is hardcoded, not in constants.ts — a pink/salmon not in the CLAUDE.md color palette.

### Top Bar

| Element | Property | Value |
|---------|----------|-------|
| Top bar | background | `transparent` |
| Top bar | padding-top | `calc(env(safe-area-inset-top) + 14px)` |
| Top bar | padding-bottom | `14px` |
| Top bar | padding-left/right | `20px` |
| Star chip | background | `rgba(255,255,255,0.55)` |
| Star chip | backdrop-filter | `blur(8px)` |
| Star chip | border-radius | `20px` |
| Star chip | padding | `4px 10px` |
| Star chip | border | `1px solid rgba(255,255,255,0.3)` |
| Star icon | size | `18px` |
| Star icon | stroke | `#b17025`, `2px` |
| Star count text | font-family | FONT |
| Star count text | font-size | `14px` |
| Star count text | font-weight | `600` |
| Star count text | color | C_TEXT |
| Spark chip | (same as star chip) | identical styles |
| Spark chip | margin-left | `12px` |
| Spark icon | size | `18px` |
| Spark icon | stroke | `#b17025`, `2px` |
| Spark icon | fill gradient | `#00bcd4` → `#2196f3` |
| Spark "+" button | size | `18px` x `18px` |
| Spark "+" button | position | absolute, right:-6px, bottom:-6px |
| Spark "+" button | background | `linear-gradient(180deg, #00bcd4, #2196f3)` |
| Spark "+" button | border | `1.5px solid #1976d2` |
| Spark "+" button | color | `#ffffff` |
| Spark "+" button | font-family | FONT |
| Spark "+" button | font-size | `13px` |
| Spark "+" button | font-weight | `700` |
| Shop button | size | `40px` x `40px` |
| Shop button | background | `linear-gradient(180deg, #00bcd4, #2196f3)` |
| Shop button | border | `1.5px solid #1976d2` |
| Shop button | border-radius | `9999px` |
| Shop icon | fill | `#ffffff` |
| Shop icon | size | `22px` |
| Settings gear button | size | `40px` x `40px` |
| Settings gear button | background | `rgba(255,255,255,0.45)` |
| Settings gear button | backdrop-filter | `blur(8px)` |
| Settings gear button | border | `1.5px solid rgba(255,255,255,0.3)` |
| Settings gear button | border-radius | `9999px` |
| Gear icon | fill | `#b17025` |
| Gear icon | size | `20px` |

### Scroll Area

| Element | Property | Value |
|---------|----------|-------|
| Background gradient | colors | `#f5d0c0` → `#f0b8b0` → `#e8a8a0` |
| Grid lines | color | `rgba(161,129,104,0.12)` |
| Grid lines | spacing | `30px` |
| Grid lines | width | `1px` |

**Flag:** Background gradient colors (`#f5d0c0`, `#f0b8b0`, `#e8a8a0`) are all hardcoded, not in constants.ts.

### Vignette

| Element | Property | Value |
|---------|----------|-------|
| Vignette | background | `radial-gradient(ellipse at 50% 50%, transparent 42%, rgba(240,210,168,0.30) 100%)` |

### Level Nodes

| Element | Property | Value |
|---------|----------|-------|
| **Locked** node | bg | radial-gradient `#e8d8c2` → `#d8c4a0` |
| Locked node | border | `4px solid #e8d8c2` |
| Locked node | text color | `#c4b49a` |
| **Completed** node | bg | radial-gradient `#fcecd8` → `#f0d2a8` |
| Completed node | border | `4px solid #ffbe0b` (3-star) or `#fb5607` (1-2 star) |
| Completed node | text color | C_TEXT |
| **Current** node | bg | radial-gradient `#ffffff` → `#ffe6f4` |
| Current node | border | `4px solid #ff006e` |
| Current node | text color | `#ff006e` |
| Current node | box-shadow | `0 0 12px rgba(255,0,110,0.5), 0 3px 6px rgba(0,0,0,0.1)` |
| **Unlocked** node | bg | radial-gradient `#fffff2` → `#f4f0da` |
| Unlocked node | border | `3px solid #d3cfc4` |
| Level numbers | font-family | `'Bungee'` (via Google Fonts) — **NOTE: HTML import says Lexend** |
| Level numbers | font-size | `29px` (standard), `31px` (current) |
| Level numbers | font-weight | `700` |
| Node diameter | standard | `64px` |
| Node diameter | current | `78px` |

**Flag:** index.html now imports both Lexend and a second `Lexend` (duplicate link from font-swap history). The level numbers use `'Lexend'` font-family, not Bungee — the last swap was Bungee→Sora→Lexend.

### Connecting Lines

| Element | Property | Value |
|---------|----------|-------|
| Completed segment | fill gradient | `#ffbe0b` → `#fb5607` |
| Incomplete segment | stroke | `#f0d2a8` |
| Locked segment | opacity | `0.5` |
| All segments | width | `4px` |

### Earned Stars (on nodes)

| Element | Property | Value |
|---------|----------|-------|
| Star SVG | size | `22px` |
| Star SVG | stroke | `#b17025`, `3px` |
| Star SVG | fill gradient | `#ffbe0b` → `#f59e0b` |

### World 1 Chip

| Element | Property | Value |
|---------|----------|-------|
| Chip | background | `rgba(255,255,255,0.25)` |
| Chip | backdrop-filter | `blur(8px)` |
| Chip | border-radius | `20px` |
| Chip | padding | `12px 32px` |
| Chip | border | `2.5px solid rgba(255,255,255,0.7)` |
| Text | font-family | FONT_HEADING |
| Text | font-size | `28px` |
| Text | font-weight | `700` |
| Text | color | C_TEXT |

### World 2 Chip

| Element | Property | Value |
|---------|----------|-------|
| Chip (locked) | background | `rgba(180,165,212,0.3)` |
| Chip (locked) | border | `1px solid rgba(180,165,212,0.2)` |
| Chip (unlocked) | background | `rgba(255,255,255,0.5)` |
| Chip (unlocked) | backdrop-filter | `blur(8px)` |
| Chip (unlocked) | border | `1px solid rgba(255,255,255,0.3)` |
| Chip | border-radius | `16px` |
| Chip | padding | `10px 18px` |
| Lock icon color | | `#b8a5d4` |
| Label | font-family | FONT_HEADING |
| Label | font-size | `15px` |
| Label | font-weight | `600` |
| Label (locked) color | | `#b8a5d4` |
| Label (unlocked) color | | C_TEXT |

### Inconsistencies
- **`#e8a8a0`** (overlay bg), **`#f5d0c0`**, **`#f0b8b0`** (scroll gradient) — all hardcoded pinks not in constants or CLAUDE.md palette
- **`#b8a5d4`** (locked purple) — hardcoded, not in constants
- **`#e8d8c2`**, **`#d8c4a0`**, **`#c4b49a`** (locked node colors) — hardcoded
- **`#ffe6f4`** (current node pink) — hardcoded
- **`#d3cfc4`** (unlocked border) — hardcoded
- **`#fffff2`**, **`#f4f0da`** (unlocked node bg) — hardcoded
- **`#fcecd8`** (completed node bg) — hardcoded
- World 1 chip border-radius `20px` vs World 2 chip `16px`
- World 1 chip padding `12px 32px` vs World 2 chip `10px 18px`
- Duplicate Google Fonts `<link>` for Lexend in index.html (lines 10 and 11)
- Shop button and gear button have **different** styles (blue gradient vs frosted glass) — intentional per user request but inconsistent with each other and with game overlay buttons
- Node star SVG stroke is `3px` but topbar star/spark icon stroke is `2px`
- `#00bcd4`, `#2196f3`, `#1976d2` (spark/shop blue theme) — hardcoded, not in constants

---

## 5. Game Overlay (src/ui/overlay.ts)

### Top Bar

| Element | Property | Value |
|---------|----------|-------|
| Top bar | background | `#ffedcd` |
| Top bar | height | `52px` |
| Top bar | padding-top | `calc(env(safe-area-inset-top) + 12px)` |
| Top bar | padding-left/right | `16px` |
| Back button (grid icon) | style | BTN_INLINE (40x40, C_RECESSED bg, 9999px radius) |
| Level indicator | font-family | FONT_HEADING |
| Level indicator | font-size | `14px` |
| Level indicator | font-weight | `600` |
| Level indicator | color | C_TEXT |
| Level name | font-family | FONT |
| Level name | font-size | `12px` |
| Level name | font-weight | `400` |
| Level name | color | C_TEXT_SEC |
| Reset button | style | BTN_INLINE (same as back button) |

### Bottom Bar

| Element | Property | Value |
|---------|----------|-------|
| Bottom bar | background | `#ffedcd` |
| Bottom bar | height | `48px` |
| Bottom bar | padding-bottom | `calc(env(safe-area-inset-bottom) + 16px)` |
| Bottom bar | padding-left/right | `24px` |
| Undo/Redo buttons | style | BTN_INLINE (40x40, C_RECESSED bg) |
| Move counter | font-size | `14px` |
| Move counter | font-weight | `600` |
| Move counter | color | C_TEXT |
| Reduce indicator | font-size (number) | `14px` |
| Reduce indicator | font-weight | `600` |
| Reduce indicator | color | C_TEXT_SEC (normal) / `#fb5607` (goal met flash) |
| Reduce label | font-size | `10px` |
| Reduce label | font-weight | `500` |

### BTN_INLINE (shared button style)

| Property | Value |
|----------|-------|
| width/height | `40px` |
| background | C_RECESSED (`#f0d2a8`) |
| border | none |
| border-radius | `9999px` |
| color | C_TEXT (`#b17025`) |

### Reset Confirm Dialog

| Element | Property | Value |
|---------|----------|-------|
| Backdrop | background | `rgba(255,237,205,0.85)` |
| Backdrop | backdrop-filter | `blur(20px)` |
| Card | background | `#feffe5` |
| Card | border-radius | `24px` |
| Card | padding | `28px 24px 24px` |
| Card | max-width | `280px` |
| Card | box-shadow | `0 8px 32px rgba(46,47,44,0.06)` |
| Title | font-family | FONT_HEADING |
| Title | font-size | `16px` |
| Title | font-weight | `600` |
| Title | color | C_TEXT |
| Cancel btn | background | C_RECESSED |
| Cancel btn | color | C_TEXT |
| Cancel btn | border-radius | `9999px` |
| Cancel btn | padding | `13px 0` |
| Cancel btn | font-size | `15px` |
| Cancel btn | font-weight | `600` |
| Confirm btn | background | GRAD_PRIMARY (`#fb5607`) |
| Confirm btn | color | `#ffffff` |
| Confirm btn | (same sizing as cancel) | |

### Win Overlay (fallback, when onWin not provided)

| Element | Property | Value |
|---------|----------|-------|
| Card | background | `#feffe5` |
| Card | border-radius | `24px` |
| Card | padding | `36px 28px 28px` |
| Card | max-width | `300px` |
| Card | box-shadow | `0 8px 32px rgba(46,47,44,0.08)` |
| "Solved!" title | font-family | FONT_HEADING |
| "Solved!" title | font-size | `34px` |
| "Solved!" title | font-weight | `700` |
| "Solved!" title | color | C_TEXT |
| Moves text | font-size | `15px` |
| Moves text | font-weight | `400` |
| Moves text | color | C_TEXT_SEC |
| Next Level btn | background | GRAD_PRIMARY |
| Next Level btn | color | `#ffffff` |
| Next Level btn | border-radius | `9999px` |
| Next Level btn | padding | `14px 0` |
| Next Level btn | font-size | `16px` |
| Next Level btn | font-weight | `600` |
| Replay btn | background | C_RECESSED |
| Replay btn | color | C_TEXT |

### Inconsistencies
- Win overlay card max-width `300px` vs reset dialog `280px`
- Win overlay card padding `36px 28px 28px` vs reset dialog `28px 24px 24px`
- Win overlay box-shadow uses `rgba(46,47,44,0.08)` vs reset dialog `rgba(46,47,44,0.06)` — subtle difference

---

## 6. Celebration Popup (src/ui/celebration.ts)

| Element | Property | Value |
|---------|----------|-------|
| Backdrop | background | `rgba(255,237,205,0.85)` |
| Backdrop | backdrop-filter | `blur(20px)` |
| Card | background | `#feffe5` |
| Card | border-radius | `24px` |
| Card | padding | `32px 28px 24px` |
| Card | max-width | `320px` |
| Card | box-shadow | `0 8px 32px rgba(46,47,44,0.08)` |
| Check icon circle | size | `48px` |
| Check icon circle | background | `#ffedcd` |
| Check icon | stroke | `#fb5607`, width `3` |
| "LEVEL X COMPLETE" | font-family | FONT_HEADING |
| "LEVEL X COMPLETE" | font-size | `13px` |
| "LEVEL X COMPLETE" | font-weight | `700` |
| "LEVEL X COMPLETE" | letter-spacing | `0.12em` |
| "LEVEL X COMPLETE" | color | C_TEXT |
| Varied title | font-family | FONT_HEADING |
| Varied title | font-size | `24px` |
| Varied title | font-weight | `700` |
| Varied title | color | C_TEXT |
| Stars row | gap | `10px` |
| Star SVG (earned) | size | `32px` |
| Star SVG (earned) | fill gradient | `#ffbe0b` → `#f59e0b` |
| Star SVG (earned) | stroke | `#b17025`, `3px` |
| Star SVG (unearned) | fill | `#d3d1c7` |
| Star SVG (unearned) | stroke | `#b17025`, `3px` |
| World unlock title | font-size | `20px` |
| World unlock title | font-weight | `700` |
| World unlock title | color | `#fb5607` |
| World unlock sub | font-size | `13px` |
| World unlock sub | font-weight | `500` |
| World unlock sub | color | `#7f7c6c` (hardcoded, same as C_TEXT_SEC) |
| Stats pill | background | `#ffedcd` |
| Stats pill | border-radius | `16px` |
| Stats pill | padding | `14px 16px` |
| Stat value | font-size | `22px` |
| Stat value | font-weight | `700` |
| Stat value | color | C_TEXT |
| Stat label | font-size | `10px` |
| Stat label | font-weight | `500` |
| Stat label | color | C_TEXT_SEC |
| Next Level btn | background | GRAD_PRIMARY |
| Next Level btn | color | `#ffffff` |
| Next Level btn | border-radius | `9999px` |
| Next Level btn | padding | `14px 0` |
| Next Level btn | font-size | `15px` |
| Next Level btn | font-weight | `600` |
| Replay btn | background | C_RECESSED |
| Replay btn | color | C_TEXT |
| Back to Levels btn | background | `transparent` |
| Back to Levels btn | color | C_TEXT |
| Back to Levels btn | text-decoration | `underline` |

### Inconsistencies
- Card max-width `320px` vs overlay win card `300px` vs reset dialog `280px`
- Card padding `32px 28px 24px` — yet another variation
- Button font-size `15px` here vs `16px` in win overlay, `14px` in settings dialog
- `#7f7c6c` hardcoded for unlock subtitle — same as C_TEXT_SEC but not using the constant

---

## 7. Settings Screen (src/ui/settings.ts)

| Element | Property | Value |
|---------|----------|-------|
| Backdrop | background | `rgba(255,237,205,0.85)` |
| Backdrop | backdrop-filter | `blur(20px)` |
| Card | background | `#feffe5` |
| Card | border-radius | `16px` |
| Card | padding | `24px` |
| Card | max-width | `320px` |
| Card | box-shadow | `0 4px 16px rgba(0,0,0,0.08)` |
| "Settings" title | font-family | FONT_HEADING |
| "Settings" title | font-size | `20px` |
| "Settings" title | font-weight | `700` |
| "Settings" title | color | C_TEXT |
| Close X button | font-size | `20px` |
| Close X button | font-weight | `500` |
| Close X button | color | C_TEXT_SEC |
| Close X button | size | `40px` x `40px` |
| Section labels | font-family | FONT |
| Section labels | font-size | `12px` |
| Section labels | font-weight | `600` |
| Section labels | color | C_TEXT_SEC |
| Section labels | letter-spacing | `0.1em` |
| Volume slider thumb | size | `18px` |
| Volume slider thumb | background | C_PRIMARY |
| Volume slider track | height | `6px` |
| Volume slider track | filled color | C_PRIMARY |
| Volume slider track | empty color | C_RECESSED |
| Mute toggle button | size | `40px` x `40px` |
| Mute toggle button | background | C_RECESSED |
| Mute toggle button | border-radius | `9999px` |
| "Colorblind patterns" text | font-size | `14px` |
| "Colorblind patterns" text | font-weight | `500` |
| Toggle pill | size | `44px` x `24px` |
| Toggle pill | border-radius | `9999px` |
| Toggle pill (on) | background | C_PRIMARY |
| Toggle pill (off) | background | C_RECESSED |
| Toggle knob | size | `20px` x `20px` |
| Toggle knob | background | `#ffffff` |
| "Reset all progress" | font-size | `14px` |
| "Reset all progress" | font-weight | `500` |
| "Reset all progress" | color | `#d4726a` (C_DANGER, local) |
| Divider | height | `1px` |
| Divider | background | C_RECESSED |
| About text | font-size | `12px` |
| About text | font-weight | `500` |
| About text | color | C_TEXT_SEC |
| Privacy link | color | C_TEXT |

### Confirm Dialog (settings reset flow)

| Element | Property | Value |
|---------|----------|-------|
| Card | background | `#feffe5` |
| Card | border-radius | `16px` |
| Card | padding | `24px` |
| Card | max-width | `280px` |
| Card | box-shadow | `0 4px 16px rgba(0,0,0,0.08)` |
| Message | font-size | `15px` |
| Message | font-weight | `600` |
| Cancel btn | background | C_RECESSED |
| Cancel btn | font-size | `14px` |
| Cancel btn | padding | `12px 0` |
| Confirm btn | background | C_PRIMARY |
| Confirm btn | color | `#ffffff` |

### Inconsistencies
- Settings card border-radius `16px` vs celebration/overlay cards `24px`
- Settings card box-shadow uses `rgba(0,0,0,0.08)` vs others use `rgba(46,47,44,...)` — different base color
- Settings card padding `24px` uniform vs other cards have asymmetric padding
- Confirm dialog buttons: font-size `14px`, padding `12px 0` vs overlay reset dialog: font-size `15px`, padding `13px 0`
- `C_DANGER` (`#d4726a`) defined locally in settings.ts — same as `COLOR_ACCIDENTAL_FLASH` in constants.ts but not imported from there

---

## 8. Resume Dialog (src/main.ts showResumeDialog)

| Element | Property | Value |
|---------|----------|-------|
| Backdrop | background | `rgba(255,237,205,0.85)` |
| Backdrop | backdrop-filter | `blur(20px)` |
| Card | background | `#feffe5` |
| Card | border-radius | `24px` |
| Card | padding | `28px 24px 24px` |
| Card | max-width | `280px` |
| Card | box-shadow | `0 8px 32px rgba(46,47,44,0.06)` |
| Title | font-family | FONT_HEADING |
| Title | font-size | `16px` |
| Title | font-weight | `600` |
| Title | color | C_TEXT |
| Subtitle | font-size | `13px` |
| Subtitle | font-weight | `400` |
| Subtitle | color | C_TEXT_SEC |
| Restart btn | background | C_RECESSED |
| Restart btn | color | C_TEXT |
| Restart btn | font-size | `15px` |
| Restart btn | font-weight | `600` |
| Restart btn | padding | `13px 0` |
| Restart btn | border-radius | `9999px` |
| Resume btn | background | GRAD_PRIMARY |
| Resume btn | color | `#ffffff` |

### Inconsistencies
- Has its own local `addPressFeedback` function — duplicates the one in overlay.ts

---

## 9. Level Transition (src/ui/level-transition.ts)

| Element | Property | Value |
|---------|----------|-------|
| Overlay | background | `#ffedcd` |
| Level number | font-family | `'Lexend',system-ui,sans-serif` (hardcoded) |
| Level number | font-size | `3rem` (~48px) |
| Level number | font-weight | `700` |
| Level number | color | `#b17025` (hardcoded) |
| Level name | font-family | `'Lexend',system-ui,sans-serif` (hardcoded) |
| Level name | font-size | `14px` |
| Level name | font-weight | `400` |
| Level name | color | `#7f7c6c` (hardcoded) |
| Level name | letter-spacing | `0.1em` |
| Level name | text-transform | `uppercase` |
| Level name | margin-top | `8px` |

### Inconsistencies
- Does **not** import constants — hardcodes `#b17025` and `#7f7c6c` directly
- Font-family hardcoded as `'Lexend',system-ui,sans-serif` instead of using FONT constant
- Uses `3rem` (relative unit) for font-size instead of `px` like everywhere else

---

## 10. Landscape Overlay (src/main.ts)

| Element | Property | Value |
|---------|----------|-------|
| Overlay | background | `#ffedcd` |
| Title | font-family | `'Lexend',system-ui,sans-serif` (hardcoded) |
| Title | font-size | `18px` |
| Title | font-weight | `600` |
| Title | color | `#b17025` (hardcoded) |
| Subtitle | font-family | `'Lexend',system-ui,sans-serif` (hardcoded) |
| Subtitle | font-size | `14px` |
| Subtitle | color | `#7f7c6c` (hardcoded) |
| Gap between elements | `8px` |

### Inconsistencies
- Font-family and colors hardcoded instead of using FONT/C_TEXT/C_TEXT_SEC constants (they are imported in main.ts but not used here)

---

## 11. Other (src/main.ts level indicator badge)

| Element | Property | Value |
|---------|----------|-------|
| Level indicator | background | C_RECESSED |
| Level indicator | border-radius | `12px` |
| Level indicator | padding | `8px 18px` |
| Level indicator | font-family | FONT |
| Level indicator | font-size | `14px` |
| Level indicator | font-weight | `500` |
| Level indicator | color | C_TEXT |

**Note:** This element appears to be unused / hidden in favor of the overlay top bar level display.

---

## Cross-Screen Inconsistency Summary

### Dialog Cards (6 variants)

| Screen | border-radius | padding | max-width | box-shadow |
|--------|--------------|---------|-----------|------------|
| Overlay reset | 24px | 28px 24px 24px | 280px | 0 8px 32px rgba(46,47,44,0.06) |
| Overlay win | 24px | 36px 28px 28px | 300px | 0 8px 32px rgba(46,47,44,0.08) |
| Celebration | 24px | 32px 28px 24px | 320px | 0 8px 32px rgba(46,47,44,0.08) |
| Resume dialog | 24px | 28px 24px 24px | 280px | 0 8px 32px rgba(46,47,44,0.06) |
| Settings modal | **16px** | 24px | 320px | **0 4px 16px rgba(0,0,0,0.08)** |
| Settings confirm | **16px** | 24px | 280px | **0 4px 16px rgba(0,0,0,0.08)** |
| Tutorial welcome | 24px | 28px 24px 24px | 280px | 0 8px 32px rgba(46,47,44,0.06) |
| Tutorial completion | **16px** | 16px 32px | (none) | 0 4px 16px rgba(0,0,0,0.08) |

### Buttons (primary action)

| Screen | font-size | font-weight | padding | border-radius |
|--------|-----------|-------------|---------|---------------|
| Main menu "Tap to Begin" | 17px | 700 | 14px 44px | 9999px |
| Tutorial "Let's go" | 16px | 600 | 14px 0 | 9999px |
| Overlay win "Next Level" | 16px | 600 | 14px 0 | 9999px |
| Celebration "Next Level" | 15px | 600 | 14px 0 | 9999px |
| Overlay reset "Reset" | 15px | 600 | 13px 0 | 9999px |
| Resume "Resume" | 15px | 600 | 13px 0 | 9999px |
| Settings confirm | 14px | 600 | 12px 0 | 9999px |

### Hardcoded Colors Not In Constants

| Color | Where Used | Suggested Constant |
|-------|-----------|-------------------|
| `#e8a8a0` | Level select overlay bg | — |
| `#f5d0c0`, `#f0b8b0` | Level select scroll gradient | — |
| `#EEDACC` | Splash SVG dot fill | — |
| `#888780` | Splash loader | — |
| `#b8a5d4` | Locked level purple | — |
| `#e8d8c2`, `#d8c4a0`, `#c4b49a` | Locked node colors | — |
| `#ffe6f4` | Current node pink tint | — |
| `#d3cfc4` | Unlocked node border | — |
| `#fffff2`, `#f4f0da` | Unlocked node bg | — |
| `#fcecd8` | Completed node bg | — |
| `#d4726a` | Danger/reset text (settings) | Should use `COLOR_ACCIDENTAL_FLASH` |
| `#00bcd4`, `#2196f3`, `#1976d2` | Spark/shop blue theme | — |
| `#d3d1c7` | Unearned star fill | Should be in constants |
| `rgba(177,112,37,0.4)` | Main menu footer | — |

### Font-Family Hardcoding

Files that hardcode `'Lexend',system-ui,sans-serif` instead of using FONT:
- `src/ui/level-transition.ts` — all text
- `src/main.ts` — landscape overlay, main menu button, footer
