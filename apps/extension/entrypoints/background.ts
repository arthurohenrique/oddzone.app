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

const ODDZONE_TAB_PATTERNS = [
  "https://oddzone.app/*",
  "https://*.oddzone.app/*",
  "https://oddzone.vercel.app/*",
  "http://localhost/*",
  "http://localhost:*/*",
  "http://127.0.0.1/*",
  "http://127.0.0.1:*/*"
];

async function reloadOddzoneTabs(reason: string): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: ODDZONE_TAB_PATTERNS });
    if (tabs.length === 0) {
      console.info("[oddzone][reload] nenhuma aba oddzone aberta", { reason });
      return;
    }

    console.info("[oddzone][reload] recarregando abas", {
      reason,
      count: tabs.length,
      tabIds: tabs.map((tab) => tab.id).filter((id): id is number => typeof id === "number")
    });

    await Promise.allSettled(
      tabs
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === "number")
        .map((tab) => chrome.tabs.reload(tab.id, { bypassCache: true }))
    );
  } catch (error) {
    console.error("[oddzone][reload] falha", {
      reason,
      error: error instanceof Error ? error.message : "erro desconhecido"
    });
  }
}

export default defineBackground(() => {
  console.info("[oddzone][background] iniciado", {
    extensionVersion: extensionVersion(),
    ingestUrl
  });

  chrome.runtime.onInstalled.addListener((details) => {
    console.info("[oddzone][lifecycle] onInstalled", {
      reason: details.reason,
      previousVersion: details.previousVersion ?? null,
      currentVersion: extensionVersion()
    });
    void reloadOddzoneTabs(`onInstalled:${details.reason}`);
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
