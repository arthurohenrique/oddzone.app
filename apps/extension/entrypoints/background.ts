import { postCollectorPayload } from "../lib/collector-api";
import { ingestUrl } from "../lib/collector-config";
import { acceptCurrentTerms, getConsentState, getOrCreateInstallationId } from "../lib/collector-consent";
import type { CollectorIngestPayload, ConsentState, SnapshotPayload } from "../lib/collector-types";

function nowIso(): string {
  return new Date().toISOString();
}

function extensionVersion(): string {
  return chrome.runtime.getManifest().version;
}

async function buildBasePayload(
  eventType: CollectorIngestPayload["eventType"],
  bookmaker: string,
  pageUrl: string | null,
  consent: ConsentState
): Promise<CollectorIngestPayload> {
  return {
    eventType,
    installationId: await getOrCreateInstallationId(),
    extensionVersion: extensionVersion(),
    bookmaker,
    pageUrl,
    capturedAt: nowIso(),
    consent
  };
}

type ExtensionMessage =
  | { type: "collector:get-consent" }
  | { type: "collector:accept-consent"; pageUrl: string; bookmaker: string }
  | {
      type: "collector:snapshot";
      pageUrl: string;
      bookmaker: string;
      snapshot: SnapshotPayload;
    };

export default defineBackground(() => {
  console.info("[oddzone][background] iniciado", {
    extensionVersion: extensionVersion(),
    ingestUrl
  });

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    void (async () => {
      if (message.type === "collector:get-consent") {
        const consent = await getConsentState();
        sendResponse({ ok: true, consent });
        return;
      }

      if (message.type === "collector:accept-consent") {
        const consent = await acceptCurrentTerms();
        const payload = await buildBasePayload(
          "consent_accepted",
          message.bookmaker,
          message.pageUrl,
          consent
        );
        await postCollectorPayload(payload);
        sendResponse({ ok: true, consent });
        return;
      }

      if (message.type === "collector:snapshot") {
        const consent = await getConsentState();
        const payload = await buildBasePayload(
          "snapshot",
          message.bookmaker,
          message.pageUrl,
          consent
        );
        payload.snapshot = message.snapshot;
        await postCollectorPayload(payload);
        sendResponse({ ok: true });
      }
    })().catch((error: unknown) => {
      const payload = message && typeof message === "object" ? message : null;
      const messageType =
        payload && "type" in payload && typeof payload.type === "string"
          ? payload.type
          : "unknown";

      console.error("[oddzone] Falha no background", {
        messageType,
        error: error instanceof Error ? error.message : "Erro inesperado"
      });

      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Erro inesperado"
      });
    });

    return true;
  });
});
