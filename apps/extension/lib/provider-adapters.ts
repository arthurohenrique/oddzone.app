import type {
  AccountProfilePayload,
  FootballOddPayload,
  SnapshotPayload,
  UserBetPayload
} from "./collector-types";

const ODD_ELEMENT_SELECTORS = [
  '[data-odds]',
  '[data-odd]',
  '[data-price]',
  '[data-testid*="odd"]',
  '[data-testid*="selection"]',
  '[data-qa*="selection"]',
  '[data-qa*="odds"]',
  '[class*="selection"]',
  '[class*="odd"]',
  '[class*="price"]',
  'button[aria-label]',
  '[role="button"][aria-label]'
];

const KNOWN_LEAGUES = [
  "brasileirao",
  "brasileirão",
  "serie a",
  "serie b",
  "serie c",
  "serie d",
  "copa do brasil",
  "libertadores",
  "sul-americana",
  "sudamericana",
  "premier league",
  "championship",
  "la liga",
  "laliga",
  "bundesliga",
  "ligue 1",
  "champions league",
  "europa league",
  "conference league",
  "mundial",
  "world cup",
  "copa do mundo",
  "uefa",
  "fifa",
  "carioca",
  "paulista",
  "gaucho",
  "mineiro",
  "gaúcho",
  "eredivisie",
  "primeira liga",
  "saudi pro",
  "mls",
  "j-league",
  "j1 league"
];

const FOOTBALL_MARKET_KEYWORDS = [
  "ambos marcam",
  "ambas marcam",
  "btts",
  "both teams to score",
  "escanteios",
  "corners",
  "cartões",
  "cartoes",
  "cards",
  "handicap asiático",
  "handicap asiatico",
  "asian handicap",
  "resultado final",
  "1x2",
  "match result",
  "full time result",
  "total de gols",
  "total goals",
  "gols acima",
  "gols abaixo",
  "over goals",
  "under goals",
  "primeiro tempo",
  "first half",
  "segundo tempo",
  "second half",
  "intervalo",
  "ht/ft",
  "dupla chance",
  "double chance",
  "marcador correto",
  "correct score",
  "placar exato",
  "draw no bet",
  "empate anula"
];

const FOOTBALL_URL_KEYWORDS = [
  "futebol",
  "soccer",
  "football"
];

const FOOTBALL_BREADCRUMB_KEYWORDS = ["futebol", "soccer", "football"];

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizedLower(value: string | null): string {
  return (value ?? "").toLowerCase();
}

function readElementText(element: Element | null): string | null {
  return normalizeText(element?.textContent);
}

function parseCurrencyToCents(value: string | null): {
  cents: number | null;
  currency: string | null;
} {
  if (!value) return { cents: null, currency: null };

  const currency = value.includes("R$")
    ? "BRL"
    : value.includes("US$") || value.includes("USD")
      ? "USD"
      : value.includes("€") || value.includes("EUR")
        ? "EUR"
        : null;

  const numeric = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(numeric);
  if (Number.isNaN(parsed)) return { cents: null, currency };
  return { cents: Math.round(parsed * 100), currency };
}

function parseOddValue(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) return null;
  if (parsed < 1.01 || parsed > 1000) return null;
  return parsed;
}

function detectBookmaker(hostname: string): string {
  const parts = hostname.toLowerCase().split(".");
  if (parts.length <= 2) return hostname.toLowerCase();
  return parts[parts.length - 3];
}

function findClosest(element: Element, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const found = element.closest<HTMLElement>(selector);
    if (found) return found;
  }
  return null;
}

function readClosestText(element: Element, selectors: string[]): string | null {
  for (const selector of selectors) {
    const found = element.closest<HTMLElement>(selector);
    const text = readElementText(found);
    if (text) return text;

    const sibling = element.parentElement?.querySelector<HTMLElement>(selector);
    const siblingText = readElementText(sibling ?? null);
    if (siblingText) return siblingText;
  }
  return null;
}

function readPageText(doc: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    const value = readElementText(element);
    if (value) return value;
  }
  return null;
}

function readEmail(doc: Document): string | null {
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[data-testid*="email"], [class*="email"], [data-testid*="user"], [class*="account"], [class*="profile"]'
    )
  );

  for (const element of candidates) {
    const text = readElementText(element);
    if (!text) continue;
    const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (match) return match[0].toLowerCase();
  }

  const bodyText = doc.body?.textContent ?? "";
  const fallback = bodyText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return fallback ? fallback[0].toLowerCase() : null;
}

function collectAccount(doc: Document): AccountProfilePayload | null {
  const displayName = readPageText(doc, [
    '[data-testid*="user-name"]',
    '[data-testid*="username"]',
    '[class*="user-name"]',
    '[class*="username"]',
    '[class*="account-name"]',
    '[class*="profile-name"]'
  ]);

  const balanceText = readPageText(doc, [
    '[data-testid*="balance"]',
    '[class*="balance"]',
    '[class*="saldo"]',
    '[aria-label*="saldo"]',
    '[aria-label*="balance"]'
  ]);

  const email = readEmail(doc);
  const { cents, currency } = parseCurrencyToCents(balanceText);

  if (!displayName && !email && cents === null) {
    return null;
  }

  return {
    email,
    displayName,
    balanceCents: cents,
    currency
  };
}

function detectFootballSignals(
  doc: Document,
  location: Location
): { urlSignal: boolean; breadcrumbSignal: boolean; pageHeaderSignal: boolean } {
  const urlLower = location.href.toLowerCase();
  const urlSignal = FOOTBALL_URL_KEYWORDS.some((keyword) =>
    urlLower.includes(keyword)
  );

  const breadcrumbCandidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[class*="breadcrumb"], nav, [class*="sport-menu"], [class*="sports-menu"], [aria-current="page"], [class*="active"]'
    )
  ).slice(0, 40);

  const breadcrumbSignal = breadcrumbCandidates.some((element) => {
    const text = normalizedLower(readElementText(element));
    return FOOTBALL_BREADCRUMB_KEYWORDS.some((keyword) => text.includes(keyword));
  });

  const pageTitleSignal = FOOTBALL_BREADCRUMB_KEYWORDS.some((keyword) =>
    doc.title.toLowerCase().includes(keyword)
  );

  return {
    urlSignal,
    breadcrumbSignal,
    pageHeaderSignal: pageTitleSignal
  };
}

type EventCardContext = {
  card: HTMLElement | null;
  eventName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  market: string | null;
  league: string | null;
  hasOneXTwo: boolean;
};

function findEventCard(element: Element): HTMLElement | null {
  return findClosest(element, [
    '[data-testid*="event"]',
    '[class*="event-card"]',
    '[class*="match-card"]',
    '[class*="event-row"]',
    '[class*="match-row"]',
    '[class*="grid-event"]',
    '[class*="EventRow"]',
    '[class*="Event-"]',
    '[class*="fixture"]'
  ]);
}

function parseTeams(text: string | null): {
  home: string | null;
  away: string | null;
} {
  if (!text) return { home: null, away: null };
  const separators = [" vs ", " x ", " v ", " - "];
  for (const sep of separators) {
    const lower = text.toLowerCase();
    const index = lower.indexOf(sep);
    if (index > 0) {
      const home = text.slice(0, index).trim();
      const away = text.slice(index + sep.length).trim();
      if (home && away && home.length < 80 && away.length < 80) {
        return { home, away };
      }
    }
  }
  return { home: null, away: null };
}

function detectLeague(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const league of KNOWN_LEAGUES) {
    if (lower.includes(league)) return league;
  }
  return null;
}

function detectOneXTwo(card: HTMLElement | null): boolean {
  if (!card) return false;
  const labels = Array.from(
    card.querySelectorAll<HTMLElement>(
      '[aria-label], [data-selection], [class*="selection"], button'
    )
  )
    .map((element) =>
      normalizedLower(
        element.getAttribute("aria-label") ??
          element.getAttribute("data-selection") ??
          element.textContent
      )
    )
    .filter((value) => value.length > 0 && value.length < 50);

  const hasHome = labels.some(
    (label) => label === "1" || label.includes("casa") || label.includes("home")
  );
  const hasDraw = labels.some(
    (label) =>
      label === "x" ||
      label.includes("empate") ||
      label.includes("draw") ||
      label === "tie"
  );
  const hasAway = labels.some(
    (label) => label === "2" || label.includes("fora") || label.includes("away")
  );

  return hasHome && hasDraw && hasAway;
}

function detectMarketFromContext(element: Element): string | null {
  return readClosestText(element, [
    "[data-market]",
    '[data-testid*="market"]',
    '[class*="market-name"]',
    '[class*="market-title"]',
    '[class*="market"] [class*="name"]'
  ]);
}

function buildEventContext(element: Element): EventCardContext {
  const card = findEventCard(element);
  const eventName = card
    ? readPageText(card.ownerDocument as Document, [
        '[data-event-name]',
        '[data-testid*="event-name"]',
        '[class*="event-name"]',
        '[class*="match-name"]',
        "h1",
        "h2",
        "h3"
      ]) ?? readElementText(card)
    : null;

  const { home, away } = parseTeams(eventName);
  const market = detectMarketFromContext(element);
  const league =
    detectLeague(eventName) ??
    detectLeague(readClosestText(element, ['[class*="league"]', '[class*="competition"]', '[class*="tournament"]']));

  return {
    card,
    eventName: eventName ? eventName.slice(0, 200) : null,
    homeTeam: home,
    awayTeam: away,
    market,
    league,
    hasOneXTwo: detectOneXTwo(card)
  };
}

function marketSignalsFootball(market: string | null): boolean {
  if (!market) return false;
  const lower = market.toLowerCase();
  return FOOTBALL_MARKET_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function buildConfidenceScore(
  context: EventCardContext,
  pageSignals: ReturnType<typeof detectFootballSignals>
): number {
  let score = 0;
  if (pageSignals.urlSignal) score += 1;
  if (pageSignals.breadcrumbSignal) score += 1;
  if (pageSignals.pageHeaderSignal) score += 1;
  if (marketSignalsFootball(context.market)) score += 2;
  if (context.hasOneXTwo) score += 2;
  if (context.league) score += 1;
  if (context.homeTeam && context.awayTeam) score += 1;
  return score;
}

function extractOddFromElement(element: HTMLElement): {
  value: number | null;
  selection: string | null;
} {
  const labels = [
    element.getAttribute("data-odds"),
    element.getAttribute("data-odd"),
    element.getAttribute("data-price"),
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent
  ]
    .map(normalizeText)
    .filter((value): value is string => Boolean(value));

  for (const candidate of labels) {
    const matches = candidate.match(/\d{1,4}(?:[.,]\d{1,3})?/g);
    if (!matches) continue;
    for (const match of matches) {
      const odd = parseOddValue(match);
      if (odd !== null) {
        return {
          value: odd,
          selection:
            normalizeText(element.getAttribute("aria-label")) ??
            normalizeText(element.getAttribute("data-selection")) ??
            candidate
        };
      }
    }
  }

  return { value: null, selection: null };
}

function collectFootballOdds(
  doc: Document,
  location: Location
): FootballOddPayload[] {
  const pageSignals = detectFootballSignals(doc, location);
  const elements = new Set<HTMLElement>();

  for (const selector of ODD_ELEMENT_SELECTORS) {
    if (elements.size >= 400) break;
    for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
      elements.add(element);
      if (elements.size >= 400) break;
    }
  }

  const dedupe = new Set<string>();
  const collected: FootballOddPayload[] = [];

  for (const element of elements) {
    const { value, selection } = extractOddFromElement(element);
    if (value === null) continue;

    const context = buildEventContext(element);
    const confidenceScore = buildConfidenceScore(context, pageSignals);

    if (confidenceScore < 2) continue;

    const dedupeKey = [
      value.toFixed(3),
      selection ?? "",
      context.market ?? "",
      context.eventName ?? ""
    ].join("|");
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    collected.push({
      league: context.league,
      eventName: context.eventName,
      homeTeam: context.homeTeam,
      awayTeam: context.awayTeam,
      market: context.market,
      selection: selection ? selection.slice(0, 120) : null,
      oddValue: value,
      confidenceScore
    });
  }

  return collected;
}

function collectUserBets(doc: Document): UserBetPayload[] {
  const rows = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[data-testid*="bet-history"] [class*="row"], [class*="bet-history"] [class*="row"], [class*="my-bets"] [class*="row"], [data-testid*="open-bets"] [class*="row"], [class*="betslip-history"] [class*="row"]'
    )
  ).slice(0, 50);

  return rows
    .map((row): UserBetPayload | null => {
      const eventName = readPageText(row.ownerDocument as Document, [
        '[class*="event"]',
        '[class*="match"]',
        '[data-event]'
      ]);

      const market = readElementText(row.querySelector('[class*="market"]'));
      const selection = readElementText(row.querySelector('[class*="selection"]'));
      const stakeText = readElementText(row.querySelector('[class*="stake"]'));
      const oddText = readElementText(row.querySelector('[class*="odd"]'));
      const returnText = readElementText(
        row.querySelector('[class*="return"], [class*="potential"], [class*="payout"]')
      );
      const status = readElementText(row.querySelector('[class*="status"]'));

      const { cents: stakeCents } = parseCurrencyToCents(stakeText);
      const { cents: returnCents } = parseCurrencyToCents(returnText);
      const oddValue = parseOddValue(oddText);

      const rowText = row.textContent?.trim() ?? "";
      if (!rowText) return null;

      return {
        betslipId: row.getAttribute("data-bet-id") ?? row.getAttribute("data-id"),
        league: detectLeague(eventName),
        eventName: eventName ? eventName.slice(0, 200) : null,
        market,
        selection: selection ?? rowText.slice(0, 180),
        stakeCents,
        oddValue,
        potentialReturnCents: returnCents,
        status,
        placedAt: null
      };
    })
    .filter((bet): bet is UserBetPayload => bet !== null);
}

export function collectSnapshotFromPage(
  doc: Document,
  location: Location
): SnapshotPayload {
  const bookmaker = detectBookmaker(location.hostname);

  return {
    bookmaker,
    pageUrl: location.href,
    account: collectAccount(doc),
    odds: collectFootballOdds(doc, location),
    bets: collectUserBets(doc)
  };
}
