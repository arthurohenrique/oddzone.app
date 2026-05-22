"use client";

import { useEffect, useState } from "react";

const VERSION_REQUEST_TYPE = "oddzone:extension-version:request";
const VERSION_RESPONSE_TYPE = "oddzone:extension-version:response";
const VERSION_ANNOUNCE_TYPE = "oddzone:extension-version:announce";

const RETRY_DELAYS_MS = [50, 250, 600, 1200, 2400];
const FINAL_TIMEOUT_MS = 4000;

export type ExtensionDetectionState =
  | { status: "checking"; version: null }
  | { status: "installed"; version: string }
  | { status: "missing"; version: null };

type BridgeMessage = {
  type?: string;
  requestId?: string;
  version?: string;
};

export function useExtensionInstalled(): ExtensionDetectionState {
  const [state, setState] = useState<ExtensionDetectionState>({
    status: "checking",
    version: null
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    let resolved = false;
    const timeouts: number[] = [];

    const resolveInstalled = (version: string) => {
      if (resolved) return;
      resolved = true;
      console.info("[oddzone][detect] extensão detectada", { version });
      cleanup();
      setState({ status: "installed", version });
    };

    const resolveMissing = () => {
      if (resolved) return;
      resolved = true;
      console.info("[oddzone][detect] extensão não detectada após timeout");
      cleanup();
      setState({ status: "missing", version: null });
    };

    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window) return;
      if (!event.data || typeof event.data !== "object") return;

      const payload = event.data as BridgeMessage;
      if (
        payload.type !== VERSION_RESPONSE_TYPE &&
        payload.type !== VERSION_ANNOUNCE_TYPE
      ) {
        return;
      }
      if (typeof payload.version !== "string") return;

      resolveInstalled(payload.version);
    };

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      for (const id of timeouts) window.clearTimeout(id);
    };

    window.addEventListener("message", onMessage);

    const sendRequest = () => {
      if (resolved) return;
      const requestId = crypto.randomUUID();
      window.postMessage(
        { type: VERSION_REQUEST_TYPE, requestId },
        window.location.origin
      );
    };

    sendRequest();
    for (const delay of RETRY_DELAYS_MS) {
      timeouts.push(window.setTimeout(sendRequest, delay));
    }
    timeouts.push(window.setTimeout(resolveMissing, FINAL_TIMEOUT_MS));

    return cleanup;
  }, []);

  return state;
}
