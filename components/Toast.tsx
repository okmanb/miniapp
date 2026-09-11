"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";

/**
 * El toast del prototipo.
 *
 * Escrito y no instalado. Cada píxel de esta app está atado al prototipo, y
 * una librería de toasts trae su propio DOM, sus animaciones y su theming:
 * pelearse con los overrides sale más caro que estas sesenta líneas. Además la
 * app no tiene ni una dependencia de UI, y la primera no la va a traer esto.
 *
 * Un toast a la vez, como el prototipo: el nuevo pisa al anterior, sin cola.
 * Dura 2400ms y se limpia a los 2600; los 200 del medio son la salida.
 */

/*
 * Los tiempos son del prototipo, incluida la asimetría. Las duraciones de
 * entrada (260ms) y salida (160ms) viven en tailwind.config.ts, como el resto
 * del movimiento de la app; acá quedan las dos del reloj: 2400ms en pantalla y
 * 200 más para que termine de salir antes de desmontarse.
 */
const VISIBLE_MS = 2400;
const CLEAR_MS = 2600;

interface ToastState {
  message: string | null;
  /** Arrancada la salida, pero todavía en el DOM. */
  leaving: boolean;
  show: (message: string) => void;
}

/*
 * zustand y no un context: ya estaba en package.json sin que lo usara nadie, y
 * un store suelto deja que cualquier componente cliente dispare un toast sin
 * prop-drilling ni un provider que re-renderice el árbol entero por un aviso
 * de dos segundos.
 */
let timers: ReturnType<typeof setTimeout>[] = [];

export const useToast = create<ToastState>((set) => ({
  message: null,
  leaving: false,
  show: (message) => {
    // El nuevo pisa al anterior: sus temporizadores no pueden apagar a este.
    for (const t of timers) clearTimeout(t);
    timers = [];

    set({ message, leaving: false });

    timers.push(setTimeout(() => set({ leaving: true }), VISIBLE_MS));
    timers.push(setTimeout(() => set({ message: null, leaving: false }), CLEAR_MS));
  },
}));

/**
 * Se monta una sola vez, en el layout de las pantallas privadas.
 *
 * Va por un PORTAL al body, y eso no es opcional: `Screen` anima su opacidad
 * al entrar, y una animación de opacidad crea un contexto de apilado. Adentro
 * de él este z-index no competiría contra el de la barra inferior sino contra
 * el `z-index: 0` del `<main>`, y el toast quedaría debajo de la barra. Es
 * exactamente el bug que tuvo el calendario.
 */
export function ToastHost() {
  const message = useToast((s) => s.message);
  const leaving = useToast((s) => s.leaving);
  const [mounted, setMounted] = useState(false);

  // El portal necesita el document, que en el render del servidor no existe.
  useEffect(() => setMounted(true), []);

  if (!mounted || !message) return null;

  return createPortal(
    <div
      /*
       * `data-motion-move` es la convención del proyecto para lo que interpola
       * un cambio de estado: con `prefers-reduced-motion` la transición queda
       * solo en opacidad y el deslizamiento se apaga. El prototipo se lo pone
       * a este mismo elemento.
       */
      /*
       * Keyframes y no una transición, a diferencia del prototipo.
       *
       * Una transición necesita un estado anterior del que salir, y un elemento
       * que acaba de montarse no lo tiene: hay que pintarlo escondido y moverlo
       * en el frame siguiente. Ese baile depende de `requestAnimationFrame`, y
       * cuando rAF no corre —una pestaña en segundo plano, un entorno que lo
       * estrangula— el toast se queda en opacidad 0 y NO APARECE. Medido: se
       * quedaba invisible los 2,6 segundos y se iba sin haberse visto.
       *
       * Una animación de keyframes corre sola al montar y no necesita estado
       * anterior. Es además el mecanismo con el que entra todo lo demás en esta
       * app, y el que `prefers-reduced-motion` ya sabe apagar por `data-motion`.
       */
      data-motion=""
      /*
       * 84px de piso: la barra mide 80 y el toast tiene que despegarse de
       * ella, igual que el panel del calendario. `pointer-events: none` para
       * que no tape lo que hay debajo durante sus dos segundos.
       */
      className={`pointer-events-none fixed inset-x-[10px] bottom-[84px] z-[60] flex justify-center overflow-hidden px-4 pb-1 ${
        leaving ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      {/*
        role=status y aria-live=polite: el toast es la única confirmación de
        que la acción ocurrió, así que tiene que llegar a quien no lo ve.
      */}
      <div
        role="status"
        aria-live="polite"
        className="flex max-w-full items-center gap-[10px] rounded-[12px] px-4 py-[13px]"
        style={{
          backgroundColor: "#12211D",
          color: "#FFFFFF",
          boxShadow: "0 18px 34px -12px rgba(0,0,0,.5)",
        }}
      >
        <span
          aria-hidden
          className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[11px]"
          style={{ backgroundColor: "#25835D", color: "#FFFFFF" }}
        >
          ✓
        </span>
        <span className="text-[13px] font-medium leading-[1.35]">{message}</span>
      </div>
    </div>,
    document.body
  );
}
