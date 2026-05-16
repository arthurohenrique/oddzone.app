import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  extensionApi: "chrome",
  manifest: {
    name: "Oddzone Extension",
    description: "Coletor para navegacao em dominios de apostas .bet.br.",
    version: "0.1.0",
    permissions: ["storage"],
    host_permissions: [
      "https://oddzone.vercel.app/*",
      "https://*.oddzone.app/*",
      "https://*.bet.br/*"
    ],
    icons: {
      "16": "/logo-favicon.svg",
      "48": "/logo-favicon.svg",
      "128": "/logo-favicon.svg"
    },
    action: {
      default_title: "Oddzone Extension",
      default_icon: {
        "16": "/logo-favicon.svg",
        "48": "/logo-favicon.svg",
        "128": "/logo-favicon.svg"
      }
    }
  }
});
