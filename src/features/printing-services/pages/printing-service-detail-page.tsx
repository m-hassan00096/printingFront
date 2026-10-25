import { useState, type FormEvent } from "react";
import { ArrowRight, Calculator, Pencil, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useCustomerTypes } from "@/features/customers/hooks/use-customers";
import { ErrorState, IdentityStatus, LoadingState, fieldClass } from "@/features/identity/components/identity-ui";
import { usePrintingService, usePrintingServiceMutations } from "../hooks/use-printing-services";
import type { PricePreview, ServiceTier } from "../types/printing-service.types";

const sourceLabels: Record<NonNullable<PricePreview["source"]>, string> = {
  customerTypeQuantityTier: "شريحة كمية مخصصة لنوع العميل",
  customerTypeCatchAll: "شريحة عامة مخصصة لنوع العميل",
  genericQuantityTier: "شريحة كمية عامة",
  genericCatchAll: "الشريحة العامة",
  basePrice: "السعر الأساسي",
};
function QuantityRange({ tier }: { tier: ServiceTier }) {
  if (tier.minQuantity === null && tier.maxQuantity === null) return <>كل الكميات</>;
  return <>{tier.minQuantity === null ? "من البداية" : `من ${tier.minQuantity}`}
    {" — "}{tier.maxQuantity === null ? "بلا حد أقصى" : `إلى ${tier.maxQuantity}`}</>;
}
function Currency({ amount }: { amount: string }) {
  return <span className="tabular-nums" dir="ltr">{amount} ج.م</span>;
}

export function PrintingServiceDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isSafeInteger(id) && id > 0;
  const { data: session } = useCurrentUser();
  const permissions = session?.permissions ?? [];
  const mayEdit = permissions.includes("printing_services.update");
  const mayPreview = permissions.includes("printing_services.price_preview.view");
  const service = usePrintingService(valid ? id : 0);
  const types = useCustomerTypes(true);
  const mutations = usePrintingServiceMutations();
  const [customerTypeId, setCustomerTypeId] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<PricePreview | null>(null);

  function typeName(typeId: number | null): string {
    if (typeId === null) return "كل أنواع العملاء";
    return types.data?.find((type) => type.value === typeId)?.label ?? `نوع عميل #${typeId}`;
  }
  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreviewError(null);
    setResult(null);
    const qty = Number(quantity);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      setPreviewError("اكتب كمية صحيحة أكبر من صفر.");
      return;
    }
    try {
      const value = await mutations.preview.mutateAsync({
        serviceId: id,
        customerTypeId: customerTypeId ? Number(customerTypeId) : null,
        quantity: qty,
      });
      setResult(value);
    } catch (error: unknown) {
      setPreviewError(getApiErrorMessage(error, "تعذّر معاينة السعر. راجع المدخلات وحالة الخدمة."));
    }
  }

  if (!valid) return <p role="alert">معرّف الخدمة غير صحيح.</p>;
  if (service.isPending) return <LoadingState />;
  if (service.isError) return <ErrorState error={service.error} retry={() => void service.refetch()} />;

  const item = service.data;
  return <div className="space-y-6">
    <Button asChild variant="ghost"><Link to="/printing-services"><ArrowRight /> العودة لخدمات الطباعة</Link></Button>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">إدارة الطباعة / خدمات الطباعة</p>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Printer className="size-6 text-primary" /> {item.name}</h1>
        <IdentityStatus status={item.status} label={item.status === 1 ? "نشط" : "غير نشط"} />
      </div>
      {mayEdit && <Button asChild><Link to={`/printing-services/${item.id}/edit`}><Pencil /> تعديل الخدمة والأسعار</Link></Button>}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-muted-foreground">السعر الأساسي للوحدة</p>
        <p className="mt-4 text-2xl font-bold">{item.basePrice === null ? "غير محدد — سعر يدوي عند الحاجة" : <Currency amount={item.basePrice} />}</p>
      </div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-muted-foreground">شرائح الأسعار</p>
        <p className="mt-4 text-2xl font-bold tabular-nums">{item.priceTiers?.length ?? 0}</p>
      </div>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="border-b p-5"><h2 className="text-lg font-bold">شرائح الأسعار</h2>
        <p className="mt-1 text-xs text-muted-foreground">شرائح عامة أو مخصصة حسب نوع العميل ونطاق الكمية.</p>
      </header>
      {!item.priceTiers?.length
        ? <p className="p-8 text-center text-sm text-muted-foreground">لا توجد شرائح أسعار لهذه الخدمة.</p>
        : <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-right text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
            {["نوع العميل", "نطاق الكمية", "سعر الوحدة"].map((name) =>
              <th key={name} scope="col" className="px-5 py-3 font-bold">{name}</th>)}
          </tr></thead>
          <tbody className="divide-y">{item.priceTiers.map((tier) => <tr key={tier.priceTierId}>
            <td className="px-5 py-4">{typeName(tier.customerTypeId)}</td>
            <td className="px-5 py-4"><QuantityRange tier={tier} /></td>
            <td className="px-5 py-4 font-semibold"><Currency amount={tier.price} /></td>
          </tr>)}</tbody>
        </table></div>}
    </section>
    {mayPreview && <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2"><Calculator className="size-5 text-primary" />
        <h2 className="text-lg font-bold">معاينة السعر المقترح</h2></div>
      {item.status !== 1 ? <p className="text-sm text-muted-foreground">الخدمة غير نشطة، ولا يمكن معاينة سعرها.</p> :
      <form onSubmit={(event) => void preview(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold">نوع العميل
            <select aria-label="نوع عميل المعاينة" className={fieldClass + " mt-2"} value={customerTypeId}
              onChange={(event) => { setCustomerTypeId(event.target.value); setResult(null); }}>
              <option value="">سعر عام — بدون نوع عميل</option>
              {types.data?.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">الكمية
            <input aria-label="كمية المعاينة" type="number" min="1" className={fieldClass + " mt-2"} value={quantity}
              onChange={(event) => { setQuantity(event.target.value); setResult(null); }} />
          </label>
          <div className="flex items-end"><Button type="submit" disabled={mutations.preview.isPending}>حساب السعر المقترح</Button></div>
        </div>
        {types.isError && <p className="text-xs text-destructive">تعذّر تحميل خيارات أنواع العملاء. يمكن معاينة السعر العام.</p>}
        {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
        {result && <div aria-label="نتيجة معاينة السعر" className="rounded-xl border bg-muted/40 p-4">
          {result.requiresManualTotal
            ? <p className="text-sm font-bold">لا يوجد سعر محدد لهذه الحالة؛ يجب إدخال إجمالي السعر يدويًا عند إنشاء الأوردر.</p>
            : <div className="grid gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-muted-foreground">مصدر السعر</p><p className="mt-1 font-bold">{result.source ? sourceLabels[result.source] : "غير محدد"}</p></div>
              <div><p className="text-xs text-muted-foreground">سعر الوحدة</p><p className="mt-1 font-bold">{result.suggestedUnitPrice && <Currency amount={result.suggestedUnitPrice} />}</p></div>
              <div><p className="text-xs text-muted-foreground">الإجمالي المقترح</p><p className="mt-1 text-xl font-extrabold">{result.suggestedTotal && <Currency amount={result.suggestedTotal} />}</p></div>
            </div>}
        </div>}
      </form>}
    </section>}
  </div>;
}
