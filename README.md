# oddzone.app

Base monorepo para:

- `apps/web`: aplicativo Next.js (App Router), com landing, termo e API de ingestão.
- `apps/extension`: extensão WXT com consentimento, detecção `.bet.br` e coleta inicial.
- `supabase/migrations`: migrações SQL para modelo de dados e retenção.
- `docs`: documentação de continuidade para futuras agentes IA.

## Regra visual global do web

No `apps/web`, manter padrão **clean com estética Apple**:

- fundo escuro com poucos elementos;
- tipografia limpa e hierarquia clara;
- superfície discreta com borda suave;
- botões `pill` e foco em ação principal.

Base técnica:

- classe global `theme-apple-clean` em `apps/web/app/layout.tsx`;
- tokens/utilitários em `apps/web/app/globals.css`.

## Configuração de ambiente

1. Copie `.env.example` para `.env`.
2. Preencha as variáveis obrigatórias:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (somente servidor)
   - `COLLECTOR_EXTENSION_SHARED_TOKEN` (servidor)
   - `WXT_PUBLIC_COLLECTOR_SHARED_TOKEN` (extensão)
   - `WXT_PUBLIC_COLLECTOR_INGEST_URL` (opcional, default de build: `https://oddzone.vercel.app/api/collector/ingest`)
   - `WXT_PUBLIC_TERMS_VERSION`
   - `NEXT_PUBLIC_EXTENSION_DOWNLOAD_PATH` (opcional, default: `/downloads/oddzone-extension.zip`)
   - `NEXT_PUBLIC_EXTENSION_VERSION` (opcional, usado pelo endpoint de versao)

## Instalar dependências

```bash
npm install
```

## Rodar localmente

Web (Next.js):

```bash
npm run dev:web
```

Extensao (WXT):

```bash
npm run dev:extension
```

## Fluxo da extensão

- Download no web: `apps/web/public/downloads/oddzone-extension.zip`
- Termo no web: `GET /termos-extensao`
- Ingestão no web: `POST /api/collector/ingest`

Fluxo de uso:

1. Baixar o arquivo `.zip`.
2. Extrair o conteúdo em uma pasta local.
3. Abrir `chrome://extensions`.
4. Ativar modo desenvolvedor.
5. Clicar em `Carregar sem compactação` e selecionar a pasta extraída.
6. Acessar domínio `.bet.br`.
7. Aceitar termo no prompt da extensão.
8. Extensão inicia envio de eventos e snapshots.

Na landing, as instrucoes detalhadas ficam ocultas por padrao e abrem via botao
`Como instalar ?`, em modal visual com cenas animadas em codigo.

## Home condicional + dashboard em tempo real

A home (`/`) detecta automaticamente se o visitante tem a extensão Oddzone instalada:

- **Sem extensão**: mostra a landing (CTA de download + tutorial de instalação).
- **Com extensão**: troca para um dashboard com as últimas 100 odds capturadas em tempo real (polling de 3s).

Detecção via bridge `postMessage` (`oddzone:extension-version:request`/`:response`) que o content script da extensão expõe somente quando o domínio é `oddzone.app`/`oddzone.vercel.app`.

Endpoint de leitura:

- `GET /api/odds/live?limit=100&since=<ISO>` — server-side, usa service role; retorna `{ ok, odds[], stats: { totalActiveOdds, totalUsers }, serverTime }`.

Componentes:

- `apps/web/app/components/home-router.tsx` — alterna landing/dashboard.
- `apps/web/app/components/use-extension-installed.ts` — hook de detecção.
- `apps/web/app/components/live-odds-dashboard.tsx` — feed em tempo real, animação de pulse em nova odd, badge "Ao vivo".

Estilo: dark mode (`#000`) com tokens Apple (`--oz-bg`, `--oz-surface`, `--oz-border`, `--oz-text`) e radial gradients sutis. Tudo em `apps/web/app/globals.css` na seção `===== Loading + Dashboard =====`.

## Modelo de dados (v2 — foco em futebol)

A extensão coleta apenas três grupos de dados objetivos:

1. **Usuário da casa** (`ext_users`): instalação + email, nome, saldo, moeda, consentimento.
2. **Odds de futebol** (`ext_football_odds`): toda odd visível classificada como futebol via score híbrido (URL + breadcrumb + assinatura de mercado + 1X2 + liga). TTL 1h.
3. **Apostas do usuário** (`ext_user_bets`): histórico de apostas exibido em tela (stake, odd, retorno potencial, status).

Eventos enviados pela extensão: `consent_accepted`, `snapshot`. Toda persistência usa uma única chamada por snapshot que atualiza `ext_users` (upsert) e insere `ext_football_odds` + `ext_user_bets`.

## Filtro híbrido de futebol

Cada odd capturada recebe um `confidence_score` (0 a 9). Só entra no banco se `score >= 2`:

- +1 URL contém `futebol`/`soccer`/`football`
- +1 breadcrumb/menu ativo com palavras de futebol
- +1 título da página com palavras de futebol
- +2 mercado exclusivo (BTTS, escanteios, cartões, handicap asiático, dupla chance, etc.)
- +2 card com 3 opções 1/X/2 (mercado 1X2)
- +1 liga reconhecida (Brasileirão, Libertadores, Premier League, La Liga, etc.)
- +1 nome do evento no formato `Time A vs Time B`

## Troubleshooting rápido (ingestão)

Se nada chegar no banco, valide nesta ordem:

1. **Service worker da extensão (Network)** — `POST /api/collector/ingest` deve retornar `200`.
2. **URL de ingestão** — produção: `https://oddzone.vercel.app/api/collector/ingest`.
3. **Token compartilhado** — `COLLECTOR_EXTENSION_SHARED_TOKEN` (web) = `WXT_PUBLIC_COLLECTOR_SHARED_TOKEN` (extensão).
4. **Tabelas no Supabase** — `ext_users` (sempre), `ext_football_odds` + `ext_user_bets` (em snapshots).
5. **Snapshot sem odds** — provavelmente a página não passou no score de futebol (≥2). Verificar `confidence_score` médio dos snapshots recentes.
6. **TTL** — `ext_football_odds` expira em 1h via `expires_at`, limpo por `pg_cron` a cada 5 min.

## Diagnóstico rápido (logs)

1. **Extensão (service worker)** — procurar `[oddzone][background] iniciado`, `[oddzone][ingest] envio iniciado/concluido/erro`.
2. **API (Vercel)** — logs com prefixo `[collector_ingest]` e `requestId`.
3. **Banco (Supabase)** — `select count(*) from ext_football_odds where captured_at > now() - interval '5 min'`.

## Atualização do arquivo da extensão

Gerar zip:

```bash
npm run zip:extension
```

Sincronizar zip gerado para botão de download:

```bash
npm run sync:extension-zip
```

Fluxo completo de release local:

```bash
npm run release:extension
```

O fluxo `release:extension` agora executa:

1. `build:extension` (gera build em `.output/chrome-mv3`)
2. `zip:extension` (artefato auxiliar)
3. `sync:extension-zip` (publica artefatos em `apps/web/public/downloads`)

## Aviso sutil de nova versão no site

O site tenta detectar a versão instalada da extensão e compara com a versão
publicada no endpoint:

- `GET /api/extension/latest`

Quando detectar versão local menor que a versão publicada, o site exibe um aviso
discreto com CTA para baixar o ZIP novamente.

Quando detectar extensão instalada e versão em dia, o site exibe apenas um
feedback sutil de “extensão detectada”.

Observações:

- para usuário sem extensão instalada, o comportamento é silencioso (sem alerta);
- o aviso depende do content script injetado no domínio do site.

## Banco de dados e retenção

Migração ativa:

- `supabase/migrations/20260521210000_collector_reset_v2.sql` — dropa modelo antigo e cria as 3 tabelas (`ext_users`, `ext_football_odds`, `ext_user_bets`).

Regras:

- `ext_football_odds`: TTL de 1 hora via `expires_at`, limpo por `pg_cron` (job `ext_football_odds_expiry_every_5_minutes`).
- `ext_users` e `ext_user_bets`: persistência sem expurgo automático.
- RLS ativo em todas; gravação somente via backend com `SUPABASE_SECRET_KEY`.

## Endpoint de versão da extensão

Endpoint:

- `GET /api/extension/latest`

Retorna:

- versao atual
- URL de download do ZIP
- data de publicação

## Documentação de continuidade

- `docs/collector-architecture.md`
- `docs/ai-handover.md`