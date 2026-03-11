import { expect, test } from '@playwright/test';
import { type DemoSetupResult, loginUser, setupDemoConversation } from '../utils';

test.describe('Real-time Messaging Critical Paths', () => {
  let demoData: DemoSetupResult;

  test.beforeEach(async ({ request }) => {
    demoData = await setupDemoConversation(request);
  });

  test('Alice sends a message to Bob and Bob receives it', async ({ browser }) => {
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

    const testMessage = 'Hello Bob, this is a real-time test message!';
    await alicePage.locator('#message_content').fill(testMessage);
    await alicePage.locator('button[type="submit"]').click();

    await expect(alicePage.getByText(testMessage).first()).toBeVisible();
    await expect(bobPage.getByText(testMessage).first()).toBeVisible();

    const replyMessage = 'Hi Alice, I got your message!';
    await bobPage.locator('#message_content').fill(replyMessage);
    // wait a moment for typing indicator logic to settle
    await bobPage.waitForTimeout(500);
    await bobPage.locator('button[type="submit"]').click();

    await expect(alicePage.getByText(replyMessage).first()).toBeVisible();
  });

  test('IndexedDB Pagination Bug: older messages should not disappear on new message', async ({
    browser,
  }) => {
    test.setTimeout(120000); // This test takes longer because we send 55 messages
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();

    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();

    await loginUser(alicePage, demoData.alice.email, demoData.password);
    await alicePage.getByText(demoData.bob.name).click();

    // Alice sends 55 messages rapidly to build up history > 50 (the pagination limit)
    for (let i = 1; i <= 55; i++) {
      await alicePage.locator('#message_content').fill(`Pagination test message ${i}`);
      await alicePage.locator('button[type="submit"]').click();
      // Wait for it to appear in Alice's UI to ensure order
      await expect(alicePage.getByText(`Pagination test message ${i}`).first()).toBeVisible();
    }

    // Now Bob logs in and opens the conversation
    await loginUser(bobPage, demoData.bob.email, demoData.password);
    await bobPage.getByText(demoData.alice.name).click();

    // Bob should see the latest 50 messages
    await expect(bobPage.getByText('Pagination test message 55').first()).toBeVisible();

    // Scroll up to trigger loadMoreMessages
    // We can evaluate scrolling to the top of the message list
    await bobPage.evaluate(() => {
      const scrollable = document.querySelector('.flex-1.overflow-y-auto'); // Check the class in MessageList
      if (scrollable) scrollable.scrollTop = 0;
    });

    // We should be able to see message 1 eventually
    // Note: The UI might require clicking a load more button or just scrolling.
    // Assuming virtual scrolling or continuous scrolling:
    await expect(bobPage.getByText('Pagination test message 5').first()).toBeVisible({
      timeout: 10000,
    });

    // Now reproduce the bug: Alice sends one more message while Bob has full history loaded
    await alicePage.locator('#message_content').fill('The breaking message 56');
    await alicePage.locator('button[type="submit"]').click();

    // Bob receives it
    await expect(bobPage.getByText('The breaking message 56').first()).toBeVisible({ timeout: 15000 });

    // ASSERTION: The older messages (e.g., message 5) MUST still be visible!
    // In the buggy implementation, receiving a new websocket message might overwrite IndexedDB state
    // and trigger a UI refresh that trims older messages or hides them.
    await expect(bobPage.getByText('Pagination test message 5').first()).toBeVisible();
  });

  test('Offline Resilience: messages queued offline are sent when online', async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();

    await loginUser(alicePage, demoData.alice.email, demoData.password);
    await alicePage.getByText(demoData.bob.name).click();

    // Simulate going offline
    await aliceContext.setOffline(true);

    const offlineMessage = 'This message was sent while offline';
    await alicePage.locator('#message_content').fill(offlineMessage);
    await alicePage.locator('button[type="submit"]').click();

    // It should appear in the UI optimistically (we might check for an error/sending state if implemented)
    await expect(alicePage.getByText(offlineMessage).first()).toBeVisible();

    // Simulate coming back online
    await aliceContext.setOffline(false);

    // Let's check Bob's UI to ensure it actually got delivered once online
    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();
    await loginUser(bobPage, demoData.bob.email, demoData.password);
    await bobPage.getByText(demoData.alice.name).click();

    await expect(bobPage.getByText(offlineMessage).first()).toBeVisible();

    // Now go back to Alice's page to verify the message status is updated to 'read' (since Bob opened the chat)
    const aliceMessageContainer = alicePage
      .locator('div.flex.max-w-\\[85\\%\\]', { hasText: offlineMessage })
      .first();
    await expect(aliceMessageContainer.locator('svg.text-blue-600')).toBeVisible({
      timeout: 10000,
    });
  });
});
