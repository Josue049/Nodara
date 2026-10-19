import { FileText, Table2 } from "lucide-react";

export function PageIcon({ icon, size = 18, kind }: { icon: string | null; size?: number; kind?: string }) {
  if (icon) return <span style={{ fontSize: size - 2, lineHeight: 1 }}>{icon}</span>;
  const Default = kind === "database" ? Table2 : FileText;
  return <Default size={size} strokeWidth={1.6} className="text-ink-2" aria-hidden />;
}
