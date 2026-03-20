import { expect, test } from "@playwright/test";

test("user can launch a mocked OpenClaw trial and open replay", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start a new trial" }).click();
  await page.getByLabel("State root override").fill("/tmp/openclaw-state");
  await page.getByRole("button", { name: "Load local agents" }).click();
  const agentSelect = page.locator('select[name="openclawAgentId"]');
  await expect(agentSelect).toBeVisible();
  await agentSelect.selectOption("agent-1");
  await page.getByRole("button", { name: "Start trial" }).click();
  await expect(page.getByText("Scenario Result")).toBeVisible();
  await page.getByRole("link", { name: "Open replay" }).click();
  await expect(page.getByText("Replay Timeline")).toBeVisible();
});
