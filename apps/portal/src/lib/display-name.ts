function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

function splitGluedName(input: string): string {
  const lower = input.toLowerCase();
  const commonSuffixes = [
    "silva",
    "santos",
    "oliveira",
    "souza",
    "costa",
    "pereira",
    "rodrigues",
    "almeida",
    "ferreira",
    "ribeiro",
    "carvalho",
    "gomes",
    "lima",
    "martins",
    "barbosa",
    "rocha",
    "dias",
    "teixeira",
    "mendes",
    "nunes",
    "moreira",
    "cardoso",
    "araujo",
    "vasques",
    "vaz",
  ];

  for (const suffix of commonSuffixes) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
      const first = input.slice(0, input.length - suffix.length);
      const last = input.slice(input.length - suffix.length);
      return `${first} ${last}`;
    }
  }
  return input;
}

export function formatCustomerDisplayName(raw: string | null | undefined): string {
  const source = (raw || "").trim();
  if (!source) return "";

  const base = source.includes("@") ? source.split("@")[0] : source;
  const noTrailingDigits = base.replace(/\d+$/g, "").trim();
  const separated = noTrailingDigits
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  const normalized = splitGluedName(separated || base);
  return titleCase(normalized);
}
