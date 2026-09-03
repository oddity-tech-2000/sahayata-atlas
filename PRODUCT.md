# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Name

Sahayata Atlas

## Stack

React and TypeScript on Vite, with a same-origin Python FastAPI backend. One Dockerized Web Service builds the client, serves its production assets, and exposes the versioned resource endpoints.

## Users

People in Mumbai who need a quick, readable view of nearby public infrastructure during preparedness or response work. The interface must remain useful to the general public without assuming specialist GIS knowledge.

## Product Purpose

Turn a searched Mumbai locality or an optionally shared in-region device location into a map and list of nearby infrastructure nodes. Success means a user can search, understand the source and freshness of the result, filter the returned places, inspect a location, and request directions without learning the underlying APIs.

## Positioning

The product combines Mumbai-constrained place lookup, nearby hospital and clinic discovery, and lightweight classification of public-place results into medical, shelter, security, and general emergency nodes.

## Operating Context

The primary workflow is a Mumbai-region resource query inspired by the public IDRN dashboard: search a Mumbai locality or explicitly choose `Use my location`, scan mapped nodes, filter by type or status, and open a place detail. Locality search remains available after location access is granted, denied, unavailable, or timed out.

## Capabilities and Constraints

- Submitted neighbourhood, street, landmark, and locality searches are limited to the Mumbai region by the backend.
- Device location is optional, requested only after an explicit user action, held only in the current browser session, and validated against the Mumbai service bounds.
- The browser calls only the same-origin `/api/v1/resources/nearby` backend route.
- The backend integration boundary and service levels are defined in `backend-requirements.md`.
- Users can filter by resource category, item (including hospitals and clinics), and inferred department type (`Govt`, `Private`, or `PSUnits`).
- A selected listing is emphasized in both the ledger and map. With a device location available, the map shows a straight-line orientation guide and offers an external Google Maps road-directions action.
- Returned node categories and availability labels are heuristic, not verified emergency-service status.
- No login, dispatch, built-in road routing, inventory editing, or real-time incident feed is present.

## Brand Commitments

Use IDRN and NIDM as factual reference context without implying that this prototype is an official dispatch service. Preserve a formal, direct public-service voice and make the Mumbai-only scope explicit.

## Evidence on Hand

- Backend agreement: `backend-requirements.md` in this project.
- Reference information architecture: `https://idrn.nidm.gov.in/`.
- Live data sources: Open-Meteo Geocoding API, OpenStreetMap Photon, Nominatim, and Overpass APIs, and English Wikipedia GeoSearch API.
- No verified facility availability, official inventory totals, or emergency-response guarantees are available and none should be fabricated.

## Product Principles

- Make the main search action unmistakable.
- Separate observed place data from heuristic classification.
- Keep map and list views mutually reinforcing.
- Use plain language and resilient error states.
- Never imply emergency dispatch or official operational status.

## Accessibility & Inclusion

Keyboard-operable controls, strong focus visibility, clear status text, reduced-motion support, adequate contrast, and responsive layouts are required.
