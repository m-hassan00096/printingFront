import { useEffect, useState } from "react";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowRight, LoaderCircle, Save, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useCreateUser, useRoles, useUpdateUser, useUser } from "../hooks/use-identity";
import { ErrorState, LoadingState, SectionHeader, fieldClass, fieldLabel } from "../components/identity-ui";
import { parseIdentityId, roleOptions } from "../lib/identity-helpers";
import { userFormSchema, type UserFormValues } from "../schemas/user.schema";
import type { UserPayload } from "../types/identity.types";

const defaultValues: UserFormValues = {
  name: "", username: "", phone: "", address: "", roleId: "", status: "1", password: "", passwordConfirmation: "",
};

export function UserFormPage() {
  const { id: raw } = useParams();
  const isNew = !raw;
  const id = parseIdentityId(raw);
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const canReadRoles = currentUser.data?.permissions.includes("identity.roles.view") ?? false;
  const user = useUser(isNew ? 0 : id);
  const roles = useRoles({ perPage: 100 }, canReadRoles);
  const create = useCreateUser();
  const update = useUpdateUser();
  const [avatar, setAvatar] = useState<File | undefined>();
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { register, handleSubmit, reset, setError, watch, formState: { errors } } = form;

  useEffect(() => {
    if (user.data && !isNew) {
      reset({
        name: user.data.name, username: user.data.username,
        phone: user.data.phone ?? "", address: user.data.address ?? "",
        roleId: String(user.data.role?.id ?? ""), status: String(user.data.status) as "0" | "1",
        password: "", passwordConfirmation: "",
      });
    }
  }, [user.data, isNew, reset]);

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setAvatarError(null);
    if (!file) { setAvatar(undefined); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("الصورة يجب أن تكون JPG أو PNG أو WebP.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("الحد الأقصى لحجم الصورة 5 ميجابايت.");
      event.currentTarget.value = "";
      return;
    }
    setAvatar(file);
  }

  async function submit(values: UserFormValues) {
    setGeneralError(null);
    if (isNew && !canReadRoles) {
      setGeneralError("إنشاء مستخدم يحتاج اختيار دور. ليس لديك صلاحية عرض الأدوار، تواصل مع المسؤول.");
      return;
    }
    if (isNew && !values.roleId) { setError("roleId", { message: "الدور مطلوب" }); return; }
    if (values.password || isNew) {
      if (values.password.length < 8) { setError("password", { message: "كلمة المرور يجب ألا تقل عن 8 أحرف" }); return; }
      if (values.password !== values.passwordConfirmation) {
        setError("passwordConfirmation", { message: "تأكيد كلمة المرور غير مطابق" }); return;
      }
    } else if (values.passwordConfirmation) {
      setError("passwordConfirmation", { message: "اكتب كلمة مرور جديدة أولًا" }); return;
    }
    if (avatarError) return;

    const payload: UserPayload = {
      name: values.name, username: values.username, phone: values.phone || null,
      address: values.address || null, status: !isNew && user.data?.role?.name === "admin" ? user.data.status : Number(values.status) as 0 | 1,
    };
    if (isNew || (canReadRoles && user.data?.role?.name !== "admin" && values.roleId && Number(values.roleId) !== user.data?.role?.id)) {
      payload.roleId = Number(values.roleId);
    }
    if (values.password) {
      payload.password = values.password;
      payload.passwordConfirmation = values.passwordConfirmation;
    }
    if (avatar) payload.avatar = avatar;

    try {
      if (isNew) {
        const result = await create.mutateAsync(payload);
        toast.success("تم إنشاء المستخدم بنجاح.");
        navigate(`/users/${result.id}`, { replace: true });
      } else {
        await update.mutateAsync({ id, payload });
        toast.success("تم حفظ التعديلات بنجاح.");
        navigate(`/users/${id}`, { replace: true });
      }
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422) {
        const serverFields = error.response.data?.errors ?? {};
        let handled = false;
        for (const field of ["name", "username", "phone", "address", "roleId", "status", "password", "passwordConfirmation"] as const) {
          if (serverFields[field]?.[0]) {
            setError(field, { message: serverFields[field][0] });
            handled = true;
          }
        }
        if (serverFields.avatar?.[0]) { setAvatarError(serverFields.avatar[0]); handled = true; }
        if (handled) return;
      }
      setGeneralError(getApiErrorMessage(error, "تعذّر حفظ بيانات المستخدم."));
    }
  }

  const busy = create.isPending || update.isPending;
  if (!isNew && !id) return <ErrorState error={null} retry={() => undefined} />;
  if (!isNew && user.isPending) return <LoadingState />;
  if (!isNew && user.isError) return <ErrorState error={user.error} retry={() => void user.refetch()} />;

  const activeRoles = roleOptions(roles.data?.roles ?? []);
  const existingRole = user.data?.role;
  const roleAvailable = activeRoles.some((role) => role.id === existingRole?.id);
  return <div className="mx-auto max-w-4xl space-y-6">
    <Button variant="ghost" asChild><Link to={isNew ? "/users" : `/users/${id}`}><ArrowRight className="size-4" /> رجوع</Link></Button>
    <SectionHeader title={isNew ? "إضافة مستخدم" : "تعديل المستخدم"} detail="أدخل البيانات الأساسية وصلاحية الوصول المطلوبة فقط." />
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      {generalError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{generalError}</div>}
      <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="border-b pb-4"><h3 className="text-base font-extrabold">البيانات الأساسية</h3><p className="mt-1 text-xs text-muted-foreground">الاسم ومعلومات التواصل داخل الفريق.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2"><span className={fieldLabel}>الاسم الكامل <span className="text-destructive">*</span></span>
            <input className={fieldClass} {...register("name")} disabled={busy} aria-invalid={!!errors.name} />
            {errors.name && <span role="alert" className="text-xs text-destructive">{errors.name.message}</span>}
          </label>
          <label className="space-y-2"><span className={fieldLabel}>اسم الدخول <span className="text-destructive">*</span></span>
            <input dir="ltr" autoComplete="off" className={fieldClass} {...register("username")} disabled={busy} aria-invalid={!!errors.username} />
            {errors.username && <span role="alert" className="text-xs text-destructive">{errors.username.message}</span>}
          </label>
          <label className="space-y-2"><span className={fieldLabel}>رقم الهاتف</span>
            <input dir="ltr" inputMode="tel" className={fieldClass} {...register("phone")} disabled={busy} />
            {errors.phone && <span role="alert" className="text-xs text-destructive">{errors.phone.message}</span>}
          </label>
          <label className="space-y-2"><span className={fieldLabel}>العنوان</span>
            <input className={fieldClass} {...register("address")} disabled={busy} />
            {errors.address && <span role="alert" className="text-xs text-destructive">{errors.address.message}</span>}
          </label>
          <label className="space-y-2 sm:col-span-2"><span className={fieldLabel}>الصورة الشخصية (اختيارية)</span>
            <span className="flex flex-wrap items-center gap-4">
              {user.data?.avatar ? <img src={user.data.avatar} alt="" className="size-12 rounded-xl object-cover" /> : <UserRound className="size-9 text-muted-foreground" />}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} disabled={busy} className="block max-w-full text-xs file:me-3 file:rounded-lg file:border file:bg-card file:px-3 file:py-2 file:font-bold" />
            </span>
            <span className="block text-xs text-muted-foreground">JPG / PNG / WebP، بحد أقصى 5 ميجابايت.</span>
            {avatarError && <span role="alert" className="text-xs text-destructive">{avatarError}</span>}
          </label>
        </div>
      </section>
      <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="border-b pb-4"><h3 className="text-base font-extrabold">الوصول للنظام</h3><p className="mt-1 text-xs text-muted-foreground">الدور يحدد الصلاحيات؛ تحقق من أنه مناسب قبل الحفظ.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2"><span className={fieldLabel}>الدور الوظيفي {isNew && "*"}</span>
            <select className={fieldClass} {...register("roleId")} disabled={busy || !canReadRoles || user.data?.role?.name === "admin"}>
              <option value="">اختر الدور</option>
              {!roleAvailable && existingRole && <option value={existingRole.id}>{existingRole.alias} (الدور الحالي)</option>}
              {activeRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {!canReadRoles && <span className="block text-xs text-amber-800">عرض الأدوار يتطلب صلاحية identity.roles.view.</span>}
            {errors.roleId && <span role="alert" className="text-xs text-destructive">{errors.roleId.message}</span>}
          </label>
          <label className="space-y-2"><span className={fieldLabel}>الحالة</span>
            <select className={fieldClass} {...register("status")} disabled={busy || user.data?.role?.name === "admin"}><option value="1">نشط</option><option value="0">غير نشط</option></select>
          </label>
        </div>
        {user.data?.role?.name === "admin" && <p className="text-xs leading-6 text-amber-800">تغيير حالة ودور حساب Admin غير متاح من هذه الواجهة لحين التأكد من حماية الباك.</p>}
        {roles.isError && canReadRoles && <p role="alert" className="text-sm text-destructive">تعذّر تحميل الأدوار. أعد المحاولة قبل اختيار دور.</p>}
      </section>
      <section className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="border-b pb-4"><h3 className="text-base font-extrabold">{isNew ? "بيانات الدخول" : "تغيير كلمة المرور"}</h3><p className="mt-1 text-xs text-muted-foreground">{isNew ? "كلمة مرور لا تقل عن 8 أحرف." : "اترك الحقلين فارغين للاحتفاظ بكلمة المرور الحالية."}</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2"><span className={fieldLabel}>كلمة المرور {isNew && "*"}</span>
            <input type="password" autoComplete="new-password" className={fieldClass} {...register("password")} disabled={busy} />
            {errors.password && <span role="alert" className="text-xs text-destructive">{errors.password.message}</span>}
          </label>
          <label className="space-y-2"><span className={fieldLabel}>تأكيد كلمة المرور {isNew && "*"}</span>
            <input type="password" autoComplete="new-password" className={fieldClass} {...register("passwordConfirmation")} disabled={busy} />
            {errors.passwordConfirmation && <span role="alert" className="text-xs text-destructive">{errors.passwordConfirmation.message}</span>}
          </label>
        </div>
        {!isNew && watch("password") && <p className="text-xs text-amber-800">سيتم تغيير كلمة مرور الحساب عند الحفظ.</p>}
      </section>
      <div className="flex flex-wrap justify-end gap-3 pb-6">
        <Button variant="outline" asChild><Link to="/users">إلغاء</Link></Button>
        <Button type="submit" disabled={busy || (isNew && (!canReadRoles || roles.isPending || roles.isError))}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{isNew ? "إنشاء المستخدم" : "حفظ التعديلات"}</Button>
      </div>
    </form>
  </div>;
}
