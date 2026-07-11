import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError, ZodSchema } from "zod";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";

// ---- Consistent API response envelope ----

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400, errors?: unknown) {
  return NextResponse.json({ success: false, message, errors }, { status });
}

// ---- Backend-enforced RBAC ----
// Every route handler calls requireRole(); authorization never relies on the UI.

export async function requireRole(allowed: Role[]) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { session: null, error: fail("Unauthorized. Please sign in.", 401) };
  }
  if (!allowed.includes(session.user.role)) {
    return {
      session: null,
      error: fail("Forbidden. Your role does not permit this action.", 403),
    };
  }
  return { session, error: null };
}

export const ALL_ROLES: Role[] = ["ADMIN", "PROGRAM_MANAGER", "OPERATIONS"];
export const MANAGERS: Role[] = ["ADMIN", "PROGRAM_MANAGER"];
export const ADMIN_ONLY: Role[] = ["ADMIN"];

// ---- Zod body parsing with uniform error shape ----

export async function parseBody<T>(req: Request, schema: ZodSchema<T>) {
  try {
    const json = await req.json();
    return { data: schema.parse(json), error: null };
  } catch (e) {
    if (e instanceof ZodError) {
      return {
        data: null,
        error: fail("Validation failed.", 422, e.flatten().fieldErrors),
      };
    }
    return { data: null, error: fail("Invalid JSON body.", 400) };
  }
}
