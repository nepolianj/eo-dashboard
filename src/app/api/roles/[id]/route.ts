import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { roleSchema } from "@/lib/validations";

type Params = { params: { id: string } };

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
};

// PUT /api/roles/:id - update name/description/permission set
export async function PUT(req: Request, { params }: Params) {
  const { error } = await requirePermission("roles.manage");
  if (error) return error;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Role not found.", 404);

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return fail("Role not found.", 404);

  const { data, error: vErr } = await parseBody(req, roleSchema);
  if (vErr) return vErr;

  if (role.is_system && data!.name !== role.name)
    return fail("System roles cannot be renamed.", 422);

  const duplicate = await prisma.role.findFirst({
    where: { name: data!.name, id: { not: id } },
  });
  if (duplicate) return fail("Another role already uses this name.", 409);

  const validCount = await prisma.permission.count({
    where: { id: { in: data!.permission_ids } },
  });
  if (validCount !== data!.permission_ids.length)
    return fail("One or more selected permissions do not exist.", 422);

  // Replace the permission set atomically.
  const [updated] = await prisma.$transaction([
    prisma.role.update({
      where: { id },
      data: { name: data!.name, description: data!.description || null },
    }),
    prisma.rolePermission.deleteMany({ where: { role_id: id } }),
    prisma.rolePermission.createMany({
      data: data!.permission_ids.map((pid) => ({ role_id: id, permission_id: pid })),
    }),
  ]);

  const fresh = await prisma.role.findUnique({ where: { id }, include: roleInclude });
  return ok(fresh ?? updated);
}

// DELETE /api/roles/:id - only custom roles with no users
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requirePermission("roles.manage");
  if (error) return error;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Role not found.", 404);

  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) return fail("Role not found.", 404);
  if (role.is_system) return fail("System roles cannot be deleted.", 422);
  if (role._count.users > 0)
    return fail(
      `Cannot delete: ${role._count.users} user(s) currently have this role. Reassign them first.`,
      409
    );

  await prisma.role.delete({ where: { id } });
  return ok({ deleted: true });
}
