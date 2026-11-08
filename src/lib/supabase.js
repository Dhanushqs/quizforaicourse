import { createClient } from "@supabase/supabase-js";

function need(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. See .env.example`);
  }
  return value;
}

let serverClient;

// The database client used by all our server code.
// It uses the secret service_role key, so it must NEVER be used in browser code.
export function db() {
  if (!serverClient) {
    serverClient = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serverClient;
}

// A separate client used ONLY for logging the admin in / refreshing their login.
// (We keep it separate so a user login can never leak into the db() client.)
export function newAuthClient() {
  return createClient(need("SUPABASE_URL"), need("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
