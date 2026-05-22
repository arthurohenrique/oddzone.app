import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

type OddRow = {
  id: number;
  bookmaker: string;
  league: string | null;
  event_name: string | null;
  home_team: string | null;
  away_team: string | null;
  market: string | null;
  selection: string | null;
  odd_value: number;
  confidence_score: number;
  captured_at: string;
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  const url = new URL(request.url);

  const requestedLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const sinceParam = url.searchParams.get("since");
  let query = supabase
    .from("ext_football_odds")
    .select(
      "id, bookmaker, league, event_name, home_team, away_team, market, selection, odd_value, confidence_score, captured_at"
    )
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (sinceParam) {
    query = query.gt("captured_at", sinceParam);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[odds_live] erro ao consultar", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const odds = (data ?? []) as OddRow[];

  return NextResponse.json(
    {
      ok: true,
      odds,
      serverTime: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      }
    }
  );
}
