import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { userCreateSchema } from "@/lib/validations";

const userSelect = {
  id: true,
  name: true,
  email: true,
  is_active: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
  // password is deliberately never selected
};

// GET /api/users - User Master list
export async function GET() {
  const { error } = await requirePermission("users.manage");
  if (error) return error;

  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "asc" },
  });
  return ok(users);
}

// POST /api/users - create user
export async function POST(req: Request) {
  const { error } = await requirePermission("users.manage");
  if (error) return error;

  const { data, error: vErr } = await parseBody(req, userCreateSchema);
  if (vErr) return vErr;

  const email = data!.email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return fail("A user with this email already exists.", 409);

  const role = await prisma.role.findUnique({ where: { id: data!.role_id } });
  if (!role) return fail("Selected role does not exist.", 422);

  const created = await prisma.user.create({
    data: {
      name: data!.name,
      email,
      password: await bcrypt.hash(data!.password, 10),
      role_id: data!.role_id,
      is_active: data!.is_active,
    },
    select: userSelect,
  });
  return ok(created, 201);
}
