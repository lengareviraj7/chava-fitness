import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/returns');

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

async function login(page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="tel"]');
  await page.fill('input[type="tel"]', '9876543210');
  await page.fill('input[type="password"]', 'Owner@123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#app-sidebar', { timeout: 10000 });
}

test.describe('Bill Return Quantity Default Suite', () => {
  test('Return modal automatically defaults to purchased quantity', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    // 1. Go to Billing (POS)
    await page.goto('/billing');
    await page.waitForSelector('button:has-text("Bills & Returns")', { timeout: 10000 });

    // 2. Go to "Bills & Returns" tab
    const historyTab = page.locator('button:has-text("Bills & Returns")');
    await historyTab.click();
    await page.waitForSelector('table', { timeout: 8000 });

    // Check if any bill with a Return button is present; if not, create one
    let returnBtn = page.locator('table button:has-text("Return")').first();
    if ((await returnBtn.count()) === 0) {
      // Switch to New Bill and checkout 1 unit
      await page.locator('button:has-text("New Bill")').click();
      const addBtn = page.locator('span:has-text("+ Add")').first();
      await addBtn.waitFor({ state: 'visible', timeout: 5000 });
      await addBtn.click();
      const completeBtn = page.locator('button:has-text("Generate Bill & Complete"), button:has-text("Generate Bill with Udhari")').first();
      await completeBtn.click();
      const startNewBillBtn = page.locator('button:has-text("Start New Bill")');
      await startNewBillBtn.waitFor({ state: 'visible', timeout: 8000 });
      await startNewBillBtn.click();
      await historyTab.click();
      returnBtn = page.locator('table button:has-text("Return")').first();
    }

    // 3. Click "Return" button on the first returnable bill in the table
    await returnBtn.waitFor({ state: 'visible', timeout: 8000 });
    await returnBtn.click();

    // 6. Verify Process Bill Return modal appears
    await page.waitForSelector('text=Process Bill Return', { timeout: 5000 });

    // 7. Check that Return Qty is NOT 0, but matches purchased quantity (e.g. 2 or 1)
    const qtyInput = page.locator('input[type="number"][min="0"]').first();
    await expect(qtyInput).toBeVisible();
    const returnQtyVal = await qtyInput.inputValue();
    expect(parseInt(returnQtyVal)).toBeGreaterThan(0);

    // Verify Estimated Refund Total is calculated (not ₹0.00)
    const refundTotal = page.locator('text=Estimated Refund Total').locator('..').locator('span.text-primary');
    const refundText = await refundTotal.textContent();
    expect(refundText).not.toContain('₹0.00');

    // Screenshot of modal with default purchased quantity
    await page.screenshot({
      path: path.join(outDir, `return-modal-default-qty-${browserName}.png`),
    });

    // 8. Test Clear All and Select All helpers
    const clearAllBtn = page.locator('button:has-text("Clear All")');
    await clearAllBtn.click();
    expect(await qtyInput.inputValue()).toBe('0');

    const selectAllBtn = page.locator('button:has-text("Select All")');
    await selectAllBtn.click();
    expect(await qtyInput.inputValue()).toBe(returnQtyVal);

    // Cancel modal
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForSelector('text=Process Bill Return', { state: 'hidden' });
  });
});
