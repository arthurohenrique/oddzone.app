/// <reference types="wxt/client" />

interface ImportMetaEnv {
  readonly WXT_PUBLIC_SUPABASE_URL?: string;
  readonly WXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly WXT_PUBLIC_EXTENSION_LATEST_URL?: string;
  readonly WXT_PUBLIC_COLLECTOR_INGEST_URL?: string;
  readonly WXT_PUBLIC_COLLECTOR_SHARED_TOKEN?: string;
  readonly WXT_PUBLIC_TERMS_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
