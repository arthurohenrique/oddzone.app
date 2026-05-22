"use client";

import { ReactNode } from "react";
import { useExtensionInstalled } from "./use-extension-installed";
import { LiveOddsDashboard } from "./live-odds-dashboard";

type HomeRouterProps = {
  children: ReactNode;
};

export function HomeRouter({ children }: HomeRouterProps) {
  const detection = useExtensionInstalled();

  if (detection.status === "checking") {
    return (
      <div className="home-loading" aria-live="polite">
        <span className="home-loading-spinner" aria-hidden />
        <span>Verificando extensão…</span>
      </div>
    );
  }

  if (detection.status === "installed") {
    return <LiveOddsDashboard />;
  }

  return <>{children}</>;
}
