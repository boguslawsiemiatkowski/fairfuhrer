// e2e/smoke.mjs
// Skrypt testów E2E (smoke tests) oparty na zainstalowanym pakiecie `playwright`.
// Uruchamianie (przy działającym serwerze `npm run dev` lub produkcyjnym):
//   npm run test:e2e
// Możesz też wskazać inny adres przez zmienną BASE_URL, np.:
//   $env:BASE_URL="https://www.fairfuehrer.guide"; npm run test:e2e

import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:10000").replace(
  /\/+$/,
  "",
);

async function runSmokeTests() {
  console.log(`🚀 Uruchamianie testów E2E (Playwright) dla: ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Sprawdzenie manifestu PWA (/manifest.webmanifest) oraz nagłówków bezpieczeństwa
    console.log("  1/4 Sprawdzanie /manifest.webmanifest i nagłówków HTTP…");
    const manifestRes = await page.request.get(
      `${BASE_URL}/manifest.webmanifest`,
    );
    assert.equal(manifestRes.status(), 200, "Manifest PWA powinien zwrócić 200");
    const headers = manifestRes.headers();
    assert.equal(
      headers["x-content-type-options"],
      "nosniff",
      "Brak nagłówka X-Content-Type-Options: nosniff",
    );
    assert.ok(
      headers["content-security-policy"]?.includes("default-src 'self'"),
      "Brak nagłówka Content-Security-Policy",
    );
    const manifestJson = await manifestRes.json();
    assert.equal(manifestJson.short_name, "Fairführer");
    assert.equal(manifestJson.start_url, "/karte");

    // 2. Sprawdzenie strony głównej (/)
    console.log("  2/4 Sprawdzanie strony głównej (/)…");
    const homeRes = await page.goto(`${BASE_URL}/`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(homeRes?.status(), 200, "Strona główna powinna zwrócić 200");
    const title = await page.title();
    assert.ok(
      title.toUpperCase().includes("FAIRFÜHRER"),
      `Nieoczekiwany tytuł strony: ${title}`,
    );

    // 3. Sprawdzenie katalogu miejsc (/liste)
    console.log("  3/4 Sprawdzanie katalogu miejsc (/liste)…");
    const listeRes = await page.goto(`${BASE_URL}/liste`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(listeRes?.status(), 200, "Strona /liste powinna zwrócić 200");

    // 4. Sprawdzenie mapy z filtrem kategorii w URL (/karte?kategorie=sehenswertes)
    console.log(
      "  4/4 Sprawdzanie mapy z filtrem w URL (/karte?kategorie=sehenswertes)…",
    );
    const karteRes = await page.goto(
      `${BASE_URL}/karte?kategorie=sehenswertes`,
      { waitUntil: "domcontentloaded" },
    );
    assert.equal(karteRes?.status(), 200, "Strona /karte powinna zwrócić 200");
    assert.ok(
      page.url().includes("kategorie=sehenswertes"),
      "Parametr ?kategorie=sehenswertes powinien zostać zachowany w URL",
    );

    console.log("✅ Wszystkie testy E2E (4/4) zakończone sukcesem!");
  } finally {
    await browser.close();
  }
}

runSmokeTests().catch((err) => {
  console.error("❌ Błąd podczas testów E2E:", err);
  process.exit(1);
});

