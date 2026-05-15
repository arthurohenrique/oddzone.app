import { TERMS_TEXT, isBetBrDomain } from "../lib/collector-config";
import { collectSnapshotFromPage } from "../lib/provider-adapters";
import type { ConsentState } from "../lib/collector-types";

async function sendToBackground<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
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
  return response.consent;
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    const hostname = window.location.hostname.toLowerCase();
    if (!isBetBrDomain(hostname)) return;

    const sourceUrl = window.location.href;

    const run = async () => {
      try {
        const consent = await getConsent();

        if (!consent.accepted) {
          renderConsentCard(async () => {
            const accepted = window.confirm(TERMS_TEXT);
            if (!accepted) return;

            await sendToBackground({
              type: "collector:accept-consent",
              sourceUrl,
              siteDomain: hostname
            });

            removeConsentCard();
            await run();
          });
          return;
        }

        await sendToBackground({
          type: "collector:page-seen",
          sourceUrl,
          siteDomain: hostname,
          pageTitle: document.title
        });

        const snapshot = collectSnapshotFromPage(document, window.location);
        await sendToBackground({
          type: "collector:snapshot",
          sourceUrl,
          siteDomain: hostname,
          snapshot
        });
      } catch (error) {
        await sendToBackground({
          type: "collector:failure",
          sourceUrl,
          siteDomain: hostname,
          code: "CONTENT_SCRIPT_FAILURE",
          message: error instanceof Error ? error.message : "Falha na coleta"
        });
      }
    };

    void run();
  }
});
