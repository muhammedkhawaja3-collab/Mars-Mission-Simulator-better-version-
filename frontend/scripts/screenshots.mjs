/**
 * Capture full-page screenshots of a running app at several widths.
 *
 * Usage: node scripts/screenshots.mjs <baseUrl> <outDir> [prefix]
 * Env:   CHROME_PATH        Chromium executable (default: Playwright cache, revision 1140)
 *        SHOT_WIDTHS        comma list, default "375,768,1440"
 *        SHOT_ACTIONS       optional path to a module exporting `async (page, width) => [{name}]`
 *                           that drives the UI and returns extra named states to capture.
 * Reports console errors/warnings and horizontal overflow for every width.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [baseUrl = 'http://127.0.0.1:4173', outDir = 'shots', prefix = 'app'] = process.argv.slice(2);
const widths = (process.env.SHOT_WIDTHS || '375,768,1440').split(',').map(Number);
const executablePath =
  process.env.CHROME_PATH || join(homedir(), '.cache/ms-playwright/chromium-1140/chrome-linux/chrome');
const actions = process.env.SHOT_ACTIONS
  ? (await import(pathToFileURL(resolve(process.env.SHOT_ACTIONS)).href)).default
  : null;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
let problems = 0;
for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: width < 768 ? 812 : 900 } });
  const logs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const shoot = async (name) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const file = join(outDir, `${prefix}-${name}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${file}${overflow > 0 ? `  OVERFLOW ${overflow}px` : ''}`);
    if (overflow > 0) problems++;
  };
  await shoot('home');
  if (actions) for (const state of (await actions(page, width)) || []) await shoot(state.name);
  for (const l of logs) console.log(`  [${width}] ${l}`);
  problems += logs.length;
  await page.close();
}
await browser.close();
process.exitCode = problems ? 1 : 0;
