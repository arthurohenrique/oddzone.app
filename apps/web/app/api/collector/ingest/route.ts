import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

type IngestBody = {
  eventType?: "consent_accepted" | "snapshot";
  installationId?: string;
  extensionVersion?: string;
  bookmaker?: string;
  pageUrl?: string | null;
  capturedAt?: string;
  consent?: {
    accepted?: boolean;
    acceptedAt?: string;
    termVersion?: string;
    termHash?: string;
  };
  snapshot?: {
    bookmaker?: string;
    pageUrl?: string;
    account?: {
      email?: string | null;
      displayName?: string | null;
      balanceCents?: number | null;
      currency?: string | null;
    } | null;
    odds?: Array<{
      league?: string | null;
      eventName?: string | null;
      homeTeam?: string | null;
      awayTeam?: string | null;
      market?: string | null;
      selection?: string | null;
      oddValue?: number;
      confidenceScore?: number;
    }>;
    bets?: Array<{
      betslipId?: string | null;
      league?: string | null;
      eventName?: string | null;
      market?: string | null;
      selection?: string | null;
      stakeCents?: number | null;
      oddValue?: number | null;
      potentialReturnCents?: number | null;
      status?: string | null;
      placedAt?: string | null;
    }>;
  };
};

type ValidatedIngestBody = IngestBody & {
  eventType: "consent_accepted" | "snapshot";
  installationId: string;
  extensionVersion: string;
  bookmaker: string;
  capturedAt: string;
  consent: {
    accepted: boolean;
    acceptedAt?: string;
    termVersion?: string;
    termHash?: string;
  };
};

const allowedEventTypes = new Set(["consent_accepted", "snapshot"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertBody(body: IngestBody): asserts body is ValidatedIngestBody {
  if (!isNonEmptyString(body.eventType) || !allowedEventTypes.has(body.eventType)) {
    throw new Error("eventType invalido");
  }
  if (!isNonEmptyString(body.installationId)) {
    throw new Error("installationId obrigatorio");
  }
  if (!isNonEmptyString(body.extensionVersion)) {
    throw new Error("extensionVersion obrigatorio");
  }
  if (!isNonEmptyString(body.bookmaker)) {
    throw new Error("bookmaker obrigatorio");
  }
  if (!isNonEmptyString(body.capturedAt)) {
    throw new Error("capturedAt obrigatorio");
  }
  if (!body.consent || typeof body.consent.accepted !== "boolean") {
    throw new Error("consent obrigatorio");
  }
}

async function upsertUser(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  const account = body.snapshot?.account ?? null;

  const row: Record<string, unknown> = {
    install_id: body.installationId,
    bookmaker: body.bookmaker,
    extension_version: body.extensionVersion,
    last_seen_at: body.capturedAt,
    updated_at: body.capturedAt
  };

  if (body.consent.accepted) {
    row.consent_accepted_at = body.consent.acceptedAt ?? body.capturedAt;
    row.consent_term_version = body.consent.termVersion ?? null;
  }

  if (account) {
    if (account.email !== undefined) row.email = account.email;
    if (account.displayName !== undefined) row.display_name = account.displayName;
    if (account.balanceCents !== undefined) row.balance_cents = account.balanceCents;
    if (account.currency !== undefined) row.currency = account.currency;
  }

  const { error } = await supabaseServer
    .from("ext_users")
    .upsert(row, { onConflict: "install_id" });

  if (error) throw error;
}

async function insertOdds(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  const odds = body.snapshot?.odds ?? [];
  if (odds.length === 0) return 0;

  const rows = odds
    .filter((odd) => typeof odd.oddValue === "number" && odd.oddValue >= 1.01)
    .map((odd) => ({
      install_id: body.installationId,
      bookmaker: body.bookmaker,
      league: odd.league ?? null,
      event_name: odd.eventName ?? null,
      home_team: odd.homeTeam ?? null,
      away_team: odd.awayTeam ?? null,
      market: odd.market ?? null,
      selection: odd.selection ?? null,
      odd_value: odd.oddValue,
      confidence_score: odd.confidenceScore ?? 0,
      page_url: body.pageUrl ?? null,
      captured_at: body.capturedAt
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabaseServer.from("ext_football_odds").insert(rows);
  if (error) throw error;
  return rows.length;
}

async function upsertBets(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  const bets = body.snapshot?.bets ?? [];
  if (bets.length === 0) return 0;

  const withBetslip = bets.filter((bet) => isNonEmptyString(bet.betslipId));
  const withoutBetslip = bets.filter((bet) => !isNonEmptyString(bet.betslipId));

  const baseRow = (bet: (typeof bets)[number]) => ({
    install_id: body.installationId,
    bookmaker: body.bookmaker,
    betslip_id: bet.betslipId ?? null,
    league: bet.league ?? null,
    event_name: bet.eventName ?? null,
    market: bet.market ?? null,
    selection: bet.selection ?? null,
    stake_cents: bet.stakeCents ?? null,
    odd_value: bet.oddValue ?? null,
    potential_return_cents: bet.potentialReturnCents ?? null,
    status: bet.status ?? null,
    placed_at: bet.placedAt ?? null,
    captured_at: body.capturedAt
  });

  if (withBetslip.length > 0) {
    const { error } = await supabaseServer
      .from("ext_user_bets")
      .upsert(withBetslip.map(baseRow), {
        onConflict: "install_id,bookmaker,betslip_id"
      });
    if (error) throw error;
  }

  if (withoutBetslip.length > 0) {
    const { error } = await supabaseServer
      .from("ext_user_bets")
      .insert(withoutBetslip.map(baseRow));
    if (error) throw error;
  }

  return bets.length;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let parsedBody: IngestBody | null = null;

  try {
    const supabaseServer = getSupabaseServerClient();
    const expectedToken = process.env.COLLECTOR_EXTENSION_SHARED_TOKEN;
    const incomingToken = request.headers.get("x-collector-token");

    if (expectedToken && incomingToken !== expectedToken) {
      console.warn("[collector_ingest] token invalido", {
        requestId,
        source: request.headers.get("x-collector-source"),
        hasIncomingToken: Boolean(incomingToken)
      });
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const collectorSource = request.headers.get("x-collector-source");
    if (collectorSource !== "oddzone-extension") {
      console.warn("[collector_ingest] origem invalida", {
        requestId,
        collectorSource
      });
      return NextResponse.json({ error: "Origem invalida" }, { status: 400 });
    }

    const body = (await request.json()) as IngestBody;
    parsedBody = body;
    assertBody(body);

    console.info("[collector_ingest] evento recebido", {
      requestId,
      eventType: body.eventType,
      installationId: body.installationId,
      bookmaker: body.bookmaker,
      oddsCount: body.snapshot?.odds?.length ?? 0,
      betsCount: body.snapshot?.bets?.length ?? 0,
      hasAccount: Boolean(body.snapshot?.account)
    });

    await upsertUser(supabaseServer, body);

    let oddsInserted = 0;
    let betsInserted = 0;
    if (body.eventType === "snapshot") {
      oddsInserted = await insertOdds(supabaseServer, body);
      betsInserted = await upsertBets(supabaseServer, body);
    }

    return NextResponse.json({
      ok: true,
      requestId,
      oddsInserted,
      betsInserted
    });
  } catch (error) {
    console.error("[collector_ingest] erro durante ingestao", {
      requestId,
      eventType: parsedBody?.eventType ?? "unknown",
      installationId: parsedBody?.installationId ?? "unknown",
      bookmaker: parsedBody?.bookmaker ?? "unknown",
      error: error instanceof Error ? error.message : "Erro interno"
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno"
      },
      { status: 500 }
    );
  }
}
