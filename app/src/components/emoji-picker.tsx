"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/strings";

const EMOJIS: [string, string][] = [
  ["😀", "sonrisa feliz"], ["😂", "risa"], ["😍", "enamorado corazones"], ["🤔", "pensando"], ["😎", "genial gafas"], ["🥳", "fiesta"],
  ["😴", "dormir"], ["🤯", "mente explotando"], ["👍", "bien pulgar"], ["👏", "aplausos"], ["🙌", "celebrar"], ["👋", "saludo mano"],
  ["💪", "fuerza"], ["🙏", "gracias rezar"], ["👀", "ojos"], ["🧠", "cerebro"], ["❤️", "corazon amor"], ["🔥", "fuego"],
  ["⭐", "estrella"], ["✨", "brillos"], ["⚡", "rayo energia"], ["🌈", "arcoiris"], ["☀️", "sol"], ["🌙", "luna"],
  ["🌱", "planta brote"], ["🌳", "arbol"], ["🌸", "flor"], ["🍀", "trebol suerte"], ["🌎", "mundo tierra"], ["🌊", "ola mar"],
  ["🐶", "perro"], ["🐱", "gato"], ["🦊", "zorro"], ["🐼", "panda"], ["🦄", "unicornio"], ["🐝", "abeja"],
  ["🍎", "manzana"], ["🍕", "pizza"], ["🍔", "hamburguesa"], ["☕", "cafe"], ["🍰", "pastel"], ["🍷", "vino"],
  ["⚽", "futbol"], ["🏀", "baloncesto"], ["🎮", "videojuego"], ["🎵", "musica"], ["🎨", "arte pintura"], ["🎬", "cine"],
  ["📚", "libros"], ["📖", "libro abierto"], ["📝", "nota escribir"], ["📌", "chincheta"], ["📎", "clip"], ["📅", "calendario"],
  ["📊", "grafico barras"], ["📈", "grafico crecimiento"], ["📉", "grafico baja"], ["📁", "carpeta"], ["📂", "carpeta abierta"], ["🗂️", "archivo fichero"],
  ["📧", "correo email"], ["📞", "telefono"], ["💬", "mensaje chat"], ["🔔", "campana notificacion"], ["🔒", "candado privado"], ["🔑", "llave"],
  ["💡", "idea bombilla"], ["🔍", "buscar lupa"], ["⚙️", "ajustes engranaje"], ["🛠️", "herramientas"], ["🔧", "llave inglesa"], ["💻", "computadora laptop"],
  ["🖥️", "monitor"], ["📱", "movil celular"], ["🚀", "cohete lanzamiento"], ["✈️", "avion viaje"], ["🚗", "coche auto"], ["🏠", "casa hogar"],
  ["🏢", "oficina edificio"], ["🏆", "trofeo premio"], ["🎯", "objetivo diana"], ["🎁", "regalo"], ["💰", "dinero"], ["💳", "tarjeta pago"],
  ["🧾", "recibo factura presupuesto"], ["✅", "hecho listo check"], ["❌", "error cruz"], ["⚠️", "advertencia"], ["❓", "pregunta"], ["💎", "diamante"],
  ["🧪", "experimento laboratorio"], ["🔬", "microscopio ciencia"], ["🧩", "pieza puzzle"], ["🗺️", "mapa roadmap"], ["🧭", "brujula"], ["⏰", "alarma reloj"],
  ["🗓️", "agenda"], ["📋", "portapapeles lista"], ["🗒️", "bloc notas"], ["🗑️", "papelera"], ["🏷️", "etiqueta"], ["🔖", "marcador"],
];

/** Selector de emoji con búsqueda. Devuelve null para quitar el icono. */
export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  const needle = q.trim().toLowerCase();
  const list = needle ? EMOJIS.filter(([e, n]) => n.includes(needle) || e === needle) : EMOJIS;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t.chooseIcon}
      data-testid="emoji-picker"
      className="absolute left-0 top-full z-50 mt-1 w-[360px] rounded-[10px] bg-[var(--popover)] p-2 shadow-[var(--shadow-pop)]"
    >
      <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.searchIcon}
          aria-label={t.searchIcon}
          className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 py-1 text-[14px] outline-none focus:border-accent"
        />
        <button onClick={() => onPick(null)} className="rounded-md px-2 py-1 text-[14px] text-ink-2 hover:bg-hover">
          {t.removeIcon}
        </button>
      </div>
      <div className="nd-scroll grid max-h-[240px] grid-cols-9 gap-0.5 overflow-y-auto">
        {list.map(([e, n]) => (
          <button
            key={e}
            title={n}
            aria-label={n}
            onClick={() => onPick(e)}
            className="flex size-9 items-center justify-center rounded text-[22px] hover:bg-hover"
          >
            {e}
          </button>
        ))}
        {list.length === 0 && <p className="col-span-9 px-2 py-4 text-center text-[14px] text-ink-3">{t.noResults}</p>}
      </div>
    </div>
  );
}
