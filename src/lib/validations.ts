import { z } from "zod";

export const programSchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters").max(150),
    code: z
      .string()
      .min(2)
      .max(30)
      .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, digits and hyphens"),
    mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
    start_date: z.coerce.date(),
    end_date: z.coerce.date(),
    fee: z.coerce.number().min(0, "Fee cannot be negative").max(10000000),
    coordinator: z.string().min(2).max(100),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

export const registrationSchema = z.object({
  program_id: z.coerce.number().int().positive(),
  learner_name: z.string().min(2).max(100),
  learner_email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .regex(/^[0-9+\-\s]{8,15}$/, "Enter a valid phone number"),
  registration_status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
  amount: z.coerce.number().min(0).max(10000000),
});

export const paymentSchema = z.object({
  registration_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  reference_no: z.string().min(3).max(50),
  paid_on: z.coerce.date(),
});

export const userCreateSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role_id: z.coerce.number().int().positive(),
  is_active: z.coerce.boolean().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .optional()
    .or(z.literal("")), // empty = keep current password
  role_id: z.coerce.number().int().positive(),
  is_active: z.coerce.boolean(),
});

export const roleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional().or(z.literal("")),
  permission_ids: z.array(z.coerce.number().int().positive()).min(1, "Select at least one permission"),
});
