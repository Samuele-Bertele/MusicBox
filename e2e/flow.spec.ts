/**
 * Browser end-to-end script (Playwright).
 *
 * Not part of `npm test`, because a headless browser download is a 300 MB
 * dependency that nobody needs to build or deploy this app. To run it:
 *
 *   npm i -D @playwright/test && npx playwright install chromium
 *   npx playwright test e2e/flow.spec.ts
 *
 * Start the app first with `npm run dev`.
 */
import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

test('login, search, play, like, playlist, history', async ({ page }) => {
  await page.goto(BASE);

  // Login (local mode: only a display name is required)
  await page.getByRole('textbox').first().fill('Samuele');
  await page.getByRole('button', { name: /entra|accedi/i }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Search
  await page.getByRole('link', { name: 'Cerca' }).first().click();
  await page.getByLabel('Cerca brani, artisti e album').fill('piano');
  await expect(page.getByRole('heading', { name: 'Brani' })).toBeVisible({ timeout: 15_000 });

  // Play the first result
  const firstTrack = page.locator('main').getByRole('button', { name: /^Riproduci .+ di / }).first();
  await firstTrack.click();
  await expect(page.getByRole('button', { name: 'Metti in pausa' })).toBeVisible({ timeout: 15_000 });

  // Like it
  await page.getByRole('button', { name: 'Aggiungi ai preferiti' }).first().click();
  await page.getByRole('link', { name: 'Preferiti' }).first().click();
  await expect(page.getByRole('heading', { name: 'Preferiti' })).toBeVisible();

  // Playback survives navigation
  await expect(page.getByRole('button', { name: 'Metti in pausa' })).toBeVisible();

  // Add to a playlist
  await page.getByRole('button', { name: /Altre azioni per/ }).first().click();
  await page.getByRole('menuitem', { name: 'Aggiungi a playlist' }).click();
  await page.getByLabel('Nome della nuova playlist').fill('E2E');
  await page.getByRole('button', { name: 'Crea' }).click();
  await page.getByRole('link', { name: 'E2E' }).first().click();
  await expect(page.getByRole('heading', { name: 'E2E' })).toBeVisible();

  // History
  await page.getByRole('link', { name: 'Ascoltati di recente' }).first().click();
  await expect(page.getByRole('heading', { name: 'Ascoltati di recente' })).toBeVisible();
});
