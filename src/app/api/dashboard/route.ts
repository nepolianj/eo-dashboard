import { prisma } from "@/lib/prisma";
import { ok, requirePermission } from "@/lib/api";

// GET /api/dashboard - aggregated operational metrics (all roles)
export async function GET() {
  const { error } = await requirePermission("dashboard.view");
  if (error) return error;

  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  const [
    activePrograms,
    totalRegistrations,
    pendingPaymentCount,
    pendingAmountAgg,
    upcomingPrograms,
    programBreakdown,
    statusCounts,
  ] = await Promise.all([
    prisma.program.count({ where: { status: "ACTIVE" } }),
    prisma.registration.count(),
    prisma.registration.count({
      where: { payment_status: { in: ["PENDING", "PARTIAL"] } },
    }),
    prisma.registration.aggregate({
      _sum: { amount: true },
      where: { payment_status: { in: ["PENDING", "PARTIAL"] } },
    }),
    prisma.program.findMany({
      where: { start_date: { gte: now, lte: in30Days }, status: { not: "CANCELLED" } },
      orderBy: { start_date: "asc" },
      select: {
        id: true, name: true, code: true, start_date: true, mode: true,
        _count: { select: { registrations: true } },
      },
    }),
    prisma.program.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        registrations: {
          select: { payment_status: true },
        },
      },
    }),
    prisma.registration.groupBy({
      by: ["registration_status"],
      _count: { _all: true },
    }),
  ]);

  type BreakdownRow = { id: number; name: string; code: string; registrations: { payment_status: string }[] };
  const breakdown = (programBreakdown as BreakdownRow[]).map((p) => ({
    program: p.code,
    name: p.name,
    registrations: p.registrations.length,
    paid: p.registrations.filter((r: { payment_status: string }) => r.payment_status === "PAID").length,
    pending: p.registrations.filter((r: { payment_status: string }) => r.payment_status !== "PAID").length,
  }));

  return ok({
    activePrograms,
    totalRegistrations,
    pendingPayments: {
      count: pendingPaymentCount,
      amount: pendingAmountAgg._sum.amount ?? 0,
    },
    upcomingPrograms,
    breakdown,
    statusCounts: (statusCounts as { registration_status: string; _count: { _all: number } }[]).map((s) => ({
      status: s.registration_status,
      count: s._count._all,
    })),
  });
}
