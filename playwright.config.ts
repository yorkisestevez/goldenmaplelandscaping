import {defineConfig,devices} from '@playwright/test';

/**
 * DeckCraft smoke tests against the production build (run `npm run build` first). Locally they drive the
 * installed Microsoft Edge so no browser download is needed; CI installs Playwright's Chromium.
 * WebGL runs on SwiftShader in headless mode; the tests assert on the page, never on canvas pixels.
 */
const PORT=Number(process.env.E2E_PORT||4031);
const channel=process.env.CI?undefined:(process.env.E2E_CHANNEL||'msedge');
const launchOptions={args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']};

export default defineConfig({
  testDir:'e2e',
  // CI runners draw SwiftShader WebGL about 3x slower than a workstation: the heaviest 3D tests take about 60s
  // here and up to 3 minutes there.
  timeout:process.env.CI?300_000:90_000,
  expect:{timeout:15_000},
  fullyParallel:false,
  workers:1,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
  use:{baseURL:`http://127.0.0.1:${PORT}`,trace:'retain-on-failure',acceptDownloads:true},
  projects:[
    {name:'desktop',use:{...devices['Desktop Chrome'],channel,launchOptions},grepInvert:/@phone/},
    {name:'phone',use:{...devices['Pixel 7'],channel,launchOptions},grep:/@phone/},
  ],
  webServer:{command:'node e2e/static-server.mjs',url:`http://127.0.0.1:${PORT}/deck-designer/`,reuseExistingServer:!process.env.CI,timeout:30_000},
});
