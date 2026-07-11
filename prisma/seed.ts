import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password@123", 10);

  // ---- Users (one per role) ----
  const admin = await prisma.user.upsert({
    where: { email: "admin@eo.iitb.ac.in" },
    update: {},
    create: {
      name: "Asha Admin",
      email: "admin@eo.iitb.ac.in",
      password: passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@eo.iitb.ac.in" },
    update: {},
    create: {
      name: "Prakash Manager",
      email: "manager@eo.iitb.ac.in",
      password: passwordHash,
      role: "PROGRAM_MANAGER",
    },
  });

  await prisma.user.upsert({
    where: { email: "ops@eo.iitb.ac.in" },
    update: {},
    create: {
      name: "Omkar Ops",
      email: "ops@eo.iitb.ac.in",
      password: passwordHash,
      role: "OPERATIONS",
    },
  });

  // ---- Programs ----
  const programsData: Prisma.ProgramCreateInput[] = [
    {
      name: "Advanced Data Science Certification",
      code: "EO-ADS-2026",
      mode: "ONLINE",
      start_date: daysFromNow(15),
      end_date: daysFromNow(105),
      fee: new Prisma.Decimal(45000),
      coordinator: "Dr. R. Iyer",
      status: "ACTIVE",
      createdBy: { connect: { id: admin.id } },
    },
    {
      name: "Executive Program in AI for Managers",
      code: "EO-AIM-2026",
      mode: "HYBRID",
      start_date: daysFromNow(25),
      end_date: daysFromNow(115),
      fee: new Prisma.Decimal(65000),
      coordinator: "Prof. S. Kulkarni",
      status: "ACTIVE",
      createdBy: { connect: { id: admin.id } },
    },
    {
      name: "Embedded Systems Bootcamp",
      code: "EO-ESB-2026",
      mode: "OFFLINE",
      start_date: daysFromNow(-30),
      end_date: daysFromNow(30),
      fee: new Prisma.Decimal(38000),
      coordinator: "Dr. M. Deshpande",
      status: "ACTIVE",
      createdBy: { connect: { id: admin.id } },
    },
    {
      name: "Cloud & DevOps Foundation",
      code: "EO-CDF-2026",
      mode: "ONLINE",
      start_date: daysFromNow(60),
      end_date: daysFromNow(150),
      fee: new Prisma.Decimal(30000),
      coordinator: "Prof. A. Nair",
      status: "DRAFT",
      createdBy: { connect: { id: admin.id } },
    },
    {
      name: "VLSI Design Winter School",
      code: "EO-VLSI-2025",
      mode: "OFFLINE",
      start_date: daysFromNow(-120),
      end_date: daysFromNow(-60),
      fee: new Prisma.Decimal(52000),
      coordinator: "Dr. K. Rao",
      status: "COMPLETED",
      createdBy: { connect: { id: admin.id } },
    },
  ];

  const programs = [];
  for (const p of programsData) {
    programs.push(
      await prisma.program.upsert({
        where: { code: p.code },
        update: {},
        create: p,
      })
    );
  }

  // ---- Registrations + payments ----
  const learners = [
    { name: "Rohit Sharma", email: "rohit.s@example.com", phone: "9820011001" },
    { name: "Priya Menon", email: "priya.m@example.com", phone: "9820011002" },
    { name: "Aditya Kulkarni", email: "aditya.k@example.com", phone: "9820011003" },
    { name: "Sneha Patil", email: "sneha.p@example.com", phone: "9820011004" },
    { name: "Farhan Sheikh", email: "farhan.s@example.com", phone: "9820011005" },
    { name: "Divya Nair", email: "divya.n@example.com", phone: "9820011006" },
    { name: "Karthik Rao", email: "karthik.r@example.com", phone: "9820011007" },
    { name: "Neha Gupta", email: "neha.g@example.com", phone: "9820011008" },
    { name: "Vivek Joshi", email: "vivek.j@example.com", phone: "9820011009" },
    { name: "Ananya Das", email: "ananya.d@example.com", phone: "9820011010" },
  ];

  const existing = await prisma.registration.count();
  if (existing === 0) {
    let i = 0;
    for (const learner of learners) {
      const program = programs[i % 3]; // spread across the 3 active programs
      const fee = program.fee;
      // Vary payment situations: fully paid, partial, pending
      const situation = i % 3;

      const reg = await prisma.registration.create({
        data: {
          program_id: program.id,
          learner_name: learner.name,
          learner_email: learner.email,
          phone: learner.phone,
          amount: fee,
          registration_status: situation === 2 ? "PENDING" : "CONFIRMED",
          payment_status:
            situation === 0 ? "PAID" : situation === 1 ? "PARTIAL" : "PENDING",
        },
      });

      if (situation === 0) {
        await prisma.payment.create({
          data: {
            registration_id: reg.id,
            amount: fee,
            reference_no: `TXN-${1000 + i}`,
            paid_on: daysFromNow(-(i + 2)),
            status: "SUCCESS",
          },
        });
      } else if (situation === 1) {
        await prisma.payment.create({
          data: {
            registration_id: reg.id,
            amount: fee.div(2),
            reference_no: `TXN-${1000 + i}`,
            paid_on: daysFromNow(-(i + 2)),
            status: "SUCCESS",
          },
        });
      }
      i++;
    }
  }

  console.log("Seed complete.");
  console.log("Login with (password for all: Password@123):");
  console.log("  admin@eo.iitb.ac.in    -> ADMIN");
  console.log("  manager@eo.iitb.ac.in  -> PROGRAM_MANAGER");
  console.log("  ops@eo.iitb.ac.in      -> OPERATIONS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
