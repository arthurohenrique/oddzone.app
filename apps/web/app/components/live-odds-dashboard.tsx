"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POLL_INTERVAL_MS = 3_000;
const MAX_KEEP = 100;

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

type LiveResponse = {
  ok: boolean;
  odds: OddRow[];
  serverTime: string;
  error?: string;
};

function formatRelativeTime(iso: string, now: number): string {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return "agora";
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `há ${hours}h`;
}

function formatBookmaker(slug: string): string {
  if (!slug) return "—";
  return slug
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatOdd(value: number): string {
  return value.toFixed(2);
}

function eventLabel(odd: OddRow): string {
  if (odd.home_team && odd.away_team) {
    return `${odd.home_team} vs ${odd.away_team}`;
  }
  if (odd.event_name) return odd.event_name;
  return "Evento desconhecido";
}

export function LiveOddsDashboard() {
  const [odds, setOdds] = useState<OddRow[]>([]);
  const [hasError, setHasError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pulseId, setPulseId] = useState<number | null>(null);
  const lastCapturedRef = useRef<string | null>(null);

  const fetchOdds = useCallback(async (initial = false) => {
    try {
      const url = new URL("/api/odds/live", window.location.origin);
      url.searchParams.set("limit", String(MAX_KEEP));
      if (!initial && lastCapturedRef.current) {
        url.searchParams.set("since", lastCapturedRef.current);
      }

      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        setHasError(true);
        return;
      }

      const payload = (await response.json()) as LiveResponse;
      if (!payload.ok) {
        setHasError(true);
        return;
      }

      setHasError(false);

      if (initial) {
        setOdds(payload.odds);
        if (payload.odds.length > 0) {
          lastCapturedRef.current = payload.odds[0].captured_at;
        }
        return;
      }

      if (payload.odds.length === 0) return;

      setOdds((previous) => {
        const seen = new Set(previous.map((row) => row.id));
        const fresh = payload.odds.filter((row) => !seen.has(row.id));
        if (fresh.length === 0) return previous;

        const merged = [...fresh, ...previous].slice(0, MAX_KEEP);
        return merged;
      });

      lastCapturedRef.current = payload.odds[0].captured_at;
      setPulseId(payload.odds[0].id);
    } catch (error) {
      console.warn("[dashboard] falha ao buscar odds", error);
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    void fetchOdds(true);
    const interval = window.setInterval(() => {
      void fetchOdds(false);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchOdds]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const visibleOdds = useMemo(() => odds.slice(0, MAX_KEEP), [odds]);

  return (
    <div className="dashboard">
      <section className="dashboard-list" aria-live="polite">
        {visibleOdds.length === 0 && !hasError && (
          <div className="dashboard-empty">
            <p>Aguardando primeira odd capturada…</p>
          </div>
        )}

        {hasError && visibleOdds.length === 0 && (
          <div className="dashboard-empty is-error">
            <p>Não foi possível carregar as odds.</p>
          </div>
        )}

        {visibleOdds.map((odd) => (
          <article
            key={odd.id}
            className={`odd-row${odd.id === pulseId ? " is-pulse" : ""}`}
          >
            <div className="odd-row-left">
              <span className="odd-row-bookmaker">{formatBookmaker(odd.bookmaker)}</span>
              {odd.league && <span className="odd-row-league">{odd.league}</span>}
            </div>

            <div className="odd-row-center">
              <span className="odd-row-event">{eventLabel(odd)}</span>
              <span className="odd-row-meta">
                {odd.market ?? "Mercado"}
                {odd.selection ? ` · ${odd.selection}` : ""}
              </span>
            </div>

            <div className="odd-row-right">
              <span className="odd-row-value">{formatOdd(odd.odd_value)}</span>
              <span className="odd-row-time">{formatRelativeTime(odd.captured_at, now)}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
