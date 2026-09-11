const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // pdfjs-dist necesita quedar "afuera" del empaquetado: si Next la reescribe
  // en vendor-chunks, no encuentra su propio worker (pdf.worker.mjs) en
  // ejecución. Dejándola externa se resuelve desde node_modules como haría
  // Node. En Next 16 esta opción salió de `experimental`.
  serverExternalPackages: ["pdfjs-dist"],

  // Y los datos de las fuentes estandar van al deploy aunque nadie los importe:
  // son archivos .pfb que pdfjs lee en ejecucion, asi que el rastreador de
  // dependencias no los ve viniendo de ningun `import`. Sin esto andaria en
  // desarrollo y fallaria en produccion al abrir un PDF que las necesite.
  outputFileTracingIncludes: {
    "/dashboard/statements/**": ["./node_modules/pdfjs-dist/standard_fonts/**"],
  },

  // Sin esto Turbopack sube buscando un lockfile y encuentra uno en el home
  // del usuario, fuera del repo. La raíz es este proyecto y nada más.
  turbopack: {
    root: path.join(__dirname),
  },

  experimental: {
    serverActions: {
      // El default de 1 MB deja afuera resúmenes con muchas páginas. El
      // límite real lo pone la acción de parseo, que rechaza arriba de 8 MB
      // con un mensaje en castellano en vez de un error del framework.
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
