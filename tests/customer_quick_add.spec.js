import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const screenshotsDir = path.resolve('docs/screenshots/customer-quick-add');

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

test.describe('Billing Counter Customer Quick-Add & Viewports Suite', () => {
  test('POS Counter Customer Header & Quick Add Flow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/billing');
    const customerHeader = page.locator('span.uppercase:has-text("Customer")');
    await expect(customerHeader).toBeVisible({ timeout: 10000 });

    const walkInPill = page.locator('span:has-text("Walk-in")').first();
    await expect(walkInPill).toBeVisible();

    // Verify "+ New customer" button is present and "+ Register" is gone
    const newCustomerBtn = page.locator('button:has-text("New customer")');
    await expect(newCustomerBtn).toBeVisible();

    const registerLink = page.locator('button:has-text("Register"), a:has-text("Register")');
    expect(await registerLink.count()).toBe(0);

    // Open Quick Add Modal
    await newCustomerBtn.click();
    await page.waitForSelector('h3:has-text("New customer")');

    // Verify fields: Name, Mobile number (+91), Address (pre-filled with Visapur)
    const nameInput = page.locator('input[placeholder*="Ramesh"]');
    const phoneInput = page.locator('input[placeholder="9876543210"]');
    const addressInput = page.locator('textarea[placeholder*="Visapur"]');

    await expect(nameInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    await expect(addressInput).toBeVisible();

    // Address must be pre-filled with Visapur
    const addressVal = await addressInput.inputValue();
    expect(addressVal).toBe('Visapur');

    // Fill new customer details
    const uniquePhone = '97' + Math.floor(10000000 + Math.random() * 90000000);
    await nameInput.fill('Kavita Deshmukh');
    await phoneInput.fill(uniquePhone);

    // Submit form
    await page.click('button:has-text("Save and add to bill")');

    // Wait for modal to close and customer card to appear
    await page.waitForSelector('text=Kavita Deshmukh', { timeout: 8000 });
    await expect(page.locator(`text=${uniquePhone}`)).toBeVisible();
    await expect(page.locator('text=Visapur')).toBeVisible();

    // Verify Change and Remove buttons exist
    const changeBtn = page.locator('button:has-text("Change")');
    await expect(changeBtn).toBeVisible();

    // Click Change to reopen search
    await changeBtn.click();
    const searchInput = page.locator('input[placeholder*="Search customer"]');
    await expect(searchInput).toBeVisible();

    // Search for the newly created customer
    await searchInput.fill(uniquePhone);
    await page.waitForSelector(`text=Kavita Deshmukh`);
    await page.click(`button:has-text("Kavita Deshmukh")`);

    // Customer re-attached
    await expect(page.locator('text=Kavita Deshmukh')).toBeVisible();
  });

  test('Duplicate mobile 409 handling with "Use this customer"', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/billing');
    const newCustomerBtn = page.locator('button:has-text("New customer")');
    await expect(newCustomerBtn).toBeVisible({ timeout: 10000 });

    const duplicatePhone = '96' + Math.floor(10000000 + Math.random() * 90000000);

    // Step 1: Create fresh customer
    await newCustomerBtn.click();
    await page.waitForSelector('h3:has-text("New customer")');
    await page.fill('input[placeholder*="Ramesh"]', 'Original Customer');
    await page.fill('input[placeholder="9876543210"]', duplicatePhone);
    await page.click('button:has-text("Save and add to bill")');

    // Wait for customer card to appear
    await page.waitForSelector(`text=${duplicatePhone}`, { timeout: 8000 });

    // Detach customer back to walk-in
    const removeBtn = page.locator('button[title*="Walk-in"]');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Verify back to walk-in
    await expect(page.locator('span:has-text("Walk-in")').first()).toBeVisible();

    // Step 2: Try creating duplicate with same phone
    await page.click('button:has-text("New customer")');
    await page.waitForSelector('h3:has-text("New customer")');
    await page.fill('input[placeholder*="Ramesh"]', 'Second Person Same Phone');
    await page.fill('input[placeholder="9876543210"]', duplicatePhone);
    await page.click('button:has-text("Save and add to bill")');

    // Verify 409 conflict banner appears
    await page.waitForSelector('text=This number belongs to', { timeout: 8000 });
    const useCustomerBtn = page.locator('button:has-text("Use this customer")');
    await expect(useCustomerBtn).toBeVisible();

    // Click "Use this customer"
    await useCustomerBtn.click();

    // Verify modal closes and customer is attached
    await expect(page.locator(`text=${duplicatePhone}`)).toBeVisible();
  });

  test('Multi-Viewport Visual Screenshots', async ({ page, browserName }) => {
    const viewports = [
      { name: '1440x900', width: 1440, height: 900 },
      { name: '1024x768', width: 1024, height: 768 },
      { name: '768x1024', width: 768, height: 1024 },
      { name: '390x844', width: 390, height: 844 },
    ];

    await login(page);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/billing');
      const header = page.locator('span.uppercase:has-text("Customer")');
      await expect(header).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(400);

      // Save screenshot
      const filename = path.join(screenshotsDir, `${vp.name}-${browserName}.png`);
      await page.screenshot({ path: filename, fullPage: false });

      // Also open modal on this viewport to verify responsive layout
      const newCustomerBtn = page.locator('button:has-text("New customer")');
      if (await newCustomerBtn.isVisible()) {
        await newCustomerBtn.click();
        await page.waitForSelector('h3:has-text("New customer")');
        await page.waitForTimeout(300);

        const modalFilename = path.join(screenshotsDir, `${vp.name}-modal-${browserName}.png`);
        await page.screenshot({ path: modalFilename, fullPage: false });

        // Close modal
        await page.click('button:has-text("Cancel")');
        await page.waitForTimeout(150);
      }
    }
  });
});
