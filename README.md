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

## Troubleshooting rápido (ingestão de odds)

Se as odds não estiverem chegando no banco, valide nesta ordem:

1. **Service worker da extensão (Network)**
   - request `POST /api/collector/ingest` precisa retornar `200`.
   - se aparecer `ERR_CONNECTION_REFUSED`, a URL de ingestão está indisponível.
2. **URL de ingestão no build da extensão**
   - produção usa por padrão: `https://oddzone.vercel.app/api/collector/ingest`.
   - valores locais (`localhost`/`127.0.0.1`) são ignorados no build final.
3. **Token compartilhado**
   - `COLLECTOR_EXTENSION_SHARED_TOKEN` (web) deve ser igual ao `WXT_PUBLIC_COLLECTOR_SHARED_TOKEN` (extensão).
4. **Sequência de tabelas no Supabase**
   - conferir `collector_installations` -> `site_sessions` -> `odds_snapshots`.
5. **Snapshots sem odds**
   - se `snapshot.odds` vier vazio no payload, não haverá insert em `odds_snapshots`.
6. **TTL de odds**
   - `odds_snapshots` expira em 1 hora e é limpo pelo `pg_cron` a cada 5 minutos.

## Diagnóstico rápido (produção / connection refused)

Quando ocorrer `ERR_CONNECTION_REFUSED`, siga em blocos:

1. **Extensão (service worker)**
   - procurar logs:
     - `[oddzone][background] iniciado`
     - `[oddzone][ingest] precheck ...`
     - `[oddzone][ingest] envio iniciado`
     - `[oddzone][ingest] erro de rede` ou `[oddzone][ingest] erro http`
   - confirmar URL alvo em todos os logs.
2. **API (Vercel)**
   - buscar logs por `requestId` no prefixo `[collector_ingest]`.
   - validar se evento chegou e com quais headers (`x-collector-source`, token).
3. **Banco (Supabase)**
   - se API recebeu e respondeu `ok`, validar inserts por tipo:
     - `collector_installations` (sempre),
     - `site_sessions` (page_seen),
     - `account_profiles` / `bets` / `odds_snapshots` (snapshot),
     - `collector_failures` (collector_failure).

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

Migrações:

- `supabase/migrations/20260515153000_init_extension_events.sql`
- `supabase/migrations/20260515181000_collector_data_model.sql`

Regras atuais:

- `odds_snapshots`: TTL de 1 hora via `expires_at`.
- Job `pg_cron` executa limpeza a cada 5 minutos.
- Dados de conta/apostas: persistência sem expurgo automático.

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