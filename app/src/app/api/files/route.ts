import { assertMember } from "@/server/authz";
import { api, resolveWorkspace } from "@/server/http";
import { saveUpload } from "@/server/files";

export const dynamic = "force-dynamic";

export const POST = api(async (req, _p, user, db) => {
  const workspaceId = await resolveWorkspace(db, user, req);
  await assertMember(db, user, workspaceId, ["owner", "admin", "member", "guest"]);
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Falta el archivo" }, { status: 400 });
    return Response.json(await saveUpload(db, file, { workspaceId, userId: user.id }), { status: 201 });
  } catch (e) {
    if (e instanceof RangeError) return Response.json({ error: e.message }, { status: 413 });
    throw e;
  }
});
