const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // pdfjs-dist necesita quedar "afuera" del empaquetado: si Next la reescribe
  // en vendor-chunks, no encuentra su propio worker (pdf.worker.mjs) en
  // ejecución. Dejándola externa se resuelve desde node_modules como haría
  // Node. En Next 16 esta opción salió de `experimental`.
  serverExternalPackages: ["pdfjs-dist"],

  // Sin esto Turbopack sube buscando un lockfile y encuentra uno en el home
  // del usuario, fuera del repo. La raíz es este proyecto y nada más.
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = nextConfig;
