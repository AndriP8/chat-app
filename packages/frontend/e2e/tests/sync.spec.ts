import { expect, test } from '@playwright/test';
import { type DemoSetupResult, loginUser, setupDemoConversation } from '../utils';

test.describe('Cross-Tab Synchronization', () => {
  let demoData: DemoSetupResult;

  test.beforeEach(async ({ request }) => {
    demoData = await setupDemoConversation(request);
  });

  test('Multi-Tab Sync: Tab 2 updates when Alice sends message from Tab 1', async ({ browser }) => {
    const context = await browser.newContext();

    // Alice opens two tabs
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    await loginUser(tab1, demoData.alice.email, demoData.password);
    await tab1.getByText(demoData.bob.name).click();

    // The second tab doesn't need to login again because they share the same context (cookies)
    await tab2.goto('/chat');
    // Wait for the app to load and login state to resolve
    await expect(tab2.locator('text=Messages')).toBeVisible();
    await tab2.getByText(demoData.bob.name).click();

    const crossTabMessage = 'This message should appear in Tab 2 instantly!';
    await tab1.locator('#message_content').fill(crossTabMessage);
    await tab1.locator('button[type="submit"]').click();

    // Assert it appears in Tab 1
    await expect(tab1.getByText(crossTabMessage).first()).toBeVisible();

    // Assert it appears in Tab 2 via BroadcastChannel (no page reload)
    await expect(tab2.getByText(crossTabMessage).first()).toBeVisible();
  });

  test('Typing indicators are synchronized across clients', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();

    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();

    await Promise.all([
      loginUser(alicePage, demoData.alice.email, demoData.password),
      loginUser(bobPage, demoData.bob.email, demoData.password),
    ]);

    await alicePage.getByText(demoData.bob.name).click();
    await bobPage.getByText(demoData.alice.name).click();

    // Alice starts typing
    await alicePage.locator('#message_content').fill('I am typing something...');

    // Bob should see Alice's typing indicator
    await expect(bobPage.locator('text=typing').first()).toBeVisible();

    // Alice stops typing (clears input)
    await alicePage.locator('#message_content').fill('');

    // Bob should no longer see the typing indicator
    await expect(bobPage.locator('text=typing').first()).toBeHidden();
  });
});
