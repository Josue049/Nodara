import { describe, expect, it } from "vitest";
import { docToHtml, docToMarkdown, markdownToDoc, parseInline, type DocNode } from "@/lib/export/markdown";

const p = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const t = (text: string, ...marks: string[]): DocNode => ({ type: "text", text, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });

describe("Markdown → documento", () => {
  it("convierte encabezados, párrafos y extrae el título", () => {
    const { title, doc } = markdownToDoc("# Mi página\n\nHola mundo\n\n## Sección\n\n#### Profundo");
    expect(title).toBe("Mi página");
    expect(doc.content?.map((n) => n.type)).toEqual(["paragraph", "heading", "heading"]);
    expect(doc.content?.[2].attrs?.level).toBe(4); // H4 existe (como en Notion); 5–6 se limitan a 4
  });

  it("interpreta formatos en línea", () => {
    const nodes = parseInline("**negrita**, *cursiva*, ~~tachado~~, `código` y [enlace](https://ejemplo.com)");
    expect(nodes.find((n) => n.text === "negrita")?.marks).toEqual([{ type: "bold" }]);
    expect(nodes.find((n) => n.text === "cursiva")?.marks).toEqual([{ type: "italic" }]);
    expect(nodes.find((n) => n.text === "tachado")?.marks).toEqual([{ type: "strike" }]);
    expect(nodes.find((n) => n.text === "código")?.marks).toEqual([{ type: "code" }]);
    expect(nodes.find((n) => n.text === "enlace")?.marks).toEqual([{ type: "link", attrs: { href: "https://ejemplo.com" } }]);
  });

  it("anida negrita y cursiva", () => {
    const nodes = parseInline("**a *b* c**");
    expect(nodes.find((n) => n.text === "b")?.marks).toEqual([{ type: "bold" }, { type: "italic" }]);
  });

  it("descarta enlaces peligrosos conservando el texto", () => {
    const nodes = parseInline("[clic](javascript:alert(1))");
    expect(JSON.stringify(nodes)).not.toContain("javascript");
    expect(nodes.map((n) => n.text).join("")).toContain("clic");
  });

  it("listas anidadas, numeradas y de tareas", () => {
    const { doc } = markdownToDoc("- uno\n  - sub\n- dos\n\n1. a\n2. b\n\n- [x] hecha\n- [ ] pendiente");
    const [bullets, ordered, tasks] = doc.content!;
    expect(bullets.type).toBe("bulletList");
    expect(bullets.content).toHaveLength(2);
    expect(bullets.content![0].content!.map((n) => n.type)).toEqual(["paragraph", "bulletList"]);
    expect(ordered.type).toBe("orderedList");
    expect(tasks.type).toBe("taskList");
    expect(tasks.content!.map((i) => i.attrs?.checked)).toEqual([true, false]);
  });

  it("código, citas, llamadas, divisores, tablas y ecuaciones", () => {
    const { doc } = markdownToDoc("```ts\nconst a = 1;\n```\n\n> cita\n\n> 💡 aviso\n\n---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n$$\nE=mc^2\n$$");
    expect(doc.content!.map((n) => n.type)).toEqual(["codeBlock", "blockquote", "callout", "horizontalRule", "table", "mathBlock"]);
    expect(doc.content![0].attrs?.language).toBe("ts");
    expect(doc.content![2].attrs?.icon).toBe("💡");
    expect(doc.content![4].content).toHaveLength(2);
    expect(doc.content![5].attrs?.latex).toBe("E=mc^2");
  });

  it("imágenes solo con URL http(s) o de archivos propios", () => {
    expect(markdownToDoc("![a](https://x.test/i.png)").doc.content![0].type).toBe("imageBlock");
    expect(markdownToDoc("![a](javascript:alert(1))").doc.content![0].type).toBe("paragraph");
  });

  it("un documento vacío produce un párrafo vacío", () => {
    expect(markdownToDoc("").doc.content).toEqual([{ type: "paragraph" }]);
  });
});

describe("documento → Markdown / HTML", () => {
  const doc: DocNode = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [t("Título")] },
      p(t("Hola "), t("fuerte", "bold"), t(" y "), { type: "text", text: "enlace", marks: [{ type: "link", attrs: { href: "https://a.test" } }] }),
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p(t("listo"))] }] },
      { type: "callout", attrs: { icon: "⚠️" }, content: [p(t("cuidado"))] },
      { type: "mathBlock", attrs: { latex: "x^2" } },
    ],
  };

  it("exporta a Markdown", () => {
    const md = docToMarkdown(doc, "Doc");
    expect(md).toContain("# Doc");
    expect(md).toContain("## Título");
    expect(md).toContain("**fuerte**");
    expect(md).toContain("[enlace](https://a.test)");
    expect(md).toContain("- [x] listo");
    expect(md).toContain("> ⚠️ cuidado");
    expect(md).toContain("$$\nx^2\n$$");
  });

  it("recorre exportación → importación sin perder estructura", () => {
    const back = markdownToDoc(docToMarkdown(doc, "Doc"));
    expect(back.title).toBe("Doc");
    expect(back.doc.content!.map((n) => n.type)).toEqual(["heading", "paragraph", "taskList", "callout", "mathBlock"]);
  });

  it("exporta a HTML escapando el contenido", () => {
    const html = docToHtml({ type: "doc", content: [p(t("<script>alert(1)</script>"))] }, "A & B");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<title>A &amp; B</title>");
  });

  it("no exporta enlaces con esquemas peligrosos", () => {
    const bad: DocNode = { type: "doc", content: [p({ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] })] };
    expect(docToHtml(bad)).not.toContain("javascript:");
    expect(docToMarkdown(bad)).not.toContain("javascript:");
  });
});
