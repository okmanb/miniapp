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
  // El nombre es la pregunta que la app contesta. Sin los signos se leería
  // como una afirmación, y la respuesta honesta a veces es que no.
  title: "¿Llegás?",
  description:
    "Mirá el mes que viene antes de que llegue: en qué mes te quedás sin plata, por qué crece cada saldo, y qué cambia si pagás distinto.",
  /*
   * La etiqueta que le prueba a Google que el sitio es nuestro.
   *
   * Hace falta porque la pantalla de consentimiento de "entrar con Google"
   * no muestra el nombre de la app ni los links a privacidad y términos
   * mientras el dominio no esté verificado — y el dominio es de Vercel, así
   * que la verificación por DNS no está disponible. La de prefijo de URL sí,
   * y se hace con esto.
   *
   * No es un secreto: viaja en el HTML de todas las páginas, que es
   * justamente para lo que sirve. Si se saca, Google deja de mostrar el
   * branding en la próxima revisión.
   */
  verification: { google: "5Rzolz0vNgud24m2b6n2OOiwqHu5e3IHEen1OgNqnwo" },
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
