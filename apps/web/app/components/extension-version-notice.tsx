"use client";

import { useEffect, useMemo, useState } from "react";
import { useExtensionInstalled } from "./use-extension-installed";

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

export function ExtensionVersionNotice({ downloadPath }: ExtensionVersionNoticeProps) {
  const detection = useExtensionInstalled();
  const installedVersion =
    detection.status === "installed" ? detection.version : null;
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [latestDownloadUrl, setLatestDownloadUrl] = useState<string>(downloadPath);

  useEffect(() => {
    if (!installedVersion) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/extension/latest", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as LatestPayload;
        if (cancelled) return;

        if (typeof payload.version === "string") setLatestVersion(payload.version);
        if (typeof payload.downloadUrl === "string") setLatestDownloadUrl(payload.downloadUrl);
      } catch {
        // silencioso quando endpoint indisponivel
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [installedVersion]);

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
