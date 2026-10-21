import type { Page } from "@playwright/test";
import { apiCreate, expect, gotoReady, test } from "./fixtures";

// Menú «/» y menú del asa de bloque, comparados con Notion (research/features/006-notion-menus.md).
const SHOTS = "../.data/menu-shots";

async function openPage(page: Page, title: string) {
  await gotoReady(page, "/");
  await page.getByRole("button", { name: "Nueva página" }).first().click();
  await page.getByTestId("page-title").fill(title);
  await page.getByTestId("page-title").press("Enter");
  await expect(page.getByTestId("editor")).toBeFocused();
}
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Guardado");
const reload = async (page: Page) => {
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
};
const menu = (page: Page) => page.getByTestId("slash-menu");
const selected = (page: Page) => menu(page).locator('[role="option"][aria-selected="true"]');

test.describe("menú «/»", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`estructura y aspecto como Notion — tema ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((t) => localStorage.setItem("nodara:theme", t), theme);
      await openPage(page, `Menú ${theme}`);
      await page.keyboard.type("/");
      await expect(menu(page)).toBeVisible();
      // Píldora «/Escribe para buscar» en el bloque
      await expect(page.getByTestId("editor").locator(".nd-slash-query.is-empty")).toHaveText("/");
      // Secciones en el orden de Notion
      await expect(menu(page).getByTestId("slash-section")).toHaveText(["Sugeridos", "Bloques básicos", "Multimedia", "Base de datos", "Bloques avanzados", "En línea", "Convertir en", "Acciones", "Color del texto", "Color de fondo"]);
      await expect(selected(page)).toHaveCount(1);
      await expect(menu(page).getByRole("option", { name: "Encabezado 1" }).first()).toContainText("#");
      await expect(page.getByTestId("slash-close")).toContainText("Cerrar menú");
      const look = await menu(page).evaluate((el) => {
        const cs = getComputedStyle(el);
        const item = el.querySelector('[role="option"][aria-selected="true"]')!;
        const r = el.getBoundingClientRect();
        return { bg: cs.backgroundColor, radius: cs.borderRadius, shadow: cs.boxShadow, w: Math.round(r.width), h: Math.round(r.height), itemH: Math.round(item.getBoundingClientRect().height), itemBg: getComputedStyle(item).backgroundColor, fs: getComputedStyle(item).fontSize };
      });
      expect(look).toMatchObject({ radius: "10px", w: 324, h: 315, itemH: 32, fs: "14px" });
      if (theme === "light") {
        expect(look.bg).toBe("rgb(255, 255, 255)");
        expect(look.itemBg).toBe("rgba(33, 27, 23, 0.05)");
        expect(look.shadow).toContain("rgba(42, 28, 0, 0.07) 0px 0px 0px 1px");
      } else {
        expect(look.bg).toBe("rgb(37, 37, 37)");
        expect(look.itemBg).toBe("rgba(255, 255, 255, 0.055)");
        expect(look.shadow).toContain("rgb(56, 56, 54) 0px 0px 0px 1px");
      }
      await page.screenshot({ path: `${SHOTS}/slash-${theme}.png` });
    });
  }

  test("teclado, ratón, filtrado, sin resultados y cierre", async ({ page }) => {
    await openPage(page, "Navegación del menú");
    await page.keyboard.type("/");
    await expect(selected(page)).toHaveAttribute("data-slash-id", "todo"); // primer sugerido
    await page.keyboard.press("ArrowDown");
    await expect(selected(page)).toHaveAttribute("data-slash-id", "h1");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(selected(page)).toHaveAttribute("data-slash-id", "bg-red"); // vuelve al final
    await menu(page).getByRole("option", { name: "Encabezado 3" }).first().hover();
    await expect(selected(page)).toHaveAttribute("data-slash-id", "h3");

    // Filtrado: una sección de resultados, alias en inglés y variantes «Convertir en»
    await page.keyboard.type("head");
    await expect(menu(page).getByTestId("slash-section")).toHaveText(["Resultados filtrados"]);
    await expect(selected(page)).toHaveAttribute("data-slash-id", "h1");
    await expect(menu(page).getByRole("option", { name: "Encabezado 2, Convertir en" })).toContainText("· Convertir en");

    // Sin resultados el menú se cierra y el texto se queda
    await page.keyboard.type("zzqx");
    await expect(menu(page)).toBeHidden();
    await expect(page.getByTestId("editor").locator("p").first()).toHaveText("/headzzqx");
    for (let i = 0; i < 9; i++) await page.keyboard.press("Backspace");

    // Escape cierra y deja «/» como texto
    await page.keyboard.type("/");
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toBeHidden();
    await expect(page.getByTestId("editor").locator("p").first()).toHaveText("/");
    await page.keyboard.press("Backspace");
    // «Cerrar menú» con el ratón
    await page.keyboard.type("/");
    await page.getByTestId("slash-close").click();
    await expect(menu(page)).toBeHidden();
  });

  test("con texto en el bloque crea el bloque debajo; vacío lo convierte", async ({ page }) => {
    await openPage(page, "Semántica de inserción");
    await page.keyboard.type("Hola /h2");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Debajo");
    const ed = page.getByTestId("editor");
    await expect(ed.locator("p").first()).toHaveText("Hola");
    await expect(ed.locator("h2")).toHaveText("Debajo");
    // «Convertir en» conserva el texto del bloque
    // Un espacio cierra la búsqueda (como en Notion): «/h4» y bajar a la variante «Convertir en»
    await page.keyboard.type(" /h4");
    await page.keyboard.press("ArrowDown");
    await expect(selected(page)).toHaveAttribute("data-slash-id", "turn-h4");
    await page.keyboard.press("Enter");
    await expect(ed.locator("h4")).toHaveText("Debajo");
    await saved(page);
    await reload(page);
    await expect(page.getByTestId("editor").locator("h4")).toHaveText("Debajo");
  });

  test("bloques nuevos: H4, página, enlace a página, ruta, 4 columnas, vídeo, audio y vista de tablero persisten", async ({ page, request }) => {
    await apiCreate(request, { title: "Destino del enlace", icon: "🎯" });
    await openPage(page, "Bloques del menú");
    const ed = page.getByTestId("editor");
    const slash = async (q: string, id: string) => {
      await page.keyboard.type(`/${q}`);
      await expect(selected(page)).toHaveAttribute("data-slash-id", id);
      await page.keyboard.press("Enter");
    };
    await slash("h4", "h4");
    await page.keyboard.type("Cuarto nivel");
    await page.keyboard.press("Enter");

    await slash("enlace", "link-page");
    await page.getByLabel("Buscar una página para enlazar").fill("destino");
    await page.getByTestId("page-link-picker").getByRole("option", { name: "Destino del enlace" }).click();
    await expect(ed.getByTestId("page-link")).toContainText("Destino del enlace");

    await ed.locator("h4").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await slash("ruta", "breadcrumb");
    await expect(ed.getByTestId("breadcrumb-block")).toContainText("Bloques del menú");

    await page.keyboard.press("Enter");
    await slash("4", "columns4");
    await expect(ed.locator(".nd-column")).toHaveCount(4);
    await ed.locator(".nd-column p").first().click();
    await page.keyboard.type("Col A");

    await ed.locator("h4").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await slash("video", "video");
    await page.getByLabel("Enlace de vídeo").fill("https://example.com/clip.mp4");
    await page.getByTestId("video-picker").getByRole("button", { name: "Insertar" }).click();
    await expect(ed.getByTestId("video-block").locator("video")).toHaveAttribute("src", "https://example.com/clip.mp4");

    await ed.locator("h4").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await slash("audio", "audio");
    await page.getByLabel("Enlace de audio").fill("https://example.com/voz.mp3");
    await page.getByTestId("audio-picker").getByRole("button", { name: "Insertar" }).click();
    await expect(ed.getByTestId("audio-block").locator("audio")).toHaveAttribute("src", "https://example.com/voz.mp3");

    await ed.locator("h4").click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await slash("tablero", "db-board");
    await expect(page.getByTestId("database")).toHaveAttribute("data-view-type", "board");

    await saved(page);
    await reload(page);
    const ed2 = page.getByTestId("editor");
    await expect(ed2.locator("h4")).toHaveText("Cuarto nivel");
    await expect(ed2.getByTestId("page-link")).toContainText("Destino del enlace");
    await expect(ed2.getByTestId("breadcrumb-block")).toContainText("Bloques del menú");
    await expect(ed2.locator(".nd-column")).toHaveCount(4);
    await expect(ed2.locator(".nd-column").first()).toContainText("Col A");
    await expect(ed2.getByTestId("video-block").locator("video")).toHaveCount(1);
    await expect(ed2.getByTestId("audio-block").locator("audio")).toHaveCount(1);
    await expect(page.getByTestId("database")).toHaveAttribute("data-view-type", "board");
    // El enlace navega a la página
    await ed2.getByTestId("page-link").getByRole("link").click();
    await expect(page.getByTestId("page-title")).toHaveValue("Destino del enlace");
  });

  test("«Página» crea una subpágina, la abre y deja el enlace en el padre", async ({ page }) => {
    await openPage(page, "Padre");
    await page.keyboard.type("/página");
    await expect(selected(page)).toHaveAttribute("data-slash-id", "page");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("page-title")).toHaveValue("");
    await page.getByTestId("page-title").fill("Hija nueva");
    await expect(page.getByTestId("save-status")).toHaveText("Guardado");
    await page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Padre" }).click();
    await expect(page.getByTestId("editor").getByTestId("page-link")).toContainText("Hija nueva");
  });

  test("en línea: emoji, mención y colores del bloque", async ({ page }) => {
    await openPage(page, "En línea");
    await page.keyboard.type("Texto coloreado");
    await page.keyboard.type(" /rojo");
    await expect(selected(page)).toHaveAttribute("data-slash-id", "color-red");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("editor").locator("p span[style*='color']").first()).toContainText("Texto coloreado");
    await page.keyboard.press("End");
    await page.keyboard.type(" /emoji");
    await page.keyboard.press("Enter");
    await page.getByTestId("emoji-picker").getByRole("button", { name: "cohete lanzamiento" }).click();
    await expect(page.getByTestId("editor")).toContainText("🚀");
    await page.keyboard.type(" /mencionar");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("editor")).toContainText("@");
  });
});

test.describe("menú del asa de bloque", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`acciones, buscador, convertir, color, atajos y recuento — tema ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((t) => localStorage.setItem("nodara:theme", t), theme);
      await openPage(page, `Asa ${theme}`);
      await page.keyboard.type("Bloque de prueba");
      const ed = page.getByTestId("editor");
      await ed.locator("p").first().hover();
      // Clic derecho sobre el asa abre el mismo menú que el clic
      await page.getByTestId("drag-grip").click({ button: "right" });
      const bm = page.getByTestId("block-menu");
      await expect(bm).toBeVisible();
      await expect(page.getByTestId("block-menu-search")).toBeFocused();
      await expect(page.getByTestId("block-menu-type")).toHaveText("Texto");
      await expect(bm.getByRole("menuitem")).toHaveText([/Convertir en/, /Color/, /Duplicar.*Ctrl\+D/, /Eliminar.*Supr/, /Comentar/]);
      await expect(page.getByTestId("block-menu-count")).toHaveText("3 palabras, 16 caracteres");
      const bg = await bm.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe(theme === "light" ? "rgb(255, 255, 255)" : "rgb(37, 37, 37)");
      await bm.getByRole("menuitem", { name: /Convertir en/ }).hover();
      await expect(page.getByTestId("block-menu-turn").getByRole("menuitem", { name: "Texto" })).toContainText("Texto");
      await page.screenshot({ path: `${SHOTS}/block-menu-${theme}.png` });
      await page.getByTestId("block-menu-turn").getByRole("menuitem", { name: "Encabezado 3" }).click();
      await expect(ed.locator("h3")).toHaveText("Bloque de prueba");

      // Buscador: filtra acciones y colores
      await ed.locator("h3").hover();
      await page.getByTestId("drag-grip").click();
      await page.getByTestId("block-menu-search").fill("fondo amar");
      await expect(page.getByTestId("block-menu").getByRole("menuitem")).toHaveText(["Fondo amarillo"]);
      await page.keyboard.press("Enter");
      await expect(ed.locator("h3 mark")).toHaveText("Bloque de prueba");

      // Atajos con el menú abierto: Ctrl+D duplica y Supr elimina
      await ed.locator("h3").first().hover();
      await page.getByTestId("drag-grip").click();
      await page.keyboard.press("Control+d");
      await expect(ed.locator("h3")).toHaveCount(2);
      await ed.locator("h3").first().hover();
      await page.getByTestId("drag-grip").click();
      await page.keyboard.press("Delete");
      await expect(ed.locator("h3")).toHaveCount(1);

      // Comentar el bloque abre el borrador con su texto
      await ed.locator("h3").hover();
      await page.getByTestId("drag-grip").click();
      await page.getByTestId("block-menu").getByRole("menuitem", { name: /Comentar/ }).click();
      await expect(page.getByTestId("draft-thread")).toContainText("Bloque de prueba");
      await saved(page);
      await reload(page);
      await expect(page.getByTestId("editor").locator("h3 mark")).toHaveText("Bloque de prueba");
    });
  }
});
