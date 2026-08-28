/**
 * Punto de entrada único para parsear un resumen: detecta el banco
 * por el contenido del texto y despacha al parser correspondiente.
 * Agregar un banco nuevo = escribir su parser (mismo formato de
 * salida ParsedStatement) y sumar una línea acá.
 */

import { parseBbvaStatement, type ParsedStatement } from "./bbva";
import { parsePatagoniaStatement } from "./patagonia";
import { parseGenericStatement } from "./generic";

export type { ParsedStatement };

export function parseStatement(layoutText: string): ParsedStatement {
  if (/BANCOPATAGONIA|Banco Patagonia/i.test(layoutText)) {
    return parsePatagoniaStatement(layoutText);
  }
  if (/BBVA/i.test(layoutText)) {
    return parseBbvaStatement(layoutText);
  }

  // Banco no reconocido: mejor esfuerzo con patrones genéricos en
  // vez de forzar un parser a medida que probablemente extraiga
  // cualquier cosa mal.
  return parseGenericStatement(layoutText);
}
