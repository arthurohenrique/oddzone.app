export type CollectorEventType =
  | "extension_lifecycle"
  | "consent_accepted"
  | "page_seen"
  | "snapshot"
  | "collector_failure";

export type ExtensionLifecycleType = "startup" | "install";

export type ConsentState = {
  accepted: boolean;
  acceptedAt?: string;
  termVersion?: string;
  termHash?: string;
};

export type AccountProfilePayload = {
  username: string | null;
  balanceCents: number | null;
  balanceCurrency: string | null;
  rawPayload: Record<string, unknown>;
};

export type BetPayload = {
  betslipId: string | null;
  market: string | null;
  selection: string | null;
  stakeCents: number | null;
  oddValue: number | null;
  status: string | null;
  placedAt: string | null;
  rawPayload: Record<string, unknown>;
};

export type OddsPayload = {
  eventName: string | null;
  market: string | null;
  selection: string | null;
  oddValue: number | null;
  rawPayload: Record<string, unknown>;
};

export type SnapshotPayload = {
  providerSlug: string;
  pageTitle: string;
  pageUrl: string;
  accountProfile: AccountProfilePayload | null;
  bets: BetPayload[];
  odds: OddsPayload[];
  rawPayload: Record<string, unknown>;
};

export type CollectorIngestPayload = {
  eventType: CollectorEventType;
  installationId: string;
  extensionVersion: string;
  siteDomain: string | null;
  sourceUrl: string | null;
  capturedAt: string;
  consent: ConsentState;
  lifecycleEventType?: ExtensionLifecycleType;
  termVersion?: string;
  termHash?: string;
  pageTitle?: string;
  snapshot?: SnapshotPayload;
  failureCode?: string;
  failureMessage?: string;
  failurePayload?: Record<string, unknown>;
};
