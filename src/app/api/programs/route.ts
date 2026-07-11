import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { programSchema } from "@/lib/validations";

// GET /api/programs - list with filtering & search (all roles)
export async function GET(req: Request) {
  const { error } = await requirePermission("programs.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const mode = searchParams.get("mode");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.ProgramWhereInput = {};
  if (status) where.status = status as Prisma.ProgramWhereInput["status"];
  if (mode) where.mode = mode as Prisma.ProgramWhereInput["mode"];
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
      { coordinator: { contains: q } },
    ];
  }
  if (from || to) {
    where.start_date = {};
    if (from) where.start_date.gte = new Date(from);
    if (to) where.start_date.lte = new Date(to);
  }

  const programs = await prisma.program.findMany({
    where,
    orderBy: { start_date: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { registrations: true } },
    },
  });

  return ok(programs);
}

// POST /api/programs - create (Admin, Program Manager)
export async function POST(req: Request) {
  const { user, error } = await requirePermission("programs.create");
  if (error) return error;

  const { data, error: vErr } = await parseBody(req, programSchema);
  if (vErr) return vErr;

  const exists = await prisma.program.findUnique({ where: { code: data!.code } });
  if (exists) return fail("A program with this code already exists.", 409);

  const program = await prisma.program.create({
    data: { ...data!, created_by: user!.id },
  });

  return ok(program, 201);
}
