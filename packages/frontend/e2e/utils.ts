/// <reference types="node" />
import { type APIRequestContext, expect, type Page } from '@playwright/test';
export interface DemoUser {
  id: string;
  email: string;
  name: string;
}

export interface DemoSetupResult {
  alice: DemoUser;
  bob: DemoUser;
  password: string;
  conversationId: string;
}

/**
 * Creates a fresh demo conversation with Alice and Bob via the API.
 */
export async function setupDemoConversation(request: APIRequestContext): Promise<DemoSetupResult> {
  const API_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  const response = await request.post(`${API_URL}/auth/demo-user`);
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.success).toBe(true);

  const alice = body.data.users.find((u: DemoUser) => u.name.includes('Alice'));
  const bob = body.data.users.find((u: DemoUser) => u.name.includes('Bob'));

  if (!alice || !bob) {
    throw new Error('Could not find Alice or Bob in demo setup response');
  }

  return {
    alice,
    bob,
    password: body.data.password,
    conversationId: body.data.conversationId,
  };
}

/**
 * Logs a demo user into the application using the UI.
 */
export async function loginUser(page: Page, email: string, password = 'demo123') {
  await page.goto('/login');

  // Fill the login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit the form
  await page.click('button[type="submit"]'); // Wait for navigation or specific UI element

  // Wait to reach the chat page
  await expect(page).toHaveURL(/\/(chat)?$/);

  // Ensure the page has fully loaded
  await page.waitForSelector('text=Chat', { state: 'visible', timeout: 10000 });
}
