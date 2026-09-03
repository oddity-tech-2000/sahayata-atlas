# Sahayata Atlas

Sahayata Atlas is a responsive Mumbai public-resource finder. It combines a React and TypeScript interface with a Python FastAPI service that resolves Mumbai localities and retrieves nearby hospitals, clinics, emergency services, and public places from public data providers.

The application is a preparedness aid, not an emergency dispatch or verified facility-availability service. For emergencies in India, call **112**.

## Product behavior

- Searches are limited to Mumbai localities and in-region device coordinates.
- Location permission is requested only after the user selects **Use my location**; raw coordinates are not persisted or placed in routine logs.
- An outside-Mumbai search or device location returns a recoverable service-area message without removing the last successful result set.
- Results can be filtered by place category, facility type—including hospitals—and organisation type.
- Selecting a resource couples the list row to its map marker. When a user location is available, the map shows an orientation line and provides an external road-directions link.
- Partial upstream data is displayed as a warning while usable results remain available.

## Stack

- React 19, TypeScript, Vite, Leaflet
- Python 3.13, FastAPI, Uvicorn, HTTPX
- Vitest, Playwright, pytest, Ruff, ESLint
- Multi-stage Docker image and Render Web Service configuration

Node.js is build tooling for the React client. The deployed application process is Python.

## Run locally

Requirements: Node.js 22+, Python 3.13+, and Git.

```bash
npm ci
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
```

Start the API in one terminal:

```bash
source .venv/bin/activate
PORT=8000 python -m backend.app
```

Start the Vite client in another:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the Python service.

To run the production-shaped application locally:

```bash
npm run build
PORT=5005 python -m backend.app
```

Then open `http://127.0.0.1:5005`.

### Windows one-command setup

From PowerShell in the project directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

The script installs missing prerequisites with `winget`, updates an existing Git checkout, installs locked frontend and backend dependencies, builds the client, starts the Python service, and opens the default browser.

## Quality checks

```bash
npm run check
npm run test:e2e
.venv/bin/ruff check backend
.venv/bin/pytest
docker build -t sahayata-atlas:local .
```

The Playwright configuration uses Helium when it is installed at `/Applications/Helium.app/Contents/MacOS/Helium`.

## API and configuration

The same-origin interface is documented in [backend-requirements.md](backend-requirements.md). Runtime settings are environment variables; copy `.env.example` for local defaults. Important settings include upstream timeout, Overpass endpoint, cache duration, cache capacity, and per-IP request limit.

Location search uses Open-Meteo first, then Mumbai-bounded OpenStreetMap Photon and Nominatim fallbacks for streets, neighbourhoods, landmarks, misspellings, and other named places. Photon ranks fuzzy text matches with a Mumbai location bias; the backend rejects out-of-bounds results and breaks comparable matches by proximity to central Mumbai. Searches run only when submitted, resolved places are cached for 24 hours, public-provider calls are globally paced, and both endpoints are configurable without a code change. Resource data comes from OpenStreetMap Overpass and Wikipedia GeoSearch. All result provenance remains visible in the interface.

## Deploy on Render

The repository includes `render.yaml` and a production `Dockerfile`. Create a Render Blueprint or Docker Web Service from the repository. The service listens on Render's `PORT`, exposes `/api/v1/health`, and serves the built client and API from the same origin.

## Project structure

```text
src/                    React client
backend/app/            FastAPI service
backend/tests/          Backend contract tests
e2e/                    Responsive browser workflow test
backend-requirements.md API and service-level agreement
Dockerfile              Production multi-stage image
render.yaml             Render Web Service definition
```
