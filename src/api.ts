import type { NearbyResponse, SearchRequest } from "./types";

function isNearbyResponse(value: unknown): value is NearbyResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NearbyResponse>;
  return candidate.schema_version === "1.0"
    && Array.isArray(candidate.resources)
    && typeof candidate.location?.display_name === "string"
    && Number.isFinite(candidate.location?.latitude)
    && Number.isFinite(candidate.location?.longitude)
    && candidate.location?.country_code === "IN";
}

export async function searchResources(request: SearchRequest, signal: AbortSignal): Promise<NearbyResponse> {
  const query = new URLSearchParams({ radius_km: "10" });
  if (request.city) query.set("city", request.city);
  if (request.latitude !== undefined && request.longitude !== undefined) {
    query.set("latitude", String(request.latitude));
    query.set("longitude", String(request.longitude));
  }

  const response = await fetch(`/api/v1/resources/nearby?${query}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await response.json().catch(() => null) as unknown;

  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string } } | null;
    throw new Error(errorPayload?.error?.message ?? "The resource service could not complete this search.");
  }
  if (!isNearbyResponse(payload)) {
    throw new Error("The resource service returned an incomplete response. Please try again.");
  }
  return payload;
}
