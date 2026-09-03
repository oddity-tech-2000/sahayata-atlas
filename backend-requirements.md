# Backend Requirements and Frontend API Agreement

## 1. Purpose

This document is the versioned integration agreement between the Sahayata Atlas React frontend and its Python backend. The current FastAPI implementation lives in `backend/app`; future backend changes must preserve this contract unless the API version changes. The backend owns place resolution, Mumbai service-area enforcement, source aggregation, validation, deduplication, distance calculation, provenance, availability, security, and operational monitoring.

Production uses a same-origin `/api/v1` interface. The browser must not call upstream data providers directly.

## 2. Environments

| Environment | Frontend origin | API base URL |
|---|---|---|
| Vite development | `http://127.0.0.1:5173` | Proxied to `http://127.0.0.1:8000` |
| Production-shaped local | `http://127.0.0.1:5005` | Same origin |
| Production | Render Web Service HTTPS origin | Same origin |

Production traffic must use HTTPS. Client code uses relative `/api/v1` URLs.

## 3. Required endpoints

### `GET /api/v1/resources/nearby`

Returns public-resource listings near either a Mumbai locality or an in-region coordinate pair.

Exactly one location mode is allowed:

| Parameter | Type | Required | Rules |
|---|---|---:|---|
| `city` | string | Locality mode | Trimmed UTF-8 text, 2–100 characters; resolve only within the Mumbai service bounds. |
| `latitude` | number | Coordinate mode | Must be provided with `longitude`; range `-90` to `90`. |
| `longitude` | number | Coordinate mode | Must be provided with `latitude`; range `-180` to `180`. |
| `radius_km` | integer | No | Default `10`; accepted range `1–50`. The frontend currently sends `10`. |
| `language` | string | No | Default `en`; accepted values are `en`, `hi`, and `mr`. Selects geocoding and localized provider names where available. |

The backend must reject requests containing both `city` and coordinates. A locality or coordinate outside the supported Mumbai service bounds must return `422 LOCATION_OUTSIDE_SERVICE_AREA`.

Example requests:

```http
GET /api/v1/resources/nearby?city=Mumbai&radius_km=10&language=en
Accept: application/json
```

```http
GET /api/v1/resources/nearby?latitude=19.076&longitude=72.8777&radius_km=10
Accept: application/json
```

### `GET /api/v1/health`

Used by deployment monitoring. It is not required by the browser UI.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "time": "2026-08-29T11:30:00Z"
}
```

## 4. Success response contract

The response body must be UTF-8 JSON with `Content-Type: application/json; charset=utf-8`.

```json
{
  "schema_version": "1.0",
  "request_id": "2c60e34e-24ae-4dcc-83c7-dde3274dc704",
  "generated_at": "2026-08-29T11:30:00Z",
  "location": {
    "query_type": "city",
    "display_name": "Mumbai",
    "city": "Mumbai",
    "district": "Mumbai Suburban",
    "state": "Maharashtra",
    "country_code": "IN",
    "latitude": 19.076,
    "longitude": 72.8777
  },
  "coverage": {
    "radius_metres": 10000,
    "healthcare_status": "available",
    "is_partial": false,
    "warnings": []
  },
  "resources": [
    {
      "id": "osm:node:123456",
      "name": "Example Municipal Hospital",
      "category": "medical",
      "facility_type": "hospital",
      "latitude": 19.0812,
      "longitude": 72.8821,
      "distance_metres": 720,
      "organisation": {
        "type": "government",
        "name": "Municipal Health Department",
        "inferred": true
      },
      "listing_status": "listed",
      "source": {
        "name": "OpenStreetMap",
        "record_id": "node/123456",
        "record_url": "https://www.openstreetmap.org/node/123456",
        "updated_at": null
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### Required field rules

- `schema_version`: required string; current major version is `1`.
- `request_id`: required unique request identifier, also returned as the `X-Request-ID` header.
- `generated_at`: required ISO 8601 UTC timestamp.
- `location.query_type`: `city` or `coordinates`; `city` represents a resolved Mumbai locality for version 1.
- `location.display_name`: required user-facing label.
- `location.country_code`: must be `IN`.
- All latitude and longitude values must be JSON numbers, never strings.
- `resources`: required array; use an empty array for a successful search with no results.
- `meta.total`: total number of resources in the response and must equal `resources.length`.
- Resources must be sorted by `distance_metres` ascending. Items with unknown distance appear last.
- `resources[].id`: required, unique, and stable across requests. Recommended format: `<provider>:<object-type>:<provider-id>`.
- `resources[].name`: required non-empty UTF-8 text, maximum 200 characters.
- `resources[].category`: `medical`, `shelter`, `security`, or `general`.
- `resources[].facility_type`: `hospital`, `clinic`, or `public_place`.
- `resources[].distance_metres`: non-negative integer or `null` when unavailable.
- `resources[].organisation.type`: `government`, `private`, `public_sector`, or `unclassified`.
- `resources[].organisation.inferred`: required boolean. It must be `true` when ownership is inferred from naming or operator metadata.
- `resources[].listing_status`: currently only `listed`. It does not imply that a facility is open, ready, safe, or has capacity.
- `resources[].source.name`: required provider label.
- Unknown fields may be added, but existing fields must not change meaning within API version 1.

The backend must return no more than 200 resources per request. Deduplicate records referring to the same physical resource before returning them.

## 5. Partial-data behavior

The request may succeed when one upstream source is unavailable, provided the backend has meaningful results from another source.

- Set `coverage.is_partial` to `true`.
- Set `coverage.healthcare_status` to `partial` or `unavailable` when applicable.
- Add concise human-readable strings to `coverage.warnings`.
- Return HTTP `200`; do not discard valid resources because one provider failed.
- If no meaningful response can be produced, return an error response instead.

## 6. Error contract

Every non-2xx response must use this shape:

```json
{
  "error": {
    "code": "LOCATION_NOT_FOUND",
    "message": "That Mumbai locality could not be found.",
    "retryable": false,
    "request_id": "2c60e34e-24ae-4dcc-83c7-dde3274dc704",
    "details": []
  }
}
```

`message` is safe for direct display to end users. It must not contain stack traces, provider credentials, internal hostnames, SQL, or implementation details.

| HTTP status | Error code | Retryable | Meaning |
|---:|---|---:|---|
| 400 | `INVALID_REQUEST` | No | Missing, conflicting, or malformed query parameters. |
| 404 | `LOCATION_NOT_FOUND` | No | The submitted locality could not be resolved. |
| 422 | `LOCATION_OUTSIDE_SERVICE_AREA` | No | The locality or coordinates resolve outside Mumbai. |
| 429 | `RATE_LIMITED` | Yes | Request limit exceeded; include `Retry-After`. |
| 500 | `INTERNAL_ERROR` | Yes | Unexpected backend failure. |
| 502 | `UPSTREAM_FAILURE` | Yes | Required upstream providers failed. |
| 503 | `SERVICE_UNAVAILABLE` | Yes | Planned or temporary service unavailability. |
| 504 | `UPSTREAM_TIMEOUT` | Yes | Required upstream providers exceeded their deadline. |

## 7. HTTP, CORS, and caching

- Allow `GET` and `OPTIONS` for the required endpoints.
- Same-origin production requests do not require CORS. If the API is split into a separate service later, explicitly allow the approved frontend origins and never use `*` with credentials.
- No authentication cookies or browser credentials are required for version 1.
- Submitted place searches may use configurable, Mumbai-bounded OpenStreetMap Photon and Nominatim fallbacks. The backend must identify the application, rank fuzzy results within the service area, cache resolved locations, and enforce configured provider request intervals; the browser must not call providers directly or issue autocomplete requests.
- Hindi and Marathi place searches must accept Devanagari input and use providers that support the selected language. Cache keys must include the requested language so localized results cannot leak across language modes.
- Return `Access-Control-Allow-Headers: Accept, Content-Type, X-Request-ID`.
- Return `X-Request-ID` on every response.
- Recommended successful-search caching: `Cache-Control: public, max-age=60, stale-if-error=300`.
- Error responses containing request-specific diagnostics: `Cache-Control: no-store`.
- Support gzip or Brotli compression.

## 8. Service levels

Measured monthly, excluding announced maintenance:

| Measure | Target |
|---|---:|
| API availability | 99.5% |
| Nearby search p50 | ≤ 2.5 seconds |
| Nearby search p95 | ≤ 8 seconds |
| Nearby search hard deadline | 15 seconds |
| Health endpoint p95 | ≤ 300 ms |

The frontend aborts a request after 20 seconds. The backend must finish or return a structured timeout error before that deadline.

## 9. Rate limits

- Minimum supported limit: 60 nearby-search requests per IP address per minute.
- Return `429 RATE_LIMITED` and a valid `Retry-After` header when exceeded.
- Coordinate and locality searches use the same quota.
- Monitoring and health checks must use a separate quota.

## 10. Privacy and security

- Treat device coordinates as sensitive request data.
- Do not persist raw user coordinates after the request completes.
- Do not place full coordinates or city query text in routine access logs. If location metrics are required, aggregate or reduce precision before logging.
- Do not return personal contact details unless they are explicitly public facility information and approved for display.
- Validate all query parameters server-side.
- Keep provider credentials and tokens exclusively on the backend.
- Apply dependency scanning, secret scanning, TLS, request-size limits, and abuse protection in production.

## 11. Versioning and change management

- The URL major version is `/api/v1`.
- Adding optional fields or enum values is non-breaking only after notifying the frontend team.
- Removing fields, renaming fields, changing types, or changing established meaning requires `/api/v2`.
- Give at least 90 days’ notice before retiring a production API major version.
- Publish a changelog and example payload for every contract change.
- Backend releases must pass contract tests using the examples and invariants in this document.

## 12. Frontend acceptance checklist

The backend integration is accepted when:

1. Mumbai city search returns a valid location and a sorted resource array.
2. Coordinate search returns `location.query_type: "coordinates"`.
3. Hospital, clinic, category, and organisation enums match this contract exactly.
4. Empty results return HTTP `200` with `resources: []`.
5. Malformed, unknown, outside-Mumbai, rate-limited, upstream-failure, and timeout cases return the documented error structure.
6. Production browser requests work from the same origin without relaxed cross-origin policy.
7. No response contains `NaN`, `Infinity`, HTML error pages, stack traces, or secrets.
8. p95 response time and monthly availability meet the service-level targets.
