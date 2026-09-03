export type ResourceCategory = "medical" | "shelter" | "security" | "general";
export type FacilityType = "hospital" | "clinic" | "public_place";
export type OrganisationType = "government" | "private" | "public_sector" | "unclassified";

export interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  facility_type: FacilityType;
  latitude: number;
  longitude: number;
  distance_metres: number | null;
  organisation: {
    type: OrganisationType;
    name: string | null;
    inferred: boolean;
  };
  listing_status: "listed";
  source: {
    name: "OpenStreetMap" | "Wikipedia";
    record_id: string;
    record_url: string;
    updated_at: string | null;
  };
}

export interface NearbyResponse {
  schema_version: "1.0";
  request_id: string;
  generated_at: string;
  location: {
    query_type: "city" | "coordinates";
    display_name: string;
    city: string | null;
    district: string | null;
    state: string | null;
    country_code: "IN";
    latitude: number;
    longitude: number;
  };
  coverage: {
    radius_metres: number;
    healthcare_status: "available" | "partial" | "unavailable";
    is_partial: boolean;
    warnings: string[];
  };
  resources: Resource[];
  meta: { total: number };
}

export interface SearchRequest {
  city?: string;
  latitude?: number;
  longitude?: number;
}
