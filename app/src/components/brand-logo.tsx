import Image from "next/image";
import { BRAND_MARK } from "@/lib/brand";

/**
 * Isotipo oficial de Nodara. Se pintan las dos variantes y el CSS muestra la del tema activo (`.nd-only-light` /
 * `.nd-only-dark`): sin parpadeo al hidratar y sin depender de JavaScript para cambiar de tema.
 */
export function BrandLogo({ size = 28 }: { size?: number }) {
  return (
    <>
      <Image src={BRAND_MARK.light.src} width={size} height={size} alt="" className="nd-only-light shrink-0" priority unoptimized />
      <Image src={BRAND_MARK.dark.src} width={size} height={size} alt="" className="nd-only-dark shrink-0" priority unoptimized />
    </>
  );
}
