import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const screenshotsDir = path.resolve('docs/screenshots/one-step-purchase');

test.beforeAll(async () => {
  fs.mkdirSync(screenshotsDir, { recursive: true });
});

async function login(page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('chava_inward_purchase_draft');
  });
  await page.waitForSelector('input[type="tel"]');
  await page.fill('input[type="tel"]', '9876543210');
  await page.fill('input[type="password"]', 'Owner@123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#app-sidebar', { timeout: 10000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('One-Step Purchase & Product Inward Suite', () => {
  test('Complete Unified Inward Flow: Create Product, Variants and Inward Stock', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    // 1. Navigate to Stock Page
    await page.goto('/stock');
    await page.waitForSelector('button:has-text("Purchases")');
    await page.click('button:has-text("Purchases")');

    // 2. Open Inward Stock Purchase Modal
    const inwardBtn = page.locator('button:has-text("Inward Purchase")');
    await expect(inwardBtn).toBeVisible({ timeout: 10000 });
    await inwardBtn.click();

    // Verify modal opened
    await page.waitForSelector('h3:has-text("Inward Stock Purchase")');
    await page.waitForTimeout(500);

    // Screenshot initial purchase modal
    await page.screenshot({
      path: path.join(screenshotsDir, `1440x900-modal-initial-${browserName}.png`),
    });

    // 3. Open New Product Inline Panel
    const newProductTrigger = page.locator('button:has-text("+ New Product")').first();
    await newProductTrigger.click();
    await page.waitForSelector('h3:has-text("New Product & Stock Inward")');

    // Fill Product Master Details
    const uniqueName = `Pro Gold Isolate ${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder*="Gold Standard"]', uniqueName);
    await page.fill('input[placeholder*="Optimum Nutrition"]', 'Chava Nutrition');

    // Pick GST rate (18%)
    const gst18Btn = page.locator('button:has-text("18%")').first();
    await gst18Btn.click();

    // Fill Variant 1
    await page.fill('input[placeholder*="Double Rich Chocolate"]', 'Kesar Pista');
    await page.fill('input[placeholder*="2 kg or 5 lbs"]', '1 kg');
    await page.fill('input[placeholder="4500"]', '3800'); // MRP
    await page.fill('input[placeholder="3999"]', '3400'); // Selling Price
    await page.fill('input[placeholder="2800"]', '2400'); // Cost
    await page.fill('input[placeholder="ON-26-A1"]', 'KP-2027-B1'); // Batch
    await page.fill('input[placeholder="MM/YYYY"]', '122027'); // Expiry text masked

    // Add Variant 2
    await page.click('button:has-text("Add Flavour / Size")');
    await page.waitForTimeout(300);

    const flavourInputs = page.locator('input[placeholder*="Double Rich Chocolate"]');
    await flavourInputs.nth(1).fill('Belgian Chocolate');

    const sizeInputs = page.locator('input[placeholder*="2 kg or 5 lbs"]');
    await sizeInputs.nth(1).fill('1 kg');

    const mrpInputs = page.locator('input[placeholder="4500"]');
    await mrpInputs.nth(1).fill('3800');

    const spInputs = page.locator('input[placeholder="3999"]');
    await spInputs.nth(1).fill('3400');

    const costInputs = page.locator('input[placeholder="2800"]');
    await costInputs.nth(1).fill('2400');

    const batchInputs = page.locator('input[placeholder="ON-26-A1"]');
    await batchInputs.nth(1).fill('BC-2027-B2');

    const expiryInputs = page.locator('input[placeholder="MM/YYYY"]');
    await expiryInputs.nth(1).fill('122027');

    // Take screenshot of New Product Panel
    await page.screenshot({
      path: path.join(screenshotsDir, `1440x900-new-product-panel-${browserName}.png`),
    });

    // Click Done & Add to Purchase
    await page.click('button:has-text("Done & Add to Purchase")');
    await page.waitForTimeout(500);

    // Verify lines created with lime NEW badge
    const newBadges = page.locator('span:has-text("NEW")');
    expect(await newBadges.count()).toBeGreaterThan(0);

    // Select or register wholesale supplier
    const supplierSelect = page.locator('select').first();
    const optionCount = await supplierSelect.locator('option').count();
    if (optionCount <= 1) {
      await page.click('button:has-text("+ New")');
      await page.waitForSelector('h3:has-text("Register New Supplier")');
      await page.fill('input[placeholder*="Bright Commodities"]', 'Prime Health Wholesale');
      await page.fill('input[placeholder="10-digit mobile number"]', '9876500001');
      await page.click('button[type="submit"]:has-text("Add Supplier")');
      await page.waitForTimeout(800);
    }
    await supplierSelect.selectOption({ index: 1 });

    // Fill Invoice details
    await page.fill('input[placeholder*="INV-2026-981"]', `INV-TEST-${Date.now().toString().slice(-4)}`);

    // Click Confirm Purchase Inward
    await page.click('button[type="submit"]:has-text("Confirm Purchase Inward")');
    await page.waitForSelector('h4:has-text("Confirm Purchase Inward")');

    // Screenshot confirmation summary
    await page.screenshot({
      path: path.join(screenshotsDir, `1440x900-confirm-summary-${browserName}.png`),
    });

    // Confirm & Save
    await page.click('button:has-text("Confirm & Save Inward")');
    await page.waitForTimeout(1500);

    // Verify inward recorded and modal closed
    const modalHeading = page.locator('h3:has-text("Inward Stock Purchase")');
    expect(await modalHeading.count()).toBe(0);
  });

  test('Save & Receive Stock from Products Page Flow', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/products');
    await page.waitForSelector('button:has-text("Add Product")');
    await page.click('button:has-text("Add Product")');

    await page.waitForSelector('h2:has-text("Add Product")');

    const prodName = `Whey Matrix Gold ${Date.now().toString().slice(-4)}`;
    await page.fill('input[placeholder="e.g. Whey Protein Isolate"]', prodName);
    await page.fill('input[placeholder="e.g. MuscleBlaze"]', 'Matrix Tech');
    await page.fill('input[placeholder="Chocolate"]', 'Swiss Choco');
    await page.fill('input[placeholder="1 kg"]', '2 kg');
    await page.fill('input[placeholder="MB-WPI-CHO-1KG"]', `MTX-${Date.now().toString().slice(-4)}`);

    const numberInputs = page.locator('input[type="number"]');
    // MRP
    await numberInputs.nth(0).fill('4800');
    // Selling price
    await numberInputs.nth(1).fill('4200');
    // Purchase price
    await numberInputs.nth(2).fill('3100');
    // Units
    await numberInputs.nth(3).fill('15');

    // Verify "Save & receive stock" button exists
    const saveAndReceiveBtn = page.locator('button:has-text("Save & receive stock")');
    await expect(saveAndReceiveBtn).toBeVisible();

    await saveAndReceiveBtn.click();
    await page.waitForTimeout(1000);

    // Verify redirected to /stock?tab=purchases&action=new with inward purchase modal open
    await expect(page).toHaveURL(/.*stock.*action=new.*/);
    await page.waitForSelector('h3:has-text("Inward Stock Purchase")');

    // Verify preloaded product name in items
    const preloadedLine = page.locator(`span:has-text("${prodName}")`);
    await expect(preloadedLine).toBeVisible();
  });

  test('Multi-Viewport Responsive Audit: 1440x900, 1024x768, 768x1024, 390x844', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await login(page);

    const viewports = [
      { name: '1440x900', width: 1440, height: 900 },
      { name: '1024x768', width: 1024, height: 768 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '390x844', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/stock?tab=purchases&action=new');
      await page.waitForSelector('h3:has-text("Inward Stock Purchase")', { timeout: 10000 });
      await page.waitForTimeout(500);

      // Screenshot main inward modal
      await page.screenshot({
        path: path.join(screenshotsDir, `${vp.name}-inward-modal-${browserName}.png`),
      });

      // Open New Product Inline Panel
      await page.click('button:has-text("+ New Product")');
      await page.waitForSelector('h3:has-text("New Product & Stock Inward")');
      await page.waitForTimeout(500);

      // Screenshot New Product Panel (Bottom sheet on 390x844, modal on tablet/desktop)
      await page.screenshot({
        path: path.join(screenshotsDir, `${vp.name}-new-product-panel-${browserName}.png`),
      });

      // Close panel
      await page.locator('button:has-text("Cancel")').last().click();
      await page.waitForTimeout(300);
    }
  });
});