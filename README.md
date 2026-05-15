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
   - `WXT_PUBLIC_COLLECTOR_INGEST_URL`
   - `WXT_PUBLIC_TERMS_VERSION`

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

1. Baixar o zip.
2. Extrair em uma pasta local.
3. Abrir gerenciador de extensões.
4. Ativar modo desenvolvedor.
5. Carregar extensão sem compactação.
6. Acessar domínio `.bet.br`.
7. Aceitar termo no prompt da extensão.
8. Extensão inicia envio de eventos e snapshots.

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
- URL de download do zip
- data de publicação

## Documentação de continuidade

- `docs/collector-architecture.md`
- `docs/ai-handover.md`