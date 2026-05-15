export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    console.debug("[oddzone-extension] content script inicializado");
  }
});
