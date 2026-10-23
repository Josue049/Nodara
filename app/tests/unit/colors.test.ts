import { describe, expect, it } from "vitest";
import { staticColor, swatchOf, TEXT_SWATCHES, themedColor } from "@/lib/editor/colors";
import { docToHtml } from "@/lib/export/markdown";

describe("paleta de colores", () => {
  it("traduce los hex antiguos a la variable del tema y deja el resto igual", () => {
    expect(themedColor("#d44c47")).toBe("var(--tx-red)");
    expect(themedColor("#FBF3DB")).toBe("var(--bgc-yellow)");
    expect(themedColor("var(--tx-blue)")).toBe("var(--tx-blue)");
    expect(themedColor("#123456")).toBe("#123456");
  });

  it("resuelve las variables a hex fijos para exportar", () => {
    expect(staticColor("var(--tx-black)")).toBe("#000000");
    expect(staticColor("var(--bgc-green)")).toBe("#edf3ec");
    expect(staticColor("var(--bgc-black)")).toBe("var(--bgc-black)");
  });

  it("el negro va justo después de «Predeterminado» y se reconoce como opción activa", () => {
    expect(TEXT_SWATCHES.slice(0, 3).map((s) => s.name)).toEqual(["Predeterminado", "Negro", "Gris"]);
    expect(swatchOf("var(--tx-black)", "text")?.id).toBe("black");
    expect(swatchOf("#9065b0", "text")?.id).toBe("purple");
    expect(swatchOf(null, "bg")?.id).toBe("default");
  });

  it("la exportación HTML no deja pasar CSS arbitrario en el color", () => {
    const html = docToHtml(
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { color: "red;background:url(evil)" } }] }] }] },
      "T",
    );
    expect(html).not.toContain("evil");
    expect(html).toContain("<p>x</p>");
  });
});
