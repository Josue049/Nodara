import { AlignLeft, ArrowUpRight, AtSign, Calendar, CircleChevronDown, Clock, Hash, Link2, List, Loader, Paperclip, Phone, Sigma, SquareCheck, SquareFunction, Type, User, UserPlus } from "lucide-react";
import { TITLE_ID, type PropertyType } from "@/lib/collections/types";

const ICONS: Record<PropertyType | typeof TITLE_ID, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  title: Type,
  text: AlignLeft,
  number: Hash,
  select: CircleChevronDown,
  multi_select: List,
  status: Loader,
  date: Calendar,
  checkbox: SquareCheck,
  url: Link2,
  email: AtSign,
  phone: Phone,
  files: Paperclip,
  relation: ArrowUpRight,
  rollup: Sigma,
  formula: SquareFunction,
  person: User,
  created_by: UserPlus,
  created_time: Clock,
  last_edited_time: Clock,
};

export function PropertyIcon({ type, size = 16 }: { type: PropertyType | typeof TITLE_ID; size?: number }) {
  const Icon = ICONS[type];
  return <Icon size={size} strokeWidth={1.7} className="shrink-0 text-ink-3" aria-hidden />;
}
