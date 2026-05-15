# Handover para futuras agentes IA

Este documento registra estado atual, decisões e próximos passos para continuidade sem perda de contexto.

## Estado atual (implementado)

### 1) Coleta com consentimento

- Coleta só inicia em domínios `.bet.br`.
- Sem consentimento, a extensão mostra prompt e bloqueia captura.
- Ao aceitar:
  - persiste `acceptedAt`, `termVersion`, `termHash`
  - gera/persiste `installation_id`
  - envia evento `consent_accepted`.

Arquivos:

- `apps/extension/entrypoints/content.ts`
- `apps/extension/lib/collector-consent.ts`
- `apps/extension/lib/collector-config.ts`

### 2) Pipeline de ingestão

- Content script envia mensagens para background.
- Background normaliza para `CollectorIngestPayload`.
- Background envia para `POST /api/collector/ingest`.
- API valida cabeçalhos e persiste no Supabase usando `SUPABASE_SECRET_KEY`.

Arquivos:

- `apps/extension/entrypoints/background.ts`
- `apps/extension/lib/collector-api.ts`
- `apps/extension/lib/collector-types.ts`
- `apps/web/app/api/collector/ingest/route.ts`

### 3) Modelo de banco

Tabelas adicionadas/planejadas por migração:

- `collector_installations`
- `consent_terms`
- `user_consents`
- `site_sessions`
- `account_profiles`
- `bets`
- `odds_snapshots`
- `collector_failures`

Retenção:

- `odds_snapshots` com `expires_at` e limpeza automática.

Arquivo:

- `supabase/migrations/20260515181000_collector_data_model.sql`

## Decisões arquiteturais importantes

1. **Coleta orientada a eventos**, não por scraping bruto contínuo.
2. **Persistência sensível só no backend**, nunca direto com chave pública.
3. **RLS habilitado por padrão** em todas as tabelas novas.
4. **TTL explícito para dados voláteis** (odds).
5. **Termo versionado** para rastreabilidade de aceite.

## Riscos conhecidos

1. **Token compartilhado da extensão** é fraco contra engenharia reversa.
2. Parsers atuais são heurísticos e podem quebrar por mudança de DOM.
3. Falta rate limiting explícito no endpoint de ingestão.
4. Falta observabilidade centralizada (dashboard/alertas).

## Próximas tarefas recomendadas (ordem sugerida)

1. Implementar autenticação forte por instalação (chave assimétrica por dispositivo).
2. Adicionar rate limit e deduplicação no endpoint de ingestão.
3. Criar adaptadores específicos por provedor `.bet.br`.
4. Adicionar testes automatizados:
   - fixtures de HTML para parsers
   - testes de contrato do endpoint
   - teste SQL de expurgo de odds
5. Criar painel interno para inspeção de `collector_failures`.

## Contrato mínimo para continuidade

Ao adicionar novos tipos de dados:

1. Atualizar `CollectorIngestPayload` em `apps/extension/lib/collector-types.ts`.
2. Atualizar validação no `POST /api/collector/ingest`.
3. Criar migração SQL correspondente.
4. Documentar no `docs/collector-architecture.md`.
5. Garantir regra de retenção (TTL ou política de persistência).

## Checklists operacionais

### Antes de deploy

- [ ] `npm run build:web`
- [ ] `npm run build:extension`
- [ ] `npm run release:extension`
- [ ] aplicar migrações no Supabase
- [ ] validar endpoint `/api/collector/ingest`

### Após deploy

- [ ] validar criação de registros em `site_sessions`
- [ ] validar criação de registros em `odds_snapshots`
- [ ] validar job de purge removendo odds expiradas
- [ ] monitorar erros em `collector_failures`
