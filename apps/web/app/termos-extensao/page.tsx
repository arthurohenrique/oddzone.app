const termsVersion = process.env.WXT_PUBLIC_TERMS_VERSION ?? "2026-05-15-v1";

export default function TermsPage() {
  return (
    <main className="home">
      <section className="home-card">
        <span className="home-kicker">Termo da Extensão</span>
        <h1 className="home-title">Autorização de coleta para domínios `.bet.br`</h1>
        <p className="home-subtitle">
          Versão do termo: <strong>{termsVersion}</strong>
        </p>

        <div style={{ marginTop: "20px", color: "#d3d3d8", lineHeight: 1.75 }}>
          <p>
            Ao aceitar este termo, o usuário autoriza a extensão Oddzone a coletar
            dados de navegação em casas de apostas legalizadas com final `.bet.br`,
            incluindo odds ao vivo, dados de conta exibidos na interface e apostas
            realizadas.
          </p>
          <p>
            Os dados coletados são enviados para processamento interno e armazenados
            no Supabase, conforme a arquitetura técnica do projeto.
          </p>
          <p>
            Dados voláteis (como odds) possuem expiração automática de 1 hora.
            Dados de conta e apostas são mantidos conforme regra operacional do
            sistema.
          </p>
        </div>
      </section>
    </main>
  );
}
