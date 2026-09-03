import { useEffect, useMemo } from "react";
import L, { type LatLngExpression } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Resource, ResourceCategory } from "../types";

interface AtlasMapProps {
  center: [number, number] | null;
  resources: Resource[];
  selectedId: string | null;
  userLocation: [number, number] | null;
  onSelect: (resource: Resource) => void;
  recenterSignal: number;
}

const MUMBAI_CENTER: LatLngExpression = [19.076, 72.8777];

function resourceIcon(category: ResourceCategory, selected: boolean) {
  return L.divIcon({
    className: "atlas-marker-shell",
    html: `<span class="resource-pin ${category}${selected ? " is-selected" : ""}"><span></span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 31],
    popupAnchor: [0, -30],
  });
}

const locationIcon = L.divIcon({
  className: "atlas-marker-shell",
  html: '<span class="current-location-pin"><span></span></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function MapMotion({ center, selected, recenterSignal }: {
  center: [number, number] | null;
  selected: Resource | null;
  recenterSignal: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (center) map.flyTo(center, 12, { duration: 0.8 });
  }, [center, map, recenterSignal]);

  useEffect(() => {
    if (selected) map.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.65 });
  }, [map, selected]);

  return null;
}

export function AtlasMap({ center, resources, selectedId, userLocation, onSelect, recenterSignal }: AtlasMapProps) {
  const selected = useMemo(
    () => resources.find((resource) => resource.id === selectedId) ?? null,
    [resources, selectedId],
  );
  const direction = selected && userLocation
    ? [userLocation, [selected.latitude, selected.longitude] as [number, number]]
    : null;

  return (
    <MapContainer center={MUMBAI_CENTER} zoom={10} scrollWheelZoom className="map" aria-label="Map of nearby public infrastructure in Mumbai">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapMotion center={center} selected={selected} recenterSignal={recenterSignal} />
      {resources.map((resource) => (
        <Marker
          key={resource.id}
          position={[resource.latitude, resource.longitude]}
          icon={resourceIcon(resource.category, resource.id === selectedId)}
          eventHandlers={{ click: () => onSelect(resource) }}
          title={resource.name}
        >
          <Popup>
            <strong>{resource.name}</strong><br />
            <span>{resource.source.name} public listing</span>
          </Popup>
        </Marker>
      ))}
      {userLocation && (
        <Marker position={userLocation} icon={locationIcon} title="Your current location">
          <Popup>Your current location</Popup>
        </Marker>
      )}
      {direction && (
        <Polyline
          positions={direction}
          pathOptions={{ color: "#bc6c25", weight: 4, opacity: 0.9, dashArray: "9 10" }}
        />
      )}
    </MapContainer>
  );
}
