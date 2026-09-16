import { test, expect } from "@playwright/test";

// Sessão real do cliente 893 (somente leitura). Token via env E2E_TOKEN.
const TOKEN = process.env.E2E_TOKEN || "";

test.beforeEach(async ({ page }) => {
  await page.goto("/pt/login");
  await page.evaluate((tok) => {
    localStorage.setItem("customer_token", tok);
    localStorage.setItem("customer_email", "tsleiman@terra.com.br");
  }, TOKEN);
});

test("dashboard mostra servicos, fatura e acao pendente (893)", async ({ page }) => {
  await page.goto("/pt/");
  await expect(page.getByText("Serviços contratados")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("E-mail Profissional")).toBeVisible();
  await expect(page.getByText("Hospedagem Gerenciada")).toBeVisible();
  await expect(page.getByText("Atenção necessária")).toBeVisible();
  await expect(page.getByText(/#1755/)).toBeVisible();
});

test("meus servicos: 1 card email + hosting, setup agrupado", async ({ page }) => {
  await page.goto("/pt/services");
  await expect(page.getByText("Hospedagem Gerenciada")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Configuração inicial/)).toBeVisible();
  // 1 único card de e-mail (título aparece 1x como heading do card)
  const titles = await page.getByText("E-mail Profissional", { exact: true }).count();
  expect(titles).toBe(1);
});

test("email exibe dominio, mailbox e guia de conexao", async ({ page }) => {
  await page.goto("/pt/services/email");
  await expect(page.getByText("contato@touficsleiman.com.br").first()).toBeVisible({
    timeout: 25000,
  });
  await expect(page.getByText("mail.touficsleiman.com.br").first()).toBeVisible();
});

test("hosting lista + detalhe 31", async ({ page }) => {
  await page.goto("/pt/services/hosting");
  await expect(page.getByText("touficsleiman.com.br")).toBeVisible({ timeout: 20000 });
  await page.getByText("touficsleiman.com.br").click();
  await expect(page).toHaveURL(/\/pt\/services\/hosting\/31/);
});

test("billing mostra fatura 401 BRL sem contradicao", async ({ page }) => {
  await page.goto("/pt/billing");
  await expect(page.getByText(/1755/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/R\$.*100/)).toBeVisible();
});

test("contracts lista + detalhe 40", async ({ page }) => {
  await page.goto("/pt/contracts");
  const link = page.locator('a[href="/pt/contracts/40"]');
  await expect(link).toBeVisible({ timeout: 20000 });
  await link.click();
  await expect(page.getByText("E-mail Profissional")).toBeVisible();
});
