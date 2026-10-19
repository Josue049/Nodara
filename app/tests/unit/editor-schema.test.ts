import { getSchema, type JSONContent } from "@tiptap/core";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { schemaExtensions } from "@/lib/editor/schema";

const schema = getSchema(schemaExtensions({ collaborative: true }));

describe("esquema del editor en el servidor", () => {
  it("convierte JSON de ProseMirror ↔ documento Yjs sin pérdida (bloques, marcas, menciones, bases integradas, comentarios)", () => {
    const json = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Hola" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "mundo ", marks: [{ type: "bold" }] },
            { type: "text", text: "comentado", marks: [{ type: "comment", attrs: { threadId: "t-1" } }] },
            { type: "mention", attrs: { id: "u1", label: "Ana" } },
          ],
        },
        { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "hecho" }] }] }] },
        { type: "databaseBlock", attrs: { collectionId: "c1" } },
      ],
    };
    const doc = prosemirrorJSONToYDoc(schema, json, "default");
    const back = yDocToProsemirrorJSON(doc, "default") as JSONContent;
    expect(back.content![1].content![1].marks![0]).toMatchObject({ type: "comment", attrs: { threadId: "t-1" } });
    expect(back.content![3]).toMatchObject({ type: "databaseBlock", attrs: { collectionId: "c1" } });
    expect(back.content![1].content![2]).toMatchObject({ type: "mention", attrs: { id: "u1", label: "Ana" } });
    expect(back.content![2].content![0].attrs).toMatchObject({ checked: true });
    // dos réplicas que reciben la misma actualización convergen
    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(doc));
    expect(yDocToProsemirrorJSON(replica, "default")).toEqual(back);
  });
});
