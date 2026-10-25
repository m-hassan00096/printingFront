import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "اسم المستخدم مطلوب").max(255, "اسم المستخدم طويل جدًا"),
  password: z.string().min(1, "كلمة المرور مطلوبة").max(255, "كلمة المرور طويلة جدًا"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
