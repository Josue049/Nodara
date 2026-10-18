import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nodara",
  description: "Alternativa open source a Notion: páginas, bloques y bases de datos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
