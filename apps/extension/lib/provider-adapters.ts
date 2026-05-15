import type {
  AccountProfilePayload,
  BetPayload,
  OddsPayload,
  SnapshotPayload
} from "./collector-types";

const GENERIC_ODD_SELECTORS = [
  '[data-odds]',
  '[data-odd]',
  '[data-price]',
  '[data-testid*="odd"]',
  '[data-testid*="odds"]',
  '[class*="odd"]',
  '[class*="price"]',
  '[class*="selection"] [class*="value"]',
  '[class*="market"] [class*="value"]',
  "button",
  '[role="button"]'
];

const PROVIDER_ODD_SELECTORS: Record<string, string[]> = {
  betano: [
    '[data-qa="pre-event-selection"]',
    '[data-qa*="odds"]',
    '[class*="selections__selection"]'
  ],
  sportingbet: [
    '[data-testid*="selection"]',
    '[class*="selectionButton"]',
    '[class*="outcome"]'
  ],
  bet365: [
    '[class*="srb-ParticipantLabel"]',
    '[class*="gl-Participant"]',
    '[class*="ovm-Selection"]'
  ],
  superbet: [
    '[data-testid*="odd"]',
    '[class*="market-selection"]',
    '[class*="selection-odd"]'
  ]
};

const CONTEXT_EVENT_SELECTORS = [
  "[data-event-name]",
  '[data-testid*="event"]',
  '[class*="event-name"]',
  '[class*="event"] [class*="name"]',
  "h1",
  "h2",
  "h3"
];

const CONTEXT_MARKET_SELECTORS = [
  "[data-market]",
  '[data-testid*="market"]',
  '[class*="market-name"]',
  '[class*="market"] [class*="name"]'
];

const CONTEXT_SELECTION_SELECTORS = [
  "[data-selection]",
  '[data-testid*="selection"]',
  '[class*="selection-name"]',
  '[class*="outcome-name"]'
];

function readText(doc: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    const value = element?.textContent?.trim();
    if (value) return value;
  }
  return null;
}

function parseCurrencyToCents(value: string | null): number | null {
  if (!value) return null;

  const numeric = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(numeric);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

function parseOddValue(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return null;
  if (parsed < 1.01 || parsed > 1000) return null;
  return parsed;
}

function detectProvider(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname.toLowerCase();
  return parts[parts.length - 3].toLowerCase();
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function readElementText(element: Element | null): string | null {
  return normalizeText(element?.textContent);
}

function findClosestContextText(
  element: HTMLElement,
  selectors: string[]
): string | null {
  for (const selector of selectors) {
    const byClosest = element.closest(selector);
    const closestValue = readElementText(byClosest);
    if (closestValue) return closestValue;

    const byParent = element.parentElement?.querySelector(selector);
    const parentValue = readElementText(byParent ?? null);
    if (parentValue) return parentValue;
  }

  return null;
}

function extractOddFromLabel(value: string | null): number | null {
  if (!value) return null;
  const matches = value.match(/\d{1,4}(?:[.,]\d{1,3})?/g);
  if (!matches) return null;

  for (const match of matches) {
    const oddValue = parseOddValue(match);
    if (oddValue !== null) return oddValue;
  }

  return null;
}

function buildOddsSelectorList(providerSlug: string): string[] {
  const providerSelectors = PROVIDER_ODD_SELECTORS[providerSlug] ?? [];
  return [...providerSelectors, ...GENERIC_ODD_SELECTORS];
}

function collectAccountProfile(doc: Document): AccountProfilePayload | null {
  const username = readText(doc, [
    '[data-testid*="user"]',
    '[class*="user-name"]',
    '[class*="username"]',
    '[class*="account-name"]'
  ]);

  const balanceLabel = readText(doc, [
    '[data-testid*="balance"]',
    '[class*="balance"]',
    '[class*="saldo"]'
  ]);

  if (!username && !balanceLabel) {
    return null;
  }

  return {
    username,
    balanceCents: parseCurrencyToCents(balanceLabel),
    balanceCurrency: balanceLabel?.includes("R$") ? "BRL" : null,
    rawPayload: {
      usernameLabel: username,
      balanceLabel
    }
  };
}

function collectOdds(doc: Document, providerSlug: string): OddsPayload[] {
  const selectors = buildOddsSelectorList(providerSlug);
  const uniqueElements = new Set<HTMLElement>();

  for (const selector of selectors) {
    const matches = doc.querySelectorAll<HTMLElement>(selector);
    for (const element of matches) {
      if (uniqueElements.size >= 250) break;
      uniqueElements.add(element);
    }

    if (uniqueElements.size >= 250) break;
  }

  const dedupe = new Set<string>();
  const collected: OddsPayload[] = [];

  for (const element of uniqueElements) {
    const labelCandidates = [
      normalizeText(element.getAttribute("data-odds")),
      normalizeText(element.getAttribute("data-odd")),
      normalizeText(element.getAttribute("data-price")),
      normalizeText(element.getAttribute("aria-label")),
      normalizeText(element.getAttribute("title")),
      normalizeText(element.textContent)
    ].filter((item): item is string => Boolean(item));

    let oddValue: number | null = null;
    let sourceLabel: string | null = null;

    for (const candidate of labelCandidates) {
      oddValue = extractOddFromLabel(candidate);
      if (oddValue !== null) {
        sourceLabel = candidate;
        break;
      }
    }

    if (oddValue === null) {
      continue;
    }

    const selection =
      findClosestContextText(element, CONTEXT_SELECTION_SELECTORS) ??
      normalizeText(element.textContent);
    const market = findClosestContextText(element, CONTEXT_MARKET_SELECTORS);
    const eventName = findClosestContextText(element, CONTEXT_EVENT_SELECTORS);

    const dedupeKey = [
      oddValue.toFixed(3),
      selection ?? "",
      market ?? "",
      eventName ?? ""
    ].join("|");

    if (dedupe.has(dedupeKey)) {
      continue;
    }

    dedupe.add(dedupeKey);
    collected.push({
      eventName,
      market,
      selection,
      oddValue,
      rawPayload: {
        providerSlug,
        selectorTag: element.tagName,
        className: element.className,
        sourceLabel,
        text: normalizeText(element.textContent)
      }
    });
  }

  return collected;
}

function collectBets(doc: Document): BetPayload[] {
  const rows = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[data-testid*="bet"], [class*="bet-item"], [class*="bet-row"], [class*="histor"] li'
    )
  ).slice(0, 50);

  return rows.map((row) => {
    const rowText = row.textContent?.trim() ?? "";

    return {
      betslipId: row.getAttribute("data-bet-id"),
      market: null,
      selection: rowText.slice(0, 180) || null,
      stakeCents: null,
      oddValue: null,
      status: null,
      placedAt: null,
      rawPayload: {
        className: row.className,
        text: rowText
      }
    } satisfies BetPayload;
  });
}

export function collectSnapshotFromPage(
  doc: Document,
  location: Location
): SnapshotPayload {
  const providerSlug = detectProvider(location.hostname);
  const odds = collectOdds(doc, providerSlug);

  return {
    providerSlug,
    pageTitle: doc.title,
    pageUrl: location.href,
    accountProfile: collectAccountProfile(doc),
    bets: collectBets(doc),
    odds,
    rawPayload: {
      hostname: location.hostname,
      observedAt: new Date().toISOString(),
      oddsCount: odds.length,
      domStats: {
        links: doc.querySelectorAll("a").length,
        forms: doc.querySelectorAll("form").length
      }
    }
  };
}
