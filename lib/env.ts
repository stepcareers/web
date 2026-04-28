import { z } from "zod";

/**
 * Validate environment variables at startup.
 * If a required var is missing or wrong shape, the app crashes at boot
 * with a clear error — never at runtime in some random code path.
 *
 * Server-side vars are validated only on the server.
 * Client-side vars (NEXT_PUBLIC_*) must be safe to expose to the browser.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),

  // Supabase (server-side)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  // Embeddings (pick one — Voyage default)
  VOYAGE_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),

  // Langfuse
  LANGFUSE_SECRET_KEY: z.string().startsWith("sk-lf-").optional(),
  LANGFUSE_PUBLIC_KEY: z.string().startsWith("pk-lf-").optional(),
  LANGFUSE_BASE_URL: z.string().url().default("https://cloud.langfuse.com"),

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  RESEND_FROM_EMAIL: z.string().email().default("hello@step.careers"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "it"]).default("en"),
});

// Note: most fields are `.optional()` for now because we deploy the bare
// scaffold before wiring services. As we wire each service we'll tighten
// to `.required()` and the build will fail-fast if a key is missing.

const parsedServer =
  typeof window === "undefined"
    ? serverSchema.safeParse(process.env)
    : { success: true as const, data: undefined };

const parsedClient = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
});

if (!parsedServer.success) {
  console.error(
    "[env] Invalid server environment variables:",
    parsedServer.error.flatten().fieldErrors,
  );
  throw new Error("Invalid server environment variables. See logs above.");
}

if (!parsedClient.success) {
  console.error(
    "[env] Invalid client environment variables:",
    parsedClient.error.flatten().fieldErrors,
  );
  throw new Error("Invalid client environment variables. See logs above.");
}

export const serverEnv = parsedServer.data;
export const clientEnv = parsedClient.data;
