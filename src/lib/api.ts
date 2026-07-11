import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError, ZodSchema } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---- Consistent API response envelope ----

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400, errors?: unknown) {
  return NextResponse.json({ success: false, message, errors }, { status });
}

// ---- Backend-enforced, permission-based access control ----
// Every route handler calls requirePermission("<module>.<action>").
// Permissions are read from the database on each request, so edits made in
// Role Master apply immediately; the JWT copy is only used for hiding UI.

export async function requirePermission(key: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { session: null, user: null, error: fail("Unauthorized. Please sign in.", 401) };
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  // Deactivated (or deleted) users lose access immediately, even mid-session.
  if (!user || !user.is_active) {
    return { session: null, user: null, error: fail("Your account is inactive.", 401) };
  }

  const keys: string[] = user.role.permissions.map(
    (rp: { permission: { key: string } }) => rp.permission.key
  );
  if (!keys.includes(key)) {
    return {
      session: null,
      user: null,
      error: fail("Forbidden. Your role does not permit this action.", 403),
    };
  }

  return { session, user, error: null };
}

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
