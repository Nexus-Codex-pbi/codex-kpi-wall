# Codex KPI Wall

## Overview
A responsive grid of KPI cards for Power BI. One card per metric, each carrying its own value, target and a variance pill measured against that target. The grid is either auto-fit or fixed at 1 to 6 columns, and reflows to whatever size the report author gives the visual — so one visual replaces a page of individually placed and hand-aligned card visuals.

## Features
- Auto-fit columns, or a fixed grid of 1 to 6 columns
- Adjustable minimum card width (default 240px) and card gap (default 14px), so the wall reflows to the visual size rather than clipping
- Every card shows its label, value, target and a variance pill against that target
- Three accent styles — flat bar, glass tube and corner bracket — each with one or two corners
- Status dot, variance pill, subtitle and progress strip can each be switched off independently
- Optional sort order measure controls the order cards appear in (ascending)
- Full font control on values and labels, with an uppercase toggle for labels
- Background colour with transparency; border with width, colour and radius
- Card signature accent with style, colour, corner radius and mirrored corners
- Click a card to cross-filter other visuals; highlights arriving from other visuals are read and rendered
- Custom tooltips through the Tooltips field well
- Every card is a keyboard focus target: Tab to a card, Enter or Space to select
  (Ctrl/Cmd to multi-select), ContextMenu or Shift+F10 for its context menu, with
  a visible focus ring. A real screen reader has not been certified.
- High contrast mode support and multi-visual selection

## Data Roles
| Role | Display Name | Kind | Required? | Description |
|------|--------------|------|-----------|-------------|
| cardLabel | Card label | Grouping | Yes | One card per value (e.g. KPI name, Region, Team) |
| value | Value | Measure | Yes | The headline number on each card |
| target | Target | Measure | No | Drives the band colour, delta pill and target strip |
| sortOrder | Sort order | Measure | No | Numeric sort key — cards follow it ascending |
| tooltips | Tooltips | Measure | No | Extra measures for the hover tooltip |
| changeValue | Change Value | Measure | No | An independent comparison (e.g. -0.18 for an 18% fall vs the prior period). When bound it drives the pill, leaving Target to drive the band colour and target strip |
| changeLabel | Change Label | Measure | No | Text inside the pill. If blank, Change Value is formatted from its own model format |

**Target and Change Value answer different questions.** Target asks "did we hit
the number?"; Change Value asks "are we moving the right way?". Bind both and a
card can read 80 against a target of 100 — a danger strip — beside a green
`▲ 10.0%` because it improved on last period. Neither calculation silently
replaces the other. With no Change Value bound the pill is the value/target
ratio, exactly as before.

`dataReductionAlgorithm` is deliberately capped at **100** rows. This is a scorecard of cards, not a scrolling dataset — a wall beyond that count stops being readable, and the cap keeps rendering bounded.

## Formatting Options

### Visual Title
Show Title, Title Text, Font Family, Font Size, Bold, Italic, Underline, Alignment, Font Colour.

### KPI Wall
- **Accent Style** — Flat bar, Glass tube or Corner bracket
- **Corners** — One or Two
- **Show dot / Show pill / Show subtitle / Show strip** — each toggles a card element independently

### Layout
- **Columns** — Auto, or 1 / 2 / 3 / 4 / 5 / 6
- **Min card width** — default 240
- **Gap** — default 14

### Value
Font Family, Font Size, Bold, Italic, Underline, Colour.

### Value Format
- **Format** — Model format (default: the measure's own format string), Number, Percent, Currency or Text
- **Currency Symbol**, **Decimal Places** — used when Format is not Model format
- **Alignment** — left, centre or right

Format: Text renders a non-numeric headline (`On call`) instead of the no-data cell.

### Label
Font Family, Font Size, Bold, Italic, Underline, Colour, Uppercase, Alignment.

### Change Indicator
- **Direction Logic** — Up is Good (default), Down is Good, Neutral. Down is
  Good inverts the target verdict too, so a cost, defect or elapsed-time wall
  reads a figure under target as success instead of danger.
- Font Family, Font Size, Bold, Italic, Underline, Alignment for the pill

### Subtitle
Font Family, Font Size, Bold, Italic, Underline, Colour, Alignment for the
card's footer line.

### Background / Border / Card Border / Card signature
Background colour and transparency. **Border** is the border around the whole
wall; **Card Border** is the border around each card — both exist, with the same
colour, transparency, width and radius controls. Card signature show, style,
auto colour, colour, corner radius and mirrored corners applies to the WALL; the
per-card accent is KPI Wall > **Cell accent**.

## Build
Node 20, `powerbi-visuals-tools` 7.0.2, `powerbi-visuals-api` 5.11.0, TypeScript 5.5.4.

```bash
npm install
npm run package     # writes dist/<guid>.<version>.pbiviz
npx eslint src      # 0 errors expected
```

No external network calls, no third-party services and no telemetry.

---
Built by [Nexus Codex](https://nexuscodex.nexus). Support: support@nexuscodex.nexus
