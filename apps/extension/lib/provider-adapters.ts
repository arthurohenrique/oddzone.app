import type {
  AccountProfilePayload,
  BetPayload,
  OddsPayload,
  SnapshotPayload
} from "./collector-types";

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
  return Number.isNaN(parsed) ? null : parsed;
}

function detectProvider(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname.toLowerCase();
  return parts[parts.length - 3].toLowerCase();
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

function collectOdds(doc: Document): OddsPayload[] {
  const elements = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[data-odds], [class*="odd"], [class*="odds"], [data-testid*="odds"]'
    )
  ).slice(0, 150);

  return elements
    .map((element) => {
      const text = element.textContent?.trim() ?? null;
      return {
        eventName: null,
        market: null,
        selection: text,
        oddValue: parseOddValue(text),
        rawPayload: {
          tagName: element.tagName,
          className: element.className,
          text
        }
      } satisfies OddsPayload;
    })
    .filter((item) => item.oddValue !== null || Boolean(item.selection));
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
  return {
    providerSlug: detectProvider(location.hostname),
    pageTitle: doc.title,
    pageUrl: location.href,
    accountProfile: collectAccountProfile(doc),
    bets: collectBets(doc),
    odds: collectOdds(doc),
    rawPayload: {
      hostname: location.hostname,
      observedAt: new Date().toISOString(),
      domStats: {
        links: doc.querySelectorAll("a").length,
        forms: doc.querySelectorAll("form").length
      }
    }
  };
}
