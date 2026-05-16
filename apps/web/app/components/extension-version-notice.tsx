"use client";

import { useEffect, useMemo, useState } from "react";

const VERSION_REQUEST_TYPE = "oddzone:extension-version:request";
const VERSION_RESPONSE_TYPE = "oddzone:extension-version:response";

type LatestPayload = {
  version: string;
  downloadUrl: string;
};

type ExtensionVersionNoticeProps = {
  downloadPath: string;
};

function compareSemver(a: string, b: string): number {
  const aParts = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const bParts = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const aValue = aParts[i] ?? 0;
    const bValue = bParts[i] ?? 0;
    if (aValue > bValue) return 1;
    if (aValue < bValue) return -1;
  }

  return 0;
}

async function requestInstalledVersion(timeoutMs = 1200): Promise<string | null> {
  const requestId = crypto.randomUUID();

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, timeoutMs);

    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window) return;
      if (!event.data || typeof event.data !== "object") return;

      const payload = event.data as {
        type?: string;
        requestId?: string;
        version?: string;
      };

      if (
        payload.type !== VERSION_RESPONSE_TYPE ||
        payload.requestId !== requestId ||
        typeof payload.version !== "string"
      ) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(payload.version);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ type: VERSION_REQUEST_TYPE, requestId }, window.location.origin);
  });
}

export function ExtensionVersionNotice({ downloadPath }: ExtensionVersionNoticeProps) {
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [latestDownloadUrl, setLatestDownloadUrl] = useState<string>(downloadPath);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const installed = await requestInstalledVersion();
      if (!installed || isCancelled) return;
      setInstalledVersion(installed);

      try {
        const response = await fetch("/api/extension/latest", {
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = (await response.json()) as LatestPayload;
        if (isCancelled) return;

        if (typeof payload.version === "string") {
          setLatestVersion(payload.version);
        }
        if (typeof payload.downloadUrl === "string") {
          setLatestDownloadUrl(payload.downloadUrl);
        }
      } catch {
        // comportamento silencioso quando endpoint indisponivel
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const versionStatus = useMemo(() => {
    if (!installedVersion) return "not_detected" as const;
    if (!latestVersion) return "detected" as const;
    return compareSemver(installedVersion, latestVersion) < 0
      ? ("outdated" as const)
      : ("up_to_date" as const);
  }, [installedVersion, latestVersion]);

  if (versionStatus === "not_detected") return null;

  if (versionStatus === "outdated") {
    return (
      <div className="extension-version-notice is-warning" role="status">
        <span>
          Nova versao disponivel ({latestVersion}). Sua extensao esta em {installedVersion}.
        </span>
        <a href={latestDownloadUrl || downloadPath} download>
          Baixar atualizacao
        </a>
      </div>
    );
  }

  return (
    <div className="extension-version-notice is-success" role="status">
      <span>
        Extensao detectada ({installedVersion})
        {latestVersion ? ". Voce esta na versao mais recente." : "."}
      </span>
    </div>
  );
}
