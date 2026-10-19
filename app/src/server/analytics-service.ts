import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "./db";
import { pageViews, users } from "./schema";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Cuenta una visita por persona y día (la primera del día crea la fila; las siguientes incrementan el contador). */
export async function recordView(db: Db, userId: string, pageId: string): Promise<void> {
  await db
    .insert(pageViews)
    .values({ pageId, userId, day: day(new Date()) })
    .onConflictDoUpdate({ target: [pageViews.pageId, pageViews.userId, pageViews.day], set: { count: sql`${pageViews.count} + 1`, lastViewedAt: new Date() } });
}

export type PageAnalytics = {
  totalViews: number;
  uniqueViewers: number;
  viewsToday: number;
  /** Últimos 14 días, del más antiguo al más reciente. */
  daily: { day: string; views: number }[];
  viewers: { name: string; email: string; views: number; lastViewedAt: string }[];
};

export async function pageAnalytics(db: Db, pageId: string, now = new Date()): Promise<PageAnalytics> {
  const rows = await db
    .select({ day: pageViews.day, count: pageViews.count, userId: pageViews.userId, last: pageViews.lastViewedAt, name: users.name, email: users.email })
    .from(pageViews)
    .innerJoin(users, eq(users.id, pageViews.userId))
    .where(eq(pageViews.pageId, pageId))
    .orderBy(desc(pageViews.lastViewedAt));
  const byDay = new Map<string, number>();
  const byUser = new Map<string, { name: string; email: string; views: number; last: Date }>();
  for (const r of rows) {
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.count);
    const u = byUser.get(r.userId) ?? { name: r.name, email: r.email, views: 0, last: r.last };
    u.views += r.count;
    if (r.last > u.last) u.last = r.last;
    byUser.set(r.userId, u);
  }
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = day(new Date(now.getTime() - (13 - i) * 86_400_000));
    return { day: d, views: byDay.get(d) ?? 0 };
  });
  return {
    totalViews: rows.reduce((n, r) => n + r.count, 0),
    uniqueViewers: byUser.size,
    viewsToday: byDay.get(day(now)) ?? 0,
    daily,
    viewers: [...byUser.values()]
      .sort((a, b) => b.last.getTime() - a.last.getTime())
      .slice(0, 10)
      .map((u) => ({ name: u.name, email: u.email, views: u.views, lastViewedAt: u.last.toISOString() })),
  };
}

