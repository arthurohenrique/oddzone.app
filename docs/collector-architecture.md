# Arquitetura do coletor `.bet.br` (v2)

## Visão geral

Pipeline focado em três coisas: **odds de futebol**, **conta do usuário** (email, nome, saldo) e **apostas realizadas**.

1. **Content script (WXT)** detecta domínio `.bet.br` e exibe prompt de consentimento.
2. **Adaptador único** percorre o DOM, classifica cada odd via score híbrido de futebol, lê dados de conta e histórico de apostas.
3. **Background** empacota um único evento `snapshot` e envia para a API.
4. **API Next.js** valida token, upserta `ext_users` e insere `ext_football_odds` + `ext_user_bets` em lote.
5. **Postgres + pg_cron** aplica TTL de 1h em `ext_football_odds`.

Apenas dois tipos de evento existem: `consent_accepted` e `snapshot`.

## Modelo de dados

Três tabelas (`supabase/migrations/20260521210000_collector_reset_v2.sql`):

### `ext_users`
Perfil do usuário capturado por instalação. Upsertado em todo snapshot.

| Coluna | Tipo | Descrição |
| ------ | ---- | --------- |
| `install_id` | `text` (pk) | UUID gerado pela extensão |
| `bookmaker` | `text` | slug do domínio (ex.: `betano`) |
| `email` | `text` | extraído do DOM (regex de email) |
| `display_name` | `text` | nome/username exibido |
| `balance_cents` | `bigint` | saldo em centavos |
| `currency` | `text` | `BRL`, `USD`, `EUR` |
| `extension_version` | `text` | versão do manifesto |
| `consent_accepted_at` | `timestamptz` | momento do aceite |
| `consent_term_version` | `text` | versão do termo |
| `first_seen_at` / `last_seen_at` / `updated_at` | `timestamptz` | janela de atividade |

### `ext_football_odds`
Toda odd classificada como futebol. TTL de 1h.

| Coluna | Tipo | Descrição |
| ------ | ---- | --------- |
| `install_id` | `text` (fk) | usuário |
| `bookmaker` | `text` | casa |
| `league` | `text` | liga reconhecida (best effort) |
| `event_name` | `text` | nome do evento |
| `home_team` / `away_team` | `text` | times (parse `vs`/`x`/`-`) |
| `market` | `text` | mercado contextual |
| `selection` | `text` | rótulo da seleção |
| `odd_value` | `numeric(10,4)` | valor numérico |
| `confidence_score` | `smallint` | 0–9, ver filtro híbrido |
| `page_url` | `text` | URL onde foi vista |
| `captured_at` | `timestamptz` | quando |
| `expires_at` | `timestamptz` | now + 1h |

### `ext_user_bets`
Apostas realizadas pelo usuário lidas do histórico/apostas abertas.

| Coluna | Tipo | Descrição |
| ------ | ---- | --------- |
| `install_id` | `text` (fk) | usuário |
| `bookmaker` | `text` | casa |
| `betslip_id` | `text` | id da casa (quando exposto) |
| `league` / `event_name` / `market` / `selection` | `text` | contexto |
| `stake_cents` / `potential_return_cents` | `bigint` | valores em centavos |
| `odd_value` | `numeric(10,4)` | odd da aposta |
| `status` | `text` | open, won, lost, void |
| `placed_at` | `timestamptz` | quando colocada |
| `captured_at` | `timestamptz` | quando capturada |

Índice único `(install_id, bookmaker, betslip_id)` quando `betslip_id` não é nulo — apostas com id são upsertadas, sem id são apenas inseridas.

## Filtro híbrido de futebol

Cada odd só entra no banco se `confidence_score >= 2`. Sinais somados:

- `+1` URL contém `futebol`/`soccer`/`football`
- `+1` breadcrumb/menu lateral marcado com `Futebol`
- `+1` `document.title` contém palavra-chave de futebol
- `+2` mercado contém termo exclusivo de futebol (BTTS, escanteios, cartões, handicap asiático, dupla chance, total de gols, etc.)
- `+2` card do evento expõe 3 opções 1/X/2 (assinatura clássica)
- `+1` liga reconhecida na lista (`KNOWN_LEAGUES` em `provider-adapters.ts`)
- `+1` nome do evento parseável como `Time A vs Time B`

A lista de palavras-chave e ligas fica em `apps/extension/lib/provider-adapters.ts` e pode ser estendida sem mudar schema.

## Componentes por arquivo

### Extensão

- `apps/extension/entrypoints/content.ts` — detecta `.bet.br`, prompt de consentimento, observa DOM e URL, dispara snapshots com cooldown de 1.5s.
- `apps/extension/entrypoints/background.ts` — recebe mensagens (`get-consent`, `accept-consent`, `snapshot`) e posta na API.
- `apps/extension/lib/provider-adapters.ts` — único parser. Captura conta, odds (com filtro híbrido) e apostas.
- `apps/extension/lib/collector-types.ts` — contrato de payload alinhado ao schema.
- `apps/extension/lib/collector-api.ts` — cliente HTTP com precheck e logs.
- `apps/extension/lib/collector-consent.ts` — `chrome.storage.local` para `install_id` + aceite.
- `apps/extension/lib/collector-config.ts` — domínio, termo, URL de ingestão.

### Web

- `apps/web/app/api/collector/ingest/route.ts` — valida token, upserta `ext_users`, insere lotes em `ext_football_odds` e upserta `ext_user_bets`.
- `apps/web/app/api/odds/live/route.ts` — `GET` server-side com service role. Retorna as 100 odds mais recentes + stats (`totalActiveOdds`, `totalUsers`). Aceita `?limit=N` (máx 200) e `?since=ISO_TIMESTAMP` para fetch incremental.
- `apps/web/app/page.tsx` — server component que delega o roteamento de tela ao `HomeRouter`.
- `apps/web/app/components/home-router.tsx` — client component que detecta extensão e alterna entre landing e dashboard.
- `apps/web/app/components/use-extension-installed.ts` — hook que consulta o bridge `postMessage` exposto pelo content script.
- `apps/web/app/components/live-odds-dashboard.tsx` — dashboard com polling de 3s, animação de pulse em odd nova, header com status "Ao vivo".
- `apps/web/app/termos-extensao/page.tsx` — termo público de referência.

## Fluxo da home

1. Visitante abre `oddzone.app`/`oddzone.vercel.app`.
2. `HomeRouter` (client) chama `useExtensionInstalled` que envia `postMessage` com `type: oddzone:extension-version:request`.
3. Se o content script da extensão estiver injetado nesse domínio, ele responde com a versão instalada em até 1.5s.
4. Sem resposta no timeout → mostra a landing (download + tutorial).
5. Com resposta → monta `<LiveOddsDashboard extensionVersion={...} />`.
6. Dashboard faz `GET /api/odds/live?limit=100` na montagem, depois `GET /api/odds/live?since=<timestamp>` a cada 3s.
7. Odds novas são inseridas no topo da lista com animação `is-pulse` (~1.6s).

### Banco

- `supabase/migrations/20260521210000_collector_reset_v2.sql` — modelo único atual.

## Segurança

1. Inserção feita pelo backend com `SUPABASE_SECRET_KEY` (service role).
2. RLS ativo em todas as tabelas, sem grants para `anon`/`authenticated`.
3. Endpoint de ingestão exige `X-Collector-Token` (compartilhado) e `X-Collector-Source: oddzone-extension`.

Limitação conhecida: o token está embarcado no bundle da extensão e funciona como controle de atrito, não autenticação forte. Hardening futuro: assinatura por dispositivo + rate limit por `install_id`.

## Distribuição (público comum)

Inalterada da v1:

1. Baixar `.zip` em `apps/web/public/downloads/oddzone-extension.zip`.
2. Extrair localmente.
3. `chrome://extensions` → modo desenvolvedor → `Carregar sem compactação`.

Sem auto-update nativo neste modo. Aviso sutil de versão no site usa `GET /api/extension/latest`.

## Release

```bash
npm run release:extension
```

Equivale a `build:extension` → `zip:extension` → `sync:extension-zip`.

## Estratégia de evolução

1. Estender `KNOWN_LEAGUES` e `FOOTBALL_MARKET_KEYWORDS` em `provider-adapters.ts` conforme cobertura aumenta.
2. Quando alguma casa tiver layout muito específico, criar adaptador dedicado por `bookmaker` e somar ao score.
3. Para outros esportes, replicar o padrão: nova tabela `ext_<esporte>_odds` + função de score próprio.
