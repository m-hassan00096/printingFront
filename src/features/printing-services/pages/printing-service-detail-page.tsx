import { ArrowRight, Layers3, Pencil, Printer, Tag } from "lucide-react";
import { uiMessages } from "@/shared/translations/ar/ui";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useCustomerTypes } from "@/features/customers/hooks/use-customers";
import { ErrorState, IdentityStatus, LoadingState } from "@/features/identity/components/identity-ui";
import { usePrintingService } from "../hooks/use-printing-services";
import { PricePreviewCalculator } from "../components/price-preview-calculator";
import type { ServiceTier } from "../types/printing-service.types";

function QuantityRange({ tier }: { tier: ServiceTier }) {
  if (tier.minQuantity === null && tier.maxQuantity === null) return <span className="inline-flex rounded-md border border-primary/15 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary">{uiMessages.printingServices.defaultTier}</span>;
  if (tier.minQuantity !== null && tier.maxQuantity !== null && tier.minQuantity === tier.maxQuantity)
    return <>الكمية {tier.minQuantity}</>;
  return <>
    {tier.minQuantity === null ? "من البداية" : `من ${tier.minQuantity}`}
    {" – "}
    {tier.maxQuantity === null ? "بدون حد أقصى" : `إلى ${tier.maxQuantity}`}
  </>;
}

function Currency({ amount }: { amount: string }) {
  return <span dir="ltr" className="inline-block tabular-nums">{amount} ج.م</span>;
}

export function PrintingServiceDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { data: session } = useCurrentUser();
  const mayEdit = session?.permissions.includes("printing_services.update") ?? false;
  const mayPreview = session?.permissions.includes("printing_services.price_preview.view") ?? false;
  const service = usePrintingService(valid ? id : 0);
  const types = useCustomerTypes(true);

  if (!valid) return <p role="alert">معرّف الخدمة غير صحيح.</p>;
  if (service.isPending) return <LoadingState />;
  if (service.isError) return <ErrorState error={service.error} retry={() => void service.refetch()} />;

  const item = service.data;
  const tiers = item.priceTiers ?? [];
  const copy = uiMessages.printingServices;
  function typeName(typeId: number | null): string {
    if (typeId === null) return "كل أنواع العملاء";
    return types.data?.find((type) => type.value === typeId)?.label ?? `نوع عميل #${typeId}`;
  }

  return <div className="space-y-5">
    <Button asChild variant="ghost" className="px-0"><Link to="/printing-services"><ArrowRight className="size-4" /> العودة لخدمات الطباعة</Link></Button>

    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">إدارة الطباعة / خدمات الطباعة</p>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Printer className="size-5 shrink-0 text-primary" /> <span dir="auto" className="min-w-0 break-words">{item.name}</span>
        </h1>
        <IdentityStatus status={item.status} label={item.status === 1 ? "نشط" : "غير نشط"} />
      </div>
      {mayEdit && <Button asChild>
        <Link to={`/printing-services/${item.id}/edit`}><Pencil className="size-4" /> تعديل الخدمة</Link>
      </Button>}
    </header>

    <div className="grid gap-3 sm:grid-cols-2" aria-label={copy.serviceSummary}>
      <div className="flex items-center gap-3 rounded-xl border bg-white px-4 py-4 shadow-[0_4px_18px_#29376b08]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Tag className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{copy.basePrice}</p>
          <p className="mt-1 text-base font-bold">{item.basePrice === null ? copy.manualPricing : <Currency amount={item.basePrice} />}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border bg-white px-4 py-4 shadow-[0_4px_18px_#29376b08]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Layers3 className="size-5" aria-hidden="true" /></span>
        <div>
          <p className="text-xs text-muted-foreground">{copy.tiersCount}</p>
          <p className="mt-1 text-base font-bold tabular-nums">{tiers.length.toLocaleString("ar-EG")}</p>
        </div>
      </div>
    </div>

    <section className="overflow-hidden rounded-lg border bg-card " aria-labelledby="service-pricing-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="service-pricing-title" className="text-lg font-bold">أسعار الخدمة</h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.tierPriorityHelp}</p>
        </div>

      </div>

      {tiers.length > 0 ? <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-right text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">نوع العميل</th>
              <th scope="col" className="px-5 py-3 font-semibold">الكمية</th>
              <th scope="col" className="px-5 py-3 font-semibold">سعر الوحدة</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tiers.map((tier) => <tr key={tier.priceTierId} className="hover:bg-muted/30">
              <td className="px-5 py-4 font-medium">{typeName(tier.customerTypeId)}</td>
              <td className="px-5 py-4"><QuantityRange tier={tier} /></td>
              <td className="px-5 py-4 font-bold"><Currency amount={tier.price} /></td>
            </tr>)}
          </tbody>
        </table>
      </div> : <p className="px-5 py-7 text-sm text-muted-foreground">
        {item.basePrice === null
          ? "لا توجد أسعار محددة. سيتم تحديد السعر يدويًا عند إنشاء الأوردر."
          : "لا توجد شرائح خاصة. يُستخدم السعر الأساسي عند عدم وجود شريحة مناسبة."}
      </p>}

      {tiers.length > 0 && <p className="border-t bg-[#fafbff] px-5 py-3 text-xs text-muted-foreground">
        {item.basePrice === null
          ? "إذا لم تنطبق أي شريحة على نوع العميل والكمية، يُحدد السعر يدويًا عند إنشاء الأوردر."
          : "إذا لم تنطبق أي شريحة، يُستخدم السعر الأساسي للخدمة."}
      </p>}
    </section>
    {mayPreview && <PricePreviewCalculator key={item.id} serviceId={item.id} active={item.status === 1} />}
  </div>;
}
