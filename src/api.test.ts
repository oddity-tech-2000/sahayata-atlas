import { afterEach, describe, expect, it, vi } from "vitest";
import { searchResources } from "./api";

const validPayload = {
  schema_version: "1.0",
  request_id: "request-1",
  generated_at: "2026-09-03T10:00:00.000Z",
  location: {
    query_type: "city",
    display_name: "Mumbai",
    city: "Mumbai",
    district: "Mumbai Suburban",
    state: "Maharashtra",
    country_code: "IN",
    latitude: 19.076,
    longitude: 72.8777,
  },
  coverage: { radius_metres: 10_000, healthcare_status: "available", is_partial: false, warnings: [] },
  resources: [],
  meta: { total: 0 },
};

afterEach(() => vi.restoreAllMocks());

describe("resource API client", () => {
  it("requests the Mumbai contract through the same origin", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(validPayload), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const result = await searchResources({ city: "Mumbai" }, new AbortController().signal);
    expect(result.location.display_name).toBe("Mumbai");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/resources/nearby?radius_km=10&city=Mumbai",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("surfaces a backend recovery message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "That Mumbai locality could not be found." } }), { status: 404 }),
    );
    await expect(searchResources({ city: "Atlantis" }, new AbortController().signal))
      .rejects.toThrow("That Mumbai locality could not be found.");
  });

  it("rejects malformed successful responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(searchResources({ city: "Mumbai" }, new AbortController().signal))
      .rejects.toThrow("incomplete response");
  });
});
