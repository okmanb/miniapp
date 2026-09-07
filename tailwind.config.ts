import type { Config } from "tailwindcss";

/**
 * Los valores de acá salen de handoff/DESIGN.md, que a su vez documenta lo
 * que hace handoff/prototipo.html. Ante cualquier diferencia gana el
 * prototipo: si tocás un número acá, verificalo contra la pantalla abierta.
 *
 * Cada verde tiene un rol y uno solo. No son intercambiables, y por eso no
 * hay escala numérica (green-500 y demás): un token con nombre de rol se
 * usa mal más difícilmente que uno con nombre de tono.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Estructura y acento
        pine: "#0E3A31",
        "pine-hover": "#0A2C25",
        // Acción
        teal: "#0D6B5C",
        "teal-hover": "#0A5A4D",
        mint: "#97DCBA",
        leaf: "#25835D",
        "leaf-deep": "#175F42",
        // Severidades — nunca se suavizan
        brick: "#B14D3B",
        "brick-ink": "#823123",
        "brick-head": "#8E3B2C",
        "brick-bg": "#FFE9E4",
        "brick-bg-soft": "#FFF6F3",
        "brick-border": "#F2C7BE",
        gold: "#A77530",
        "gold-ink": "#7A5116",
        "gold-border": "#E6CFA4",
        // Texto
        ink: "#12211D",
        muted: "#5C6B65",
        // Superficies
        "app-bg": "#F1F3EF",
        surface: "#FFFFFF",
        "surface-sunken": "#F7FAF7",
        "surface-arch": "#F2F5F1",
        "surface-alt": "#EFF2EE",
        "mint-wash": "#E0F4E9",
        // Líneas
        border: "#DEE3DD",
        "border-input": "#D3DAD2",
        "border-row": "#E2E7E1",
        "border-dash": "#CBD2C9",
        /**
         * Rampa de severidad del flujo de caja, medida del prototipo. No es
         * decorativa: cada escalón es un umbral de plata sobre el saldo
         * acumulado (ver severityOf en lib/calc/cashflow.ts). Va de "colchón
         * cómodo" a "el rojo más profundo", pasando por gold cuando todavía
         * es positivo pero se adelgaza.
         */
        "sev-ok": "#25835D",
        "sev-justo": "#A77530",
        "sev-rojo1": "#C9735B",
        "sev-rojo2": "#B05441",
        "sev-rojo3": "#94362A",

        // Utilitarios
        track: "#E7EBE6",
        skeleton: "#DFE5DF",
        selection: "#BEE1CE",
      },
      fontFamily: {
        sans: ["var(--font-work-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // Tres niveles, sin excepciones.
        row: "8px",
        surface: "12px",
        "surface-lg": "14px",
        pill: "999px",
      },
      boxShadow: {
        // Una sola sombra en el sistema, para la tarjeta principal.
        card: "0 14px 26px -18px rgba(14,58,49,.28)",
      },
      transitionTimingFunction: {
        // La única curva.
        sd: "cubic-bezier(.23,1,.32,1)",
        // Excepción documentada: el clip-path del selector segmentado.
        segmented: "cubic-bezier(.77,0,.175,1)",
      },
      keyframes: {
        sdScreenIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        sdCardIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        sdBannerIn: {
          "0%": { opacity: "0", transform: "scale(.96)" },
          "100%": { opacity: "1", transform: "none" },
        },
        // Las salidas son mas cortas que las entradas: al cerrar ya se decidio,
        // y esperar a que la animacion termine se siente como que la app duda.
        sdCardOut: {
          "0%": { opacity: "1", transform: "none" },
          "100%": { opacity: "0", transform: "translateY(6px)" },
        },
        sdFadeOut: { "0%": { opacity: "1" }, "100%": { opacity: "0" } },
        sdSpin: { "100%": { transform: "rotate(360deg)" } },
        sdSlide: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(238%)" },
        },
        sdShimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "screen-in": "sdScreenIn 130ms cubic-bezier(.23,1,.32,1) both",
        "card-in": "sdCardIn 210ms cubic-bezier(.23,1,.32,1) both",
        "banner-in": "sdBannerIn 190ms cubic-bezier(.23,1,.32,1) both",
        "card-out": "sdCardOut 140ms cubic-bezier(.23,1,.32,1) both",
        "fade-out": "sdFadeOut 140ms cubic-bezier(.23,1,.32,1) both",
        spin: "sdSpin 700ms linear infinite",
        slide: "sdSlide 620ms cubic-bezier(.23,1,.32,1) infinite",
        shimmer: "sdShimmer 1200ms cubic-bezier(.23,1,.32,1) infinite",
      },
      fontSize: {
        // Los tamaños con significado en el sistema; el resto sale de la escala default.
        label: ["10.5px", { lineHeight: "1.2", letterSpacing: ".06em", fontWeight: "600" }],
        help: ["11.5px", { lineHeight: "1.5" }],
        card: ["13.5px", { lineHeight: "1.35", fontWeight: "600" }],
        "card-lg": ["15px", { lineHeight: "1.3", fontWeight: "600" }],
        screen: ["20px", { lineHeight: "1.25", letterSpacing: "-.01em", fontWeight: "600" }],
      },
      minHeight: { touch: "44px" },
      minWidth: { touch: "44px" },
    },
  },
  plugins: [],
};

export default config;
