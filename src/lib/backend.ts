/**
 * Optional Supabase backend. With VITE_SUPABASE_URL and
 * VITE_SUPABASE_PUBLISHABLE_KEY set, the app runs as a shared instance;
 * without them it runs in local-only mode (browser storage).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const SCHEMA = (import.meta.env.VITE_SUPABASE_SCHEMA as string | undefined) || "fivepointfive";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: SupabaseClient<any, any, any> | null = url && key ? createClient(url, key, { db: { schema: SCHEMA } }) : null;
export const cloud = !!supabase;
