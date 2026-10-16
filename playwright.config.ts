import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, permissions: ["clipboard-read", "clipboard-write"] },
  projects: [
    // SwiftShader gives headless Chromium a software WebGL so the 3D path is exercised too.
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: `npm run build && npx next start -p ${PORT}`, port: PORT, timeout: 300_000, reuseExistingServer: true },
});
