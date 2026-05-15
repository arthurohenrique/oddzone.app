# Arquitetura do coletor `.bet.br`

## Visão geral

O coletor foi desenhado em camadas para separar captura, transporte e persistência:

1. **Content script (WXT)** detecta domínio `.bet.br`.
2. **Gate de consentimento** bloqueia coleta até aceite.
3. **Adaptadores** extraem snapshot inicial (conta, bets, odds).
4. **Background** empacota evento e envia para API de ingestão.
5. **API Next.js** valida payload e persiste no Supabase com chave de servidor.
6. **Postgres + pg_cron** aplica retenção de odds (`TTL = 1h`).

## Componentes por arquivo

### Extensão

- `apps/extension/entrypoints/content.ts`
  - valida domínio `.bet.br`
  - exibe prompt de consentimento
  - envia `page_seen` e `snapshot`
- `apps/extension/entrypoints/background.ts`
  - recebe mensagens
  - normaliza payload
  - envia para `/api/collector/ingest`
- `apps/extension/lib/collector-config.ts`
  - constantes de domínio, termo e endpoint
- `apps/extension/lib/collector-consent.ts`
  - persistência do aceite e `installation_id`
- `apps/extension/lib/provider-adapters.ts`
  - parser heurístico inicial por DOM
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

## Estratégia de evolução dos adaptadores

1. Criar parser por domínio (ex.: `providers/betano.ts`, `providers/sportingbet.ts`).
2. Definir contrato comum (`SnapshotPayload`).
3. Registrar versão do parser no `raw_payload`.
4. Logar seletor falho em `collector_failures`.
5. Adicionar testes de fixture HTML por provedor.
