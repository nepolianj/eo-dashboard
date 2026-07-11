import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { registrationSchema } from "@/lib/validations";

type Params = { params: { id: string } };

async function findRegistration(id: string) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) return null;
  return prisma.registration.findUnique({
    where: { id: numId },
    include: {
      program: { select: { id: true, name: true, code: true } },
      payments: { orderBy: { paid_on: "desc" } },
    },
  });
}

// GET /api/registrations/:id
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requirePermission("registrations.view");
  if (error) return error;

  const registration = await findRegistration(params.id);
  if (!registration) return fail("Registration not found.", 404);
  return ok(registration);
}

// PUT /api/registrations/:id
export async function PUT(req: Request, { params }: Params) {
  const { error } = await requirePermission("registrations.edit");
  if (error) return error;

  const registration = await findRegistration(params.id);
  if (!registration) return fail("Registration not found.", 404);

  const { data, error: vErr } = await parseBody(req, registrationSchema);
  if (vErr) return vErr;

  const program = await prisma.program.findUnique({
    where: { id: data!.program_id },
  });
  if (!program) return fail("Selected program does not exist.", 422);

  // Re-derive payment_status against the (possibly changed) amount, so a fee
  // edit can never leave a stale PAID/PARTIAL flag. REFUNDED is left as-is.
  let payment_status = registration.payment_status;
  if (payment_status !== "REFUNDED") {
    const paid = registration.payments
      .filter((p: { status: string }) => p.status === "SUCCESS")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);
    payment_status =
      paid >= data!.amount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
  }

  const updated = await prisma.registration.update({
    where: { id: registration.id },
    data: { ...data!, payment_status },
    include: {
      program: { select: { id: true, name: true, code: true } },
      payments: true,
    },
  });
  return ok(updated);
}

// DELETE /api/registrations/:id
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requirePermission("registrations.delete");
  if (error) return error;

  const registration = await findRegistration(params.id);
  if (!registration) return fail("Registration not found.", 404);

  if (registration.payments.some((p: { status: string }) => p.status === "SUCCESS")) {
    return fail(
      "Cannot delete: successful payments exist for this registration. Cancel it instead.",
      409
    );
  }

  await prisma.registration.delete({ where: { id: registration.id } });
  return ok({ deleted: true });
}
