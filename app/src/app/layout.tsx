import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeSync } from "@/components/theme-sync";
import { faviconFor } from "@/lib/brand";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// Inter autoalojada por next/font (sin peticiones a Google desde el navegador; compatible con la CSP `font-src 'self'`).
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Nodara",
  description: "Alternativa open source a Notion: páginas, bloques y bases de datos.",
  // Antes de hidratar se elige por la preferencia del sistema; después ThemeSync sigue al tema elegido en Nodara.
  icons: {
    icon: [
      { url: faviconFor("light"), type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: light)" },
      { url: faviconFor("dark"), type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
