import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serverAuthOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
};

export function createServerAnonClient(accessToken?: string) {
  if (!supabaseUrl || !supabaseAnonKey) throw new ServerConfigurationError("Supabase public configuration is missing.");
  return createClient(supabaseUrl, supabaseAnonKey, {
    ...serverAuthOptions,
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export function createServerServiceClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new ServerConfigurationError("Traveler verification server configuration is missing.");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, serverAuthOptions);
}

export class ServerConfigurationError extends Error {}
