/// <reference types="wxt/client" />

interface ImportMetaEnv {
  readonly WXT_PUBLIC_SUPABASE_URL?: string;
  readonly WXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly WXT_PUBLIC_EXTENSION_LATEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
