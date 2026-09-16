import { test } from "@playwright/test";
const TOKEN = process.env.E2E_TOKEN || "";
test("debug email", async ({ page }) => {
  await page.goto("/pt/login");
  await page.evaluate((tok) => {
    localStorage.setItem("customer_token", tok);
    localStorage.setItem("customer_email", "tsleiman@terra.com.br");
  }, TOKEN);
  await page.goto("/pt/services/email");
  await page.waitForTimeout(12000);
  console.log("URL:", page.url());
  const main = await page.locator("main").innerHTML().catch(() => "NO-MAIN");
  console.log("MAIN-LEN:", main.length);
  console.log("MAIN:", main.slice(0, 800));
});
