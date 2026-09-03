import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5005",
    browserName: "chromium",
    launchOptions: {
      executablePath: "/Applications/Helium.app/Contents/MacOS/Helium",
    },
    trace: "retain-on-failure",
  },
});
