# Handover para futuras agentes IA

Este documento registra estado atual, decisões e próximos passos para continuidade sem perda de contexto.

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
