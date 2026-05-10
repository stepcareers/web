/**
 * NextAuth v5 catch-all handler.
 *
 * Mounted at /api/auth/* — handles signin, signout, callback, session,
 * verification, etc. The actual config lives in /auth.ts.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
