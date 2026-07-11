import { prisma } from "@/lib/prisma";
import { ok, requirePermission } from "@/lib/api";

// GET /api/permissions - the catalog, for the Role Master permission matrix
export async function GET() {
  const { error } = await requirePermission("roles.manage");
  if (error) return error;

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { id: "asc" }],
  });
  return ok(permissions);
}
