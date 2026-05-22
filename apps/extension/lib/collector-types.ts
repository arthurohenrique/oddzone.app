export type CollectorEventType = "consent_accepted" | "snapshot";

export type ConsentState = {
  accepted: boolean;
  acceptedAt?: string;
  termVersion?: string;
  termHash?: string;
};

export type AccountProfilePayload = {
  email: string | null;
  displayName: string | null;
  balanceCents: number | null;
  currency: string | null;
};

export type FootballOddPayload = {
  league: string | null;
  eventName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  market: string | null;
  selection: string | null;
  oddValue: number;
  confidenceScore: number;
};

export type UserBetPayload = {
  betslipId: string | null;
  league: string | null;
  eventName: string | null;
  market: string | null;
  selection: string | null;
  stakeCents: number | null;
  oddValue: number | null;
  potentialReturnCents: number | null;
  status: string | null;
  placedAt: string | null;
};

export type SnapshotPayload = {
  bookmaker: string;
  pageUrl: string;
  account: AccountProfilePayload | null;
  odds: FootballOddPayload[];
  bets: UserBetPayload[];
};

export type CollectorIngestPayload = {
  eventType: CollectorEventType;
  installationId: string;
  extensionVersion: string;
  bookmaker: string;
  pageUrl: string | null;
  capturedAt: string;
  consent: ConsentState;
  snapshot?: SnapshotPayload;
};
