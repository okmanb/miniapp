"use client";

/**
 * Elegir una opción de una lista corta, sin `<select>`.
 *
 * El prototipo no tiene un solo `<select>` en ninguna pantalla, y no es un
 * capricho: el control nativo abre la rueda del sistema operativo, con su
 * tipografía y su idioma, y esconde las opciones hasta que lo tocás. Con dos o
 * seis opciones no hay nada que esconder — verlas todas es el punto.
 *
 * Adentro son `<input type="radio">` de verdad, escondidos a la vista pero no
 * al teclado ni al lector de pantalla: así las flechas, el foco y el envío del
 * formulario los maneja el navegador y no una imitación nuestra.
 *
 * ## Las tres formas
 *
 * El prototipo usa una distinta en cada lugar, y la regla que las explica es
 * el largo de la etiqueta, no el campo:
 *
 *  - `row`   → tres opciones de una o dos palabras, en una fila.
 *  - `grid`  → cuatro opciones medianas, en dos columnas.
 *  - `stack` → etiquetas largas, una por renglón y a todo el ancho.
 *
 * `row` y `grid` son píldoras; `stack` son filas de radio 12. Cuando la
 * etiqueta no entra en una píldora, la respuesta es `stack`, no achicar la
 * letra.
 */

export type ChoiceLayout = "row" | "grid" | "stack";

export interface Choice {
  value: string;
  label: string;
  /** Se muestra debajo del grupo cuando esta opción está elegida. */
  note?: string;
}

const LAYOUT_CLASS: Record<ChoiceLayout, string> = {
  row: "flex gap-1.5",
  grid: "grid grid-cols-2 gap-[7px]",
  stack: "flex flex-col gap-[7px]",
};

export function ChoiceGroup({
  name,
  label,
  value,
  onChange,
  options,
  layout = "stack",
  help,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Choice[];
  layout?: ChoiceLayout;
  /** Ayuda fija; la `note` de la opción elegida gana si existe. */
  help?: string;
  error?: string;
}) {
  const pill = layout !== "stack";
  // La ayuda cambia con lo elegido: es donde va a parar lo que antes venía
  // apretado adentro del texto de cada `<option>`.
  const note = options.find((o) => o.value === value)?.note ?? help;

  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-label uppercase text-muted">{label}</legend>

      <div className={LAYOUT_CLASS[layout]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex min-h-touch cursor-pointer items-center transition-colors duration-150 ease-sd ${
                pill
                  ? "flex-1 justify-center rounded-pill px-3 py-2.5 text-center text-[12.5px] leading-tight"
                  : "rounded-surface px-[13px] py-[11px] text-[13.5px]"
              }`}
              style={{
                backgroundColor: selected
                  ? pill
                    ? "#0E3A31"
                    : "#E0F4E9"
                  : pill
                  ? "#FFFFFF"
                  : "#FFFFFF",
                color: selected && pill ? "#FFFFFF" : selected ? "#12211D" : pill ? "#5C6B65" : "#12211D",
                border: `1px solid ${selected ? "#0E3A31" : "#D3DAD2"}`,
                fontWeight: selected ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span className="peer-focus-visible:underline peer-focus-visible:underline-offset-4">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>

      {note && <p className="help mt-1.5">{note}</p>}
      {error && <p className="mt-1.5 text-[11.5px] text-brick-ink">{error}</p>}
    </fieldset>
  );
}
