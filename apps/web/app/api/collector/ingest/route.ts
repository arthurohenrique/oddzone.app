import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

type IngestBody = {
  eventType?: string;
  installationId?: string;
  extensionVersion?: string;
  siteDomain?: string | null;
  sourceUrl?: string | null;
  capturedAt?: string;
  consent?: {
    accepted?: boolean;
    acceptedAt?: string;
    termVersion?: string;
    termHash?: string;
  };
  lifecycleEventType?: "startup" | "install";
  termVersion?: string;
  termHash?: string;
  pageTitle?: string;
  snapshot?: {
    providerSlug?: string;
    pageTitle?: string;
    pageUrl?: string;
    accountProfile?: {
      username?: string | null;
      balanceCents?: number | null;
      balanceCurrency?: string | null;
      rawPayload?: Record<string, unknown>;
    } | null;
    bets?: Array<{
      betslipId?: string | null;
      market?: string | null;
      selection?: string | null;
      stakeCents?: number | null;
      oddValue?: number | null;
      status?: string | null;
      placedAt?: string | null;
      rawPayload?: Record<string, unknown>;
    }>;
    odds?: Array<{
      eventName?: string | null;
      market?: string | null;
      selection?: string | null;
      oddValue?: number | null;
      rawPayload?: Record<string, unknown>;
    }>;
    rawPayload?: Record<string, unknown>;
  };
  failureCode?: string;
  failureMessage?: string;
  failurePayload?: Record<string, unknown>;
};

type ValidatedIngestBody = IngestBody & {
  eventType: string;
  installationId: string;
  extensionVersion: string;
  capturedAt: string;
  consent: {
    accepted: boolean;
    acceptedAt?: string;
    termVersion?: string;
    termHash?: string;
  };
};

const allowedEventTypes = new Set([
  "extension_lifecycle",
  "consent_accepted",
  "page_seen",
  "snapshot",
  "collector_failure"
]);

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
  if (!isNonEmptyString(body.capturedAt)) {
    throw new Error("capturedAt obrigatorio");
  }
  if (!body.consent || typeof body.consent.accepted !== "boolean") {
    throw new Error("consent obrigatorio");
  }
}

async function upsertInstallation(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  installationId: string,
  extensionVersion: string,
  capturedAt: string
) {
  const { error } = await supabaseServer.from("collector_installations").upsert(
    {
      installation_id: installationId,
      latest_extension_version: extensionVersion,
      first_seen_at: capturedAt,
      last_seen_at: capturedAt
    },
    { onConflict: "installation_id" }
  );

  if (error) throw error;
}

async function insertLifecycle(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  const { error } = await supabaseServer.from("extension_events").insert({
    event_type: body.lifecycleEventType ?? "startup",
    extension_version: body.extensionVersion,
    latest_known_version: null,
    update_available: null
  });

  if (error) throw error;
}

async function insertConsent(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  const { error } = await supabaseServer.from("user_consents").insert({
    installation_id: body.installationId,
    term_version: body.termVersion ?? body.consent.termVersion ?? "unknown",
    term_hash: body.termHash ?? body.consent.termHash ?? null,
    accepted_at: body.consent.acceptedAt ?? body.capturedAt,
    source_url: body.sourceUrl ?? null,
    statement:
      "Usuário aceitou termo único para coleta de dados de domínios .bet.br."
  });

  if (error) throw error;
}

async function insertPageSeen(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  const { error } = await supabaseServer.from("site_sessions").insert({
    installation_id: body.installationId,
    site_domain: body.siteDomain ?? "unknown.bet.br",
    page_url: body.sourceUrl ?? null,
    page_title: body.pageTitle ?? null,
    visited_at: body.capturedAt
  });

  if (error) throw error;
}

async function insertSnapshot(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  if (!body.snapshot) return;

  if (body.snapshot.accountProfile) {
    const { error: accountError } = await supabaseServer
      .from("account_profiles")
      .insert({
        installation_id: body.installationId,
        site_domain: body.siteDomain ?? "unknown.bet.br",
        captured_at: body.capturedAt,
        username: body.snapshot.accountProfile.username ?? null,
        balance_cents: body.snapshot.accountProfile.balanceCents ?? null,
        balance_currency: body.snapshot.accountProfile.balanceCurrency ?? null,
        raw_payload: body.snapshot.accountProfile.rawPayload ?? {}
      });

    if (accountError) throw accountError;
  }

  if (Array.isArray(body.snapshot.bets) && body.snapshot.bets.length > 0) {
    const { error: betsError } = await supabaseServer.from("bets").insert(
      body.snapshot.bets.map((bet) => ({
        installation_id: body.installationId,
        site_domain: body.siteDomain ?? "unknown.bet.br",
        captured_at: body.capturedAt,
        betslip_id: bet.betslipId ?? null,
        market: bet.market ?? null,
        selection: bet.selection ?? null,
        stake_cents: bet.stakeCents ?? null,
        odd_value: bet.oddValue ?? null,
        status: bet.status ?? null,
        placed_at: bet.placedAt ?? null,
        raw_payload: bet.rawPayload ?? {}
      }))
    );

    if (betsError) throw betsError;
  }

  if (Array.isArray(body.snapshot.odds) && body.snapshot.odds.length > 0) {
    const { error: oddsError } = await supabaseServer.from("odds_snapshots").insert(
      body.snapshot.odds.map((odd) => ({
        installation_id: body.installationId,
        site_domain: body.siteDomain ?? "unknown.bet.br",
        captured_at: body.capturedAt,
        market: odd.market ?? null,
        event_name: odd.eventName ?? null,
        selection: odd.selection ?? null,
        odd_value: odd.oddValue ?? null,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        raw_payload: odd.rawPayload ?? {}
      }))
    );

    if (oddsError) throw oddsError;
  } else {
    console.warn("[collector_ingest] snapshot sem odds", {
      installationId: body.installationId,
      siteDomain: body.siteDomain ?? "unknown.bet.br",
      sourceUrl: body.sourceUrl ?? null
    });
  }
}

async function insertFailure(
  supabaseServer: ReturnType<typeof getSupabaseServerClient>,
  body: ValidatedIngestBody
) {
  const { error } = await supabaseServer.from("collector_failures").insert({
    installation_id: body.installationId,
    site_domain: body.siteDomain ?? "unknown.bet.br",
    source_url: body.sourceUrl ?? null,
    error_code: body.failureCode ?? "UNKNOWN",
    error_message: body.failureMessage ?? "Falha nao detalhada",
    raw_payload: body.failurePayload ?? {}
  });

  if (error) throw error;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let parsedBody: IngestBody | null = null;

  try {
    const supabaseServer = getSupabaseServerClient();
    const expectedToken = process.env.COLLECTOR_EXTENSION_SHARED_TOKEN;
    const incomingToken = request.headers.get("x-collector-token");

    if (expectedToken && incomingToken !== expectedToken) {
      console.warn("[collector_ingest] token inválido", {
        requestId,
        source: request.headers.get("x-collector-source"),
        hasIncomingToken: Boolean(incomingToken)
      });
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
    }

    const collectorSource = request.headers.get("x-collector-source");
    if (collectorSource !== "oddzone-extension") {
      console.warn("[collector_ingest] origem inválida", {
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
      siteDomain: body.siteDomain ?? "unknown.bet.br",
      collectorSource,
      hasIncomingToken: Boolean(incomingToken)
    });

    await upsertInstallation(
      supabaseServer,
      body.installationId,
      body.extensionVersion,
      body.capturedAt
    );

    if (body.eventType === "extension_lifecycle") {
      await insertLifecycle(supabaseServer, body);
    } else if (body.eventType === "consent_accepted") {
      await insertConsent(supabaseServer, body);
    } else if (body.eventType === "page_seen") {
      await insertPageSeen(supabaseServer, body);
    } else if (body.eventType === "snapshot") {
      await insertSnapshot(supabaseServer, body);
    } else if (body.eventType === "collector_failure") {
      await insertFailure(supabaseServer, body);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[collector_ingest] erro durante ingestão", {
      requestId,
      eventType: parsedBody?.eventType ?? "unknown",
      installationId: parsedBody?.installationId ?? "unknown",
      siteDomain: parsedBody?.siteDomain ?? "unknown.bet.br",
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
