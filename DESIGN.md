---
name: Sahayata Atlas
description: A field-ready civic resource desk for resolving Mumbai localities into nearby public infrastructure.
colors:
  forest: "#283618"
  olive: "#606c38"
  cream: "#fefae0"
  sand: "#dda15e"
  ochre: "#bc6c25"
  civic-ink: "#283618"
  field-paper: "#fefae0"
  cream-tint: "#f4edcf"
  signal-white: "#fffdf1"
  civic-line: "#d5c79d"
  ledger-muted: "#606c38"
  ink-on-dark-muted: "#e8ddb6"
  olive-control: "#606c38"
  control-line: "#dda15e"
  action-sand: "#dda15e"
  action-sand-hover: "#d29450"
  action-ink: "#283618"
  confirmation-green: "#606c38"
  ochre-utility: "#bc6c25"
  ochre-focus: "#bc6c25"
  sand-focus: "#dda15e"
  medical-ochre: "#bc6c25"
  shelter-amber: "#dda15e"
  security-olive: "#606c38"
  general-forest: "#283618"
  cream-muted: "#f5deb4"
  olive-hover: "#4f5c2d"
  map-paper: "#eee4c2"
  status-muted: "#948b69"
  status-ring: "#e0e3c7"
  status-warm: "#f2dfc0"
  radar-line: "#9d956f"
  radar-ring: "#b7ad84"
  ledger-rule: "#e8dfbd"
  node-neutral: "#e7dfbd"
  node-medical: "#f4dfbd"
  error-ink: "#612e14"
  error-paper: "#f6ddbd"
  error-line: "#d49b63"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(38px, 4vw, 66px)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(32px, 4vw, 52px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.5
  ramp:
    fontSize: "10px 11px 12px 13px 14px 15px 16px 17px 18px 24px 28px 30px 32px 43px"
rounded:
  square: "0px"
  marker: "5px"
  node: "12px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  xxl: "32px"
components:
  civic-masthead:
    backgroundColor: "{colors.signal-white}"
    textColor: "{colors.civic-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "0 clamp(22px, 4vw, 64px)"
    height: "84px"
  search-field:
    backgroundColor: "{colors.signal-white}"
    textColor: "{colors.civic-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "0 0 0 20px"
    height: "66px"
  button-primary:
    backgroundColor: "{colors.action-sand}"
    textColor: "{colors.action-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 24px"
    height: "66px"
  button-primary-hover:
    backgroundColor: "{colors.action-sand-hover}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.square}"
  button-icon:
    backgroundColor: "{colors.cream-tint}"
    textColor: "{colors.civic-ink}"
    rounded: "{rounded.square}"
    size: "44px"
  query-select:
    backgroundColor: "{colors.olive-control}"
    textColor: "{colors.signal-white}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 36px 0 12px"
    height: "44px"
  quick-city-chip:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 9px"
  resource-row:
    backgroundColor: "transparent"
    textColor: "{colors.civic-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "18px 22px"
  map-toolbar:
    backgroundColor: "rgba(255, 255, 255, 0.94)"
    textColor: "{colors.civic-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "13px 14px 13px 16px"
  department-badge:
    backgroundColor: "{colors.node-neutral}"
    textColor: "{colors.forest}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 7px"
---

# Design System: Sahayata Atlas

## Overview

**Creative North Star: "The Civic Resource Desk"**

The Atlas feels like a public-service workstation brought into the present: formal enough to inspire care, direct enough to use under pressure, and explicit about the limits of its evidence. A compact masthead and deep civic command band frame the operative map-and-ledger workspace rather than turning the page into a promotional landing screen.

The visual world is dense but calm. Warm cream work areas, pale ledger surfaces, sand action, olive status cues, and clipped typography create a field-ready rhythm. Information hierarchy comes from scale, placement, tonal layering, and a disciplined split between the spatial map and ranked textual evidence.

**Key Characteristics:**

- Deep forest civic framing around a warm cream workspace.
- Sand reserved for the primary query action; ochre marks selection and direction.
- Map-first desktop composition with a dense, ranked resource ledger.
- Three square scope selectors directly under the city query.
- Condensed display typography paired with highly legible operational body copy.
- Square-cut controls, with rounded geometry reserved for shortcuts, status, and map symbols.
- Visible source, freshness, classification, and emergency-use limitations.

## Colors

The palette is drawn from the specified woodland range: Forest `#283618`, Olive `#606c38`, Cream `#fefae0`, Sand `#dda15e`, and Ochre `#bc6c25`. Derived cream and earth tints provide borders, hover surfaces, and elevation while preserving contrast.

### Primary

- **Forest** (`forest`, `civic-ink`): The dominant frame for the command band, footer, body text, and high-authority structure.
- **Sand** (`sand`, `action-sand`): The unmistakable search action and the current-location halo; it pairs with Forest text and deepens on hover.

### Secondary

- **Ochre** (`ochre`, `ochre-utility`): A restrained utility accent for brand linework, selection, direction, and text actions.
- **Olive** (`olive`, `confirmation-green`): Reserved for secondary controls and a successfully resolved live view. It never represents ownership, availability, or operational readiness.
- **Olive Controls** (`olive-control`): The inset field behind the three native scope selectors.
- **Earth Focus** (`ochre-focus`, `sand-focus`): Ochre provides the global focus indicator on light surfaces; Sand provides focus contrast on Forest.

### Tertiary

- **Medical Ochre**, **Shelter Sand**, **Security Olive**, and **General Forest**: Category identity across map pins, legend dots, and ledger symbols. Icons, labels, and position keep the classification from relying on color alone.

### Neutral

- **Cream** (`cream`, `field-paper`): The page canvas outside the operative workspace.
- **Cream Tint** (`cream-tint`): Hover, icon-button, and work-area tone that keeps interaction states visible without competing with the map.
- **Pale Cream** (`signal-white`): Masthead, search field, ledger, overlays, and contrast surfaces.
- **Civic Line** (`civic-line`): Low-contrast dividers and field boundaries.
- **Ledger Muted** (`ledger-muted`): Supporting metadata, descriptions, and secondary status copy.
- **On-Dark Muted Ink** (`ink-on-dark-muted`): Supporting command-band and footer copy that remains quieter than Cream.
- **Control Line** (`control-line`): The recurring Sand outline around selectors and quick-city chips.

### Named Rules

**The Civic Frame Rule.** Civic Ink owns the large framing surfaces; pale tones own the work area. Do not invert this relationship on new operational screens.

**The Warm Action Rule.** Sand identifies the primary task, while darker Ochre is reserved for selection and directional emphasis.

**The Evidence Color Rule.** The four palette roles classify observed listings and Olive marks interface resolution. Inferred organisation labels stay neutral so they cannot be mistaken for verified ownership, readiness, capacity, or availability.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow and sans-serif fallbacks)  
**Body Font:** Source Sans 3 (with Segoe UI and sans-serif fallbacks)

**Character:** Barlow Condensed brings the square-cut, information-desk authority used by the identity, commands, section titles, and ranks. Source Sans 3 carries every explanatory, interactive, and data-bearing sentence with neutral public-service clarity.

### Hierarchy

- **Display** (700, fluid 38–66px, 0.94 line-height): First-view command headlines; on narrow phones the shipped expression settles at 43px.
- **Headline** (700, fluid 32–52px, 1 line-height): Major explanatory statements below the workspace.
- **Title** (700, 28–32px, 0.8–1 line-height): Brand lockup, map-empty title, and ledger title.
- **Body** (400, 16–18px, 1.5 line-height): Instructions and explanations, typically constrained to 55–60 characters per line.
- **Label** (600–800, 10–15px): Field labels, metadata, selectors, badges, and compact navigation. Only status badges use uppercase tracking.

### Named Rules

**The Condensed Command Rule.** Use Barlow Condensed for orientation, identity, and rank—not for paragraphs, field values, or dense metadata.

**The Plain Evidence Rule.** Limit body text to short, direct phrases and readable measure; operational limitations remain normal sentence case, never promotional display copy.

## Layout

The desktop page uses full-width civic framing around a fluid canvas. Horizontal gutters scale from 14–48px in the main area and 22–64px in the masthead and command band. The command band is a two-column composition weighted toward the search control; its place, facility, and organisation selectors form a three-column row immediately below the city field. The primary workspace uses an approximately two-thirds map to one-third ledger split (`1.62fr / 0.78fr`) with a 340px ledger floor.

The workspace is the spatial anchor: both sides share a 610px minimum height, the ledger scrolls within that frame, and map overlays sit 18px from the map edges. Repeated component padding clusters around 18–26px, with 6–12px gaps for dense controls and metadata.

At 980px and below, the command band, map, ledger, and data note collapse to one column; the map keeps a 500px minimum height and the ledger becomes fully flowing. At 620px and below, outer gutters tighten to 12–18px, the query action drops below its input, the three selectors sit inside a collapsed `Refine results` disclosure, quick-city targets grow to a 44px minimum height, the map becomes 440px tall, neutral organisation badges move below row metadata, and the footer stacks.

**The Map-Led Split Rule.** On wide screens, preserve the larger spatial field and narrower textual ledger as one coupled workspace; on smaller screens, stack map before ledger without removing either view.

**The Compact Edge Rule.** Operational gutters shrink before content does. Keep touch targets and type readable while reducing outer whitespace at narrow widths.

## Elevation & Depth

Depth is a hybrid of tonal layering, lines, and soft forest ambient shadows. The page canvas, command frame, map field, ledger, and inset details form a clear layer stack; shadows are reserved for functional surfaces that sit over or join those layers rather than for decorative card collections.

### Shadow Vocabulary

- **Command Lift** (`0 15px 34px rgba(20, 29, 10, 0.32)`): The pale city-search control on the Forest command band.
- **Workspace Lift** (`0 18px 42px rgba(16, 42, 67, 0.14)`): The coupled map-and-ledger shell; compact screens soften it to `0 12px 28px rgba(16, 42, 67, 0.12)`.
- **Overlay Lift** (`0 12px 28px rgba(16, 42, 67, 0.18)`): Map toolbar and other controls floating directly over geographic content.
- **Detail Lift** (`0 8px 22px rgba(16, 42, 67, 0.10)`): Expanded explanatory content inside the ledger.
- **Marker Lift** (`0 6px 16px rgba(16, 42, 67, 0.30)`): Resource pins that must remain legible over varying map tiles.

### Named Rules

**The Operational Lift Rule.** Use elevation to distinguish an active control, overlay, or selected detail from its working surface; keep passive information separated by tone and rules.

## Shapes

The base language is square-cut: the masthead, command field, native selectors, primary action, workspace, map toolbar, icon buttons, rows, and detail panel have no corner radius. Thin civic lines define boundaries. Rounded geometry is intentionally semantic: fully pill-shaped chips communicate shortcuts or status, circles mark live state and legend categories, 12px rounded tiles hold node-category icons, and rotated teardrops locate resources on the map.

**The Semantic Curve Rule.** Curves identify compact state, shortcut, category, or location; do not round large structural surfaces, native selectors, or primary work controls.

## Components

### Buttons

- **Shape:** Primary and icon actions are square; quick-search choices are fully pill-shaped.
- **Primary:** Sand with Forest action text, 66px desktop height, horizontal 24px padding, and an 800-weight label. On phones it becomes a full-width second row with a 52px minimum height.
- **Hover / Focus:** The primary deepens to its earth hover tone and nudges its arrow 3px over 180ms ease-out. Interactive elements receive a 3px Ochre or Sand focus outline chosen for the surface beneath it.
- **Secondary / Ghost:** Quick-city chips stay transparent with a Sand border; text actions use Olive or Ochre underlined copy; 44px icon actions sit on a Cream tint.

### Chips

- **Style:** Quick-city chips use a 4px by 9px transparent treatment with a Control Line border over the dark command band; they grow to 44px touch targets on compact screens.
- **State:** Organisation badges use a neutral Cream tint, a fine earth border, and sentence-case copy such as `Inferred: Private` or `Unclassified`. They deliberately avoid resolved-state Olive because none is proof of ownership.

### Cards / Containers

- **Corner Style:** Structural containers remain square; node-symbol tiles alone use the 12px node radius.
- **Background:** Pale Cream for the masthead, ledger, toolbars, and detail panels; Cream and close earth tints provide hover and selection tones.
- **Shadow Strategy:** Use the functional vocabulary from Elevation & Depth.
- **Border:** One-pixel Civic Line or lighter earth rules partition ledgers and metadata.
- **Internal Padding:** 18–26px for rows and heads; 13–16px for compact overlays and expanded details.

### Inputs / Fields

- **Style:** The city query is a 66px square pale-Cream field composed as icon, flexible input, and attached Sand action. The native input has no internal border or outline. A secondary 44px Olive `Use my location` control sits below it with persistent session-only permission copy; it never triggers a prompt on page load.
- **Scope selectors:** Place type, facility, and organisation type use native selects inside 44px square Olive fields with Sand borders and custom chevrons. On compact screens the selector row becomes a single-column `Refine results` disclosure.
- **Focus:** Focus belongs to each composed field through a 3px Sand outer outline; the global Ochre focus-visible treatment remains the fallback for every keyboard target.
- **Geolocation state:** Pending and error copy stays beside the control that initiated it: next to `Use my location` in the command band, or directly under the selected row's directions action. Pending controls disable with a wait cursor and spinning location icon; declined, unavailable, timed-out, and outside-Mumbai states keep locality search available and name it as the recovery path.
- **Error / Disabled:** The submit action drops to 68% opacity and a wait cursor while loading. City-query errors sit directly below the search field as a focusable alert on the Forest band; partial-source warnings use a pale Ochre ledger strip, while a failed refresh uses the warmer error strip and preserves the previous Mumbai result set.

### Navigation

The compact pale-Cream masthead uses a 44px Ochre line-mark, condensed brand type, a ruled supporting descriptor, and a single underlined source link. Below 980px the descriptor disappears; below 620px the source link keeps visible text and at least a 44px target.

### Resource Workspace

The map and ledger operate as one component. A live toolbar states searching, resolved, or unavailable state without contradicting the command area; category legend dots repeat the ledger classification colors. A compact query summary records resolved district/state, active organisation scope, and data-source state. The initial nearest-first view shows 20 resources on desktop and 10 on compact screens, with an explicit `Show all` action. Ledger rows combine a tabular rank, category tile, place name, facility and distance metadata, neutral inferred-organisation label, and disclosure arrow. A persistent note explains the inference, while expansion adds source-specific limits. Selection is bidirectional: a row expands its detail, flies the map to the resource, and adds an Ochre ring to its pin; selecting a pin applies the same ledger selection and scrolls its row into view. When device location is available, the map also shows a distinct Forest-and-Sand current-location marker and a dashed Ochre straight-line guide to the selection; the expanded row clearly separates that orientation aid from its external road-directions action.

Mumbai-only scope remains visible in the idle map, command-band scope chip, recovery copy, resolved summary, and data note. An outside-region locality or device position is an error rather than an empty success: without prior data, the map and ledger both explain the interrupted scan; with prior data, the ledger reports the failed replacement while retaining the earlier Mumbai results.

**Raster provenance:** No first-party raster asset ships with the application. The brand mark, favicon, icons, and resource markers are inline SVG or HTML/CSS; map imagery is fetched at runtime from OpenStreetMap's raster tile service and retains visible OpenStreetMap attribution. Review screenshots under `.impeccable/review/` are QA artifacts, not product assets.

**The Coupled Evidence Rule.** A resource selection must connect the textual row to the map and keep classification, distance, freshness, and limitations available together.

## Do's and Don'ts

### Do:

- **Do** preserve the Forest command band, Cream work field, and pale evidence surfaces as the primary layer order.
- **Do** keep the search action visually dominant with Sand and a clear verb; reserve Ochre for selection and direction.
- **Do** repeat category colors consistently across pins, legends, and node symbols.
- **Do** maintain 3px keyboard focus outlines and the reduced-motion override.
- **Do** keep place, facility, and organisation scope adjacent to the city query and echo the resolved scope in the ledger summary.
- **Do** stack the map before the ledger below the desktop split while retaining selectors and source limitations.
- **Do** use plain status language that distinguishes a public listing from verified emergency readiness.
- **Do** keep location permission optional, explain its session-only use before prompting, and preserve city search as the fallback.
- **Do** label the in-map line as straight-line orientation and the external action as road directions.

### Don't:

- **Don't** round structural panels, toolbars, search controls, native selectors, or primary buttons; curves are reserved for compact semantic elements.
- **Don't** use semantic category colors as decorative accents or as guarantees of urgency, capacity, or availability.
- **Don't** turn Ochre into a competing primary action color; Sand remains the single primary action voice.
- **Don't** replace the map-led workspace with a generic card grid or a form-heavy portal layout.
- **Don't** hide source, freshness, classification, or non-dispatch limitations behind secondary navigation.
- **Don't** use display typography for paragraphs, field values, or dense metadata.
- **Don't** request location on page load or describe the straight map line as a road route.
