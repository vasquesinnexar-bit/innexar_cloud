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
          const nsDict = (dict as Record<string, Record<string, string>>)[ns] ?? {};
          expect(`${lang}.${ns}.${key}`).toBeDefined();
          expect(typeof nsDict[key]).toBe("string");
          expect(nsDict[key].length).toBeGreaterThan(0);
        }
      });
    }
  }
});
