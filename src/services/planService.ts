import { supabase } from "@/lib/supabase";
import { PlanRecord } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://deploy-carga-archivos-backend-production.up.railway.app";

async function safeJson<T>(resp: Response): Promise<T> {
  const data = (await resp.json()) as unknown;
  return data as T;
}

// === Helper para extraer mensaje de error sin usar "any" ===

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error.toLowerCase();

  if (error && typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage.toLowerCase();
    }
  }

  return "";
}

// === RAW TYPES QUE VIENEN DE SUPABASE PARA LA VISTA ===

type MateriaPlanRow = {
  materia_id: number;
  codigo: string;
  nombre: string;
  creditos: number;
  tipo: string | null;
  plan_id: number;
  plan_nombre: string;
  plan_version: string;
  total_creditos: number | null;
  semestres_sugeridos: number | null;
};

// === MAPPERS ===

function mapMateriaPlanRowToPlanRecord(row: MateriaPlanRow): PlanRecord {
  return {
    id: row.materia_id,
    codigo: row.codigo,
    nombre_materia: row.nombre,
    creditos: row.creditos,
    tipo: row.tipo ?? "OBLIGATORIA",
    plan_id: row.plan_id,
    plan_nombre: row.plan_nombre,
    plan_version: row.plan_version,
    plan_total_creditos: row.total_creditos,
    plan_semestres_sugeridos: row.semestres_sugeridos,
  };
}

// === HISTORIAL DE ARCHIVOS DE PLAN ===

export interface PlanHistorialItem {
  id: number;
  fecha: string; // ISO string
  nombre_archivo: string;
  estado: string;
}

type PlanHistorialResponse = {
  ok?: boolean;
  items?: PlanHistorialItem[];
};

export async function getPlanHistorial(
  limit = 50
): Promise<PlanHistorialItem[]> {
  const url = new URL(`${API_BASE}/plan/historial`);
  url.searchParams.set("limit", String(limit));

  const resp = await fetch(url.toString(), {
    method: "GET",
  });

  if (!resp.ok) {
    throw new Error("Error al obtener historial de plan de estudios");
  }

  const json = await safeJson<PlanHistorialResponse>(resp);

  return Array.isArray(json.items) ? json.items : [];
}

// === CATÁLOGO DE PLANES ===

export interface PlanOption {
  id: number;
  label: string; // "Nombre (versión)"
}

export async function getPlanesCatalog(): Promise<PlanOption[]> {
  const { data, error } = await supabase
    .from("plan_estudio")
    .select("id, nombre, version")
    .order("nombre");

  if (error) {
    console.error("Error al obtener planes:", error);
    throw error;
  }

  const rows = (data ?? []) as { id: number; nombre: string; version: string }[];

  return rows.map((p) => ({
    id: p.id,
    label: `${p.nombre} (v${p.version})`,
  }));
}

// === LISTADO DE MATERIAS POR PLAN (vista) ===

export async function getPlanMaterias(): Promise<PlanRecord[]> {
  const { data, error } = await supabase
    .from("vista_materias_planes")
    .select(
      `
      materia_id,
      codigo,
      nombre,
      creditos,
      tipo,
      plan_id,
      plan_nombre,
      plan_version,
      total_creditos,
      semestres_sugeridos
    `
    )
    .order("codigo");

  if (error) {
    console.error("Error al obtener materias de plan:", error);
    throw error;
  }

  const rows = (data ?? []) as MateriaPlanRow[];
  return rows.map(mapMateriaPlanRowToPlanRecord);
}

// === CREAR / EDITAR / ELIMINAR MATERIA ===

export interface PlanMateriaFormData {
  codigo: string;
  nombre_materia: string;
  creditos: number;
  tipo: string;
  plan_id: number;
}

function mapFormToMateriaPayload(form: PlanMateriaFormData) {
  return {
    codigo: form.codigo,
    nombre: form.nombre_materia,
    creditos: form.creditos,
    tipo: form.tipo,
    plan_estudio_id: form.plan_id,
  };
}

// Crear materia + relación en materia_plan
export async function createPlanMateria(
  form: PlanMateriaFormData
): Promise<void> {
  const payload = mapFormToMateriaPayload(form);

  // 1) Insertar en materia (solo necesitamos el id)
  const { data, error } = await supabase
    .from("materia")
    .insert([payload])
    .select("id");

  if (error) {
    console.error("Error al crear materia de plan:", error);
    throw new Error(error.message || "Error al crear materia de plan");
  }

  const row = (data?.[0] ?? null) as { id: number } | null;
  if (!row) {
    throw new Error("No se pudo obtener el ID de la materia recién creada.");
  }

  // 2) Asociar en materia_plan para que aparezca en la vista
  const { error: mpError } = await supabase.from("materia_plan").insert({
    materia_id: row.id,
    plan_estudio_id: payload.plan_estudio_id,
  });

  if (mpError) {
    console.error("Error al asociar materia con plan (materia_plan):", mpError);
    throw new Error(
      mpError.message ||
        "La materia se creó pero no se pudo asociar al plan de estudio."
    );
  }

  // No regresamos nada: el front recargará la lista desde la vista
}

// Actualizar materia (solo UPDATE; la vista se recarga después)
export async function updatePlanMateria(
  id: number,
  form: PlanMateriaFormData
): Promise<void> {
  const payload = mapFormToMateriaPayload(form);

  const { error } = await supabase
    .from("materia")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error("❌ Error al actualizar materia de plan (Supabase):", error);

    const parts = [
      error.message,
      error.details,
      error.hint,
      error.code && `Código: ${error.code}`,
    ].filter(Boolean);

    const msg =
      parts.join(" | ") ||
      "No se pudo actualizar la materia de plan en la base de datos.";

    throw new Error(msg);
  }

  // La relación en materia_plan no cambia si solo modificas código/nombre/créditos/tipo/plan_id.
  // Si quisieras cambiar de plan, tendríamos que actualizar materia_plan también.
}

// Eliminar materia: primero materia_plan, luego materia
export async function deletePlanMateria(id: number): Promise<void> {
  // 1) Borrar asociaciones en materia_plan para evitar violación de FK
  const { error: mpError } = await supabase
    .from("materia_plan")
    .delete()
    .eq("materia_id", id);

  if (mpError) {
    console.error("Error al eliminar asociaciones en materia_plan:", mpError);
    throw new Error(
      mpError.message ||
        "No se pudo eliminar la asociación de la materia con su plan de estudio."
    );
  }

  // 2) Borrar materia
  const { error } = await supabase.from("materia").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar materia de plan:", error);
    const msg = extractErrorMessage(error);

    if (msg.includes("violates foreign key constraint")) {
      throw new Error(
        "No se puede eliminar esta materia porque está asociada a grupos, kardex u otros registros."
      );
    }

    throw new Error("No se pudo eliminar la materia. Intenta de nuevo más tarde.");
  }
}

// === INGESTA DESDE PDF (/plan/upload) ===

export interface PlanUploadIngesta {
  planId: number;
  materiasInput: number;
  added: number;
  updated: number;
  unchanged: number;
  warnings: string[];
  action: string;
}

export interface PlanUploadParsedPlan {
  nombre?: string;
  version?: string;
  total_creditos?: number;
  semestres_sugeridos?: number;
}

export interface PlanUploadParsed {
  ok: boolean;
  origen?: string;
  plan?: PlanUploadParsedPlan;
  materias?: {
    codigo: string;
    nombre: string;
    creditos: number;
    tipo?: string | null;
  }[];
  warnings?: string[];
}

export interface PlanUploadResponse {
  ok: boolean;
  action: string;
  archivoId: number;
  parsed?: PlanUploadParsed;
  ingesta?: PlanUploadIngesta;
}

export async function uploadPlanPdf(
  file: File,
  opts?: { force?: boolean; debug?: boolean; ocr?: boolean }
): Promise<PlanUploadResponse> {
  const form = new FormData();
  form.append("pdf", file); // nombre de campo según planMiddleware

  const params = new URLSearchParams();
  if (opts?.force) params.append("force", "1");
  if (opts?.debug) params.append("debug", "1");
  if (opts?.ocr) params.append("ocr", "1");

  const url = `${API_BASE}/plan/upload${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  const resp = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Error al subir plan (${resp.status}): ${text || resp.statusText}`
    );
  }

  const json = (await resp.json()) as PlanUploadResponse;
  return json;
}
