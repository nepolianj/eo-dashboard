import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { registrationSchema } from "@/lib/validations";

// GET /api/registrations - list with filtering & search (all roles)
export async function GET(req: Request) {
  const { error } = await requirePermission("registrations.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const regStatus = searchParams.get("registration_status");
  const payStatus = searchParams.get("payment_status");
  const programId = searchParams.get("program_id");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.RegistrationWhereInput = {};
  if (regStatus) where.registration_status = regStatus as never;
  if (payStatus) where.payment_status = payStatus as never;
  if (programId) where.program_id = Number(programId);
  if (q) {
    where.OR = [
      { learner_name: { contains: q } },
      { learner_email: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.created_at.lte = end;
    }
  }

  const registrations = await prisma.registration.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: {
      program: { select: { id: true, name: true, code: true } },
      payments: { orderBy: { paid_on: "desc" } },
    },
  });

  return ok(registrations);
}

// POST /api/registrations - create
export async function POST(req: Request) {
  const { error } = await requirePermission("registrations.create");
  if (error) return error;

  const { data, error: vErr } = await parseBody(req, registrationSchema);
  if (vErr) return vErr;

  const program = await prisma.program.findUnique({
    where: { id: data!.program_id },
  });
  if (!program) return fail("Selected program does not exist.", 422);
  if (program.status === "CANCELLED" || program.status === "COMPLETED") {
    return fail(`Cannot register a learner on a ${program.status.toLowerCase()} program.`, 422);
  }

  const duplicate = await prisma.registration.findFirst({
    where: {
      program_id: data!.program_id,
      learner_email: data!.learner_email,
      registration_status: { not: "CANCELLED" },
    },
  });
  if (duplicate) {
    return fail("This learner is already registered on this program.", 409);
  }

  const registration = await prisma.registration.create({
    data: { ...data!, payment_status: "PENDING" },
    include: { program: { select: { id: true, name: true, code: true } } },
  });

  return ok(registration, 201);
}
