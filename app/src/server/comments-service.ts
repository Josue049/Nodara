import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { HttpError, type SessionUser } from "./auth";
import { assertPage, atLeast, pageAccess } from "./authz";
import type { Db } from "./db";
import { comments, notifications, pages, users } from "./schema";

export type CommentView = { id: string; authorId: string | null; authorName: string; authorColor: string; body: string; createdAt: Date };
export type ThreadView = { id: string; anchorText: string; resolved: boolean; createdAt: Date; comments: CommentView[] };

const preview = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 140);

/** Notifica a `userIds` (sin repetir ni notificar al autor) solo si tienen acceso de lectura a la página. */
export async function notifyUsers(
  db: Db,
  input: { userIds: string[]; actorId: string | null; pageId: string; type: "mention" | "comment" | "reply"; commentId?: string | null; preview: string },
): Promise<number> {
  const unique = [...new Set(input.userIds)].filter((id) => id !== input.actorId);
  let sent = 0;
  for (const userId of unique) {
    const access = await pageAccess(db, userId, input.pageId);
    if (!access || !atLeast(access.level, "view")) continue;
    await db.insert(notifications).values({ userId, actorId: input.actorId, pageId: input.pageId, type: input.type, commentId: input.commentId ?? null, preview: preview(input.preview) });
    sent++;
  }
  return sent;
}

export async function listThreads(db: Db, user: SessionUser, pageId: string): Promise<ThreadView[]> {
  await assertPage(db, user, pageId, "view");
  const rows = await db
    .select({ id: comments.id, threadId: comments.threadId, body: comments.body, anchorText: comments.anchorText, resolved: comments.resolved, createdAt: comments.createdAt, authorId: comments.authorId, authorName: users.name, authorColor: users.avatarColor })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.pageId, pageId))
    .orderBy(asc(comments.createdAt));
  const threads = new Map<string, ThreadView>();
  for (const r of rows) {
    if (r.id === r.threadId) threads.set(r.id, { id: r.id, anchorText: r.anchorText, resolved: r.resolved, createdAt: r.createdAt, comments: [] });
  }
  for (const r of rows) {
    threads.get(r.threadId)?.comments.push({ id: r.id, authorId: r.authorId, authorName: r.authorName ?? "Usuario eliminado", authorColor: r.authorColor ?? "gray", body: r.body, createdAt: r.createdAt });
  }
  return [...threads.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function createThread(db: Db, user: SessionUser, pageId: string, input: { body: string; anchorText?: string; mentions?: string[] }): Promise<{ id: string }> {
  await assertPage(db, user, pageId, "comment");
  const id = randomUUID();
  await db.insert(comments).values({ id, threadId: id, pageId, authorId: user.id, body: input.body, anchorText: input.anchorText ?? "" });
  await notifyUsers(db, { userIds: input.mentions ?? [], actorId: user.id, pageId, type: "mention", commentId: id, preview: input.body });
  // El autor de la página se entera de los comentarios nuevos de otras personas.
  const [page] = await db.select({ creatorId: pages.creatorId }).from(pages).where(eq(pages.id, pageId));
  if (page?.creatorId && !(input.mentions ?? []).includes(page.creatorId)) {
    await notifyUsers(db, { userIds: [page.creatorId], actorId: user.id, pageId, type: "comment", commentId: id, preview: input.body });
  }
  return { id };
}

export async function replyToThread(db: Db, user: SessionUser, threadId: string, input: { body: string; mentions?: string[] }): Promise<{ id: string }> {
  const [root] = await db.select().from(comments).where(and(eq(comments.id, threadId), eq(comments.threadId, threadId)));
  if (!root) throw new HttpError(404, "Hilo no encontrado");
  await assertPage(db, user, root.pageId, "comment");
  const id = randomUUID();
  await db.insert(comments).values({ id, threadId, pageId: root.pageId, authorId: user.id, body: input.body });
  const mentions = input.mentions ?? [];
  await notifyUsers(db, { userIds: mentions, actorId: user.id, pageId: root.pageId, type: "mention", commentId: id, preview: input.body });
  const participants = (await db.select({ a: comments.authorId }).from(comments).where(eq(comments.threadId, threadId))).map((r) => r.a).filter((a): a is string => !!a);
  await notifyUsers(db, { userIds: participants.filter((p) => !mentions.includes(p)), actorId: user.id, pageId: root.pageId, type: "reply", commentId: id, preview: input.body });
  return { id };
}

/** Página a la que pertenece un hilo o comentario (para avisar en vivo a quienes la tienen abierta). */
export async function pageIdOfComment(db: Db, commentId: string): Promise<string | null> {
  const [c] = await db.select({ pageId: comments.pageId }).from(comments).where(eq(comments.id, commentId));
  return c?.pageId ?? null;
}

export async function setResolved(db: Db, user: SessionUser, threadId: string, resolved: boolean): Promise<void> {
  const [root] = await db.select().from(comments).where(and(eq(comments.id, threadId), eq(comments.threadId, threadId)));
  if (!root) throw new HttpError(404, "Hilo no encontrado");
  await assertPage(db, user, root.pageId, "comment");
  await db.update(comments).set({ resolved }).where(eq(comments.id, threadId));
}

export async function deleteComment(db: Db, user: SessionUser, commentId: string): Promise<{ threadDeleted: boolean; threadId: string; pageId: string }> {
  const [c] = await db.select().from(comments).where(eq(comments.id, commentId));
  if (!c) throw new HttpError(404, "Comentario no encontrado");
  const access = await assertPage(db, user, c.pageId, "comment");
  if (c.authorId !== user.id && !atLeast(access.level, "full")) throw new HttpError(403, "Solo el autor puede borrar su comentario");
  const isRoot = c.id === c.threadId;
  if (isRoot) await db.delete(comments).where(eq(comments.threadId, c.threadId));
  else await db.delete(comments).where(eq(comments.id, commentId));
  return { threadDeleted: isRoot, threadId: c.threadId, pageId: c.pageId };
}

// ── Notificaciones ───────────────────────────────────────────────────

export type NotificationView = {
  id: string;
  type: string;
  preview: string;
  createdAt: Date;
  read: boolean;
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  actorName: string | null;
};

export async function listNotifications(db: Db, user: SessionUser, opts: { unreadOnly?: boolean; limit?: number } = {}) {
  const rows = await db
    .select({ id: notifications.id, type: notifications.type, preview: notifications.preview, createdAt: notifications.createdAt, readAt: notifications.readAt, pageId: notifications.pageId, pageTitle: pages.title, pageIcon: pages.icon, actorName: users.name })
    .from(notifications)
    .innerJoin(pages, eq(pages.id, notifications.pageId))
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(and(eq(notifications.userId, user.id), opts.unreadOnly ? isNull(notifications.readAt) : undefined))
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit ?? 50);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  return { unread: n, items: rows.map((r): NotificationView => ({ id: r.id, type: r.type, preview: r.preview, createdAt: r.createdAt, read: !!r.readAt, pageId: r.pageId, pageTitle: r.pageTitle, pageIcon: r.pageIcon, actorName: r.actorName })) };
}

export async function markNotificationsRead(db: Db, user: SessionUser, ids?: string[]): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt), ids ? inArray(notifications.id, ids) : undefined));
}
