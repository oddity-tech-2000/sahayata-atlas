import { expect, test, type Page } from "@playwright/test";

const mumbaiPayload = {
  schema_version: "1.0",
  request_id: "e2e-mumbai",
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
  coverage: {
    radius_metres: 10_000,
    healthcare_status: "available",
    is_partial: false,
    warnings: [],
  },
  resources: [
    {
      id: "osm:node:1",
      name: "Mumbai Community Hospital",
      category: "medical",
      facility_type: "hospital",
      latitude: 19.0812,
      longitude: 72.8821,
      distance_metres: 720,
      organisation: { type: "government", name: "Municipal Health Department", inferred: true },
      listing_status: "listed",
      source: { name: "OpenStreetMap", record_id: "node/1", record_url: "https://www.openstreetmap.org/node/1", updated_at: null },
    },
    {
      id: "wikipedia:page:2",
      name: "Bandra Community Centre",
      category: "shelter",
      facility_type: "public_place",
      latitude: 19.0607,
      longitude: 72.8362,
      distance_metres: 940,
      organisation: { type: "unclassified", name: null, inferred: true },
      listing_status: "listed",
      source: { name: "Wikipedia", record_id: "page/2", record_url: "https://en.wikipedia.org/?curid=2", updated_at: null },
    },
  ],
  meta: { total: 2 },
};

async function mockApi(page: Page) {
  await page.route("**/api/v1/resources/nearby?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("city") === "Delhi") {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "LOCATION_OUTSIDE_SERVICE_AREA", message: "This region is outside Mumbai and is currently not available. Search a Mumbai locality instead." } }),
      });
      return;
    }
    if (url.searchParams.has("latitude")) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UPSTREAM_FAILURE", message: "The resource service is temporarily unavailable. Try again." } }),
      });
      return;
    }
    const isPartial = url.searchParams.get("city") === "Bandra";
    const payload = isPartial
      ? {
          ...mumbaiPayload,
          request_id: "e2e-bandra-partial",
          location: { ...mumbaiPayload.location, display_name: "Bandra", city: "Bandra" },
          coverage: {
            ...mumbaiPayload.coverage,
            healthcare_status: "partial",
            is_partial: true,
            warnings: ["Some general public-place listings are temporarily unavailable."],
          },
        }
      : mumbaiPayload;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

test("Hindi, Marathi, and accessibility preferences persist", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByLabel("Language").selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { name: "पूरे मुंबई में सहायता सुविधाएँ खोजें।" })).toBeVisible();

  await page.locator(".accessibility-menu > summary").click();
  await page.getByLabel("बड़ा", { exact: true }).check();
  await page.getByLabel("अधिक कंट्रास्ट वाले रंग").check();
  await page.getByLabel("एनीमेशन कम करें").check();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  await expect(page.locator("html")).toHaveAttribute("data-high-contrast", "true");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  await page.getByLabel("भाषा").selectOption("mr");
  await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  await expect(page.getByRole("heading", { name: "संपूर्ण मुंबईत मदत सुविधा शोधा." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("desktop and mobile Mumbai workflows", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Find response infrastructure across Mumbai." })).toBeVisible();

  await page.getByRole("button", { name: "Mumbai", exact: true }).click();
  await expect(page.getByText("Mumbai Community Hospital", { exact: true })).toBeVisible();
  await expect(page.locator(".resource-row")).toHaveCount(2);
  await expect(page.locator(".resource-pin")).toHaveCount(2);

  await page.locator(".leaflet-tile-loaded").first().waitFor({ state: "visible" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: ".impeccable/review/desktop.png", fullPage: true });

  await page.locator(".resource-pin").nth(1).click();
  await expect(page.locator("li.selected").filter({ hasText: "Bandra Community Centre" })).toBeVisible();

  await page.getByRole("button", { name: /Inspect Mumbai Community Hospital/ }).click();
  await expect(page.getByText("What this result means")).toBeVisible();
  await page.getByLabel("Facility").selectOption("hospital");
  await expect(page.locator(".resource-row")).toHaveCount(1);

  await page.getByRole("button", { name: "Bandra", exact: true }).click();
  await expect(page.getByText("Some sources are delayed.")).toBeVisible();
  await expect(page.getByText("Some general public-place listings are temporarily unavailable.")).toBeVisible();

  await page.getByRole("button", { name: /Inspect Mumbai Community Hospital/ }).click();
  await page.context().grantPermissions(["geolocation"], { origin: "http://127.0.0.1:5005" });
  await page.context().setGeolocation({ latitude: 28.6139, longitude: 77.209 });
  await page.getByRole("button", { name: "Use my location for directions" }).click();
  await expect(page.locator(".direction-note[data-state='error']")).toContainText("outside Mumbai");

  await page.context().setGeolocation({ latitude: 19.076, longitude: 72.8777 });
  await page.reload();
  await page.getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(page.locator("#location-status")).toContainText("Location found, but nearby resources could not be loaded.");

  await page.getByRole("button", { name: "Mumbai", exact: true }).click();
  await expect(page.locator(".resource-row")).toHaveCount(2);
  await page.getByLabel("Facility").selectOption("hospital");
  await expect(page.locator(".resource-row")).toHaveCount(1);

  await page.getByLabel("Mumbai locality").fill("Delhi");
  await page.getByRole("button", { name: "Find resources" }).click();
  await expect(page.getByText("New search not loaded.")).toBeVisible();
  await expect(page.getByText(/outside Mumbai/).first()).toBeVisible();
  await expect(page.locator(".resource-row")).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("details.filter-panel")).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Mumbai", exact: true }).click();
  await expect(page.locator(".resource-row")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.getByRole("button", { name: "Use my location", exact: true }).evaluate((button) => button.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("button", { name: "Use my location", exact: true })).toBeVisible();
  await page.screenshot({ path: ".impeccable/review/mobile.png", fullPage: true });
  const expectedHttpErrors = ["422 (Unprocessable Entity)", "503 (Service Unavailable)"];
  const unexpectedBrowserErrors = browserErrors.filter((message) => !expectedHttpErrors.some((expected) => message.includes(expected)));
  expect(unexpectedBrowserErrors).toEqual([]);
});
