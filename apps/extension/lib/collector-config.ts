export const BET_BR_SUFFIX = ".bet.br";
export const DEFAULT_INGEST_URL = "http://localhost:3000/api/collector/ingest";

export const TERMS_VERSION =
  import.meta.env.WXT_PUBLIC_TERMS_VERSION ?? "2026-05-15-v1";

export const TERMS_TEXT = `Ao aceitar este termo, você autoriza a extensão Oddzone a coletar dados dos sites de apostas brasileiros acessados por você (domínios .bet.br), incluindo informações exibidas em tela como odds ao vivo, informações da conta logada e apostas realizadas. Esses dados serão enviados e armazenados no banco de dados da Oddzone para processamento interno.`;

export const ingestUrl =
  import.meta.env.WXT_PUBLIC_COLLECTOR_INGEST_URL ?? DEFAULT_INGEST_URL;

export const collectorSharedToken =
  import.meta.env.WXT_PUBLIC_COLLECTOR_SHARED_TOKEN ?? "";

export function isBetBrDomain(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(BET_BR_SUFFIX);
}

export async function buildTermHash(termText: string): Promise<string> {
  const bytes = new TextEncoder().encode(termText);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
