import { useState, type FormEvent } from "react";
import { Calculator, LoaderCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCustomerTypes } from "@/features/customers/hooks/use-customers";
import { fieldClass } from "@/features/identity/components/identity-ui";
import { usePrintingServiceMutations } from "../hooks/use-printing-services";
import type { PricePreview } from "../types/printing-service.types";

const sourceLabels: Record<NonNullable<PricePreview["source"]>, string> = {
  customerTypeQuantityTier: "شريحة كمية مخصصة لنوع العميل",
  customerTypeCatchAll: "شريحة عامة مخصصة لنوع العميل",
  genericQuantityTier: "شريحة كمية عامة",
  genericCatchAll: "الشريحة العامة",
  basePrice: "السعر الأساسي",
};

export function PricePreviewCalculator({ serviceId, active }: { serviceId: number; active: boolean }) {
  const [customerTypeId, setCustomerTypeId] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [result, setResult] = useState<PricePreview | null>(null);
  const types = useCustomerTypes(active);
  const { preview } = usePrintingServiceMutations();

  function invalidateResult() {
    setResult(null);
    setPreviewError(null);
    preview.reset();
  }

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview.isPending) return;
    setResult(null);
    setPreviewError(null);
    const parsed = Number(quantity);
    if (!/^\d+$/.test(quantity.trim()) || !Number.isSafeInteger(parsed) || parsed < 1) {
      setPreviewError("أدخل كمية صحيحة أكبر من صفر.");
      return;
    }
    try {
      const answer = await preview.mutateAsync({
        serviceId, customerTypeId: customerTypeId ? Number(customerTypeId) : null, quantity: parsed,
      });
      setResult(answer);
    } catch (error: unknown) {
      setPreviewError(getApiErrorMessage(error, "تعذّر حساب السعر المقترح."));
    }
  }

  return <section aria-labelledby="price-preview-heading" className="rounded-lg border bg-card px-4 py-4  sm:px-5">
    <div className="mb-4 flex items-center gap-2">
      <Calculator className="size-5 text-primary" />
      <h2 id="price-preview-heading" className="font-bold">حاسبة السعر المقترح</h2>
    </div>

    {!active ? <p className="text-sm text-muted-foreground">الخدمة غير نشطة، ولا يمكن حساب سعرها حاليًا.</p> :
      <form onSubmit={(event) => void calculate(event)} className="space-y-4">
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
          <label className="block text-xs font-semibold">نوع العميل
            <select aria-label="نوع عميل المعاينة" value={customerTypeId}
              className={fieldClass + " mt-2"} disabled={preview.isPending}
              onChange={(e) => { setCustomerTypeId(e.target.value); invalidateResult(); }}>
              <option value="">سعر عام — بدون نوع عميل</option>
              {types.data?.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">الكمية
            <input aria-label="كمية المعاينة" className={fieldClass + " mt-2"}
              type="number" min="1" step="1" value={quantity} disabled={preview.isPending}
              onChange={(e) => { setQuantity(e.target.value); invalidateResult(); }} />
          </label>
          <Button type="submit" disabled={preview.isPending}>
            {preview.isPending && <LoaderCircle className="size-4 animate-spin" />}
            حساب السعر المقترح
          </Button>
        </div>
        {types.isError && <p className="text-xs text-destructive">
          تعذّر تحميل أنواع العملاء.{" "}
          <button className="underline" type="button" onClick={() => void types.refetch()}>إعادة المحاولة</button>
          {" "}أو احسب السعر العام.
        </p>}
        {previewError && <p role="alert" className="text-sm text-destructive">{previewError}</p>}
        {result && <div aria-label="نتيجة معاينة السعر" role="status"
          className="rounded-lg border bg-muted/40 px-4 py-3">
          {result.requiresManualTotal ? <p className="text-sm font-medium">
            لا يوجد سعر محدد لهذا النوع والكمية؛ أدخل إجمالي السعر يدويًا عند إنشاء الأوردر.
          </p> : <div className="grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">مصدر السعر</p>
              <p className="mt-1 text-sm font-semibold">{result.source ? sourceLabels[result.source] : "غير محدد"}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">سعر الوحدة</p>
              <p className="mt-1 text-base font-bold tabular-nums" dir="ltr">{result.suggestedUnitPrice} ج.م</p>
            </div>
            <div><p className="text-xs text-muted-foreground">الإجمالي المقترح</p>
              <p className="mt-1 text-xl font-extrabold tabular-nums" dir="ltr">{result.suggestedTotal} ج.م</p>
            </div>
          </div>}
        </div>}
      </form>}
  </section>;
}
