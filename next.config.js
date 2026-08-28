/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist necesita quedar "afuera" del empaquetado de Next: si
  // Next la reescribe en vendor-chunks, no puede encontrar su
  // propio archivo de worker (pdf.worker.mjs) en tiempo de
  // ejecución. Dejándola externa, se resuelve directo desde
  // node_modules como haría Node normalmente.
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },
};

module.exports = nextConfig;
