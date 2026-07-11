import { prisma } from "@/lib/prisma";
import { ok, fail, requireRole, parseBody, ALL_ROLES, MANAGERS, ADMIN_ONLY } from "@/lib/api";
import { programSchema } from "@/lib/validations";

type Params = { params: { id: string } };

async function findProgram(id: string) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;
  return prisma.program.findUnique({
    where: { id: numId },
    include: { _count: { select: { registrations: true } } },
  });
}

// GET /api/programs/:id (all roles)
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireRole(ALL_ROLES);
  if (error) return error;

  const program = await findProgram(params.id);
  if (!program) return fail("Program not found.", 404);
  return ok(program);
}

// PUT /api/programs/:id (Admin, Program Manager)
export async function PUT(req: Request, { params }: Params) {
  const { error } = await requireRole(MANAGERS);
  if (error) return error;

  const program = await findProgram(params.id);
  if (!program) return fail("Program not found.", 404);

  const { data, error: vErr } = await parseBody(req, programSchema);
  if (vErr) return vErr;

  const duplicate = await prisma.program.findFirst({
    where: { code: data!.code, id: { not: program.id } },
  });
  if (duplicate) return fail("Another program already uses this code.", 409);

  const updated = await prisma.program.update({
    where: { id: program.id },
    data: data!,
  });
  return ok(updated);
}

// DELETE /api/programs/:id (Admin only - destructive)
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireRole(ADMIN_ONLY);
  if (error) return error;

  const program = await findProgram(params.id);
  if (!program) return fail("Program not found.", 404);

  // Referential safety: block deletion when registrations exist,
  // instead of silently cascading learner records away.
  if (program._count.registrations > 0) {
    return fail(
      `Cannot delete: ${program._count.registrations} registration(s) are linked to this program. Cancel the program instead.`,
      409
    );
  }

  await prisma.program.delete({ where: { id: program.id } });
  return ok({ deleted: true });
}
