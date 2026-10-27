import {
  CheckCircle2,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

const principles = [
  {
    icon: Layers,
    title: "تنظيم حسب الميزة",
    description: "الطلبات والإنتاج والعملاء لكل منها نطاق واضح، من غير تكرار منطق العمل بين الشاشات.",
  },
  {
    icon: LayoutDashboard,
    title: "واجهة هادئة",
    description: "تسلسل بصري ثابت، إجراءات واضحة، ومعلومات تظهر وقت الحاجة بدل ازدحام الشاشة.",
  },
  {
    icon: ShieldCheck,
    title: "بيانات موثوقة",
    description: "فصل بيانات الخادم عن حالة الواجهة، مع تجهيز الاتصال لجلسات Sanctum وCSRF.",
  },
];

const foundations = [
  { title: "معمارية المشروع", detail: "React + TypeScript + Feature-based structure", status: "مجهزة" },
  { title: "نظام التصميم", detail: "RTL عربي، Cairo، ألوان ومسافات موحدة", status: "مجهز" },
  { title: "الاتصال بالـ API", detail: "Axios وتهيئة CSRF دون تخزين Bearer Token", status: "مهيأ للربط" },
];

export function FoundationPage() {
  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-lg border border-border bg-card ">
        <div className="absolute left-0 top-0 -z-10 size-64 rounded-full bg-accent/70 blur-3xl" aria-hidden="true" />
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:p-10">
          <div className="space-y-5">
            <Badge variant="secondary" className="px-3 py-1.5">
              <Sparkles className="size-3.5" />
              بداية منظمة
            </Badge>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
                كل طلب واضح، وكل خطوة في مكانها.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                نبني طَبعة كمساحة عمل يومية تساعد الفريق على متابعة الطلب من بدايته حتى التسليم والتحصيل، بواجهة عربية مريحة لا تشتت الانتباه.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Arabic-first</Badge>
              <Badge variant="outline">Feature-based</Badge>
              <Badge variant="outline">Sanctum-ready</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/90 p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">أساس المشروع</p>
                <p className="mt-1 text-xs text-muted-foreground">ما يتم تجهيزه قبل بناء الشاشات</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Workflow className="size-5" />
              </div>
            </div>
            <div className="space-y-4">
              {foundations.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#14815b]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <span className="text-[11px] font-bold text-accent-foreground">{item.status}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">المبادئ التي ستقود كل شاشة</h2>
          <p className="mt-1 text-sm text-muted-foreground">قرارات ثابتة تساعدنا نحافظ على الجودة مع توسع النظام.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {principles.map((principle) => {
            const Icon = principle.icon;
            return (
              <Card key={principle.title} className="rounded-lg">
                <CardHeader className="gap-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="size-5" strokeWidth={1.9} />
                  </div>
                  <CardTitle className="text-base">{principle.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-7">{principle.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-bold">الخطوة التالية</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            تثبيت مكونات الواجهة المشتركة، ثم تصميم شاشة الطلبات بناءً على سير العمل الفعلي.
          </p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 bg-card">لا توجد بيانات تشغيل تجريبية</Badge>
      </section>
    </div>
  );
}
