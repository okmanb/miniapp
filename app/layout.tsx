import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini App Factory",
  description: "Boilerplate base con auth + suscripciones",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {/*
          THESIS: debt tracking read as a builder tool that hands back
          control, not an anxiety object — refuses the pizarrón/ledger
          arrangement this category always ships.
          OWN-WORLD: white ground, frosted-glass panels over soft gradient
          wash; Plus Jakarta Sans; Material Symbols Outlined icons; pill
          radius; coral primary, olive secondary, blue tertiary (estimates
          only), red error that never softens for a bad number.
          STORY: user opens the dashboard, scans debts grouped by status in
          a clean glass table, a due-soon banner reads urgent without noise,
          a negative cash-flow month stays unmistakably red.
          FIRST VIEWPORT: header + hero balance stat, debts grouped by
          status in glass-card sections, health ribbon as rounded pill
          tiles.
          FORM: user-pinned canon direction (Horizon), chosen over assigned
          grounded direction #3 (semáforo de riesgo BCRA), seed key
          03ddac73.
          FINISH: unreviewed and undocumented is unfinished; this build ends
          with the finish review, the verdict, DESIGN.md, and every shipping
          raster carrying its provenance.
        */}
        {children}
      </body>
    </html>
  );
}
