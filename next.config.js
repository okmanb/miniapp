const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // pdfjs-dist necesita quedar "afuera" del empaquetado: si Next la reescribe
  // en vendor-chunks, no encuentra su propio worker (pdf.worker.mjs) en
  // ejecución. Dejándola externa se resuelve desde node_modules como haría
  // Node. En Next 16 esta opción salió de `experimental`.
  serverExternalPackages: ["pdfjs-dist"],

  // Lo que pdfjs carga en EJECUCION y el rastreador de dependencias no ve venir,
  // porque no sale de ningun `import`: su propio worker y los datos de las
  // fuentes estandar. En desarrollo anda igual —node_modules esta entero— y en
  // produccion falla, que es la peor forma de fallar.
  //
  // El worker es el que rompia de verdad: sin el, pdfjs cae a su "fake worker",
  // que lo importa por ruta absoluta, y en /var/task el archivo no estaba:
  //   Setting up fake worker failed: Cannot find module
  //   '/var/task/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  //
  // Las dos rutas son las dos desde donde se puede subir un PDF: la pantalla
  // del resumen y la raiz, que es donde vive el onboarding. Una accion de
  // servidor se empaqueta con la ruta que la invoca, no donde esta declarada.
  outputFileTracingIncludes: {
    "/dashboard/statements/**": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
    ],
    "/": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
    ],
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
