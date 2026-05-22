import { ExtensionVersionNotice } from "./components/extension-version-notice";
import { HomeRouter } from "./components/home-router";
import { InstallationGuideModal } from "./components/installation-guide-modal";

const extensionDownloadPath =
  process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_PATH ??
  "/downloads/oddzone-extension.zip";

export default function HomePage() {
  return (
    <HomeRouter>
      <main className="home">
        <section className="home-card">
          <span className="home-kicker">Oddzone</span>
          <h1 className="home-title">Baixe a extensão e comece em segundos.</h1>

          <div className="home-actions">
            <a href={extensionDownloadPath} download className="apple-button">
              Baixar extensao (.zip)
            </a>
          </div>

          <p style={{ marginTop: "14px", color: "#a1a1aa", fontSize: "13px" }}>
            Ao usar a extensão, leia e aceite o{" "}
            <a href="/termos-extensao" style={{ textDecoration: "underline" }}>
              termo de coleta
            </a>
            .
          </p>

          <ExtensionVersionNotice downloadPath={extensionDownloadPath} />

          <div className="install-entry-row">
            <InstallationGuideModal downloadPath={extensionDownloadPath} />
          </div>
        </section>
      </main>
    </HomeRouter>
  );
}
