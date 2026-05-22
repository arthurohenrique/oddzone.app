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

const EVENT_CARD_SELECTORS = [
  '[data-testid*="event"]',
  '[data-event-id]',
  '[data-fixture-id]',
  '[class*="event-card"]',
  '[class*="EventCard"]',
  '[class*="match-card"]',
  '[class*="MatchCard"]',
  '[class*="event-row"]',
  '[class*="EventRow"]',
  '[class*="match-row"]',
  '[class*="MatchRow"]',
  '[class*="grid-event"]',
  '[class*="Event-"]',
  '[class*="fixture"]',
  '[class*="Fixture"]'
];

const EVENT_NAME_ATTRS = [
  "data-event-name",
  "data-event",
  "data-fixture-name",
  "data-match-name"
];

const TEAM_SELECTORS = [
  "[data-home-team]",
  "[data-away-team]",
  '[class*="team-name"]',
  '[class*="TeamName"]',
  '[class*="participant-name"]',
  '[class*="ParticipantName"]',
  '[class*="competitor"]',
  '[class*="Competitor"]',
  '[class*="team"]'
];

const MARKET_LABEL_SELECTORS = [
  "[data-market-name]",
  "[data-market]",
  '[data-testid*="market-name"]',
  '[data-testid*="market-title"]',
  '[class*="market-name"]',
  '[class*="MarketName"]',
  '[class*="market-title"]',
  '[class*="MarketTitle"]',
  '[class*="market-header"]',
  '[class*="MarketHeader"]'
];

const LEAGUE_SELECTORS = [
  "[data-league-name]",
  "[data-competition-name]",
  '[class*="league-name"]',
  '[class*="LeagueName"]',
  '[class*="competition-name"]',
  '[class*="CompetitionName"]',
  '[class*="tournament-name"]',
  '[class*="TournamentName"]',
  '[class*="league-header"]',
  '[class*="competition-header"]'
];

const MARKET_CONTAINER_SELECTORS = [
  '[class*="market-group"]',
  '[class*="MarketGroup"]',
  '[class*="market-container"]',
  '[class*="MarketContainer"]',
  '[class*="market-section"]',
  '[class*="market"]'
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
  "j1 league",
  "copa america",
  "copa do nordeste",
  "estaduais"
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
  "vencedor da partida",
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
  "empate anula",
  "vencedor",
  "para vencer"
];

const FOOTBALL_URL_KEYWORDS = ["futebol", "soccer", "football"];
const FOOTBALL_BREADCRUMB_KEYWORDS = ["futebol", "soccer", "football"];

const TEAM_SEPARATORS = [" vs ", " x ", " v ", " - ", " — ", " – "];

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

function readWithin(scope: Element | null, selectors: string[]): string | null {
  if (!scope) return null;
  for (const selector of selectors) {
    const found = scope.querySelector(selector);
    const text = readElementText(found);
    if (text) return text;
  }
  return null;
}

function readAttrWithin(scope: Element | null, attrs: string[]): string | null {
  if (!scope) return null;
  for (const attr of attrs) {
    const value = scope.getAttribute(attr);
    if (value && value.trim().length > 0) return normalizeText(value);
    const inner = scope.querySelector(`[${attr}]`);
    const innerValue = inner?.getAttribute(attr);
    if (innerValue && innerValue.trim().length > 0) return normalizeText(innerValue);
  }
  return null;
}

function findClosest(element: Element, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const found = element.closest<HTMLElement>(selector);
    if (found) return found;
  }
  return null;
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

function detectLeagueInText(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const league of KNOWN_LEAGUES) {
    if (lower.includes(league)) return league;
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
  const displayName = readWithin(doc.body, [
    '[data-testid*="user-name"]',
    '[data-testid*="username"]',
    '[class*="user-name"]',
    '[class*="username"]',
    '[class*="account-name"]',
    '[class*="profile-name"]'
  ]);

  const balanceText = readWithin(doc.body, [
    '[data-testid*="balance"]',
    '[class*="balance"]',
    '[class*="saldo"]',
    '[aria-label*="saldo"]',
    '[aria-label*="balance"]'
  ]);

  const email = readEmail(doc);
  const { cents, currency } = parseCurrencyToCents(balanceText);

  if (!displayName && !email && cents === null) return null;

  return { email, displayName, balanceCents: cents, currency };
}

function detectPageSignals(
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

  const pageHeaderSignal = FOOTBALL_BREADCRUMB_KEYWORDS.some((keyword) =>
    doc.title.toLowerCase().includes(keyword)
  );

  return { urlSignal, breadcrumbSignal, pageHeaderSignal };
}

// --- Estratégias de extração (em camadas) ---

function extractTeamsFromText(text: string | null): {
  home: string | null;
  away: string | null;
} {
  if (!text) return { home: null, away: null };
  for (const sep of TEAM_SEPARATORS) {
    const lower = text.toLowerCase();
    const index = lower.indexOf(sep);
    if (index > 0) {
      const home = text.slice(0, index).trim();
      const away = text.slice(index + sep.length).trim();
      if (
        home && away &&
        home.length >= 2 && home.length < 60 &&
        away.length >= 2 && away.length < 60 &&
        // descartar coisas que claramente não são nomes de time
        !/\d{2}:\d{2}/.test(home) && !/\d{2}:\d{2}/.test(away)
      ) {
        return { home, away };
      }
    }
  }
  return { home: null, away: null };
}

function extractTeamsFromStructure(card: HTMLElement | null): {
  home: string | null;
  away: string | null;
} {
  if (!card) return { home: null, away: null };

  // Atributos diretos
  const homeAttr = normalizeText(card.querySelector("[data-home-team]")?.getAttribute("data-home-team"));
  const awayAttr = normalizeText(card.querySelector("[data-away-team]")?.getAttribute("data-away-team"));
  if (homeAttr && awayAttr) return { home: homeAttr, away: awayAttr };

  // Dois elementos de time vizinhos
  for (const selector of TEAM_SELECTORS) {
    const elements = Array.from(card.querySelectorAll<HTMLElement>(selector));
    if (elements.length >= 2) {
      const home = readElementText(elements[0]);
      const away = readElementText(elements[1]);
      if (
        home && away &&
        home !== away &&
        home.length < 60 && away.length < 60
      ) {
        return { home, away };
      }
    }
  }

  return { home: null, away: null };
}

function extractEventName(card: HTMLElement | null): {
  eventName: string | null;
  home: string | null;
  away: string | null;
} {
  if (!card) return { eventName: null, home: null, away: null };

  // 1. Atributo direto no card ou descendente
  const attrName = readAttrWithin(card, EVENT_NAME_ATTRS);
  if (attrName) {
    const { home, away } = extractTeamsFromText(attrName);
    return { eventName: attrName, home, away };
  }

  // 2. Estrutura: dois elementos de time
  const structured = extractTeamsFromStructure(card);
  if (structured.home && structured.away) {
    return {
      eventName: `${structured.home} vs ${structured.away}`,
      home: structured.home,
      away: structured.away
    };
  }

  // 3. Cabeçalho do card (limitado ao escopo do card)
  const headerText = readWithin(card, [
    '[data-testid*="event-name"]',
    '[data-testid*="match-name"]',
    '[data-testid*="fixture-name"]',
    '[class*="event-name"]',
    '[class*="EventName"]',
    '[class*="match-name"]',
    '[class*="MatchName"]',
    '[class*="fixture-name"]',
    "h1",
    "h2",
    "h3",
    "h4"
  ]);
  if (headerText) {
    const { home, away } = extractTeamsFromText(headerText);
    if (home && away) return { eventName: headerText, home, away };
  }

  return { eventName: null, home: null, away: null };
}

function extractMarket(element: Element, card: HTMLElement | null): string | null {
  // 1. Atributo direto
  const dataMarket =
    element.getAttribute("data-market-name") ??
    element.getAttribute("data-market");
  if (dataMarket && dataMarket.trim()) return normalizeText(dataMarket);

  // 2. Container de mercado mais próximo
  const marketContainer = findClosest(element, MARKET_CONTAINER_SELECTORS);
  if (marketContainer) {
    const labelInContainer = readWithin(marketContainer, MARKET_LABEL_SELECTORS);
    if (labelInContainer) return labelInContainer;
  }

  // 3. Label no card
  if (card) {
    const labelInCard = readWithin(card, MARKET_LABEL_SELECTORS);
    if (labelInCard) return labelInCard;
  }

  // 4. Sibling acima com classe header
  let parent = element.parentElement;
  let safety = 0;
  while (parent && safety < 6) {
    const header = parent.querySelector<HTMLElement>(
      '[class*="market-header"], [class*="market-title"], [class*="MarketHeader"], [class*="MarketTitle"]'
    );
    const headerText = readElementText(header);
    if (headerText) return headerText;
    parent = parent.parentElement;
    safety += 1;
  }

  return null;
}

function extractLeague(card: HTMLElement | null): string | null {
  if (!card) return null;

  // 1. Atributo direto
  const attr =
    card.getAttribute("data-league-name") ??
    card.getAttribute("data-competition-name");
  if (attr && attr.trim()) return normalizeText(attr);

  // 2. Subir N níveis procurando header de liga
  let scope: Element | null = card;
  let safety = 0;
  while (scope && safety < 6) {
    const text = readWithin(scope as HTMLElement, LEAGUE_SELECTORS);
    if (text) return text;
    scope = scope.parentElement;
    safety += 1;
  }

  // 3. Casar texto do card contra lista conhecida
  const known = detectLeagueInText(readElementText(card));
  if (known) return known;

  return null;
}

function extractSelectionLabel(element: HTMLElement): string | null {
  const candidates = [
    element.getAttribute("aria-label"),
    element.getAttribute("data-selection-name"),
    element.getAttribute("data-selection"),
    element.getAttribute("title"),
    element.textContent
  ].map(normalizeText);

  for (const candidate of candidates) {
    if (!candidate) continue;
    // Filtra labels muito longas (provavelmente texto técnico)
    if (candidate.length < 120 && !/^\d+([.,]\d+)?$/.test(candidate)) {
      return candidate.length > 80 ? candidate.slice(0, 80) : candidate;
    }
  }

  return null;
}

// Tenta parsear toda a info de um aria-label rico (muitas casas colocam tudo lá)
function parseAriaLabel(
  label: string | null
): { home: string | null; away: string | null; market: string | null; selection: string | null } {
  if (!label) return { home: null, away: null, market: null, selection: null };

  const { home, away } = extractTeamsFromText(label);
  let market: string | null = null;
  for (const keyword of FOOTBALL_MARKET_KEYWORDS) {
    if (label.toLowerCase().includes(keyword)) {
      market = keyword;
      break;
    }
  }

  // Seleção heurística: parte antes de "odds" / "cotação"
  const splitMatch = label.match(/^(.*?)(?:\s*[-,.]\s*odds?|\s*[-,.]\s*cota[çc][aã]o)/i);
  const selection = splitMatch ? normalizeText(splitMatch[1]) : null;

  return { home, away, market, selection };
}

// --- Detecção de 1X2 (sinal forte de futebol) ---

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

function marketSignalsFootball(market: string | null): boolean {
  if (!market) return false;
  const lower = market.toLowerCase();
  return FOOTBALL_MARKET_KEYWORDS.some((keyword) => lower.includes(keyword));
}

// --- Coleta principal ---

type OddCandidate = {
  oddValue: number;
  selection: string | null;
  ariaLabel: string | null;
  card: HTMLElement | null;
  element: HTMLElement;
};

function extractOddCandidate(element: HTMLElement): OddCandidate | null {
  const labels = [
    element.getAttribute("data-odds"),
    element.getAttribute("data-odd"),
    element.getAttribute("data-price"),
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent
  ].map(normalizeText);

  let oddValue: number | null = null;
  for (const candidate of labels) {
    if (!candidate) continue;
    const matches = candidate.match(/\d{1,4}(?:[.,]\d{1,3})?/g);
    if (!matches) continue;
    for (const match of matches) {
      const odd = parseOddValue(match);
      if (odd !== null) {
        oddValue = odd;
        break;
      }
    }
    if (oddValue !== null) break;
  }

  if (oddValue === null) return null;

  return {
    oddValue,
    selection: extractSelectionLabel(element),
    ariaLabel: normalizeText(element.getAttribute("aria-label")),
    card: findClosest(element, EVENT_CARD_SELECTORS),
    element
  };
}

type CaptureStats = {
  rawCandidates: number;
  withOdd: number;
  withFullContext: number;
  droppedNoContext: number;
  droppedLowScore: number;
};

function collectFootballOdds(
  doc: Document,
  location: Location,
  stats: CaptureStats
): FootballOddPayload[] {
  const pageSignals = detectPageSignals(doc, location);
  const elements = new Set<HTMLElement>();

  for (const selector of ODD_ELEMENT_SELECTORS) {
    if (elements.size >= 500) break;
    for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
      elements.add(element);
      if (elements.size >= 500) break;
    }
  }

  stats.rawCandidates = elements.size;

  const dedupe = new Set<string>();
  const collected: FootballOddPayload[] = [];

  for (const element of elements) {
    const candidate = extractOddCandidate(element);
    if (!candidate) continue;
    stats.withOdd += 1;

    const card = candidate.card;
    const fromCard = extractEventName(card);
    const fromAria = parseAriaLabel(candidate.ariaLabel);

    const eventName = fromCard.eventName ?? (fromAria.home && fromAria.away ? `${fromAria.home} vs ${fromAria.away}` : null);
    const homeTeam = fromCard.home ?? fromAria.home;
    const awayTeam = fromCard.away ?? fromAria.away;
    const market = extractMarket(element, card) ?? fromAria.market;
    const league = extractLeague(card);
    const selection = candidate.selection ?? fromAria.selection;
    const hasOneXTwo = detectOneXTwo(card);

    // Filtro estrito: descartar sem contexto mínimo
    if (!eventName || !market) {
      stats.droppedNoContext += 1;
      continue;
    }

    // Score híbrido
    let score = 0;
    if (pageSignals.urlSignal) score += 1;
    if (pageSignals.breadcrumbSignal) score += 1;
    if (pageSignals.pageHeaderSignal) score += 1;
    if (marketSignalsFootball(market)) score += 2;
    if (hasOneXTwo) score += 2;
    if (league) score += 1;
    if (homeTeam && awayTeam) score += 1;

    if (score < 2) {
      stats.droppedLowScore += 1;
      continue;
    }

    stats.withFullContext += 1;

    const dedupeKey = [
      candidate.oddValue.toFixed(3),
      selection ?? "",
      market,
      eventName
    ].join("|");
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    collected.push({
      league,
      eventName: eventName.slice(0, 200),
      homeTeam,
      awayTeam,
      market: market.slice(0, 120),
      selection: selection ? selection.slice(0, 120) : null,
      oddValue: candidate.oddValue,
      confidenceScore: score
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
      const eventName =
        readAttrWithin(row, EVENT_NAME_ATTRS) ??
        readWithin(row, ['[class*="event"]', '[class*="match"]']);

      const market = readWithin(row, MARKET_LABEL_SELECTORS);
      const selection = readWithin(row, ['[class*="selection"]', "[data-selection]"]);
      const stakeText = readWithin(row, ['[class*="stake"]']);
      const oddText = readWithin(row, ['[class*="odd"]']);
      const returnText = readWithin(row, [
        '[class*="return"]',
        '[class*="potential"]',
        '[class*="payout"]'
      ]);
      const status = readWithin(row, ['[class*="status"]']);

      const { cents: stakeCents } = parseCurrencyToCents(stakeText);
      const { cents: returnCents } = parseCurrencyToCents(returnText);
      const oddValue = parseOddValue(oddText);

      const rowText = row.textContent?.trim() ?? "";
      if (!rowText) return null;

      return {
        betslipId: row.getAttribute("data-bet-id") ?? row.getAttribute("data-id"),
        league: detectLeagueInText(eventName),
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

  const stats: CaptureStats = {
    rawCandidates: 0,
    withOdd: 0,
    withFullContext: 0,
    droppedNoContext: 0,
    droppedLowScore: 0
  };

  const odds = collectFootballOdds(doc, location, stats);

  console.info("[oddzone][capture]", {
    bookmaker,
    rawCandidates: stats.rawCandidates,
    withOdd: stats.withOdd,
    accepted: stats.withFullContext,
    droppedNoContext: stats.droppedNoContext,
    droppedLowScore: stats.droppedLowScore
  });

  return {
    bookmaker,
    pageUrl: location.href,
    account: collectAccount(doc),
    odds,
    bets: collectUserBets(doc)
  };
}
