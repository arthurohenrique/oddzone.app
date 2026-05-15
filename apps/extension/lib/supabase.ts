import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.WXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.WXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseExtensionClient =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;
