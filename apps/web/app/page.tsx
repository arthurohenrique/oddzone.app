const extensionDownloadPath =
  process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_PATH ??
  "/downloads/oddzone-extension.zip";

export default function HomePage() {
  return (
    <main className="home">
      <section className="home-card">
        <span className="home-kicker">Oddzone</span>
        <h1 className="home-title">Baixe a extensão e comece em segundos.</h1>

        <div className="home-actions">
          <a href={extensionDownloadPath} download className="apple-button">
            Baixar extensão (.zip)
          </a>
        </div>

        <details className="home-guide">
          <summary className="home-guide-summary">
            <span className="home-guide-icon" aria-hidden>
              i
            </span>
            Ver passo a passo
          </summary>
          <ol className="home-steps">
            <li>Baixe o arquivo ZIP da extensão.</li>
            <li>Extraia o ZIP em uma pasta local.</li>
            <li>Abra a página de extensões do navegador.</li>
            <li>Ative o Modo do desenvolvedor.</li>
            <li>Use "Carregar sem compactação".</li>
          </ol>
        </details>
      </section>
    </main>
  );
}
