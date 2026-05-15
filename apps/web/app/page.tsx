const extensionDownloadPath =
  process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_PATH ??
  "/downloads/oddzone-extension.zip";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px"
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "720px",
          background: "#171a21",
          border: "1px solid #2a303d",
          borderRadius: "12px",
          padding: "24px"
        }}
      >
        <h1 style={{ marginTop: 0 }}>Oddzone</h1>
        <p>
          Estrutura inicial em Next.js pronta para evoluir e integrar dados do
          banco.
        </p>

        <a
          href={extensionDownloadPath}
          download
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: "8px",
            background: "#2e8bff",
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none"
          }}
        >
          Baixar extensao do navegador (.zip)
        </a>

        <ol style={{ marginTop: "20px", lineHeight: 1.6 }}>
          <li>Baixe o arquivo zip da extensao.</li>
          <li>Extraia o zip em uma pasta local.</li>
          <li>Abra a pagina de extensoes do navegador.</li>
          <li>Ative o Modo do desenvolvedor.</li>
          <li>Use "Carregar sem compactacao".</li>
        </ol>
      </section>
    </main>
  );
}
