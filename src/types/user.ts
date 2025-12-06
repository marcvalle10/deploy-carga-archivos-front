/**
 * Interfaz que define la estructura de un usuario en el sistema
 */
export interface User {
  id: number;
  profesorId: number;
  usuarioId: number;
  nombre: string;
  email: string;
  numEmpleado: number;
  rol: string;
  rolId: number;
  imagen?: string | null;
}

export interface ProfesorFormValues {
  nombre: string;
  correo: string;
  numEmpleado: string;
  rolId: number | "";
}

/**
 * Tipos de roles disponibles en el sistema (opcional, para validaciones / UI)
 */
export type UserRole = "Administrador" | "Coordinador" | "Profesor";

/**
 * Interfaz para roles en el sistema (vienen de la tabla rol en la BD)
 */
export interface Role {
  id: number;
  nombre: string; // <-- aquí lo cambiamos de UserRole a string
}
