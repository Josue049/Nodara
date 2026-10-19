"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarToggle } from "@/components/app-shell";
import { PageIcon } from "@/components/page-icon";
import { useWorkspace } from "@/components/workspace-provider";
import { t } from "@/lib/strings";

export default function HomePage() {
  const { pages, loaded, createPage } = useWorkspace();
  const router = useRouter();
  const empty = loaded && pages.length === 0;

  return (
    <>
    <div className="flex h-[var(--topbar-h)] shrink-0 items-center px-3">
      <SidebarToggle />
    </div>
    <div className="nd-scroll flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[708px] px-6 pt-12">
        <h1 className="text-[32px] font-bold leading-tight">{t.welcome}</h1>
        {empty ? (
          <div className="mt-10 text-ink-2">
            <p className="text-[16px] font-medium text-ink">{t.noPagesTitle}</p>
            <p className="mt-1">{t.noPagesBody}</p>
            <button
              onClick={async () => router.push(`/${await createPage(null)}`)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[14px] font-medium text-white hover:brightness-95"
            >
              <Plus size={16} /> {t.newPage}
            </button>
          </div>
        ) : (
          <section className="mt-10">
            <h2 className="mb-1 text-[12px] font-medium text-ink-3">{t.recent}</h2>
            <ul>
              {pages.map((p) => (
                <li key={p.id}>
                  <Link href={`/${p.id}`} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
                    <PageIcon icon={p.icon} />
                    <span className="truncate">{p.title || t.untitled}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
    </>
  );
}
