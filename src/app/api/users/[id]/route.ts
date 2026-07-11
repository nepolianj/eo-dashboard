import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validations";

type Params = { params: { id: string } };

const userSelect = {
  id: true,
  name: true,
  email: true,
  is_active: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
};

// PUT /api/users/:id - update user (role, status, optional password reset)
export async function PUT(req: Request, { params }: Params) {
  const { user: actor, error } = await requirePermission("users.manage");
  if (error) return error;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("User not found.", 404);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return fail("User not found.", 404);

  const { data, error: vErr } = await parseBody(req, userUpdateSchema);
  if (vErr) return vErr;

  // Lock-out protection: you cannot deactivate or demote your own account.
  if (actor!.id === id) {
    if (!data!.is_active) return fail("You cannot deactivate your own account.", 422);
    if (data!.role_id !== target.role_id)
      return fail("You cannot change your own role.", 422);
  }

  const email = data!.email.toLowerCase().trim();
  const duplicate = await prisma.user.findFirst({ where: { email, id: { not: id } } });
  if (duplicate) return fail("Another user already uses this email.", 409);

  const role = await prisma.role.findUnique({ where: { id: data!.role_id } });
  if (!role) return fail("Selected role does not exist.", 422);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: data!.name,
      email,
      role_id: data!.role_id,
      is_active: data!.is_active,
      ...(data!.password ? { password: await bcrypt.hash(data!.password, 10) } : {}),
    },
    select: userSelect,
  });
  return ok(updated);
}
