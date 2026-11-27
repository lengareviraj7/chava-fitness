import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const screenshotsDir = path.resolve('docs/screenshots/dashboard-bg');

test.beforeAll(async () => {
  fs.mkdirSync(screenshotsDir, { recursive: true });
});

async function login(page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="tel"]');
  await page.fill('input[type="tel"]', '9876543210');
  await page.fill('input[type="password"]', 'Owner@123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#app-sidebar', { timeout: 10000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Static App Shell & Dashboard Backdrop Suite', () => {
  test('Static Sidebar Invariant across routes and scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/');
    await page.waitForSelector('#app-sidebar');
    const sidebar = page.locator('#app-sidebar');
    await expect(sidebar).toBeVisible();

    const boxInitial = await sidebar.boundingBox();
    expect(boxInitial).not.toBeNull();
    // At 1440px (>=1280px), sidebar width should be 262px
    expect(boxInitial.width).toBeCloseTo(262, 2);

    // Scroll main scroller
    const mainScroller = page.locator('#app-main-scroller');
    await mainScroller.evaluate((el) => { el.scrollTop = 250; });
    await page.waitForTimeout(200);

    // Verify document html/body does not scroll at >=768px
    const docScrollTop = await page.evaluate(() => document.scrollingElement.scrollTop);
    expect(docScrollTop).toBe(0);

    // Sidebar bounding box must be identical
    const boxAfterScroll = await sidebar.boundingBox();
    expect(boxAfterScroll.x).toBe(boxInitial.x);
    expect(boxAfterScroll.width).toBe(boxInitial.width);

    // Route transition to Billing POS: sidebar MUST NOT auto-collapse!
    await page.click('a[href="/billing"]');
    await page.waitForURL('**/billing');
    await page.waitForTimeout(250);

    const boxBilling = await sidebar.boundingBox();
    expect(boxBilling.width).toBeCloseTo(boxInitial.width, 2);
  });

  test('Responsive Sidebar Widths without transitions', async ({ page }) => {
    await login(page);

    // 1. Tablet Rail (768px - 1023px) -> 76px
    await page.setViewportSize({ width: 800, height: 1024 });
    await page.goto('/');
    const sidebar = page.locator('#app-sidebar');
    await expect(sidebar).toBeVisible();
    const boxTablet = await sidebar.boundingBox();
    expect(boxTablet.width).toBeCloseTo(76, 2);

    // 2. Desktop Small (1024px - 1279px) -> 232px
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(100);
    const boxSmallDesktop = await sidebar.boundingBox();
    expect(boxSmallDesktop.width).toBeCloseTo(232, 2);

    // 3. Desktop Large (>=1280px) -> 262px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100);
    const boxLargeDesktop = await sidebar.boundingBox();
    expect(boxLargeDesktop.width).toBeCloseTo(262, 2);
  });

  test('Zero Hero Image Requests on Non-Dashboard Routes', async ({ page }) => {
    await login(page);

    const heroImageRequests = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('dashboard-bg-') && url.endsWith('.webp')) {
        heroImageRequests.push(url);
      }
    });

    // Visit Products, Stock, Reports
    await page.goto('/products');
    await page.waitForSelector('#app-sidebar');
    await page.waitForTimeout(200);
    expect(heroImageRequests.length).toBe(0);

    await page.goto('/stock');
    await page.waitForSelector('#app-sidebar');
    await page.waitForTimeout(200);
    expect(heroImageRequests.length).toBe(0);

    await page.goto('/reports');
    await page.waitForSelector('#app-sidebar');
    await page.waitForTimeout(200);
    expect(heroImageRequests.length).toBe(0);
  });

  test('Capture Visual Verification Screenshots and Build Compare Image', async ({ page }) => {
    await login(page);

    const viewports = [
      { name: '1672x941', width: 1672, height: 941 },
      { name: '1440x900', width: 1440, height: 900 },
      { name: '1024x768', width: 1024, height: 768 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '390x844',  width: 390,  height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForSelector('#app-main-scroller');
      await page.waitForTimeout(600); // Allow fonts & images to render

      const screenshotPath = path.join(screenshotsDir, `${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`Saved screenshot: ${screenshotPath}`);
    }

    // Generate docs/screenshots/dashboard-bg/compare.png (A on left, new build 1672x941 on right)
    const refA = path.resolve('docs/design/dashboard-reference-v2.png');
    const newBuild1672 = path.join(screenshotsDir, '1672x941.png');
    const compareOut = path.join(screenshotsDir, 'compare.png');

    if (fs.existsSync(refA) && fs.existsSync(newBuild1672)) {
      const imgA = sharp(refA).resize({ width: 836, height: 470, fit: 'fill' });
      const imgB = sharp(newBuild1672).resize({ width: 836, height: 470, fit: 'fill' });

      const bufA = await imgA.toBuffer();
      const bufB = await imgB.toBuffer();

      await sharp({
        create: {
          width: 1672,
          height: 470,
          channels: 4,
          background: { r: 5, g: 8, b: 5, alpha: 1 },
        },
      })
        .composite([
          { input: bufA, left: 0, top: 0 },
          { input: bufB, left: 836, top: 0 },
        ])
        .png()
        .toFile(compareOut);

      console.log(`✅ Saved side-by-side comparison: ${compareOut}`);
    }
  });
});
