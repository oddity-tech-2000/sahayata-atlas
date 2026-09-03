---
version: 1
slug: "index-html"
primary_target: "src/App.tsx"
related_targets: ["src/styles.css","src/components/AtlasMap.tsx"]
---

## Scope and mode

`/` is a React Operate surface for a Mumbai-only public-infrastructure query, served with its Python FastAPI from one production web service.

## Audience, job, and task

People in Mumbai search a locality or explicitly share their current location, refine results by place, facility, and inferred organisation type, scan nearby public listings on a map and resource ledger, and inspect a listing. An outside-region device location or query is rejected with a recoverable Mumbai-only message. They can orient from their location to a selected resource and open an external road-directions service. The interface must make its public-data limitations visible and must not imply dispatch capability, verified ownership, verified readiness, or built-in routing.

## Direction

An established IDRN public-service world modernized as an earthbound field resource desk: deep Forest civic framing, a Sand command action, a quieter Olive location action, three square scope selectors, a warm Cream map field, and a pale inventory ledger. Ochre couples the selected ledger row to its map target. The exact anchor palette is `#606c38`, `#283618`, `#fefae0`, `#dda15e`, and `#bc6c25`; derived tints are allowed only for accessible surfaces, borders, and states.

## Direction contract

THESIS: A live civic resource desk makes one place query spatial and inspectable; it refuses the form-heavy government portal.
OWN-WORLD: Forest framing, Cream evidence surfaces, Sand action, Olive resolution, Ochre selection, square structural controls, and condensed command type.
STORY: Search or share location, refine the returned evidence, inspect a facility, then open directions with limitations still visible.
FIRST VIEWPORT: Compact masthead, two-column command band, then a coupled map-led workspace with the ranked ledger occupying the right third.
FORM: Established Operate surface, first-ranked map-led composition; seed key `established-civic-desk`.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

The same-origin `/api/v1/resources/nearby` service accepts either a Mumbai locality or coordinates validated against the Mumbai service bounds. Device geolocation is optional, user-triggered, session-only, and recoverable through locality search. Classification and organisation type remain qualified when inferred. The in-map line is orientation only; road directions open externally. Desktop and mobile retain search, filters, map, results, provenance, and emergency disclaimer.
