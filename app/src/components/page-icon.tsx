import { FileText } from "lucide-react";

export function PageIcon({ icon, size = 18 }: { icon: string | null; size?: number }) {
  if (icon) return <span style={{ fontSize: size - 2, lineHeight: 1 }}>{icon}</span>;
  return <FileText size={size} strokeWidth={1.6} className="text-ink-2" aria-hidden />;
}
