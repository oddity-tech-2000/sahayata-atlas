import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Crosshair,
  ExternalLink,
  Hospital,
  House,
  Info,
  Landmark,
  ListFilter,
  LocateFixed,
  MapPin,
  Navigation,
  Shield,
} from "lucide-react";
import { searchResources } from "./api";
import { AtlasMap } from "./components/AtlasMap";
import { useMediaQuery } from "./hooks/useMediaQuery";
import type { FacilityType, NearbyResponse, OrganisationType, Resource, ResourceCategory, SearchRequest } from "./types";

type CategoryFilter = ResourceCategory | "all";
type FacilityFilter = FacilityType | "all";
type OrganisationFilter = OrganisationType | "all";

const quickCities = ["Mumbai", "Andheri", "Bandra", "Powai"];
const MUMBAI_BOUNDS = { south: 18.85, west: 72.70, north: 19.35, east: 73.15 };
const categoryLabels: Record<ResourceCategory, string> = {
  medical: "Medical facility",
  shelter: "Emergency shelter",
  security: "Security service",
  general: "Public place",
};
const facilityLabels: Record<FacilityType, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  public_place: "Public place",
};
const organisationLabels: Record<OrganisationType, string> = {
  government: "Government",
  private: "Private",
  public_sector: "Public sector organisation",
  unclassified: "Unclassified",
};

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3.5 34 11v18L20 36.5 6 29V11Z" />
      <path d="M12 23.5c3.2-5.8 7.3-9.3 12.4-10.6M11.5 28c5.6-3.2 10.8-3.4 15.7-.7M20 11.5v17" />
    </svg>
  );
}

function formatDistance(metres: number | null) {
  if (metres === null) return "Distance unavailable";
  return metres < 1000 ? `${Math.round(metres)} m away` : `${(metres / 1000).toFixed(1)} km away`;
}

function formatResolvedAt(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function ResourceIcon({ category }: { category: ResourceCategory }) {
  if (category === "medical") return <Hospital aria-hidden="true" />;
  if (category === "shelter") return <House aria-hidden="true" />;
  if (category === "security") return <Shield aria-hidden="true" />;
  return <Landmark aria-hidden="true" />;
}

function directionsUrl(origin: [number, number], resource: Resource) {
  const params = new URLSearchParams({
    api: "1",
    origin: origin.map((coordinate) => coordinate.toFixed(6)).join(","),
    destination: `${resource.latitude.toFixed(6)},${resource.longitude.toFixed(6)}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

export function App() {
  const compact = useMediaQuery("(max-width: 620px)");
  const [cityInput, setCityInput] = useState("");
  const [result, setResult] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestedLabel, setRequestedLabel] = useState("");
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("Permission is requested only when you choose this option. Your location is used for this session and is not stored.");
  const [locationState, setLocationState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [locationIntent, setLocationIntent] = useState<"search" | "directions" | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [facility, setFacility] = useState<FacilityFilter>("all");
  const [organisation, setOrganisation] = useState<OrganisationFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(!compact);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const searchErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!compact) setFiltersOpen(true);
  }, [compact]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const filteredResources = useMemo(() => {
    if (!result) return [];
    return result.resources.filter((resource) => (
      (category === "all" || resource.category === category)
      && (facility === "all" || resource.facility_type === facility)
      && (organisation === "all" || resource.organisation.type === organisation)
    ));
  }, [category, facility, organisation, result]);

  const visibleResources = useMemo(() => {
    if (showAll) return filteredResources;
    return filteredResources.slice(0, compact ? 10 : 20);
  }, [compact, filteredResources, showAll]);

  const selectedResource = useMemo(
    () => visibleResources.find((resource) => resource.id === selectedId) ?? null,
    [selectedId, visibleResources],
  );
  const hospitalCount = filteredResources.filter((resource) => resource.facility_type === "hospital").length;
  const resolvedAt = result ? formatResolvedAt(result.generated_at) : "";
  const center: [number, number] | null = result
    ? [result.location.latitude, result.location.longitude]
    : null;

  async function runSearch(request: SearchRequest, label: string): Promise<boolean> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setRequestedLabel(label);
    setError("");

    try {
      const payload = await searchResources(request, controller.signal);
      setResult(payload);
      setSelectedId(null);
      setShowAll(false);
      setCityInput(payload.location.query_type === "city" ? payload.location.display_name : "");
      if (compact) setFiltersOpen(false);
      return true;
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") return false;
      const message = searchError instanceof Error ? searchError.message : "This search could not be completed.";
      setError(message);
      window.requestAnimationFrame(() => searchErrorRef.current?.focus());
      return false;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }

  function submitCity(event: React.FormEvent) {
    event.preventDefault();
    const city = cityInput.trim();
    if (city.length < 2) {
      setError("Enter a Mumbai locality, such as Andheri, Bandra, or Powai.");
      window.requestAnimationFrame(() => searchErrorRef.current?.focus());
      return;
    }
    void runSearch({ city }, city);
  }

  function searchQuickCity(city: string) {
    setCityInput(city);
    void runSearch({ city }, city);
  }

  function getBrowserPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 300_000,
      });
    });
  }

  async function requestLocation(searchNearby: boolean, resource?: Resource) {
    setLocationIntent(resource ? "directions" : "search");
    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationMessage("Location is unavailable in this browser. Search a Mumbai locality instead.");
      return;
    }
    setLocationState("pending");
    setLocationMessage("Your browser may ask you to allow location access.");

    try {
      const position = await getBrowserPosition();
      const nextLocation: [number, number] = [
        Number(position.coords.latitude.toFixed(6)),
        Number(position.coords.longitude.toFixed(6)),
      ];
      if (
        nextLocation[0] < MUMBAI_BOUNDS.south
        || nextLocation[0] > MUMBAI_BOUNDS.north
        || nextLocation[1] < MUMBAI_BOUNDS.west
        || nextLocation[1] > MUMBAI_BOUNDS.east
      ) {
        throw new Error("OUTSIDE_MUMBAI");
      }
      setUserLocation(nextLocation);
      setLocationState("success");
      setLocationMessage(searchNearby ? "Location found. Loading nearby resources…" : "Location found. Direction guidance is ready.");
      if (searchNearby) {
        const loaded = await runSearch({ latitude: nextLocation[0], longitude: nextLocation[1] }, "your location");
        setLocationState(loaded ? "success" : "error");
        setLocationMessage(loaded
          ? "Location found. Nearby resources are ready."
          : "Location found, but nearby resources could not be loaded. Try the search again.");
      }
      if (resource) setSelectedId(resource.id);
    } catch (locationError) {
      setLocationState("error");
      if (typeof locationError === "object" && locationError && "code" in locationError) {
        const code = (locationError as GeolocationPositionError).code;
        setLocationMessage(code === 1
          ? "Location permission was declined. You can still search a Mumbai locality."
          : code === 2
            ? "Your device could not determine its location. Check location services or search a Mumbai locality."
            : "Location took too long to resolve. Try again or search a Mumbai locality.");
      } else if (locationError instanceof Error && locationError.message === "OUTSIDE_MUMBAI") {
        setLocationMessage("This region is outside Mumbai and is currently not available. Search a Mumbai locality instead.");
      } else {
        setLocationMessage("Location is unavailable. Search a Mumbai locality instead.");
      }
    }
  }

  function clearResults() {
    abortRef.current?.abort();
    abortRef.current = null;
    setResult(null);
    setCityInput("");
    setError("");
    setLoading(false);
    setCategory("all");
    setFacility("all");
    setOrganisation("all");
    setSelectedId(null);
    setShowAll(false);
    if (compact) setFiltersOpen(false);
  }

  function selectCategory(nextCategory: CategoryFilter) {
    setCategory(nextCategory);
    if (nextCategory !== "medical" && facility !== "all") setFacility("all");
    setSelectedId(null);
    setShowAll(false);
  }

  function selectFacility(nextFacility: FacilityFilter) {
    setFacility(nextFacility);
    if (nextFacility !== "all") setCategory("medical");
    setSelectedId(null);
    setShowAll(false);
  }

  function selectResource(resource: Resource) {
    setSelectedId((current) => current === resource.id ? null : resource.id);
  }

  function selectMapResource(resource: Resource) {
    setSelectedId(resource.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`resource-${resource.id}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  const locationTitle = loading ? `Searching ${requestedLabel}` : result?.location.display_name ?? "Awaiting a locality";
  const locationMeta = loading
    ? "Requesting place, hospital, and public listing data"
    : result
      ? `${visibleResources.length} listings · resolved ${resolvedAt}`
      : "Mumbai search is ready";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to resource search</a>
      <div className="national-stripe" aria-hidden="true"><span /><span /><span /></div>

      <header className="masthead">
        <a className="brand" href="/" aria-label="Sahayata Atlas home">
          <span className="brand-mark"><BrandMark /></span>
          <span><strong>Sahayata</strong><small>Atlas</small></span>
        </a>
        <div className="masthead-copy">
          <strong>Mumbai public infrastructure lookup</strong>
          <span>Preparedness view · on-demand public data</span>
        </div>
        <a className="source-link" href="#data-note">How this data works <ArrowDown aria-hidden="true" /></a>
      </header>

      <main id="main-content">
        <section className="search-command" aria-labelledby="search-title">
          <div className="search-intro">
            <h1 id="search-title">Find response infrastructure across Mumbai.</h1>
            <p>Search a Mumbai neighbourhood, street, or landmark to map public resources listed within 10 km.</p>
            <div className="scope-note"><MapPin aria-hidden="true" /><span>Currently available in the Mumbai region</span></div>
          </div>

          <form className="search-form" role="search" noValidate onSubmit={submitCity}>
            <label htmlFor="city-input">Mumbai locality</label>
            <div className="search-field">
              <MapPin aria-hidden="true" />
              <input
                id="city-input"
                name="city"
                type="search"
                autoComplete="address-level2"
                placeholder="Try Dadar, Marine Lines, Kalbadevi…"
                aria-describedby={error ? "search-error" : undefined}
                aria-invalid={Boolean(error)}
                value={cityInput}
                onChange={(event) => { setCityInput(event.target.value); setError(""); }}
              />
              <button type="submit" disabled={loading}>
                <span>{loading ? "Searching…" : "Find resources"}</span><ArrowRight aria-hidden="true" />
              </button>
            </div>
            {error && (
              <div ref={searchErrorRef} id="search-error" className="search-error" role="alert" tabIndex={-1}>
                <CircleAlert aria-hidden="true" />
                <span><strong>We couldn’t complete that search.</strong>{error}</span>
              </div>
            )}

            <div className="location-choice">
              <button
                type="button"
                className={`location-button${locationState === "pending" ? " locating" : ""}`}
                disabled={locationState === "pending" || loading}
                aria-describedby="location-status"
                onClick={() => void requestLocation(true)}
              >
                <LocateFixed aria-hidden="true" />
                <span>{locationState === "pending" ? "Finding your location…" : userLocation ? "Refresh my location" : "Use my location"}</span>
              </button>
              <p id="location-status" aria-live="polite" data-state={locationState}>{locationMessage}</p>
            </div>

            <details className="filter-panel" open={!compact || filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
              <summary>
                <span><strong>Refine results</strong><small>Place type, facility, organisation</small></span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="inventory-controls" aria-label="Resource filters">
                <label className="query-select" htmlFor="category-filter">
                  <span>Place type</span>
                  <span className="select-shell">
                    <select id="category-filter" value={category} onChange={(event) => selectCategory(event.target.value as CategoryFilter)}>
                      <option value="all">All place types</option>
                      <option value="medical">Medical facilities</option>
                      <option value="shelter">Emergency shelters</option>
                      <option value="security">Security services</option>
                      <option value="general">Other public places</option>
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="query-select" htmlFor="facility-filter">
                  <span>Facility</span>
                  <span className="select-shell">
                    <select id="facility-filter" value={facility} onChange={(event) => selectFacility(event.target.value as FacilityFilter)}>
                      <option value="all">All facilities</option>
                      <option value="hospital">Hospitals</option>
                      <option value="clinic">Clinics</option>
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="query-select" htmlFor="organisation-filter">
                  <span>Organisation type</span>
                  <span className="select-shell">
                    <select
                      id="organisation-filter"
                      value={organisation}
                      onChange={(event) => { setOrganisation(event.target.value as OrganisationFilter); setSelectedId(null); setShowAll(false); }}
                    >
                      <option value="all">All organisation types</option>
                      <option value="government">Government</option>
                      <option value="private">Private</option>
                      <option value="public_sector">Public sector organisation</option>
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
              </div>
            </details>

            <div className="quick-cities" aria-label="Suggested cities">
              <span>Quick search</span>
              {quickCities.map((city) => (
                <button
                  key={city}
                  type="button"
                  aria-pressed={result?.location.query_type === "city" && result.location.display_name === city}
                  onClick={() => searchQuickCity(city)}
                >{city}</button>
              ))}
            </div>
          </form>
        </section>

        <section className="workspace" aria-label="Resource map and results">
          <div className="map-stage">
            <div className="map-toolbar">
              <div>
                <span className={`status-dot${loading ? " searching" : result ? " live" : ""}`} aria-hidden="true" />
                <strong>{locationTitle}</strong>
                <span>{locationMeta}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                disabled={!result}
                aria-label="Recenter map"
                onClick={() => setRecenterSignal((signal) => signal + 1)}
              ><Crosshair aria-hidden="true" /></button>
            </div>

            <AtlasMap
              center={center}
              resources={visibleResources}
              selectedId={selectedId}
              userLocation={userLocation}
              onSelect={selectMapResource}
              recenterSignal={recenterSignal}
            />

            {!result && (
              <div className={`map-empty${loading ? " loading" : ""}`}>
                <div className="radar" aria-hidden="true"><span /><span /><span /></div>
                <h2>{loading ? `Building ${requestedLabel}’s resource picture…` : error ? "We couldn’t build this resource picture." : "Your Mumbai resource picture starts with a locality."}</h2>
                <p>{loading
                  ? "Place resolution usually returns first; detailed public listings can take a little longer."
                  : error
                    ? "Check the search message, then try a Mumbai neighbourhood, street, or landmark again."
                    : "Results are requested on demand. No location history is stored by this application."}</p>
              </div>
            )}

            <div className="map-legend" aria-label="Map legend">
              {userLocation && <span><i className="legend-current" />You</span>}
              {userLocation && selectedResource && <span><i className="legend-direction" />Orientation</span>}
              <span><i className="legend-dot medical" />Medical</span>
              <span><i className="legend-dot shelter" />Shelter</span>
              <span><i className="legend-dot security" />Security</span>
              <span><i className="legend-dot general" />General</span>
            </div>
            <span className="sr-only" aria-live="polite">{result ? `${visibleResources.length} public listings mapped near ${result.location.display_name}` : "Map ready"}</span>
          </div>

          <aside className="resource-ledger" aria-labelledby="ledger-title" aria-busy={loading}>
            <div className="ledger-head">
              <div>
                <h2 id="ledger-title">Nearby resources</h2>
                <p aria-live="polite">{result
                  ? `${visibleResources.length < filteredResources.length ? `Nearest ${visibleResources.length} of ${filteredResources.length}` : `${filteredResources.length} shown · nearest first`} · ${hospitalCount} hospital${hospitalCount === 1 ? "" : "s"}`
                  : loading ? "Contacting the resource service…" : "Search a Mumbai locality to load resources."}</p>
              </div>
              {result && <button type="button" className="text-button" onClick={clearResults}>Clear search</button>}
            </div>

            {result && (
              <div className="query-summary" aria-label="Resolved location and active scope">
                <span>{[result.location.district, result.location.state].filter(Boolean).join(", ") || result.location.display_name}</span>
                <span>{organisation === "all" ? "All organisations" : organisationLabels[organisation]}</span>
                <span>Resolved {resolvedAt}</span>
              </div>
            )}

            {loading && result && <div className="refreshing-strip"><span /><span>Updating the resource picture…</span></div>}
            {result?.coverage.is_partial && (
              <div className="coverage-warning" role="status"><CircleAlert aria-hidden="true" /><span><strong>Some sources are delayed.</strong>{result.coverage.warnings.join(" ")}</span></div>
            )}

            {result && error && (
              <div className="ledger-error" role="alert"><CircleAlert aria-hidden="true" /><span><strong>New search not loaded.</strong>{error} Your previous Mumbai results remain available.</span></div>
            )}

            {loading && !result && (
              <div className="loading-state" aria-live="polite">
                <div><span /><span /><span /></div>
                <p>Resolving the location and requesting nearby public listings…</p>
                <button type="button" className="text-button" onClick={() => abortRef.current?.abort()}>Cancel search</button>
              </div>
            )}

            {!loading && !result && (
              <div className={`message-state${error ? " error-state" : ""}`}>
                {error ? <CircleAlert aria-hidden="true" /> : <ListFilter aria-hidden="true" />}
                <div><strong>{error ? "Resource scan interrupted" : "No resources loaded yet"}</strong><p>{error || "Your nearest public listings will appear here."}</p></div>
              </div>
            )}

            {result && filteredResources.length === 0 && (
              <div className="message-state">
                <ListFilter aria-hidden="true" />
                <div><strong>{result.resources.length ? "No resources match these filters" : "No nearby listings found"}</strong><p>{result.resources.length ? "Adjust the filters to broaden this view." : "Try another Mumbai locality for broader public-data coverage."}</p></div>
              </div>
            )}

            {result && visibleResources.length > 0 && (
              <ol className="resource-list">
                {visibleResources.map((resource, index) => {
                  const selected = selectedId === resource.id;
                  const organisationLabel = resource.organisation.type === "unclassified"
                    ? "Unclassified"
                    : `${resource.organisation.inferred ? "Inferred: " : "Listed: "}${organisationLabels[resource.organisation.type]}`;
                  return (
                    <li id={`resource-${resource.id}`} key={resource.id} className={selected ? "selected" : undefined}>
                      <button
                        type="button"
                        className="resource-row"
                        data-category={resource.category}
                        aria-expanded={selected}
                        aria-controls={`resource-detail-${index}`}
                        aria-label={`Inspect ${resource.name}, nearest result ${index + 1}`}
                        onClick={() => selectResource(resource)}
                      >
                        <span className="node-rank">{String(index + 1).padStart(2, "0")}</span>
                        <span className="node-symbol"><ResourceIcon category={resource.category} /></span>
                        <span className="node-copy"><strong>{resource.name}</strong><small>{facilityLabels[resource.facility_type]} · {formatDistance(resource.distance_metres)}</small></span>
                        <span className="node-status">{organisationLabel}</span>
                        <ChevronRight className="row-arrow" aria-hidden="true" />
                      </button>

                      {selected && (
                        <div id={`resource-detail-${index}`} className="node-detail">
                          <strong>What this result means</strong>
                          <p>A public {resource.source.name} listing classified as a {categoryLabels[resource.category].toLowerCase()}. Ownership, operating status, capacity, and emergency suitability are not verified.</p>
                          <div className="detail-facts">
                            <span><Building2 aria-hidden="true" />{resource.organisation.name || organisationLabel}</span>
                            <a href={resource.source.record_url} target="_blank" rel="noreferrer">View source <ExternalLink aria-hidden="true" /></a>
                          </div>
                          <div className="direction-actions">
                            {userLocation ? (
                              <a className="directions-link" href={directionsUrl(userLocation, resource)} target="_blank" rel="noreferrer">
                                <Navigation aria-hidden="true" />Open road directions
                              </a>
                            ) : (
                              <button
                                type="button"
                                className={`detail-location-button${locationState === "pending" && locationIntent === "directions" ? " locating" : ""}`}
                                disabled={locationState === "pending"}
                                aria-describedby={`direction-status-${index}`}
                                onClick={() => void requestLocation(false, resource)}
                              >
                                <LocateFixed aria-hidden="true" />{locationState === "pending" && locationIntent === "directions" ? "Finding your location…" : "Use my location for directions"}
                              </button>
                            )}
                            <small
                              id={`direction-status-${index}`}
                              className="direction-note"
                              data-state={locationIntent === "directions" ? locationState : "idle"}
                              aria-live="polite"
                            >
                              {locationIntent === "directions" && (locationState === "pending" || locationState === "error")
                                ? locationMessage
                                : "The ochre map line is straight-line orientation. Google Maps provides the road route."}
                            </small>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            {visibleResources.length < filteredResources.length && (
              <button type="button" className="show-all-button" onClick={() => setShowAll(true)}>Show all {filteredResources.length} results</button>
            )}
            {result && (
              <div className="classification-note"><Info aria-hidden="true" /><span>Organisation labels may be inferred from public names and operator metadata, not verified ownership.</span></div>
            )}
          </aside>
        </section>

        <section id="data-note" className="data-note" aria-labelledby="data-title">
          <div>
            <h2 id="data-title">Mumbai public data, with its limits left visible.</h2>
            <p>Sahayata Atlas currently covers the Mumbai region and is a preparedness aid—not an emergency dispatch service. Listings do not confirm that a facility is open, equipped, safe, or available.</p>
          </div>
          <dl>
            <div><dt>Service region</dt><dd>Mumbai localities and in-region device coordinates</dd></div>
            <div><dt>Location search</dt><dd>Open-Meteo + OSM Photon/Nominatim · on submit</dd></div>
            <div><dt>Hospitals & clinics</dt><dd>OpenStreetMap Overpass · on-demand</dd></div>
            <div><dt>Other public places</dt><dd>Wikipedia GeoSearch · within 10 km</dd></div>
            <div><dt>Organisation type</dt><dd>Operator metadata and name inference · qualified in every result</dd></div>
          </dl>
        </section>
      </main>

      <footer><span>Sahayata Atlas · Mumbai public-resource interface</span><span>For emergencies in India, call <strong>112</strong>.</span></footer>
    </div>
  );
}
