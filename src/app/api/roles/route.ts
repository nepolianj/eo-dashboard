import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { roleSchema } from "@/lib/validations";

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
};

// GET /api/roles - Role Master list
// Also used (names only) by User Master's role dropdown, so it accepts
// either roles.manage or users.manage.
export async function GET() {
  const roleCheck = await requirePermission("roles.manage");
  if (roleCheck.error) {
    const userCheck = await requirePermission("users.manage");
    if (userCheck.error) return roleCheck.error;
    const basic = await prisma.role.findMany({
      select: { id: true, name: true, description: true, is_system: true },
      orderBy: { id: "asc" },
    });
    return ok(basic);
  }

  const roles = await prisma.role.findMany({
    include: roleInclude,
    orderBy: { id: "asc" },
  });
  return ok(roles);
}

// POST /api/roles - create custom role with permissions
export async function POST(req: Request) {
  const { error } = await requirePermission("roles.manage");
  if (error) return error;

  const { data, error: vErr } = await parseBody(req, roleSchema);
  if (vErr) return vErr;

  const exists = await prisma.role.findUnique({ where: { name: data!.name } });
  if (exists) return fail("A role with this name already exists.", 409);

  const validCount = await prisma.permission.count({
    where: { id: { in: data!.permission_ids } },
  });
  if (validCount !== data!.permission_ids.length)
    return fail("One or more selected permissions do not exist.", 422);

  const role = await prisma.role.create({
    data: {
      name: data!.name,
      description: data!.description || null,
      permissions: {
        create: data!.permission_ids.map((pid) => ({ permission_id: pid })),
      },
    },
    include: roleInclude,
  });
  return ok(role, 201);
}
