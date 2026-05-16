import { collectorSharedToken, ingestUrl } from "./collector-config";
import type { CollectorIngestPayload } from "./collector-types";

let hasCheckedConnectivityThisSession = false;

async function runConnectivityPrecheckOnce(): Promise<void> {
  if (hasCheckedConnectivityThisSession) return;
  hasCheckedConnectivityThisSession = true;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(ingestUrl, {
      method: "GET",
      signal: controller.signal
    });

    console.info("[oddzone][ingest] precheck concluido", {
      url: ingestUrl,
      status: response.status
    });
  } catch (error) {
    console.error("[oddzone][ingest] precheck host inacessivel", {
      url: ingestUrl,
      error: error instanceof Error ? error.message : "erro desconhecido"
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function postCollectorPayload(
  payload: CollectorIngestPayload
): Promise<void> {
  await runConnectivityPrecheckOnce();

  const startedAt = new Date().toISOString();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Collector-Source": "oddzone-extension"
  };

  if (collectorSharedToken) {
    headers["X-Collector-Token"] = collectorSharedToken;
  }

  console.info("[oddzone][ingest] envio iniciado", {
    at: startedAt,
    eventType: payload.eventType,
    method: "POST",
    url: ingestUrl
  });

  let response: Response;

  try {
    response = await fetch(ingestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const isOnline =
      typeof navigator !== "undefined" && "onLine" in navigator
        ? navigator.onLine
        : null;

    console.error("[oddzone][ingest] erro de rede", {
      eventType: payload.eventType,
      url: ingestUrl,
      online: isOnline,
      error: error instanceof Error ? error.message : "erro desconhecido"
    });
    throw error;
  }

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    const details = responseBody ? ` body=${responseBody.slice(0, 220)}` : "";
    console.error("[oddzone][ingest] erro http", {
      eventType: payload.eventType,
      status: response.status,
      url: ingestUrl
    });
    throw new Error(
      `Falha no envio para ingestao status=${response.status} url=${ingestUrl}${details}`
    );
  }

  console.info("[oddzone][ingest] envio concluido", {
    eventType: payload.eventType,
    status: response.status,
    url: ingestUrl
  });
}
