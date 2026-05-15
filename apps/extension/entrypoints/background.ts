import { postCollectorPayload } from "../lib/collector-api";
import { acceptCurrentTerms, getConsentState, getOrCreateInstallationId } from "../lib/collector-consent";
import type { CollectorIngestPayload, ConsentState, ExtensionLifecycleType, SnapshotPayload } from "../lib/collector-types";

function nowIso(): string {
  return new Date().toISOString();
}

function extensionVersion(): string {
  return chrome.runtime.getManifest().version;
}

async function buildBasePayload(
  eventType: CollectorIngestPayload["eventType"],
  siteDomain: string | null,
  sourceUrl: string | null,
  consent: ConsentState
): Promise<CollectorIngestPayload> {
  return {
    eventType,
    installationId: await getOrCreateInstallationId(),
    extensionVersion: extensionVersion(),
    siteDomain,
    sourceUrl,
    capturedAt: nowIso(),
    consent
  };
}

async function sendLifecycle(event: ExtensionLifecycleType): Promise<void> {
  const consent = await getConsentState();
  const payload = await buildBasePayload(
    "extension_lifecycle",
    null,
    null,
    consent
  );

  payload.lifecycleEventType = event;
  await postCollectorPayload(payload);
}

type ExtensionMessage =
  | { type: "collector:get-consent" }
  | { type: "collector:accept-consent"; sourceUrl: string; siteDomain: string }
  | { type: "collector:page-seen"; sourceUrl: string; siteDomain: string; pageTitle: string }
  | { type: "collector:snapshot"; sourceUrl: string; siteDomain: string; snapshot: SnapshotPayload }
  | { type: "collector:failure"; sourceUrl: string | null; siteDomain: string | null; code: string; message: string; rawPayload?: Record<string, unknown> };

export default defineBackground(() => {
  chrome.runtime.onStartup.addListener(async () => {
    try {
      await sendLifecycle("startup");
    } catch (error) {
      console.error("[oddzone] Falha ao enviar lifecycle startup", error);
    }
  });

  chrome.runtime.onInstalled.addListener(async () => {
    try {
      await sendLifecycle("install");
    } catch (error) {
      console.error("[oddzone] Falha ao enviar lifecycle install", error);
    }
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
          message.siteDomain,
          message.sourceUrl,
          consent
        );
        payload.termVersion = consent.termVersion;
        payload.termHash = consent.termHash;
        await postCollectorPayload(payload);
        sendResponse({ ok: true, consent });
        return;
      }

      if (message.type === "collector:page-seen") {
        const consent = await getConsentState();
        const payload = await buildBasePayload(
          "page_seen",
          message.siteDomain,
          message.sourceUrl,
          consent
        );
        payload.pageTitle = message.pageTitle;
        await postCollectorPayload(payload);
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "collector:snapshot") {
        const consent = await getConsentState();
        const payload = await buildBasePayload(
          "snapshot",
          message.siteDomain,
          message.sourceUrl,
          consent
        );
        payload.snapshot = message.snapshot;
        await postCollectorPayload(payload);
        sendResponse({ ok: true });
        return;
      }

      if (message.type === "collector:failure") {
        const consent = await getConsentState();
        const payload = await buildBasePayload(
          "collector_failure",
          message.siteDomain,
          message.sourceUrl,
          consent
        );
        payload.failureCode = message.code;
        payload.failureMessage = message.message;
        payload.failurePayload = message.rawPayload;
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
