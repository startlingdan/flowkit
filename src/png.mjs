// SVG -> PNG via headless chromium.
// One browser instance per process; callers pass a list of jobs.

import fs from 'fs';
import { createRequire } from 'module';

export async function rasterise(jobs, { scale = 2 } = {}) {
  // resolves from this file upward, so a shared install in a parent
  // node_modules works as well as a local `npm i -D puppeteer`
  const require = createRequire(import.meta.url);
  const puppeteer = require('puppeteer');
  const executablePath = process.env.FLOWKIT_CHROMIUM
    ?? ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
      .find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    for (const job of jobs) {
      await page.setViewport({
        width: Math.ceil(job.width) + 20,
        height: Math.ceil(job.height) + 20,
        deviceScaleFactor: scale,
      });
      await page.setContent(
        `<html><head><meta charset="utf-8"><style>body{margin:0;padding:0}</style></head><body>${job.svg}</body></html>`,
        { waitUntil: 'load' },
      );
      const el = await page.$('svg');
      await el.screenshot({ path: job.out });
    }
  } finally {
    await browser.close();
  }
}
