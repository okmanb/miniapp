import type { Metadata, Viewport } from "next";
import { Work_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-work-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Simuladeudas",
  description: "Simulá cómo salir de tus deudas, mes a mes.",
};

export const viewport: Viewport = {
  themeColor: "#F1F3EF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${workSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
