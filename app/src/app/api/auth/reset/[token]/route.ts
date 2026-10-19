import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/server/auth";
import { publicApi, readJson } from "@/server/http";
import { completePasswordReset, getPasswordReset } from "@/server/password-reset-service";

export const dynamic = "force-dynamic";

export const GET = publicApi(async (req, p, _u, db) => {
  rateLimit(`reset-get:${clientIp(req)}`, 30, 10 * 60 * 1000);
  return getPasswordReset(db, p.token);
});

export const POST = publicApi(async (req, p, _u, db) => {
  rateLimit(`reset-post:${clientIp(req)}`, 10, 10 * 60 * 1000);
  const { password } = z.object({ password: z.string().min(8, "La contraseña necesita al menos 8 caracteres").max(200) }).parse(await readJson(req));
  const out = await completePasswordReset(db, p.token, password);
  return NextResponse.json({ ok: true, email: out.email });
});
