// src/services/userService.ts
import { User, Role } from "@/types/user"; 


const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://deploy-carga-archivos-backend-production.up.railway.app";


// === Tipado del DTO que viene del backend ===
interface UserDto {
  id: number;          // id del profesor
  profesorId: number;
  usuarioId: number;
  nombre: string;
  email: string;
  numEmpleado: number;
  rolId: number | null;
  rol: string | null;
}

// === Helpers ===
interface UserDto {
  id: number;          // id del profesor
  profesorId: number;
  usuarioId: number;
  nombre: string;
  email: string;
  numEmpleado: number;
  rolId: number | null;
  rol: string | null;
}

function mapDtoToUser(dto: UserDto): User {
  return {
    id: dto.id,
    profesorId: dto.profesorId,
    usuarioId: dto.usuarioId,
    nombre: dto.nombre,
    email: dto.email,
    numEmpleado: dto.numEmpleado,
    // si viene null, mapeamos a algo válido para tu tipo:
    rolId: dto.rolId ?? 0,   // 0 = sin rol asignado
    rol: dto.rol ?? "",      // "" = sin rol asignado
    imagen: null,
  };
}


// === API calls ===

export async function getUsersWithRoles(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/admin/users`);
  if (!res.ok) {
    throw new Error("Error al obtener usuarios");
  }
  const data: UserDto[] = await res.json();
  return data.map(mapDtoToUser);
}

export async function getRoles(): Promise<Role[]> {
  const res = await fetch(`${API_BASE}/admin/roles`);
  if (!res.ok) {
    throw new Error("Error al obtener roles");
  }
  const data: Role[] = await res.json();
  return data;
}

export async function updateUserRole(
  usuarioId: number,
  rolId: number
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${usuarioId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rolId }),
  });
  if (!res.ok) {
    throw new Error("Error al actualizar rol");
  }
}

export async function deleteUser(usuarioId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${usuarioId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Error al eliminar usuario");
  }
}

// === Crear / actualizar profesor ===

interface CreateProfesorInput {
  nombreCompleto: string;
  correo: string;
  numEmpleado: number;
  rolId: number;
  password?: string;
}

export async function createProfesor(
  input: CreateProfesorInput
): Promise<User> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error("Error al crear profesor");
  }

  const data: UserDto = await res.json();
  return mapDtoToUser(data);
}

interface UpdateProfesorInput {
  profesorId: number;
  usuarioId: number;
  nombreCompleto: string;
  correo: string;
  numEmpleado: number;
  rolId: number;
}

export async function updateProfesor(
  input: UpdateProfesorInput
): Promise<User> {
  const { profesorId, ...body } = input;

  const res = await fetch(`${API_BASE}/admin/users/${profesorId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error("Error al actualizar profesor");
  }

  const data: UserDto = await res.json();
  return mapDtoToUser(data);
}
