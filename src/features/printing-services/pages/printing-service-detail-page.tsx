import { ArrowRight, Pencil, Printer } from "lucide-react";
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
    if (typeId === null) return copy.genericTiers;
    return types.data?.find((type) => type.value === typeId)?.label ?? `نوع عميل #${typeId}`;
  }

  return <div className="space-y-4">
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

    <section className="overflow-hidden rounded-xl border bg-card shadow-[0_4px_18px_#29376b08]" aria-labelledby="service-pricing-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <div>
          <h2 id="service-pricing-title" className="text-lg font-bold">أسعار الخدمة</h2>
          <p className="mt-1 text-xs text-muted-foreground">{copy.tierSimpleHelp}</p>
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
        {copy.noTiers}
      </p>}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-[#f8f9ff] px-5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{copy.basePrice}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{copy.basePriceDescription}</p>
        </div>
        <strong className="shrink-0 text-base font-bold text-foreground"><Currency amount={item.basePrice ?? "0.00"} /></strong>
      </div>
    </section>
    {mayPreview && <PricePreviewCalculator key={item.id} serviceId={item.id} active={item.status === 1} />}
  </div>;
}
