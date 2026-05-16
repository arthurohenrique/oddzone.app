import { TERMS_TEXT, isBetBrDomain } from "../lib/collector-config";
import { collectSnapshotFromPage } from "../lib/provider-adapters";
import type { ConsentState } from "../lib/collector-types";

const VERSION_REQUEST_TYPE = "oddzone:extension-version:request";
const VERSION_RESPONSE_TYPE = "oddzone:extension-version:response";

async function sendToBackground<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

async function sendAndAssert(message: unknown): Promise<void> {
  const response = await sendToBackground<{ ok: boolean; error?: string }>(message);
  if (!response?.ok) {
    throw new Error(response?.error ?? "Background recusou a mensagem");
  }
}

function renderConsentCard(onAccept: () => Promise<void>) {
  const card = document.createElement("div");
  card.id = "oddzone-consent-card";
  card.style.position = "fixed";
  card.style.right = "16px";
  card.style.bottom = "16px";
  card.style.zIndex = "2147483647";
  card.style.width = "340px";
  card.style.maxWidth = "calc(100vw - 32px)";
  card.style.padding = "14px";
  card.style.borderRadius = "14px";
  card.style.border = "1px solid rgba(255,255,255,0.2)";
  card.style.background = "rgba(8,8,10,0.96)";
  card.style.backdropFilter = "blur(10px)";
  card.style.color = "#f5f5f7";
  card.style.fontFamily = "system-ui, -apple-system, Segoe UI, Arial, sans-serif";
  card.style.boxShadow = "0 8px 30px rgba(0,0,0,0.4)";
  card.innerHTML = `
    <div style="font-size:13px; line-height:1.45; margin-bottom:12px;">
      Para ativar a coleta neste site, você precisa aceitar o termo de uso.
    </div>
    <button id="oddzone-consent-btn" style="border:0;border-radius:999px;padding:10px 14px;background:#1f6fff;color:#fff;font-weight:600;cursor:pointer;">
      Aceitar e continuar
    </button>
  `;

  const btn = card.querySelector<HTMLButtonElement>("#oddzone-consent-btn");
  btn?.addEventListener("click", () => {
    void onAccept();
  });

  document.body.appendChild(card);
}

function removeConsentCard() {
  document.getElementById("oddzone-consent-card")?.remove();
}

async function getConsent(): Promise<ConsentState> {
  const response = await sendToBackground<{ ok: boolean; consent: ConsentState }>({
    type: "collector:get-consent"
  });

  if (!response.ok) {
    throw new Error("Falha ao consultar consentimento");
  }

  return response.consent;
}

function isOddzoneSite(hostname: string): boolean {
  return (
    hostname === "oddzone.app" ||
    hostname.endsWith(".oddzone.app") ||
    hostname === "oddzone.vercel.app" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

function setupVersionBridge() {
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window) return;
    if (!event.data || typeof event.data !== "object") return;

    const payload = event.data as { type?: string; requestId?: string };
    if (payload.type !== VERSION_REQUEST_TYPE) return;

    window.postMessage(
      {
        type: VERSION_RESPONSE_TYPE,
        requestId: payload.requestId ?? null,
        version: chrome.runtime.getManifest().version
      },
      window.location.origin
    );
  });
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    const hostname = window.location.hostname.toLowerCase();
    if (isOddzoneSite(hostname)) {
      setupVersionBridge();
      return;
    }

    if (!isBetBrDomain(hostname)) return;

    let currentUrl = window.location.href;
    let isCollectorStarted = false;
    let isSnapshotInFlight = false;
    let lastSnapshotSignature: string | null = null;
    let lastSnapshotAt = 0;
    let lastFailureAt = 0;
    let mutationDebounce: number | null = null;
    let locationTimer: number | null = null;

    const failureCooldownMs = 12_000;
    const snapshotCooldownMs = 1_200;

    const buildSnapshotSignature = (snapshot: ReturnType<typeof collectSnapshotFromPage>): string => {
      return JSON.stringify({
        pageUrl: snapshot.pageUrl,
        providerSlug: snapshot.providerSlug,
        odds: snapshot.odds
          .slice(0, 40)
          .map((odd) => [odd.selection, odd.oddValue, odd.market, odd.eventName]),
        bets: snapshot.bets.length,
        profile: snapshot.accountProfile?.username ?? null
      });
    };

    const reportFailure = async (code: string, message: string): Promise<void> => {
      const now = Date.now();
      if (now - lastFailureAt < failureCooldownMs) return;
      lastFailureAt = now;

      try {
        await sendToBackground({
          type: "collector:failure",
          sourceUrl: currentUrl,
          siteDomain: hostname,
          code,
          message
        });
      } catch (error) {
        console.error("[oddzone] Falha ao reportar erro para background", error);
      }
    };

    const sendPageSeen = async (): Promise<void> => {
      await sendAndAssert({
        type: "collector:page-seen",
        sourceUrl: currentUrl,
        siteDomain: hostname,
        pageTitle: document.title
      });
    };

    const sendSnapshot = async (reason: string, force = false): Promise<void> => {
      if (isSnapshotInFlight) return;

      const now = Date.now();
      if (!force && now - lastSnapshotAt < snapshotCooldownMs) return;

      const snapshot = collectSnapshotFromPage(document, window.location);
      const signature = buildSnapshotSignature(snapshot);
      if (!force && signature === lastSnapshotSignature) return;

      isSnapshotInFlight = true;
      try {
        await sendAndAssert({
          type: "collector:snapshot",
          sourceUrl: currentUrl,
          siteDomain: hostname,
          snapshot: {
            ...snapshot,
            rawPayload: {
              ...snapshot.rawPayload,
              captureReason: reason
            }
          }
        });
        lastSnapshotSignature = signature;
        lastSnapshotAt = now;
      } finally {
        isSnapshotInFlight = false;
      }
    };

    const scheduleSnapshot = (reason: string) => {
      if (mutationDebounce !== null) {
        window.clearTimeout(mutationDebounce);
      }

      mutationDebounce = window.setTimeout(() => {
        mutationDebounce = null;
        void sendSnapshot(reason).catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : "Falha desconhecida";
          console.error("[oddzone] Falha ao enviar snapshot", detail);
          void reportFailure("SNAPSHOT_SEND_FAILURE", detail);
        });
      }, 1200);
    };

    const startLiveCollector = () => {
      if (isCollectorStarted) return;
      isCollectorStarted = true;

      const observer = new MutationObserver(() => {
        scheduleSnapshot("dom_mutation");
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });

      locationTimer = window.setInterval(() => {
        const href = window.location.href;
        if (href === currentUrl) return;

        currentUrl = href;
        lastSnapshotSignature = null;
        void sendPageSeen()
          .then(() => sendSnapshot("url_change", true))
          .catch((error: unknown) => {
            const detail = error instanceof Error ? error.message : "Falha ao processar mudanca de URL";
            console.error("[oddzone] Falha em evento de mudanca de URL", detail);
            void reportFailure("URL_CHANGE_FAILURE", detail);
          });
      }, 1500);

      window.addEventListener("beforeunload", () => {
        observer.disconnect();
        if (mutationDebounce !== null) {
          window.clearTimeout(mutationDebounce);
          mutationDebounce = null;
        }
        if (locationTimer !== null) {
          window.clearInterval(locationTimer);
          locationTimer = null;
        }
      });
    };

    const run = async () => {
      try {
        const consent = await getConsent();

        if (!consent.accepted) {
          renderConsentCard(async () => {
            const accepted = window.confirm(TERMS_TEXT);
            if (!accepted) return;

            await sendAndAssert({
              type: "collector:accept-consent",
              sourceUrl: currentUrl,
              siteDomain: hostname
            });

            removeConsentCard();
            await run();
          });
          return;
        }

        removeConsentCard();
        await sendPageSeen();
        await sendSnapshot("initial_load", true);
        startLiveCollector();
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Falha na coleta";
        console.error("[oddzone] Falha no content script", detail);
        await reportFailure("CONTENT_SCRIPT_FAILURE", detail);
      }
    };

    void run();
  }
});
