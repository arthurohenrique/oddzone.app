# Handover para futuras agentes IA

Este documento registra estado atual, decisões e próximos passos para continuidade sem perda de contexto.

## Atualização recente (2026-05-21) — reset v2: foco em futebol + 3 tabelas

### Contexto

Auditoria mostrou que **nenhuma tabela do coletor existia no banco de produção** (`bethedge-prod`, projeto Supabase `uvjleaeipxqnqbvtlarp`). As migrations antigas (`20260515153000_init_extension_events.sql` e `20260515181000_collector_data_model.sql`) nunca foram aplicadas no remoto — toda tentativa de ingestão da extensão falhava silenciosamente porque as tabelas-alvo (`collector_installations`, `account_profiles`, `bets`, `odds_snapshots`, etc.) não existiam.

O usuário pediu, simultaneamente:

1. Estruturar o que é coletado das casas de apostas.
2. Focar em **odds de futebol** e **dados da conta do usuário** (nome, email, saldo, apostas realizadas).
3. Reformular o banco com boas práticas, poucas tabelas, objetivo.

### Decisões tomadas nesta rodada (confirmadas com o usuário via AskUserQuestion)

1. **Modelo enxuto de 3 tabelas** (não manter o modelo antigo de 8 tabelas, não usar single-table-jsonb).
2. **Filtro híbrido de futebol com score de confiança** (não apenas URL/breadcrumb nem só assinatura de mercado).
3. **Migration destrutiva autorizada** — como nada do coletor existia, foi feito `drop ... cascade` no modelo antigo e criação do novo do zero.

### Arquivos alterados nesta rodada

#### 1) `supabase/migrations/20260521210000_collector_reset_v2.sql` (novo) — APLICADA NO REMOTO

- Dropa em cascade: `collector_installations`, `consent_terms`, `user_consents`, `site_sessions`, `account_profiles`, `bets`, `odds_snapshots`, `collector_failures`, `extension_events`.
- Cria 3 tabelas novas com prefixo `ext_` (isolamento claro do sistema bethedge-prod que compartilha o schema `public`):
  - **`ext_users`** (`install_id` pk) — instalação + perfil capturado: `bookmaker`, `email`, `display_name`, `balance_cents`, `currency`, `extension_version`, `consent_accepted_at`, `consent_term_version`, `first_seen_at`, `last_seen_at`, `updated_at`. Índices: `bookmaker`, `email` (parcial).
  - **`ext_football_odds`** — `install_id` (fk), `bookmaker`, `league`, `event_name`, `home_team`, `away_team`, `market`, `selection`, `odd_value`, `confidence_score`, `page_url`, `captured_at`, `expires_at (now + 1h)`. Índices: `(install_id, captured_at desc)`, `(bookmaker, event_name, market)`, `expires_at`.
  - **`ext_user_bets`** — `install_id` (fk), `bookmaker`, `betslip_id`, `league`, `event_name`, `market`, `selection`, `stake_cents`, `odd_value`, `potential_return_cents`, `status`, `placed_at`, `captured_at`. Índice único parcial `(install_id, bookmaker, betslip_id) where betslip_id is not null` (habilita upsert).
- Recria função `private.cleanup_expired_football_odds()` + cron job `ext_football_odds_expiry_every_5_minutes`.
- RLS habilitado em todas, sem grant para `anon`/`authenticated` — gravação apenas via backend com service role.

#### 2) `apps/extension/lib/collector-types.ts` — REESCRITO

Payload simplificado. Apenas dois `eventType`: `consent_accepted` e `snapshot`. Eliminados `extension_lifecycle`, `page_seen`, `collector_failure`, `lifecycleEventType`, `failureCode`, etc. Novos tipos:

- `AccountProfilePayload`: `email`, `displayName`, `balanceCents`, `currency`.
- `FootballOddPayload`: `league`, `eventName`, `homeTeam`, `awayTeam`, `market`, `selection`, `oddValue` (não-nulo), `confidenceScore`.
- `UserBetPayload`: `betslipId`, `league`, `eventName`, `market`, `selection`, `stakeCents`, `oddValue`, `potentialReturnCents`, `status`, `placedAt`.
- `SnapshotPayload`: `bookmaker`, `pageUrl`, `account`, `odds[]`, `bets[]`.
- `CollectorIngestPayload`: `eventType`, `installationId`, `extensionVersion`, `bookmaker`, `pageUrl`, `capturedAt`, `consent`, `snapshot?`.

Note: removidos todos os `rawPayload: Record<string, unknown>` para fugir do dump de DOM no banco. Cada campo é tipado.

#### 3) `apps/extension/lib/provider-adapters.ts` — REESCRITO

Único parser, sem provedores específicos por enquanto. Componentes:

- **`detectFootballSignals(doc, location)`** — sinais de página: URL contém `futebol`/`soccer`/`football`; breadcrumb/menu lateral marcado; `document.title`.
- **`buildEventContext(element)`** — encontra o card do evento (heurística `[class*="event-card"]`, `[class*="match-card"]`, `[class*="fixture"]`, etc.), extrai `eventName`, parseia `Time A vs Time B` (separadores `vs`/`x`/`v`/`-`), detecta `market` via `[data-market]`/`[class*="market-name"]`, detecta liga contra `KNOWN_LEAGUES`, detecta padrão 1X2 procurando rótulos `1`/`x`/`empate`/`draw`/`2`/`fora`/`away` no mesmo card.
- **`buildConfidenceScore(context, pageSignals)`** — soma: `+1` URL, `+1` breadcrumb, `+1` título, `+2` mercado exclusivo (BTTS/escanteios/cartões/handicap asiático/dupla chance/total de gols), `+2` 1X2 detectado, `+1` liga reconhecida, `+1` `homeTeam && awayTeam`. **Limiar de entrada: `>= 2`.**
- **`collectFootballOdds`** — varre até 400 elementos via lista de `ODD_ELEMENT_SELECTORS`, extrai odd numérica (faixa 1.01–1000), aplica score, dedupe por `(value, selection, market, eventName)`.
- **`collectAccount`** — `display_name` (várias heurísticas), `email` via regex no DOM (primeiro em elementos suspeitos, fallback em `body.textContent`), saldo com parser de moeda multi-currency (BRL/USD/EUR).
- **`collectUserBets`** — varre linhas em `[data-testid*="bet-history"]`/`[class*="my-bets"]`/etc., extrai stake, odd, retorno potencial, status.
- **`detectBookmaker(hostname)`** — pega o terceiro segmento de domínio (ex.: `betano.bet.br` → `betano`).

Listas extensíveis sem mudar schema:
- `KNOWN_LEAGUES` (Brasileirão, Libertadores, Premier League, Champions, La Liga, Bundesliga, Serie A/B/C/D, Sul-Americana, Copa do Brasil, Mundial, Eredivisie, MLS, J-League, etc.)
- `FOOTBALL_MARKET_KEYWORDS` (ambos marcam/BTTS, escanteios/corners, cartões/cards, handicap asiático, 1X2, dupla chance, total de gols, primeiro/segundo tempo, HT/FT, marcador correto, draw no bet, empate anula).

#### 4) `apps/extension/entrypoints/background.ts` — REESCRITO

Removidos handlers de `extension_lifecycle`, `page_seen` e `collector_failure`. Restam:

- `collector:get-consent` — retorna estado de aceite.
- `collector:accept-consent` — persiste aceite + envia `consent_accepted`.
- `collector:snapshot` — envia o payload completo (conta + odds + bets) em uma única chamada.

#### 5) `apps/extension/entrypoints/content.ts` — REESCRITO

Removida lógica de `page_seen` / `report_failure`. Comportamento:

- Detecta `.bet.br`, exibe prompt de consentimento se necessário.
- `MutationObserver` + monitor de URL (1.5s) para SPAs.
- Debounce de 1.5s no envio; cooldown de 1.5s entre snapshots; deduplicação por assinatura.
- Snapshot só vai pro background se tiver pelo menos `account`, alguma odd ou alguma bet (corta ruído).
- Bridge de versão para `oddzone.app` preservado.

#### 6) `apps/web/app/api/collector/ingest/route.ts` — REESCRITO

- Aceita só `consent_accepted` e `snapshot`. Validações estritas: `installationId`, `extensionVersion`, `bookmaker`, `capturedAt`, `consent.accepted` obrigatórios.
- **`upsertUser`** (sempre) — atualiza `ext_users` com último visto; preenche email/nome/saldo só se vierem no payload (não sobrescreve com `null`).
- **`insertOdds`** (em snapshot) — filtra `oddValue >= 1.01`, insere em lote em `ext_football_odds`.
- **`upsertBets`** (em snapshot) — separa em dois grupos: com `betslipId` (upsert no conflito de `(install_id, bookmaker, betslip_id)`) e sem (insert simples).
- Retorna `{ ok, requestId, oddsInserted, betsInserted }` para debugging fácil.
- Mantém check de token (`X-Collector-Token`) e origem (`X-Collector-Source: oddzone-extension`).

#### 7) `README.md`

- Substituída seção de troubleshooting/diagnóstico antiga (que referenciava tabelas inexistentes) por uma nova focada nas 3 tabelas atuais.
- Adicionada seção "Modelo de dados (v2 — foco em futebol)" e "Filtro híbrido de futebol".
- Atualizada seção "Banco de dados e retenção" para apontar a migration v2.

#### 8) `docs/collector-architecture.md` — REESCRITO

Documento agora descreve o pipeline v2 ponta-a-ponta: 3 tabelas com colunas, filtro híbrido com a fórmula do score, componentes por arquivo, segurança, release e estratégia de evolução.

### Validações executadas

- Migration aplicada no remoto via MCP Supabase: `apply_migration` retornou `{success:true}`.
- Conferência de schema: `ext_users` (12 cols), `ext_football_odds` (14 cols), `ext_user_bets` (14 cols).
- Teste manual de pipeline: insert de 1 user + 2 odds + 1 bet com FK funcionando; cleanup via cascade ok.
- `npm run build:extension` (ok, 23kB total).
- `npm run build:web` (ok, rotas estáticas e dinâmicas renderizando).
- `tsc --noEmit` no `apps/web` sem erros.
- `tsc --noEmit` no `apps/extension` reporta apenas erros pré-existentes do WXT (auto-imports `defineBackground`/`defineContentScript` — esperado, só funcionam no build do WXT).
- Supabase advisors: as 3 tabelas novas aparecem como `rls_enabled_no_policy` nível INFO. **Comportamento desejado** — gravação só via service role, que bypassa RLS.

### Limitações remanescentes (não tocadas nesta rodada)

- Token compartilhado segue como controle de atrito.
- Nenhum parser específico por casa (`betano.ts`, `bet365.ts`, etc.) — só o adaptador genérico com filtro híbrido.
- Sem testes automatizados; cobertura real só conhecida com extensão rodando em ambiente real.
- `placed_at` de bets sempre `null` no momento — parser do histórico ainda não extrai data.
- Score mínimo `>= 2` é heurístico; pode precisar de calibração depois de ver dados reais.

### Como validar em ambiente real

1. `npm run release:extension` (gera novo zip em `apps/web/public/downloads`).
2. Recarregar extensão no Chrome via `chrome://extensions` (Carregar sem compactação ou Atualizar).
3. Visitar uma casa `.bet.br` com odds visíveis (ex.: `betano.bet.br/futebol/...`).
4. Aceitar o termo.
5. Conferir `POST /api/collector/ingest` 200 no DevTools do service worker.
6. No Supabase: `select count(*) from ext_football_odds where captured_at > now() - interval '5 min';` deve retornar > 0.
7. `select email, display_name, balance_cents from ext_users order by last_seen_at desc limit 5;` para conferir captura de conta.

### Prioridade recomendada para próxima rodada

1. **Validar em produção real**: rodar extensão em 3+ casas `.bet.br`, observar `confidence_score` médio e ajustar limiar/sinais se necessário.
2. **Estender `KNOWN_LEAGUES` e `FOOTBALL_MARKET_KEYWORDS`** com base no que aparece nos dados.
3. **Extrair `placed_at` real** das linhas de aposta (parser de data/hora).
4. **Parser dedicado por casa** quando o filtro genérico não cobrir alguma (`apps/extension/lib/providers/<casa>.ts`).
5. **Rate limit por `install_id`** no endpoint de ingestão.
6. **Painel interno simples** para inspecionar odds e bets recentes (consulta direta às 3 tabelas).

## Atualização recente (2026-05-15) - correção de ingestão e reforço de coleta

### Contexto do incidente

- Sintoma reportado: extensão instalada sem erro, mas odds não chegando no banco.
- Evidência no service worker (Network): `net::ERR_CONNECTION_REFUSED` no request de ingestão.
- Causa raiz imediata: endpoint de ingestão inacessível para o build carregado da extensão (URL/configuração ambiente).
- Causa funcional adicional: coleta de odds baseada em heurística pontual, sem observação contínua de DOM em páginas SPA.

### Objetivo desta rodada

1. Normalizar conectividade para ingestão em produção.
2. Melhorar cobertura de extração de odds.
3. Incluir coleta contínua para páginas dinâmicas.
4. Aumentar observabilidade de falhas no fluxo.
5. Registrar runbook de troubleshooting para operações e próximas agentes.

### Arquivos alterados nesta rodada

#### 1) `apps/extension/lib/collector-config.ts`

- Default de ingestão alterado para produção:
  - `DEFAULT_INGEST_URL` agora é `https://oddzone.vercel.app/api/collector/ingest`.
- Mantido override por `WXT_PUBLIC_COLLECTOR_INGEST_URL`.
- Adicionada resolução defensiva da URL (`resolveIngestUrl`) para tratar valor vazio.

Impacto: reduz chance de `ERR_CONNECTION_REFUSED` por fallback local indevido em builds de uso real.

#### 2) `apps/extension/wxt.config.ts`

- `host_permissions` ampliado com:
  - `https://oddzone.vercel.app/*`
  - `http://127.0.0.1:3000/*`

Impacto: evita bloqueio de requisição por permissão de host para o endpoint de ingestão.

#### 3) `apps/extension/lib/collector-api.ts`

- Mensagem de erro de ingestão enriquecida com `status`, `url` e trecho de body da resposta.

Impacto: diagnóstico rápido de falhas HTTP (401/400/500) sem depender apenas de stack trace.

#### 4) `apps/extension/entrypoints/background.ts`

- `onStartup` e `onInstalled` protegidos com `try/catch` + `console.error`.
- Tratamento de erro em `onMessage` agora registra `messageType` e detalhe da falha.

Impacto: erros no background deixam de ser silenciosos durante lifecycle e mensagens de coleta.

#### 5) `apps/extension/lib/provider-adapters.ts`

- Estratégia de extração de odds reforçada:
  - novos seletores genéricos;
  - seletores específicos por provedor (`betano`, `sportingbet`, `bet365`, `superbet`);
  - parsing de odds por atributos e texto, com validação de faixa;
  - deduplicação de odds;
  - tentativa de enriquecer `eventName`, `market`, `selection` por contexto DOM;
  - inclusão de `oddsCount` em `rawPayload`.

Impacto: aumento de cobertura e redução de snapshots com `odds: []`.

#### 6) `apps/extension/entrypoints/content.ts`

- Envio robusto com `sendAndAssert` (falha explícita quando background retorna `ok: false`).
- Coleta inicial + coleta contínua:
  - `MutationObserver` para mudanças de DOM;
  - monitor de mudança de URL para SPA;
  - debounce/cooldown para evitar excesso de snapshots;
  - assinatura de snapshot para deduplicar envios.
- Melhoria de reporte de falhas (`collector:failure`) com cooldown.

Impacto: coleta deixa de depender apenas do primeiro carregamento de página.

#### 7) `apps/web/app/api/collector/ingest/route.ts`

- Logs estruturados adicionados:
  - token inválido,
  - origem inválida,
  - evento recebido,
  - erro de ingestão,
  - snapshot sem odds.

Impacto: facilita identificar se falha é conectividade, autenticação, validação ou extração.

#### 8) `README.md`

- Documentado fallback de ingestão em produção.
- Nova seção de troubleshooting operacional para odds/ingestão.

Impacto: melhora onboarding e operação sem precisar abrir código.

#### 9) `docs/collector-architecture.md`

- Fluxo atualizado com coleta contínua em DOM/URL.
- Parser documentado como híbrido (genérico + por provedor).
- Checklist operacional mínimo adicionado.

Impacto: arquitetura refletindo comportamento real implementado.

### Validações executadas

- Build da extensão: `npm run build:extension` (ok).
- Build web: `npm run build:web` (ok).
- Lints dos arquivos alterados: sem erros.
- Teste de conectividade de endpoint em produção:
  - `POST https://oddzone.vercel.app/api/collector/ingest` respondeu HTTP `400` sem payload válido.
  - Interpretação: endpoint está acessível (não houve `connection refused`).

### Como validar em ambiente real (passo a passo curto)

1. Recarregar extensão no navegador com o novo build.
2. Abrir DevTools do service worker da extensão.
3. Acessar uma casa `.bet.br` com odds visíveis.
4. Confirmar `POST /api/collector/ingest` com status `200`.
5. Inspecionar payload `snapshot` e validar `snapshot.odds.length > 0`.
6. No banco, validar sequência:
   - `collector_installations`,
   - `site_sessions`,
   - `odds_snapshots`.
7. Em caso de falha, usar logs do endpoint para classificar o erro.

### Limitações remanescentes (não resolvidas nesta rodada)

- Token compartilhado continua sendo controle de atrito (não autenticação forte).
- Parsers ainda podem quebrar com mudanças de DOM dos provedores.
- Não há rate limit/deduplicação no backend.
- Não há suíte automatizada com fixtures HTML por provedor.

### Prioridade recomendada para próxima rodada

1. Implementar parsers por provedor em módulos separados (`providers/*`).
2. Adicionar teste automatizado por fixtures de HTML.
3. Incluir deduplicação/rate limit no endpoint de ingestão.
4. Evoluir autenticação por instalação com credenciais rotativas.

## Atualização recente (2026-05-15) - auto-update da extensão sem loja

### Contexto e decisão

- A distribuição antiga (`ZIP + Carregar sem compactação`) não oferece auto-update nativo para usuários já instalados.
- Foi adotada distribuição auto-hospedada com `.crx` assinado + `update_url` + XML de updates.
- Mantido objetivo de não usar Chrome Web Store.

### Objetivo desta rodada

1. Permitir atualização automática no Chrome para instalações via `.crx`.
2. Preservar ID estável da extensão entre releases.
3. Documentar operação de release e migração dos usuários antigos.

### Arquivos alterados nesta rodada

#### 1) `apps/extension/wxt.config.ts`

- Inclusão de `update_url` no manifesto (default para `https://oddzone.vercel.app/downloads/oddzone-extension-updates.xml`).
- Inclusão opcional de `key` via env (`WXT_PUBLIC_EXTENSION_KEY` / `ODDZONE_EXTENSION_PUBLIC_KEY`) para manter ID estável.

Impacto: o Chrome passa a consultar feed de atualização para extensões instaladas via CRX.

#### 2) `scripts/build-extension-crx.mjs` (novo)

- Script de release para gerar:
  - `oddzone-extension.crx`
  - `oddzone-extension-updates.xml`
- Usa chave privada via:
  - `ODDZONE_EXTENSION_PRIVATE_KEY` (conteúdo) ou
  - `ODDZONE_EXTENSION_PRIVATE_KEY_PATH` (arquivo `.pem`).
- Deriva e registra `extensionId` estável a partir da chave pública.

Impacto: padroniza build assinado e produção de manifest XML de update.

#### 3) `scripts/sync-extension-zip.mjs`

- Fluxo expandido para sincronizar três artefatos em `apps/web/public/downloads`:
  - `.zip` (auxiliar)
  - `.crx` (distribuição)
  - `.xml` (update manifest)

Impacto: garante publicação conjunta dos artefatos necessários para auto-update.

#### 4) `package.json`

- Novo comando: `npm run crx:extension`.
- `npm run release:extension` atualizado para:
  - `build:extension`
  - `zip:extension`
  - `crx:extension`
  - `sync:extension-zip`
- Dependência de build adicionada: `crx3`.

Impacto: pipeline local/CI passa a gerar e publicar CRX + XML no mesmo fluxo.

#### 5) `apps/web/app/api/extension/latest/route.ts`

- Download padrão alterado para `.crx`.
- Resposta inclui `updateManifestUrl`.

Impacto: endpoint de metadados reflete a distribuição real da extensão.

#### 6) `apps/web/app/page.tsx`

- Botão de download alterado para `.crx`.
- Passo a passo visual atualizado para instalação por CRX.
- Aviso de migração única para usuários da instalação antiga via unpacked ZIP.

Impacto: onboarding alinhado com o novo mecanismo de atualização automática.

#### 7) `README.md`

- Novas variáveis de ambiente do fluxo CRX/update.
- Novo fluxo de release e troubleshooting de auto-update.
- Seção de uso atualizada para instalação por `.crx`.

Impacto: operação e suporte têm guia completo sem depender de conhecimento implícito.

### Validações executadas

- `npm run build:extension` (ok).
- `npm run build:web` (ok).
- `npm run crx:extension` sem secrets (falha esperada com mensagem clara sobre variáveis obrigatórias).
- Lints dos arquivos alterados sem erros.

### Riscos e cuidados operacionais

1. **Rotação/perda da chave** quebra continuidade de updates (ID muda).
2. **Ambiente sem variáveis de chave** impede geração de CRX no release.
3. **Usuários antigos (unpacked)** exigem migração única para `.crx`.

### Runbook rápido (release CRX)

1. Configurar `WXT_PUBLIC_EXTENSION_KEY` e chave privada (`ODDZONE_EXTENSION_PRIVATE_KEY` ou `ODDZONE_EXTENSION_PRIVATE_KEY_PATH`).
2. Executar `npm run release:extension`.
3. Confirmar artefatos em `apps/web/public/downloads`:
   - `oddzone-extension.crx`
   - `oddzone-extension-updates.xml`
4. Confirmar download público do CRX e XML.
5. Validar update no `chrome://extensions`.

## Atualização recente (2026-05-15) - reversão para ZIP + aviso de versão no site

### Contexto e decisão

- O fluxo CRX fora da loja não ficou viável para público comum no Chrome.
- O projeto voltou para distribuição por ZIP + instalação unpacked.
- Para reduzir atrito operacional, o site passou a detectar versão instalada e sinalizar atualização de forma sutil.

### Arquivos alterados nesta rodada

#### 1) `apps/web/app/page.tsx`

- CTA principal voltou para download `.zip`.
- Home integra componente de aviso de versão da extensão.

#### 2) `apps/web/app/api/extension/latest/route.ts`

- Resposta simplificada para `version`, `downloadUrl` (ZIP) e `publishedAt`.
- Removido campo de update manifest CRX no contrato público.

#### 3) `apps/extension/wxt.config.ts`

- Removidos `update_url` e `key` do manifesto.

#### 4) `apps/extension/entrypoints/content.ts`

- Adicionado bridge `postMessage` no domínio `oddzone.app` para retornar versão instalada da extensão.
- Comportamento de coleta em `.bet.br` preservado.

#### 5) `apps/web/app/components/extension-version-notice.tsx` (novo)

- Consulta versão instalada via bridge.
- Consulta versão publicada via `/api/extension/latest`.
- Exibe:
  - aviso discreto com CTA de download quando desatualizada;
  - feedback sutil de “extensão detectada” quando atualizada.

#### 6) `scripts/sync-extension-zip.mjs` e `package.json`

- Pipeline voltou a publicar apenas ZIP.
- Removidos `crx:extension` e dependência `crx3`.
- `release:extension` agora: `build -> zip -> sync`.

#### 7) `README.md` e `docs/collector-architecture.md`

- Documentação alinhada ao fluxo ZIP + atualização manual assistida no site.

### Validações executadas

- `npm run build:extension` (ok).
- `npm run build:web` (ok).
- Lints dos arquivos alterados sem erros.

## Atualização recente (2026-05-15) - diagnóstico por partes da ingestão

### Objetivo

- Isolar falhas de produção (`ERR_CONNECTION_REFUSED`) com evidência simples em logs.

### Mudanças implementadas

#### 1) `apps/extension/lib/collector-api.ts`

- Logs objetivos no envio:
  - `envio iniciado` (evento, URL, timestamp),
  - `erro de rede` (com `navigator.onLine` quando disponível),
  - `erro http` (status + URL),
  - `envio concluido`.
- Precheck de conectividade uma vez por sessão:
  - `precheck concluido` (status) ou
  - `precheck host inacessivel`.

#### 2) `apps/extension/entrypoints/background.ts`

- Log único de startup:
  - versão da extensão e URL ativa de ingestão.

#### 3) `apps/web/app/api/collector/ingest/route.ts`

- Logs de entrada/erro com `requestId` para correlação.
- Loga `eventType`, `installationId`, `siteDomain`, `x-collector-source` e presença de token.

#### 4) `README.md`

- Novo runbook de diagnóstico em 3 blocos:
  1. extensão,
  2. API (requestId),
  3. banco.

### Como usar no próximo incidente

1. Capturar logs da extensão e identificar URL/tipo da falha (rede vs HTTP).
2. Correlacionar no backend pelo `requestId`.
3. Validar inserts esperados no Supabase conforme `eventType`.

## Estado atual (após reset v2 de 2026-05-21)

### 1) Coleta com consentimento

- Coleta só inicia em domínios `.bet.br`.
- Sem consentimento, a extensão mostra prompt e bloqueia captura.
- Ao aceitar, persiste `acceptedAt`, `termVersion`, `termHash`, gera/persiste `installation_id` e envia evento `consent_accepted`.

Arquivos: `apps/extension/entrypoints/content.ts`, `apps/extension/lib/collector-consent.ts`, `apps/extension/lib/collector-config.ts`.

### 2) Pipeline de ingestão (v2)

- Content script monta um único `SnapshotPayload` (account + odds + bets) via `collectSnapshotFromPage`.
- Background envia `POST /api/collector/ingest` com `eventType: "snapshot"`.
- API valida cabeçalhos e payload, **upserta `ext_users`** + **insere `ext_football_odds`** + **upserta `ext_user_bets`** usando `SUPABASE_SECRET_KEY`.

Arquivos: `apps/extension/entrypoints/background.ts`, `apps/extension/lib/collector-api.ts`, `apps/extension/lib/collector-types.ts`, `apps/extension/lib/provider-adapters.ts`, `apps/web/app/api/collector/ingest/route.ts`.

### 3) Modelo de banco (v2)

Apenas **3 tabelas** com prefixo `ext_`:

- `ext_users` — perfil capturado da casa por instalação (email, nome, saldo, moeda) + consentimento.
- `ext_football_odds` — odds de futebol com `confidence_score`. TTL 1h via `expires_at` + cron `*/5 * * * *`.
- `ext_user_bets` — apostas realizadas. Upsert por `(install_id, bookmaker, betslip_id)` quando há id.

Arquivo: `supabase/migrations/20260521210000_collector_reset_v2.sql` (aplicada no remoto em 2026-05-21).

Tabelas do modelo v1 (`collector_installations`, `consent_terms`, `user_consents`, `site_sessions`, `account_profiles`, `bets`, `odds_snapshots`, `collector_failures`, `extension_events`) foram **dropadas em cascade** e não devem ser referenciadas.

### 4) Filtro de futebol

Cada odd ganha `confidence_score` em `buildConfidenceScore`. Só persiste se `score >= 2`. Sinais somáveis: URL (+1), breadcrumb (+1), título (+1), mercado exclusivo (+2), 1X2 detectado (+2), liga reconhecida (+1), `home vs away` (+1).

Listas extensíveis em `apps/extension/lib/provider-adapters.ts`: `KNOWN_LEAGUES`, `FOOTBALL_MARKET_KEYWORDS`, `FOOTBALL_URL_KEYWORDS`, `FOOTBALL_BREADCRUMB_KEYWORDS`.

## Decisões arquiteturais importantes

1. **3 tabelas, sem rawPayload** — schema relacional puro; o que não couber em coluna tipada não vai pro banco.
2. **Coleta orientada a snapshot único** — um POST por captura agrega conta + odds + bets; evita N requests por evento.
3. **Persistência sensível só no backend**, nunca direto com chave pública.
4. **RLS habilitado, sem policy** — gravação apenas via service role; queries de leitura precisam usar service role no backend.
5. **TTL de 1h em odds** (`pg_cron`), persistência indefinida em users/bets.
6. **Termo versionado** para rastreabilidade de aceite.
7. **Prefixo `ext_`** isola as tabelas da extensão do schema compartilhado com `bethedge-prod`.

## Riscos conhecidos

1. **Token compartilhado da extensão** é fraco contra engenharia reversa.
2. **Filtro híbrido é heurístico** — limiar `>= 2` precisa calibração após observar dados reais.
3. Falta rate limiting explícito no endpoint de ingestão.
4. Falta observabilidade centralizada (dashboard/alertas).
5. **Sem parsers por provedor** — uma casa com DOM atípico pode produzir baixo `confidence_score`.

## Próximas tarefas recomendadas (ordem sugerida)

1. **Validar em produção real** com 3+ casas; ajustar listas de palavras-chave e limiar.
2. Extrair `placed_at` real das linhas de bet history.
3. Implementar parsers por provedor (`apps/extension/lib/providers/<casa>.ts`) somando sinais ao score.
4. Rate limit por `install_id` no endpoint de ingestão.
5. Painel interno simples para inspecionar `ext_football_odds`, `ext_user_bets`, `ext_users` recentes.
6. Autenticação forte por instalação (chave assimétrica por dispositivo).
7. Testes automatizados com fixtures de HTML por provedor.

## Contrato mínimo para continuidade

Ao adicionar novos campos ou tipos:

1. Atualizar `SnapshotPayload`/`CollectorIngestPayload` em `apps/extension/lib/collector-types.ts`.
2. Atualizar parser correspondente em `apps/extension/lib/provider-adapters.ts`.
3. Atualizar validação + insert no `POST /api/collector/ingest`.
4. Criar migração SQL adicionando coluna/tabela (não dropar `ext_*` sem alinhamento).
5. Documentar no `docs/collector-architecture.md` e atualizar `Estado atual` neste handover.

## Checklists operacionais

### Antes de deploy

- [ ] `npm run build:extension` passa
- [ ] `npm run build:web` passa
- [ ] `npm run release:extension` gera zip atualizado em `apps/web/public/downloads`
- [ ] migrations novas aplicadas no Supabase (`mcp__claude_ai_Supabase__apply_migration` ou CLI)
- [ ] endpoint `/api/collector/ingest` responde 400 sem payload (saúde)

### Após deploy

- [ ] `select count(*) from ext_users where last_seen_at > now() - interval '1 hour'` > 0
- [ ] `select count(*) from ext_football_odds where captured_at > now() - interval '5 min'` > 0
- [ ] `select count(*) from ext_user_bets where captured_at > now() - interval '1 hour'` > 0 (se houver usuário com apostas abertas)
- [ ] `select count(*) from ext_football_odds where expires_at < now()` deve manter próximo de 0 (job de purge ativo)
- [ ] `select avg(confidence_score) from ext_football_odds where captured_at > now() - interval '1 hour'` para acompanhar qualidade do filtro
