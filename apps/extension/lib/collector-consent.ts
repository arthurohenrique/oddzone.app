import { TERMS_TEXT, TERMS_VERSION, buildTermHash } from "./collector-config";
import type { ConsentState } from "./collector-types";

const STORAGE_KEYS = {
  consent: "oddzone.collector.consent",
  installationId: "oddzone.collector.installation_id"
} as const;

type PersistedConsent = {
  accepted: boolean;
  acceptedAt: string;
  termVersion: string;
  termHash: string;
};

function randomId(): string {
  return crypto.randomUUID();
}

export async function getOrCreateInstallationId(): Promise<string> {
  const saved = await chrome.storage.local.get(STORAGE_KEYS.installationId);
  const current = saved[STORAGE_KEYS.installationId];
  if (typeof current === "string" && current.length > 0) {
    return current;
  }

  const installationId = randomId();
  await chrome.storage.local.set({ [STORAGE_KEYS.installationId]: installationId });
  return installationId;
}

export async function getConsentState(): Promise<ConsentState> {
  const saved = await chrome.storage.local.get(STORAGE_KEYS.consent);
  const consent = saved[STORAGE_KEYS.consent] as PersistedConsent | undefined;

  if (!consent?.accepted) {
    return { accepted: false };
  }

  return {
    accepted: true,
    acceptedAt: consent.acceptedAt,
    termVersion: consent.termVersion,
    termHash: consent.termHash
  };
}

export async function acceptCurrentTerms(): Promise<ConsentState> {
  const acceptedAt = new Date().toISOString();
  const termHash = await buildTermHash(TERMS_TEXT);

  const consent: PersistedConsent = {
    accepted: true,
    acceptedAt,
    termVersion: TERMS_VERSION,
    termHash
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.consent]: consent });

  return {
    accepted: true,
    acceptedAt,
    termVersion: TERMS_VERSION,
    termHash
  };
}
