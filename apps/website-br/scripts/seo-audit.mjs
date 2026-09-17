#!/usr/bin/env node
/* Auditoria estática de SEO do site BR (Roda com `npm run audit:seo`).
 * Verifica invariantes sem subir servidor: sitemap x rotas x redirects,
 * JSON-LD sem Product merchant, links internos, checkout preservado. */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "src/app");
const SRC = join(ROOT, "src");
let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FALHA: ${msg}`);
};
const ok = (msg) => console.log(`ok: ${msg}`);

// 1. Sitemap: só URLs 200 (sem redirect, sem noindex)
const sitemapSrc = readFileSync(join(APP, "sitemap.ts"), "utf8");
const pagesBlock = sitemapSrc.slice(
  sitemapSrc.indexOf("const pages = ["),
  sitemapSrc.indexOf("];", sitemapSrc.indexOf("const pages = ["))
);
const nextCfg = readFileSync(join(ROOT, "next.config.ts"), "utf8");
const redirected = [...nextCfg.matchAll(/source:\s*"([^"]+)"/g)].map((m) => m[1].replace(/\/:.*$/, ""));
const noindexPages = ["checkout", "launch", "promo", "saas"];
for (const m of pagesBlock.matchAll(/"([a-z0-9\-/]+)"/g)) {
  const p = m[1];
  if (["daily", "weekly"].includes(p)) continue;
  for (const r of redirected) {
    if (p === r.replace(/^\//, "") && r !== "/:path*")
      fail(`sitemap contém URL com redirect: /${p}`);
  }
  for (const n of noindexPages) {
    if (p === n || p.startsWith(n + "/")) fail(`sitemap contém noindex: /${p}`);
  }
}
ok("sitemap sem redirect/noindex");

// 2. Toda página do sitemap existe como rota (inclui slugs de /[slug])
const slugPage = readFileSync(join(APP, "[slug]/page.tsx"), "utf8");
const knownSlugs = new Set(
  [...slugPage.matchAll(/"([a-z0-9-]+)"/g)]
    .map((m) => m[1])
    .filter((s) => s.includes("-") && s.length > 4)
);
for (const m of pagesBlock.matchAll(/"([a-z0-9\-/]+)"/g)) {
  const p = m[1];
  if (["daily", "weekly"].includes(p)) continue;
  if (!p.includes("/")) {
    const dir = p === "" ? APP : join(APP, p);
    if (!existsSync(join(dir, "page.tsx")) && !knownSlugs.has(p))
      fail(`sitemap sem rota: /${p || "/"}`);
    continue;
  }
  const dir = join(APP, p);
  if (!existsSync(join(dir, "page.tsx"))) fail(`sitemap sem page.tsx: /${p}`);
}
ok("sitemap x rotas");

// 3. JSON-LD: nenhum Product merchant (serviços => Service)
const schemas = readFileSync(join(SRC, "config/schemas.ts"), "utf8");
if (/"@type":\s*"Product"/.test(schemas)) fail("schemas.ts ainda tem Product");
if (!/"@type":\s*"Service"/.test(schemas)) fail("schemas.ts sem Service");
ok("JSON-LD sem Product merchant");

// 4. Checkout preservado: 6 slugs e CTA
const planos = readFileSync(join(APP, "planos/page.tsx"), "utf8");
for (const slug of ["site-starter", "site-pro", "site-enterprise", "ads-starter", "ads-premium", "ads-full"]) {
  if (!planos.includes(slug)) fail(`planos sem slug ${slug}`);
}
if (/annualPrice|setBilling\(.+annual|billing === "annual"/.test(planos))
  fail("planos ainda tem ciclo anual");
const checkout = readFileSync(join(APP, "checkout/[planId]/page.tsx"), "utf8");
if (!checkout.includes("knownPlan")) fail("checkout sem validação de slug");
ok("checkout preservado + honesto");

// 5. H1 únicos: /projetos via compact; /saas via headingLevel h2
const ps = readFileSync(join(SRC, "components/seo/ProjectsSection.tsx"), "utf8");
if (!ps.includes("{compact ? (")) fail("ProjectsSection sem h1 condicional");
const saas = readFileSync(join(SRC, "components/pages/SaasServiceClient.tsx"), "utf8");
if (!saas.includes('headingLevel="h2"')) fail("saas com h1 duplo");
ok("H1 únicos");

// 6. Footer cobre páginas comerciais (sem órfãs)
const footer = readFileSync(join(SRC, "components/layout/Footer.tsx"), "utf8");
for (const r of ["desenvolvimento-de-software", "desenvolvimento-de-saas", "marketing-digital"]) {
  if (!footer.includes(r)) fail(`footer sem link /${r}`);
}
ok("footer sem órfãs comerciais");

if (failures > 0) {
  console.error(`${failures} falha(s)`);
  process.exit(1);
}
console.log("auditoria SEO ok");
