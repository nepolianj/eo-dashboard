import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---- Permission catalog (grouped by module for the Role Master UI) ----
const PERMISSIONS: { key: string; label: string; module: string }[] = [
  { key: "dashboard.view", label: "View dashboard", module: "Dashboard" },
  { key: "programs.view", label: "View programs", module: "Programs" },
  { key: "programs.create", label: "Create programs", module: "Programs" },
  { key: "programs.edit", label: "Edit programs", module: "Programs" },
  { key: "programs.delete", label: "Delete programs", module: "Programs" },
  { key: "registrations.view", label: "View registrations", module: "Registrations" },
  { key: "registrations.create", label: "Create registrations", module: "Registrations" },
  { key: "registrations.edit", label: "Edit registrations", module: "Registrations" },
  { key: "registrations.delete", label: "Delete registrations", module: "Registrations" },
  { key: "payments.view", label: "View payments", module: "Payments" },
  { key: "payments.record", label: "Record payments", module: "Payments" },
  { key: "users.manage", label: "Manage users", module: "Administration" },
  { key: "roles.manage", label: "Manage roles & permissions", module: "Administration" },
];

// ---- System roles and their permission sets ----
const ROLES: { name: string; description: string; permissions: string[] }[] = [
  {
    name: "Administrator",
    description: "Full access to every module including user and role management",
    permissions: PERMISSIONS.map((p) => p.key),
  },
  {
    name: "Program Manager",
    description: "Manages programs, registrations and payments",
    permissions: [
      "dashboard.view",
      "programs.view", "programs.create", "programs.edit",
      "registrations.view", "registrations.create", "registrations.edit", "registrations.delete",
      "payments.view", "payments.record",
    ],
  },
  {
    name: "Operations",
    description: "Day-to-day registration handling and payment recording",
    permissions: [
      "dashboard.view",
      "programs.view",
      "registrations.view", "registrations.create", "registrations.edit",
      "payments.view", "payments.record",
    ],
  },
];

async function main() {
  // 1. Permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, module: p.module },
      create: p,
    });
  }
  const allPerms = await prisma.permission.findMany();
  const permId = (key: string) => {
    const found = allPerms.find((p: { key: string; id: number }) => p.key === key);
    if (!found) throw new Error(`Unknown permission key: ${key}`);
    return found.id;
  };

  // 2. Roles + role_permissions
  const roleIds: Record<string, number> = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, is_system: true },
      create: { name: r.name, description: r.description, is_system: true },
    });
    roleIds[r.name] = role.id;
    await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });
    await prisma.rolePermission.createMany({
      data: r.permissions.map((key) => ({ role_id: role.id, permission_id: permId(key) })),
    });
  }

  // 3. Users (one per system role)
  // const passwordHash = await bcrypt.hash("Password@123", 10);
  // const admin = await prisma.user.upsert({
  //   where: { email: "admin@eo.iitb.ac.in" },
  //   update: { role_id: roleIds["Administrator"] },
  //   create: { name: "Asha Admin", email: "admin@eo.iitb.ac.in", password: passwordHash, role_id: roleIds["Administrator"] },
  // });
  // await prisma.user.upsert({
  //   where: { email: "manager@eo.iitb.ac.in" },
  //   update: { role_id: roleIds["Program Manager"] },
  //   create: { name: "Prakash Manager", email: "manager@eo.iitb.ac.in", password: passwordHash, role_id: roleIds["Program Manager"] },
  // });
  // await prisma.user.upsert({
  //   where: { email: "ops@eo.iitb.ac.in" },
  //   update: { role_id: roleIds["Operations"] },
  //   create: { name: "Omkar Ops", email: "ops@eo.iitb.ac.in", password: passwordHash, role_id: roleIds["Operations"] },
  // });
  // 3. Users (one per system role, individual strong passwords)
  const USERS = [
    { name: "Asha Admin",      email: "admin@eo.iitb.ac.in",   role: "Administrator",   password: "Adm#EO26!vX9qLp2$" },
    { name: "Prakash Manager", email: "manager@eo.iitb.ac.in", role: "Program Manager", password: "Mgr#EO26!tR4wNs7@" },
    { name: "Omkar Ops",       email: "ops@eo.iitb.ac.in",     role: "Operations",      password: "Ops#EO26!kM8zHd3%" },
  ];

  let admin!: { id: number };
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { role_id: roleIds[u.role], password: hash },
      create: { name: u.name, email: u.email, password: hash, role_id: roleIds[u.role] },
    });
    if (u.role === "Administrator") admin = user;
  }

  // 4. Programs
  const programsData: Prisma.ProgramCreateInput[] = [
    { name: "Advanced Data Science Certification", code: "EO-ADS-2026", mode: "ONLINE", start_date: daysFromNow(15), end_date: daysFromNow(105), fee: new Prisma.Decimal(45000), coordinator: "Dr. R. Iyer", status: "ACTIVE", createdBy: { connect: { id: admin.id } } },
    { name: "Executive Program in AI for Managers", code: "EO-AIM-2026", mode: "HYBRID", start_date: daysFromNow(25), end_date: daysFromNow(115), fee: new Prisma.Decimal(65000), coordinator: "Prof. S. Kulkarni", status: "ACTIVE", createdBy: { connect: { id: admin.id } } },
    { name: "Embedded Systems Bootcamp", code: "EO-ESB-2026", mode: "OFFLINE", start_date: daysFromNow(-30), end_date: daysFromNow(30), fee: new Prisma.Decimal(38000), coordinator: "Dr. M. Deshpande", status: "ACTIVE", createdBy: { connect: { id: admin.id } } },
    { name: "Cloud & DevOps Foundation", code: "EO-CDF-2026", mode: "ONLINE", start_date: daysFromNow(60), end_date: daysFromNow(150), fee: new Prisma.Decimal(30000), coordinator: "Prof. A. Nair", status: "DRAFT", createdBy: { connect: { id: admin.id } } },
    { name: "VLSI Design Winter School", code: "EO-VLSI-2025", mode: "OFFLINE", start_date: daysFromNow(-120), end_date: daysFromNow(-60), fee: new Prisma.Decimal(52000), coordinator: "Dr. K. Rao", status: "COMPLETED", createdBy: { connect: { id: admin.id } } },
  ];

  const programs = [];
  for (const p of programsData) {
    programs.push(await prisma.program.upsert({ where: { code: p.code }, update: {}, create: p }));
  }

  // 5. Registrations + payments
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
      const program = programs[i % 3];
      const fee = program.fee;
      const situation = i % 3; // 0 paid, 1 partial, 2 pending

      const reg = await prisma.registration.create({
        data: {
          program_id: program.id,
          learner_name: learner.name,
          learner_email: learner.email,
          phone: learner.phone,
          amount: fee,
          registration_status: situation === 2 ? "PENDING" : "CONFIRMED",
          payment_status: situation === 0 ? "PAID" : situation === 1 ? "PARTIAL" : "PENDING",
        },
      });

      if (situation === 0) {
        await prisma.payment.create({
          data: { registration_id: reg.id, amount: fee, reference_no: `TXN-${1000 + i}`, paid_on: daysFromNow(-(i + 2)), status: "SUCCESS" },
        });
      } else if (situation === 1) {
        await prisma.payment.create({
          data: { registration_id: reg.id, amount: fee.div(2), reference_no: `TXN-${1000 + i}`, paid_on: daysFromNow(-(i + 2)), status: "SUCCESS" },
        });
      }
      i++;
    }
  }

  console.log("Seed complete.");
  console.log("Login with (password for all: Password@123):");
  console.log("  admin@eo.iitb.ac.in    -> Administrator");
  console.log("  manager@eo.iitb.ac.in  -> Program Manager");
  console.log("  ops@eo.iitb.ac.in      -> Operations");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
