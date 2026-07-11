import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail, requirePermission, parseBody } from "@/lib/api";
import { paymentSchema } from "@/lib/validations";

// POST /api/payments - record a payment and derive the registration's
// payment_status on the backend (PENDING / PARTIAL / PAID).
export async function POST(req: Request) {
  const { error } = await requirePermission("payments.record");
  if (error) return error;

  const { data, error: vErr } = await parseBody(req, paymentSchema);
  if (vErr) return vErr;

  const registration = await prisma.registration.findUnique({
    where: { id: data!.registration_id },
    include: { payments: true },
  });
  if (!registration) return fail("Registration not found.", 404);
  if (registration.registration_status === "CANCELLED") {
    return fail("Cannot record a payment against a cancelled registration.", 422);
  }

  const refExists = await prisma.payment.findUnique({
    where: { reference_no: data!.reference_no },
  });
  if (refExists) return fail("This payment reference number is already recorded.", 409);

  const successfulPayments: { amount: Prisma.Decimal }[] =
    registration.payments.filter((p: { status: string }) => p.status === "SUCCESS");
  const alreadyPaid = successfulPayments.reduce(
    (sum, p) => sum.add(p.amount),
    new Prisma.Decimal(0)
  );
  const due = new Prisma.Decimal(registration.amount).sub(alreadyPaid);

  if (new Prisma.Decimal(data!.amount).gt(due)) {
    return fail(`Payment exceeds the outstanding amount (₹${due.toFixed(2)} due).`, 422);
  }

  // Payment insert + derived status update succeed or fail together.
  const [payment] = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.create({
      data: {
        registration_id: data!.registration_id,
        amount: data!.amount,
        reference_no: data!.reference_no,
        paid_on: data!.paid_on,
        status: "SUCCESS",
      },
    });

    const totalPaid = alreadyPaid.add(data!.amount);
    const newStatus = totalPaid.gte(registration.amount)
      ? "PAID"
      : totalPaid.gt(0)
        ? "PARTIAL"
        : "PENDING";

    const updated = await tx.registration.update({
      where: { id: registration.id },
      data: { payment_status: newStatus },
    });

    return [payment, updated];
  });

  return ok(payment, 201);
}

// GET /api/payments - Payment Module: every payment initiated, with filters
// and summary stats (how many initiated, amount collected, by status).
export async function GET(req: Request) {
  const { error } = await requirePermission("payments.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.PaymentWhereInput = {};
  if (status) where.status = status as never;
  if (q) {
    where.OR = [
      { reference_no: { contains: q } },
      { registration: { learner_name: { contains: q } } },
      { registration: { learner_email: { contains: q } } },
    ];
  }
  if (from || to) {
    where.paid_on = {};
    if (from) where.paid_on.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.paid_on.lte = end;
    }
  }

  const [payments, totalInitiated, sumSuccess, byStatus] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paid_on: "desc" },
      include: {
        registration: {
          select: {
            id: true,
            learner_name: true,
            learner_email: true,
            program: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
    prisma.payment.count(),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "SUCCESS" } }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
  ]);

  return ok({
    payments,
    summary: {
      totalInitiated,
      totalCollected: sumSuccess._sum.amount ?? 0,
      byStatus: (byStatus as { status: string; _count: { _all: number }; _sum: { amount: unknown } }[]).map(
        (s) => ({ status: s.status, count: s._count._all, amount: s._sum.amount ?? 0 })
      ),
    },
  });
}
