import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  extensionApi: "chrome",
  manifest: {
    name: "Oddzone Extension",
    description: "Base inicial da extensao com check de atualizacao.",
    version: "0.1.0",
    permissions: ["storage"],
    host_permissions: [
      "http://localhost:3000/*",
      "https://*.supabase.co/*"
    ],
    action: {
      default_title: "Oddzone Extension"
    }
  }
});
