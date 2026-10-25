import { z } from "zod";

export const userFormSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(255, "الاسم طويل جدًا"),
  username: z.string().trim().min(1, "اسم الدخول مطلوب").max(255, "اسم الدخول طويل جدًا"),
  phone: z.string().trim().max(32, "رقم الهاتف طويل جدًا"),
  address: z.string().trim().max(1000, "العنوان طويل جدًا"),
  roleId: z.string(),
  status: z.enum(["0", "1"]),
  password: z.string(),
  passwordConfirmation: z.string(),
});
export type UserFormValues = z.infer<typeof userFormSchema>;
