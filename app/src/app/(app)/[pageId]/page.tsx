import { PageView } from "@/components/page-view";

export default async function Page({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  return <PageView key={pageId} pageId={pageId} />;
}
