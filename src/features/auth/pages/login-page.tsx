import { useState } from "react";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Printer, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { useLogin } from "../hooks/use-login";
import { safeReturnPath } from "../lib/auth-helpers";
import { loginSchema, type LoginFormValues } from "../schemas/login.schema";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const returnTo = safeReturnPath((location.state as { from?: unknown } | null)?.from);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  async function submit(values: LoginFormValues) {
    setServerError(null);
    try {
      await loginMutation.mutateAsync(values);
      navigate(returnTo, { replace: true });
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422) {
        const validation = error.response.data?.errors;
        if (validation?.username?.[0]) setError("username", { message: validation.username[0] });
        if (validation?.password?.[0]) setError("password", { message: validation.password[0] });
        if (validation?.username?.length || validation?.password?.length) return;
      }
      setServerError(getApiErrorMessage(error, "تعذّر تسجيل الدخول. حاول مرة أخرى."));
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[430px]">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-[#4d5ac6] ">
              <Printer className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">طَبعة</p>
              <p className="text-xs text-muted-foreground">إدارة الطباعة والإنتاج</p>
            </div>
          </div>

          <div className="mb-9 space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="size-3.5 text-[#147c58]" aria-hidden="true" />
              دخول آمن لمساحة العمل
            </span>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">مرحبًا بعودتك</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              أدخل بيانات حسابك للمتابعة وإدارة أعمال المطبعة.
            </p>
          </div>

          <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
            {serverError && (
              <div role="alert" className="rounded-xl border border-[#efbec6] bg-[#fff0f2] p-3.5 text-sm leading-6 text-[#c8384a]">
                {serverError}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-bold">اسم المستخدم</label>
              <input
                {...register("username")}
                id="username"
                type="text"
                dir="ltr"
                autoComplete="username"
                placeholder="username"
                aria-invalid={Boolean(errors.username)}
                aria-describedby={errors.username ? "username-error" : undefined}
                className="h-10 w-full rounded-md border border-input bg-card px-4 text-left text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
                disabled={loginMutation.isPending}
              />
              {errors.username && <p id="username-error" role="alert" className="text-xs text-destructive">{errors.username.message}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-bold">كلمة المرور</label>
              <div className="relative">
                <input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  dir="ltr"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className="h-10 w-full rounded-md border border-input bg-card px-12 text-left text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 end-2 flex w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>
              {errors.password && <p id="password-error" role="alert" className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              {loginMutation.isPending ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
              {!loginMutation.isPending && <ArrowLeft className="ms-auto size-4" />}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-6 text-muted-foreground">
            لو نسيت كلمة المرور، تواصل مع مسؤول النظام لإعادة تعيينها.
          </p>
          <p className="mt-12 text-center text-[11px] text-muted-foreground/75">
            طَبعة · مساحة عمل آمنة
          </p>
        </div>
      </div>

      <aside className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-gradient-to-bl from-[#eff1ff] via-[#f5f6ff] to-[#f8f9fe] p-10 text-foreground lg:flex xl:p-16" aria-label="عن طَبعة">
        <div className="pointer-events-none absolute -top-32 -left-20 size-96 rounded-full border border-[#d6ddfa]" aria-hidden="true" />
        <div className="pointer-events-none absolute top-16 -left-28 size-[30rem] rounded-full border border-[#d6ddfa]" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-2 text-xs font-semibold text-[#4d5ac6]">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          مساحة العمل
        </div>

        <div className="relative z-10 max-w-lg space-y-10">
          <div className="flex size-14 items-center justify-center rounded-lg border border-border bg-white/75">
            <Printer className="size-7 text-[#4d5ac6]" aria-hidden="true" />
          </div>
          <div className="space-y-5">
            <h2 className="text-[clamp(2rem,3.2vw,3.5rem)] leading-[1.45] font-extrabold">
              من أول طلب،<br />
              لحد آخر تسليم.
            </h2>
            <p className="max-w-md text-base leading-9 text-[#646e8d]">
              كل مرحلة واضحة، وكل عملية في مكانها. مساحة واحدة تخلّي فريقك مركز على الشغل المهم.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#d9def8] bg-white/65 p-4 backdrop-blur-sm sm:gap-3 sm:p-5">
            {["الطلبات", "الإنتاج", "التسليم"].map((step, index) => (
              <div key={step} className="flex flex-col items-center gap-3 rounded-xl bg-card/5 py-4">
                <span className="flex size-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-sm font-extrabold text-[#4d5ac6]">
                  {index + 1}
                </span>
                <span className="text-sm font-bold">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-[#8894ac]">نظام إدارة الطباعة · واجهة عربية سهلة الاستخدام</p>
      </aside>
    </main>
  );
}
