# Arquitetura do coletor `.bet.br`

## Visão geral

O coletor foi desenhado em camadas para separar captura, transporte e persistência:

1. **Content script (WXT)** detecta domínio `.bet.br`.
2. **Gate de consentimento** bloqueia coleta até aceite.
3. **Adaptadores** extraem snapshot inicial (conta, bets, odds).
4. **Content script** continua observando mudanças de DOM/URL para coletar snapshots adicionais em páginas SPA.
5. **Background** empacota evento e envia para API de ingestão.
6. **API Next.js** valida payload e persiste no Supabase com chave de servidor.
7. **Postgres + pg_cron** aplica retenção de odds (`TTL = 1h`).

## Componentes por arquivo

### Extensão

- `apps/extension/entrypoints/content.ts`
  - valida domínio `.bet.br`
  - exibe prompt de consentimento
  - envia `page_seen` e `snapshot`
  - observa mutações de DOM e mudanças de URL para nova coleta
- `apps/extension/entrypoints/background.ts`
  - recebe mensagens
  - normaliza payload
  - envia para `/api/collector/ingest`
- `apps/extension/lib/collector-config.ts`
  - constantes de domínio, termo e endpoint
- `apps/extension/lib/collector-consent.ts`
  - persistência do aceite e `installation_id`
- `apps/extension/lib/provider-adapters.ts`
  - parser heurístico com fallback genérico e seletores por provedor
- `apps/extension/lib/collector-api.ts`
  - cliente HTTP de ingestão
- `apps/extension/lib/collector-types.ts`
  - contrato de payload

### Web

- `apps/web/app/api/collector/ingest/route.ts`
  - valida token compartilhado e formato
  - grava por tipo de evento
- `apps/web/app/termos-extensao/page.tsx`
  - termo público para referência

### Banco

- `supabase/migrations/20260515181000_collector_data_model.sql`
  - modelo principal e job de limpeza

## Modelo de eventos de ingestão

Tipos aceitos:

- `extension_lifecycle`
- `consent_accepted`
- `page_seen`
- `snapshot`
- `collector_failure`

Campos base:

- `installationId`
- `extensionVersion`
- `siteDomain`
- `sourceUrl`
- `capturedAt`
- `consent` (accepted, version, hash)

## Estratégia de retenção

- **Volátil**: `odds_snapshots.expires_at` (1h).
- **Purge**: função `private.cleanup_expired_odds()` + cron `*/5 * * * *`.
- **Persistente**: `account_profiles` e `bets` sem TTL automático.

## Segurança atual e limitações

1. Inserção sensível feita por backend com `SUPABASE_SECRET_KEY`.
2. Tabelas sensíveis têm RLS habilitado e sem grants para `anon/authenticated`.
3. Endpoint de ingestão aceita header `X-Collector-Token`.

Limitação conhecida:

- o token da extensão é embarcado no build e deve ser tratado como controle de atrito, não como autenticação forte.
- para hardening futuro: assinatura por dispositivo + rotação de credencial curta + rate limit por instalação.

## Distribuição e atualização da extensão (público comum)

### Modelo adotado

Para público comum, o fluxo atual usa:

1. download do arquivo `.zip`;
2. extração local da pasta da extensão;
3. instalação por `chrome://extensions` com `Carregar sem compactação`.

Não há auto-update nativo nesse modo.

### Componentes do fluxo

- `apps/web/app/page.tsx`
  - CTA principal de download do ZIP;
  - guia visual de instalação por pasta descompactada.
- `apps/web/app/api/extension/latest/route.ts`
  - expõe `version` e `downloadUrl` (ZIP).
- `scripts/sync-extension-zip.mjs`
  - publica apenas `oddzone-extension.zip` em `apps/web/public/downloads`.
- `apps/extension/wxt.config.ts`
  - manifesto sem `update_url`/`key` de distribuição CRX.

### Detecção de versão no site

Para reduzir fricção de atualização manual:

- `apps/extension/entrypoints/content.ts`
  - expõe bridge via `window.postMessage` em `oddzone.app` para responder versão instalada (`chrome.runtime.getManifest().version`).
- `apps/web/app/components/extension-version-notice.tsx`
  - consulta versão instalada + `GET /api/extension/latest`;
  - mostra aviso sutil de atualização quando necessário;
  - mostra feedback sutil de “extensão detectada” quando versão está em dia.

### Sequência de release

1. `npm run build:extension`
2. `npm run zip:extension`
3. `npm run sync:extension-zip`

Comando agregado:

- `npm run release:extension`

Checklist operacional mínimo:

1. Confirmar que `POST /api/collector/ingest` retorna `200` no service worker.
2. Confirmar URL/token alinhados entre web e extensão.
3. Confirmar `snapshot.odds` preenchido no payload em páginas com odds visíveis.
4. Confirmar inserts em `collector_installations`, `site_sessions` e `odds_snapshots`.

## Estratégia de evolução dos adaptadores

1. Criar parser por domínio (ex.: `providers/betano.ts`, `providers/sportingbet.ts`).
2. Definir contrato comum (`SnapshotPayload`).
3. Registrar versão do parser no `raw_payload`.
4. Logar seletor falho em `collector_failures`.
5. Adicionar testes de fixture HTML por provedor.
