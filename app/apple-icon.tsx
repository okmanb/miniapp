import { ImageResponse } from "next/og";

/**
 * El ícono para la pantalla de inicio del teléfono.
 *
 * Va aparte de `icon.svg` por una limitación de Safari, no por gusto:
 * `apple-touch-icon` no acepta SVG. Se genera como PNG en el build en vez de
 * versionar un binario.
 *
 * **Sin esquinas redondeadas, a propósito.** iOS le aplica su propia máscara:
 * un ícono que ya viene redondeado queda recortado dos veces y se le ve un
 * halo. Por eso el cuadrado va a sangre completa y el radio vive solo en
 * `icon.svg`, que es el que se muestra tal cual en la pestaña.
 *
 * El `<path>` es el mismo de `icon.svg` —el glifo `questiondown` de Work Sans,
 * aplanado a una caja de 100— y está duplicado a propósito: no se puede
 * importar un SVG acá adentro, y tener dos copias de una forma que no cambia
 * es mejor que un paso de build que nadie recuerda. Si se toca una, se toca
 * la otra.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const SIGNO =
  "M49.18 87Q42.11 87 36.72 84.71Q31.34 82.43 28.34 78.19Q25.35 73.94 25.35 68.06Q25.35 61.64 28.13 57.51Q30.9 53.37 35.53 51.14Q40.15 48.91 45.81 48.37V36.72H54.84V53.05Q46.9 54.24 42.49 55.99Q38.08 57.73 36.29 60.28Q34.49 62.84 34.49 66.76Q34.49 70.57 36.18 73.29Q37.87 76.01 41.29 77.42Q44.72 78.84 49.84 78.84Q57.02 78.84 61.59 74.87Q66.16 70.89 66.92 64.04L74.65 68.5Q73.45 74.05 70.02 78.19Q66.6 82.32 61.32 84.66Q56.04 87 49.18 87ZM50.49 27.15Q47.33 27.15 45.38 25.19Q43.42 23.23 43.42 20.07Q43.42 16.92 45.38 14.96Q47.33 13 50.49 13Q53.65 13 55.6 14.96Q57.56 16.92 57.56 20.07Q57.56 23.23 55.6 25.19Q53.65 27.15 50.49 27.15Z";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          // pine, el mismo fondo que el sistema usa para lo oscuro.
          background: "#0E3A31",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 100 100">
          <path fill="#97DCBA" d={SIGNO} />
        </svg>
      </div>
    ),
    { ...size }
  );
}
