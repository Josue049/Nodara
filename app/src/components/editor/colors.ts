// Paleta de bloques de Notion (valores de uso público); el tema oscuro reutiliza los mismos tonos de texto. Sin medir en la app: ver docs/STATUS.md.
export type Swatch = { name: string; text: string | null; bg: string | null };

export const SWATCHES: Swatch[] = [
  { name: "Predeterminado", text: null, bg: null },
  { name: "Gris", text: "#787774", bg: "#f1f1ef" },
  { name: "Marrón", text: "#9f6b53", bg: "#f4eeee" },
  { name: "Naranja", text: "#d9730d", bg: "#fbecdd" },
  { name: "Amarillo", text: "#cb912f", bg: "#fbf3db" },
  { name: "Verde", text: "#448361", bg: "#edf3ec" },
  { name: "Azul", text: "#337ea9", bg: "#e7f3f8" },
  { name: "Morado", text: "#9065b0", bg: "#f6f3f9" },
  { name: "Rosa", text: "#c14c8a", bg: "#f9f0f5" },
  { name: "Rojo", text: "#d44c47", bg: "#fdebec" },
];
