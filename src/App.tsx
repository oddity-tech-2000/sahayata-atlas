import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accessibility,
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
  Languages,
  ListFilter,
  LocateFixed,
  MapPin,
  Navigation,
  RotateCcw,
  Shield,
} from "lucide-react";
import {
  applyAccessibilityPreferences,
  defaultAccessibilityPreferences,
  loadAccessibilityPreferences,
  type AccessibilityPreferences,
  type TextSize,
} from "./accessibility";
import { ResourceApiError, searchResources } from "./api";
import { AtlasMap } from "./components/AtlasMap";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { isLanguage, languageNames, localeNames, messages, quickPlaces, translate, type Language } from "./i18n";
import type { FacilityType, NearbyResponse, OrganisationType, Resource, ResourceCategory, SearchRequest } from "./types";

type CategoryFilter = ResourceCategory | "all";
type FacilityFilter = FacilityType | "all";
type OrganisationFilter = OrganisationType | "all";

const MUMBAI_BOUNDS = { south: 18.85, west: 72.70, north: 19.35, east: 73.15 };

function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem("sahayata-atlas-language");
    if (isLanguage(saved)) return saved;
  } catch {
    // Browser language remains available when storage is blocked.
  }
  const browserLanguage = window.navigator.language.toLowerCase().split("-", 1)[0];
  return isLanguage(browserLanguage) ? browserLanguage : "en";
}

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 3.5 34 11v18L20 36.5 6 29V11Z" />
      <path d="M12 23.5c3.2-5.8 7.3-9.3 12.4-10.6M11.5 28c5.6-3.2 10.8-3.4 15.7-.7M20 11.5v17" />
    </svg>
  );
}

function formatDistance(metres: number | null, language: Language) {
  if (metres === null) return translate(language, "distanceUnavailable");
  const value = metres < 1000 ? Math.round(metres) : Number((metres / 1000).toFixed(1));
  const distance = new Intl.NumberFormat(localeNames[language], { maximumFractionDigits: 1 }).format(value);
  return translate(language, metres < 1000 ? "metresAway" : "kilometresAway", { distance });
}

function formatResolvedAt(timestamp: string, language: Language) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(localeNames[language], { hour: "numeric", minute: "2-digit" });
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
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [accessibilityPreferences, setAccessibilityPreferences] = useState(
    loadAccessibilityPreferences,
  );
  const [cityInput, setCityInput] = useState("");
  const [result, setResult] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestedLabel, setRequestedLabel] = useState("");
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState(() =>
    translate(language, "permissionIntro"),
  );
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
  const copy = messages[language];
  const categoryLabels: Record<ResourceCategory, string> = {
    medical: copy.medicalFacilities,
    shelter: copy.emergencyShelters,
    security: copy.securityServices,
    general: copy.otherPublicPlaces,
  };
  const facilityLabels: Record<FacilityType, string> = {
    hospital: copy.hospitals,
    clinic: copy.clinics,
    public_place: copy.otherPublicPlaces,
  };
  const organisationLabels: Record<OrganisationType, string> = {
    government: copy.government,
    private: copy.private,
    public_sector: copy.publicSector,
    unclassified: copy.unclassified,
  };

  useEffect(() => {
    if (!compact) setFiltersOpen(true);
  }, [compact]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem("sahayata-atlas-language", language);
    } catch {
      // Language still applies for this page when storage is unavailable.
    }
    if (locationState === "idle") {
      setLocationMessage(translate(language, "permissionIntro"));
    }
  }, [language, locationState]);

  useEffect(() => {
    applyAccessibilityPreferences(accessibilityPreferences);
  }, [accessibilityPreferences]);

  function updateAccessibility(
    key: keyof AccessibilityPreferences,
    value: AccessibilityPreferences[keyof AccessibilityPreferences],
  ) {
    setAccessibilityPreferences((current) => ({ ...current, [key]: value }));
  }

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
  const resolvedAt = result ? formatResolvedAt(result.generated_at, language) : "";
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
      const payload = await searchResources({ ...request, language }, controller.signal);
      setResult(payload);
      setSelectedId(null);
      setShowAll(false);
      setCityInput(payload.location.query_type === "city" ? payload.location.display_name : "");
      if (compact) setFiltersOpen(false);
      return true;
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") return false;
      const errorMessages: Record<string, string> = {
        INVALID_REQUEST: copy.invalidRequest,
        LOCATION_NOT_FOUND: copy.locationNotFound,
        LOCATION_OUTSIDE_SERVICE_AREA: copy.outsideMumbai,
        RATE_LIMITED: copy.rateLimited,
        UPSTREAM_FAILURE: copy.providerUnavailable,
        UPSTREAM_TIMEOUT: copy.providerUnavailable,
      };
      const message = searchError instanceof ResourceApiError
        ? errorMessages[searchError.code] ?? copy.defaultSearchError
        : searchError instanceof Error ? searchError.message : copy.defaultSearchError;
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
      setError(copy.invalidLocality);
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
      setLocationMessage(copy.noBrowserLocation);
      return;
    }
    setLocationState("pending");
    setLocationMessage(copy.browserMayAsk);

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
      setLocationMessage(searchNearby ? copy.locationFoundLoading : copy.locationFoundDirections);
      if (searchNearby) {
        const loaded = await runSearch({ latitude: nextLocation[0], longitude: nextLocation[1] }, copy.currentLocation);
        setLocationState(loaded ? "success" : "error");
        setLocationMessage(loaded
          ? copy.locationReady
          : copy.locationLoadFailed);
      }
      if (resource) setSelectedId(resource.id);
    } catch (locationError) {
      setLocationState("error");
      if (typeof locationError === "object" && locationError && "code" in locationError) {
        const code = (locationError as GeolocationPositionError).code;
        setLocationMessage(code === 1
          ? copy.permissionDeclined
          : code === 2
            ? copy.deviceLocationFailed
            : copy.locationTimedOut);
      } else if (locationError instanceof Error && locationError.message === "OUTSIDE_MUMBAI") {
        setLocationMessage(copy.outsideMumbai);
      } else {
        setLocationMessage(copy.locationUnavailable);
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

  const locationTitle = loading
    ? `${copy.searching} ${requestedLabel}`
    : result?.location.display_name ?? copy.awaitingLocality;
  const locationMeta = loading
    ? copy.requestingData
    : result
      ? `${visibleResources.length} · ${translate(language, "resolved", { time: resolvedAt })}`
      : copy.searchReady;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{copy.skipLink}</a>
      <div className="national-stripe" aria-hidden="true"><span /><span /><span /></div>

      <header className="masthead">
        <a className="brand" href="/" aria-label={copy.homeLabel}>
          <span className="brand-mark"><BrandMark /></span>
          <span><strong>Sahayata</strong><small>Atlas</small></span>
        </a>
        <div className="masthead-copy">
          <strong>{copy.mastheadTitle}</strong>
          <span>{copy.mastheadSubtitle}</span>
        </div>
        <div className="masthead-tools">
          <label className="language-picker">
            <Languages aria-hidden="true" />
            <span className="sr-only">{copy.language}</span>
            <select
              aria-label={copy.language}
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              {(Object.keys(languageNames) as Language[]).map((languageCode) => (
                <option key={languageCode} value={languageCode}>{languageNames[languageCode]}</option>
              ))}
            </select>
          </label>
          <details className="accessibility-menu">
            <summary><Accessibility aria-hidden="true" /><span>{copy.accessibility}</span></summary>
            <div className="accessibility-panel">
              <div className="accessibility-heading">
                <Accessibility aria-hidden="true" />
                <div><h2>{copy.accessibilityTitle}</h2><p>{copy.accessibilityIntro}</p></div>
              </div>
              <fieldset>
                <legend>{copy.textSize}</legend>
                <div className="text-size-options">
                  {(["default", "large", "largest"] as TextSize[]).map((size) => (
                    <label key={size}>
                      <input
                        type="radio"
                        name="text-size"
                        value={size}
                        checked={accessibilityPreferences.textSize === size}
                        onChange={() => updateAccessibility("textSize", size)}
                      />
                      <span>{copy[size === "default" ? "textDefault" : size === "large" ? "textLarge" : "textLargest"]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {([
                ["highContrast", copy.highContrast],
                ["reduceMotion", copy.reduceMotion],
                ["underlineLinks", copy.underlineLinks],
                ["enhancedFocus", copy.enhancedFocus],
              ] as Array<[keyof AccessibilityPreferences, string]>).map(([key, label]) => (
                <label className="accessibility-toggle" key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(accessibilityPreferences[key])}
                    onChange={(event) => updateAccessibility(key, event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <button
                type="button"
                className="reset-accessibility"
                onClick={() => setAccessibilityPreferences(defaultAccessibilityPreferences)}
              ><RotateCcw aria-hidden="true" />{copy.resetSettings}</button>
            </div>
          </details>
          <a className="source-link" href="#data-note">{copy.howDataWorks} <ArrowDown aria-hidden="true" /></a>
        </div>
      </header>

      <main id="main-content">
        <section className="search-command" aria-labelledby="search-title">
          <div className="search-intro">
            <h1 id="search-title">{copy.heroTitle}</h1>
            <p>{copy.heroBody}</p>
            <div className="scope-note"><MapPin aria-hidden="true" /><span>{copy.scope}</span></div>
          </div>

          <form className="search-form" role="search" noValidate onSubmit={submitCity}>
            <label htmlFor="city-input">{copy.localityLabel}</label>
            <div className="search-field">
              <MapPin aria-hidden="true" />
              <input
                id="city-input"
                name="city"
                type="search"
                autoComplete="address-level2"
                placeholder={copy.placeholder}
                aria-describedby={error ? "search-error" : undefined}
                aria-invalid={Boolean(error)}
                value={cityInput}
                onChange={(event) => { setCityInput(event.target.value); setError(""); }}
              />
              <button type="submit" disabled={loading}>
                <span>{loading ? copy.searching : copy.findResources}</span><ArrowRight aria-hidden="true" />
              </button>
            </div>
            {error && (
              <div ref={searchErrorRef} id="search-error" className="search-error" role="alert" tabIndex={-1}>
                <CircleAlert aria-hidden="true" />
                <span><strong>{copy.searchErrorTitle}</strong>{error}</span>
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
                <span>{locationState === "pending" ? copy.findingLocation : userLocation ? copy.refreshLocation : copy.useLocation}</span>
              </button>
              <p id="location-status" aria-live="polite" data-state={locationState}>{locationMessage}</p>
            </div>

            <details className="filter-panel" open={!compact || filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
              <summary>
                <span><strong>{copy.refineResults}</strong><small>{copy.refineHint}</small></span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="inventory-controls" aria-label={copy.resourceFilters}>
                <label className="query-select" htmlFor="category-filter">
                  <span>{copy.placeType}</span>
                  <span className="select-shell">
                    <select id="category-filter" value={category} onChange={(event) => selectCategory(event.target.value as CategoryFilter)}>
                      <option value="all">{copy.allPlaceTypes}</option>
                      <option value="medical">{copy.medicalFacilities}</option>
                      <option value="shelter">{copy.emergencyShelters}</option>
                      <option value="security">{copy.securityServices}</option>
                      <option value="general">{copy.otherPublicPlaces}</option>
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="query-select" htmlFor="facility-filter">
                  <span>{copy.facility}</span>
                  <span className="select-shell">
                    <select id="facility-filter" value={facility} onChange={(event) => selectFacility(event.target.value as FacilityFilter)}>
                      <option value="all">{copy.allFacilities}</option>
                      <option value="hospital">{copy.hospitals}</option>
                      <option value="clinic">{copy.clinics}</option>
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
                <label className="query-select" htmlFor="organisation-filter">
                  <span>{copy.organisationType}</span>
                  <span className="select-shell">
                    <select
                      id="organisation-filter"
                      value={organisation}
                      onChange={(event) => { setOrganisation(event.target.value as OrganisationFilter); setSelectedId(null); setShowAll(false); }}
                    >
                      <option value="all">{copy.allOrganisationTypes}</option>
                      <option value="government">{copy.government}</option>
                      <option value="private">{copy.private}</option>
                      <option value="public_sector">{copy.publicSector}</option>
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>
              </div>
            </details>

            <div className="quick-cities" aria-label={copy.suggestedCities}>
              <span>{copy.quickSearch}</span>
              {quickPlaces[language].map((place) => (
                <button
                  key={place.query}
                  type="button"
                  aria-pressed={result?.location.query_type === "city" && result.location.display_name === place.query}
                  onClick={() => searchQuickCity(place.query)}
                >{place.label}</button>
              ))}
            </div>
          </form>
        </section>

        <section className="workspace" aria-label={copy.workspaceLabel}>
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
                aria-label={copy.recenterMap}
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
              reduceMotion={accessibilityPreferences.reduceMotion}
              labels={{
                map: copy.mapLabel,
                currentLocation: copy.currentLocation,
                publicListing: copy.publicListing,
              }}
            />

            {!result && (
              <div className={`map-empty${loading ? " loading" : ""}`}>
                <div className="radar" aria-hidden="true"><span /><span /><span /></div>
                <h2>{loading
                  ? translate(language, "buildingPicture", { place: requestedLabel })
                  : error ? copy.pictureFailed : copy.pictureStart}</h2>
                <p>{loading
                  ? copy.resolutionWait
                  : error
                    ? copy.retryPlace
                    : copy.noLocationHistory}</p>
              </div>
            )}

            <div className="map-legend" aria-label={copy.mapLegend}>
              {userLocation && <span><i className="legend-current" />{copy.you}</span>}
              {userLocation && selectedResource && <span><i className="legend-direction" />{copy.orientation}</span>}
              <span><i className="legend-dot medical" />{copy.medical}</span>
              <span><i className="legend-dot shelter" />{copy.shelter}</span>
              <span><i className="legend-dot security" />{copy.security}</span>
              <span><i className="legend-dot general" />{copy.general}</span>
            </div>
            <span className="sr-only" aria-live="polite">{result
              ? translate(language, "mappedListings", { count: visibleResources.length, place: result.location.display_name })
              : copy.mapReady}</span>
          </div>

          <aside className="resource-ledger" aria-labelledby="ledger-title" aria-busy={loading}>
            <div className="ledger-head">
              <div>
                <h2 id="ledger-title">{copy.nearbyResources}</h2>
                <p aria-live="polite">{result
                  ? `${visibleResources.length}/${filteredResources.length} · ${hospitalCount} ${copy.hospitals}`
                  : loading ? copy.contactingService : copy.searchToLoad}</p>
              </div>
              {result && <button type="button" className="text-button" onClick={clearResults}>{copy.clearSearch}</button>}
            </div>

            {result && (
              <div className="query-summary" aria-label={copy.resolvedScope}>
                <span>{[result.location.district, result.location.state].filter(Boolean).join(", ") || result.location.display_name}</span>
                <span>{organisation === "all" ? copy.allOrganisations : organisationLabels[organisation]}</span>
                <span>{translate(language, "resolved", { time: resolvedAt })}</span>
              </div>
            )}

            {loading && result && <div className="refreshing-strip"><span /><span>{copy.updatingPicture}</span></div>}
            {result?.coverage.is_partial && (
              <div className="coverage-warning" role="status"><CircleAlert aria-hidden="true" /><span><strong>{copy.delayedTitle}</strong>{language === "en" ? result.coverage.warnings.join(" ") : copy.delayedDetails}</span></div>
            )}

            {result && error && (
              <div className="ledger-error" role="alert"><CircleAlert aria-hidden="true" /><span><strong>{copy.newSearchFailed}</strong>{error} {copy.previousRemain}</span></div>
            )}

            {loading && !result && (
              <div className="loading-state" aria-live="polite">
                <div><span /><span /><span /></div>
                <p>{copy.resolving}</p>
                <button type="button" className="text-button" onClick={() => abortRef.current?.abort()}>{copy.cancelSearch}</button>
              </div>
            )}

            {!loading && !result && (
              <div className={`message-state${error ? " error-state" : ""}`}>
                {error ? <CircleAlert aria-hidden="true" /> : <ListFilter aria-hidden="true" />}
                <div><strong>{error ? copy.scanInterrupted : copy.noResourcesYet}</strong><p>{error || copy.nearestAppear}</p></div>
              </div>
            )}

            {result && filteredResources.length === 0 && (
              <div className="message-state">
                <ListFilter aria-hidden="true" />
                <div><strong>{result.resources.length ? copy.noFilterMatches : copy.noNearby}</strong><p>{result.resources.length ? copy.adjustFilters : copy.tryAnother}</p></div>
              </div>
            )}

            {result && visibleResources.length > 0 && (
              <ol className="resource-list">
                {visibleResources.map((resource, index) => {
                  const selected = selectedId === resource.id;
                  const organisationLabel = resource.organisation.type === "unclassified"
                    ? copy.unclassified
                    : `${resource.organisation.inferred ? copy.inferred : copy.listed} ${organisationLabels[resource.organisation.type]}`;
                  return (
                    <li id={`resource-${resource.id}`} key={resource.id} className={selected ? "selected" : undefined}>
                      <button
                        type="button"
                        className="resource-row"
                        data-category={resource.category}
                        aria-expanded={selected}
                        aria-controls={`resource-detail-${index}`}
                        aria-label={translate(language, "inspectResult", { name: resource.name, position: index + 1 })}
                        onClick={() => selectResource(resource)}
                      >
                        <span className="node-rank">{String(index + 1).padStart(2, "0")}</span>
                        <span className="node-symbol"><ResourceIcon category={resource.category} /></span>
                        <span className="node-copy"><strong>{resource.name}</strong><small>{facilityLabels[resource.facility_type]} · {formatDistance(resource.distance_metres, language)}</small></span>
                        <span className="node-status">{organisationLabel}</span>
                        <ChevronRight className="row-arrow" aria-hidden="true" />
                      </button>

                      {selected && (
                        <div id={`resource-detail-${index}`} className="node-detail">
                          <strong>{copy.resultMeaning}</strong>
                          <p>{translate(language, "resultDescription", { source: resource.source.name, category: categoryLabels[resource.category].toLocaleLowerCase(localeNames[language]) })}</p>
                          <div className="detail-facts">
                            <span><Building2 aria-hidden="true" />{resource.organisation.name || organisationLabel}</span>
                            <a href={resource.source.record_url} target="_blank" rel="noreferrer">{copy.viewSource} <ExternalLink aria-hidden="true" /></a>
                          </div>
                          <div className="direction-actions">
                            {userLocation ? (
                              <a className="directions-link" href={directionsUrl(userLocation, resource)} target="_blank" rel="noreferrer">
                                <Navigation aria-hidden="true" />{copy.openDirections}
                              </a>
                            ) : (
                              <button
                                type="button"
                                className={`detail-location-button${locationState === "pending" && locationIntent === "directions" ? " locating" : ""}`}
                                disabled={locationState === "pending"}
                                aria-describedby={`direction-status-${index}`}
                                onClick={() => void requestLocation(false, resource)}
                              >
                                <LocateFixed aria-hidden="true" />{locationState === "pending" && locationIntent === "directions" ? copy.findingLocation : copy.useLocationDirections}
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
                                : copy.directionNote}
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
              <button type="button" className="show-all-button" onClick={() => setShowAll(true)}>{translate(language, "showAll", { count: filteredResources.length })}</button>
            )}
            {result && (
              <div className="classification-note"><Info aria-hidden="true" /><span>{copy.classificationNote}</span></div>
            )}
          </aside>
        </section>

        <section id="data-note" className="data-note" aria-labelledby="data-title">
          <div>
            <h2 id="data-title">{copy.dataTitle}</h2>
            <p>{copy.dataBody}</p>
          </div>
          <dl>
            <div><dt>{copy.serviceRegion}</dt><dd>{copy.serviceRegionValue}</dd></div>
            <div><dt>{copy.locationSearch}</dt><dd>{copy.locationSearchValue}</dd></div>
            <div><dt>{copy.hospitalsClinics}</dt><dd>{copy.hospitalsClinicsValue}</dd></div>
            <div><dt>{copy.publicPlaces}</dt><dd>{copy.publicPlacesValue}</dd></div>
            <div><dt>{copy.organisationType}</dt><dd>{copy.organisationValue}</dd></div>
          </dl>
        </section>
      </main>

      <footer><span>{copy.footerProduct}</span><span>{copy.emergency} <strong>112</strong>.</span></footer>
    </div>
  );
}
