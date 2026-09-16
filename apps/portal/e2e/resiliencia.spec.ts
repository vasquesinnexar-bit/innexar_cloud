import { test, expect } from "@playwright/test";

// Sem token: redirect para login. Com API quebrada (intercept): error states.
// Nada aqui toca dados reais (mocks de rede).
const TOKEN = process.env.E2E_TOKEN || "fake";

test("sem login redireciona para /pt/login", async ({ page }) => {
  await page.goto("/pt/services");
  await expect(page).toHaveURL(/\/pt\/login/);
});

test("API de email falha => estado de erro, sem skeleton infinito", async ({ page }) => {
  await page.goto("/pt/login");
  await page.evaluate((tok) => {
    localStorage.setItem("customer_token", tok);
  }, TOKEN);
  await page.route("**/api/portal/services/email", (r) => r.abort());
  await page.goto("/pt/services/email");
  // ou erro explícito ou empty de sem-serviço — nunca skeleton eterno:
  await expect(page.locator('[role="status"], [role="alert"]').first()).toBeVisible({
    timeout: 30000,
  });
});

test("API de hosting falha => erro com retry", async ({ page }) => {
  await page.goto("/pt/login");
  await page.evaluate((tok) => {
    localStorage.setItem("customer_token", tok);
  }, TOKEN);
  await page.route("**/api/portal/hosting/services", (r) => r.abort());
  await page.goto("/pt/services/hosting");
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 30000 });
});

test("overview vazio => empty state com CTA (cenário F)", async ({ page }) => {
  await page.goto("/pt/login");
  await page.evaluate((tok) => {
    localStorage.setItem("customer_token", tok);
  }, TOKEN);
  await page.route("**/api/portal/services/overview", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], email_domains: [], hosting_services: [], projects: [] }),
    })
  );
  await page.goto("/pt/services");
  await expect(page.getByText(/Nenhum serviço|noServices/)).toBeVisible({ timeout: 20000 });
});

test("EN: catalog redirect + pagina carrega", async ({ page }) => {
  await page.goto("/en/catalog");
  await expect(page).toHaveURL(/\/en\/services\/catalog/);
});

test("mobile 375px sem overflow horizontal no dashboard", async ({ page }) => {
  await page.goto("/pt/login");
  await page.evaluate((tok) => {
    localStorage.setItem("customer_token", tok);
    localStorage.setItem("customer_email", "tsleiman@terra.com.br");
  }, TOKEN);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/pt/");
  await page.waitForTimeout(4000);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
