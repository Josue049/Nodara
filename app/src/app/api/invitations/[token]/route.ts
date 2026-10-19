import { publicApi } from "@/server/http";
import { getInvitation } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const GET = publicApi(async (_req, p, _u, db) => {
  const inv = await getInvitation(db, p.token);
  // Información mínima para mostrar la pantalla de aceptación.
  return { workspaceName: inv.workspaceName, role: inv.role, email: inv.email, expired: inv.expired, used: inv.used };
});
