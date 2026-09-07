/**
 * La palabra que hay que escribir para borrar todo.
 *
 * Vive en su propio módulo porque un archivo "use server" solo puede exportar
 * funciones asíncronas, y la constante la necesitan los dos lados: el
 * formulario para pedirla y la acción para verificarla. Duplicar el literal
 * sería la forma más tonta de que un día dejen de coincidir.
 */
export const DELETE_CONFIRMATION = "BORRAR";
