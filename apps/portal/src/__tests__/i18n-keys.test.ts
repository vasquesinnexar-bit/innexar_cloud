import pt from "../../messages/pt.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

const REQUIRED: Record<string, string[]> = {
  hostingPage: ["loadError", "retry", "notFound"],
  marketplace: ["loadError", "retry", "setupPending", "hostingTitle"],
  dashboardWorkspace: ["services", "noServices"],
};

describe("i18n keys PT/EN/ES", () => {
  for (const [ns, keys] of Object.entries(REQUIRED)) {
    for (const key of keys) {
      it(`${ns}.${key} exists in pt/en/es`, () => {
        for (const [lang, dict] of Object.entries({ pt, en, es })) {
          const nsDict = ((dict as unknown as Record<string, unknown>)[ns] ?? {}) as Record<
            string,
            unknown
          >;
          expect(`${lang}.${ns}.${key}`).toBeDefined();
          expect(typeof nsDict[key]).toBe("string");
          expect((nsDict[key] as string).length).toBeGreaterThan(0);
        }
      });
    }
  }
});

describe("email connect guides", () => {
  it("connectGuides has 6 guides with steps in pt/en/es", async () => {
    for (const lang of ["pt", "en", "es"] as const) {
      const dict = (await import(`../../messages/${lang}.json`)).default as unknown as Record<
        string,
        unknown
      >;
      const emailPage = dict.emailPage as Record<string, unknown>;
      const guides = emailPage.connectGuides as { id: string; title: string; steps: string[] }[];
      expect(guides).toHaveLength(6);
      for (const g of guides) {
        expect(g.title.length).toBeGreaterThan(0);
        expect(g.steps.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
