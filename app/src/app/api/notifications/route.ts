import { z } from "zod";
import { listNotifications, markNotificationsRead } from "@/server/comments-service";
import { api, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async (req, _p, user, db) => listNotifications(db, user, { unreadOnly: new URL(req.url).searchParams.get("unread") === "1" }));
export const PATCH = api(async (req, _p, user, db) => {
  const { ids } = z.object({ ids: z.array(z.uuid()).max(200).optional() }).parse(await readJson(req));
  await markNotificationsRead(db, user, ids);
  return null;
});
