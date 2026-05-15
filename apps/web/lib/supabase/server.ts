import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function readEnvValueFromFile(key: string): string | undefined {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", "..", ".env.local"),
    path.join(process.cwd(), "..", "..", ".env")
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const [entryKey, ...entryValueParts] = line.split("=");
      if (entryKey !== key) continue;
      const value = entryValueParts.join("=").trim();
      if (value.length > 0) return value;
    }
  }

  return undefined;
}

export function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    readEnvValueFromFile("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ??
    readEnvValueFromFile("SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias."
    );
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false }
  });
}
