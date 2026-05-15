import { supabaseExtensionClient } from "../lib/supabase";

type LatestVersionPayload = {
  version: string;
  downloadUrl: string;
  publishedAt: string;
};

async function checkLatestVersion() {
  const latestUrl =
    import.meta.env.WXT_PUBLIC_EXTENSION_LATEST_URL ??
    "http://localhost:3000/api/extension/latest";

  try {
    const response = await fetch(latestUrl);
    if (!response.ok) return null;
    return (await response.json()) as LatestVersionPayload;
  } catch {
    return null;
  }
}

async function registerStartupEvent(
  latest: LatestVersionPayload | null,
  eventType: "startup" | "install"
) {
  if (!supabaseExtensionClient) return;

  await supabaseExtensionClient.from("extension_events").insert({
    event_type: eventType,
    extension_version: chrome.runtime.getManifest().version,
    latest_known_version: latest?.version ?? null,
    update_available: latest
      ? latest.version !== chrome.runtime.getManifest().version
      : null
  });
}

export default defineBackground(() => {
  chrome.runtime.onStartup.addListener(async () => {
    const latest = await checkLatestVersion();
    await registerStartupEvent(latest, "startup");
  });

  chrome.runtime.onInstalled.addListener(async () => {
    const latest = await checkLatestVersion();
    await registerStartupEvent(latest, "install");
  });
});
