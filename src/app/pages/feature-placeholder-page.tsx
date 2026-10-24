import { CheckCircle2, CircleDot } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export type FeatureKey =
  | "orders"
  | "production"
  | "deliveries"
  | "customers"
  | "collections"
  | "finance"
  | "settings";

type FeatureBrief = {
  title: string;
  description: string;
  principles: string[];
};

const featureBriefs: Record<FeatureKey, FeatureBrief> = {
  orders: {
    title: "الطلبات",
    description: "ستجمع الشاشة بيانات العميل وبنود الطباعة والمواعيد والمبالغ في تدفق واضح، مع فصل إجراءات الطلب عن الحركات المالية.",
    principles: [
      "العميل المسجل هو نقطة البداية لإنشاء الطلب.",
      "حالة الطلب وموعد التسليم يظهران بوضوح في القائمة.",
      "البحث والفلاتر لا يزاحمان الإجراء الأساسي.",
    ],
  },
  production: {
    title: "الإنتاج",
    description: "ستعرض كل مرحلة ما يحتاجه الفريق الآن، وتُظهر البنود داخل مجموعات الطلبات من غير تكرار معلومات غير ضرورية.",
    principles: [
      "مراحل العمل واضحة ويمكن تمييزها نصيًا.",
      "التأخير لا يعتمد على اللون وحده.",
      "الإجراء التالي لكل بند ظاهر ومفهوم.",
    ],
  },
  deliveries: {
    title: "التسليمات",
    description: "ستفصل بين الطلبات الجاهزة للتسليم وسجل التسليم الفعلي، مع بحث سريع وتأكيد واضح للمبالغ قبل الإتمام.",
    principles: [
      "تظهر قيمة المدفوع والمتبقي قبل تأكيد التسليم.",
      "لا يتم التسليم النهائي قبل جاهزية جميع البنود.",
      "يُحفظ سجل واضح لمن سلّم ومتى.",
    ],
  },
  customers: {
    title: "العملاء",
    description: "ملف واحد لكل عميل يجمع بيانات التواصل والطلبات والحركات المالية المرتبطة به.",
    principles: [
      "البحث بالاسم أو رقم الهاتف أو رقم الطلب عند الحاجة.",
      "الرصيد يعكس الحركات المالية المسجلة.",
      "تفاصيل العميل لا تُحشر في جدول القائمة.",
    ],
  },
  collections: {
    title: "التحصيلات",
    description: "واجهة دقيقة لتسجيل ومراجعة الإيصالات، مع توضيح مصدر الحركة وحالتها ومنع التكرار.",
    principles: [
      "نوع المصدر ورقم الإيصال سهلان في البحث.",
      "لا يُسجل التحصيل مرتين لنفس العملية.",
      "تصحيح الحركة المالية يتم بحركة جديدة موثقة.",
    ],
  },
  finance: {
    title: "الحسابات",
    description: "عرض كشف حساب العميل والالتزامات والأرصدة الدائنة بطريقة سهلة المراجعة.",
    principles: [
      "المستحق والرصيد الدائن معروضان بشكل منفصل.",
      "اختيار استخدام الرصيد الدائن يتم بوضوح.",
      "الحركات المالية المرحلة لا تُحذف أو تُعدل مباشرة.",
    ],
  },
  settings: {
    title: "الإعدادات",
    description: "إدارة إعدادات التشغيل مثل أماكن الطباعة والحسابات البنكية والمحافظ الإلكترونية وأنواع العملاء.",
    principles: [
      "الإعدادات مجمعة حسب الغرض.",
      "حالة التفعيل ظاهرة بجانب كل عنصر.",
      "النماذج قصيرة ولا تعرض حقولًا غير لازمة.",
    ],
  },
};

type FeaturePlaceholderPageProps = {
  featureKey: FeatureKey;
};

export function FeaturePlaceholderPage({ featureKey }: FeaturePlaceholderPageProps) {
  const feature = featureBriefs[featureKey];

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-3">
        <Badge variant="outline">
          <CircleDot className="size-3.5" />
          قيد التصميم
        </Badge>
        <h2 className="text-3xl font-extrabold tracking-tight">{feature.title}</h2>
        <p className="text-sm leading-7 text-muted-foreground sm:text-base">{feature.description}</p>
      </div>

      <Card className="max-w-3xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">مبادئ تصميم هذه الشاشة</CardTitle>
          <CardDescription>هذه نقاط توجيهية للتنفيذ وليست بيانات تشغيل أو وظائف مكتملة.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {feature.principles.map((principle) => (
              <li key={principle} className="flex items-start gap-3 text-sm leading-6">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <span>{principle}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
