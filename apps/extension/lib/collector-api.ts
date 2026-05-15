import { collectorSharedToken, ingestUrl } from "./collector-config";
import type { CollectorIngestPayload } from "./collector-types";

export async function postCollectorPayload(
  payload: CollectorIngestPayload
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Collector-Source": "oddzone-extension"
  };

  if (collectorSharedToken) {
    headers["X-Collector-Token"] = collectorSharedToken;
  }

  const response = await fetch(ingestUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Falha no envio para ingestão (${response.status})`);
  }
}
