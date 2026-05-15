# oddzone.app

Estrutura inicial com:

- `apps/web`: aplicativo Next.js (App Router).
- `apps/extension`: extensao de navegador com WXT.
- `supabase/migrations`: SQL inicial de tabela + RLS.

## Regra de estilo do layout web

No `apps/web`, manter sempre o padrão visual **clean com estética Apple**:

- fundo escuro com alto contraste e poucos elementos;
- tipografia limpa com hierarquia simples;
- cards discretos (glass/surface) com bordas suaves;
- botões arredondados no estilo `pill`;
- textos curtos e foco em ação principal.

Base técnica desse padrão:

- classe global `theme-apple-clean` em `apps/web/app/layout.tsx`;
- tokens e utilitários em `apps/web/app/globals.css`.

## 1) Configuracao de ambiente

1. Copie `.env.example` para `.env.local` na raiz.
2. Preencha com suas chaves do Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (somente servidor, nunca no cliente)
3. Para a extensao, preencha:
   - `WXT_PUBLIC_SUPABASE_URL`
   - `WXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `WXT_PUBLIC_EXTENSION_LATEST_URL` (por padrao aponta para `http://localhost:3000/api/extension/latest`)

## 2) Instalar dependencias

```bash
npm install
```

## 3) Rodar localmente

Web (Next.js):

```bash
npm run dev:web
```

Extensao (WXT):

```bash
npm run dev:extension
```

## 4) Download da extensao no site

A home do web expõe um botao para baixar:

- `apps/web/public/downloads/oddzone-extension.zip`

O fluxo atual e manual (Modo do desenvolvedor no navegador):

1. Baixar o zip.
2. Extrair em uma pasta local.
3. Abrir gerenciador de extensoes.
4. Ativar modo desenvolvedor.
5. Carregar extensao sem compactacao.

## 5) Atualizacao do arquivo da extensao

Gerar zip da extensao:

```bash
npm run zip:extension
```

Copiar o ultimo zip gerado para o botao de download do web:

```bash
npm run sync:extension-zip
```

Fluxo completo de release local:

```bash
npm run release:extension
```

## 6) Endpoint de versao para a extensao

Endpoint:

- `GET /api/extension/latest`

Retorna:

- versao atual
- URL de download do zip
- data de publicacao

## 7) Banco e RLS

Migracao inicial:

- `supabase/migrations/20260515153000_init_extension_events.sql`

Ela cria a tabela `public.extension_events`, habilita RLS e libera `insert` para `anon` e `authenticated` apenas para eventos `startup` e `install`.