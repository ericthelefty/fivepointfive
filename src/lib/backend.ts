/**
 * Optional Supabase backend. With VITE_SUPABASE_URL and
 * VITE_SUPABASE_PUBLISHABLE_KEY set, the app runs as a shared instance;
 * without them it runs in local-only mode (browser storage).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const SCHEMA = (import.meta.env.VITE_SUPABASE_SCHEMA as string | undefined) || "fivepointfive";

/** Why the instance settings can't be used, or null when they're fine (or absent). */
function checkConfig(u?: string, k?: string): string | null {
  if (!u && !k) return null;
  if (!u) return "VITE_SUPABASE_URL is missing.";
  if (!k) return "VITE_SUPABASE_PUBLISHABLE_KEY is missing.";
  if (/^(sb_|eyJ)/.test(u)) return "VITE_SUPABASE_URL contains a key. It should be your project address, like https://abcd1234.supabase.co.";
  if (!/^https?:\/\/[^\s/]+/.test(u)) return "VITE_SUPABASE_URL isn't a web address. It should look like https://abcd1234.supabase.co.";
  if (/^https?:/.test(k)) return "VITE_SUPABASE_PUBLISHABLE_KEY contains an address. It should be your publishable key, starting with sb_publishable_.";
  if (k.startsWith("sb_secret_")) return "VITE_SUPABASE_PUBLISHABLE_KEY is a secret key. Use the publishable key (sb_publishable_…) and rotate the secret key in Supabase.";
  if (!/^(sb_publishable_|eyJ)/.test(k)) return "VITE_SUPABASE_PUBLISHABLE_KEY doesn't look like a publishable key. It should start with sb_publishable_.";
  return null;
}

const trimmedUrl = url?.trim().replace(/\/+$/, "");
const trimmedKey = key?.trim();
export const configError = checkConfig(trimmedUrl, trimmedKey);

/**
 * Demo mode: opening /demo runs this tab without the shared instance, so anyone can try the builder and sheet without
 * signing in. Everything they make is kept in their own browser; nothing reaches the instance. It lasts until the tab
 * closes or they choose Exit demo.
 */
export const DEMO_KEY = "fpf.demo";
export const demo = (() => {
  try {
    if (location.pathname === "/demo") sessionStorage.setItem(DEMO_KEY, "1");
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
})();

function connect() {
  if (demo || !trimmedUrl || !trimmedKey || configError) return null;
  try {
    return createClient(trimmedUrl, trimmedKey, { db: { schema: SCHEMA } });
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, any, any> | null = connect();
export const cloud = !!supabase;
