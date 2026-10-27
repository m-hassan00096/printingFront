import { useRef, useState, type FormEvent } from "react";
import axios from "axios";
import { ArrowRight, Info, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { uiMessages } from "@/shared/translations/ar/ui";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { useCustomerTypes } from "@/features/customers/hooks/use-customers";
import { ErrorState, fieldClass, fieldLabel, LoadingState } from "@/features/identity/components/identity-ui";
import { usePrintingService, usePrintingServiceMutations } from "../hooks/use-printing-services";
import type {
  CreateServicePayload, PrintingService, ServiceTier, TierCommand,
  TierValues, UpdateServicePayload,
} from "../types/printing-service.types";

type TierInput = {
  key: number;
  priceTierId?: number;
  customerTypeId: string;
  minQuantity: string;
  maxQuantity: string;
  price: string;
};
type Errors = Record<string, string>;
const blankTier = (key: number): TierInput => ({
  key, customerTypeId: "", minQuantity: "", maxQuantity: "", price: "",
});
function fromTier(tier: ServiceTier): TierInput {
  return {
    key: tier.priceTierId, priceTierId: tier.priceTierId,
    customerTypeId: tier.customerTypeId?.toString() ?? "",
    minQuantity: tier.minQuantity?.toString() ?? "",
    maxQuantity: tier.maxQuantity?.toString() ?? "",
    price: tier.price,
  };
}
function toValues(input: TierInput): TierValues {
  return {
    customerTypeId: input.customerTypeId ? Number(input.customerTypeId) : null,
    minQuantity: input.minQuantity ? Number(input.minQuantity) : null,
    maxQuantity: input.maxQuantity ? Number(input.maxQuantity) : null,
    price: input.price.trim(),
  };
}
function equalTier(input: TierInput, original: ServiceTier): boolean {
  const values = toValues(input);
  return values.customerTypeId === original.customerTypeId &&
    values.minQuantity === original.minQuantity &&
    values.maxQuantity === original.maxQuantity &&
    Number(values.price) === Number(original.price);
}
function validMoney(value: string, zeroAllowed: boolean): boolean {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim())) return false;
  const number = Number(value);
  return Number.isFinite(number) && (zeroAllowed ? number >= 0 : number > 0);
}

/** UI-only advisory; the backend remains the source of truth for tier precedence. */
function hasAmbiguousQuantityRanges(rows: TierInput[]): boolean {
  const ranges = rows.filter(row =>
    row.minQuantity !== "" || row.maxQuantity !== ""
  ).filter(row =>
    (!row.minQuantity || /^\d+$/.test(row.minQuantity)) &&
    (!row.maxQuantity || /^\d+$/.test(row.maxQuantity))
  );
  return ranges.some((row, index) => ranges.slice(index + 1).some(next => {
    if (row.customerTypeId !== next.customerTypeId) return false;
    const startA = row.minQuantity ? Number(row.minQuantity) : 1;
    const endA = row.maxQuantity ? Number(row.maxQuantity) : Infinity;
    const startB = next.minQuantity ? Number(next.minQuantity) : 1;
    const endB = next.maxQuantity ? Number(next.maxQuantity) : Infinity;
    return startA <= endA && startB <= endB && startA <= endB && startB <= endA;
  }));
}

function PrintingServiceForm({ service }: { service?: PrintingService }) {
  const navigate = useNavigate();
  const mutations = usePrintingServiceMutations();
  const types = useCustomerTypes(true);
  const nextKey = useRef(-1);
  const [name, setName] = useState(service?.name ?? "");
  const [basePrice, setBasePrice] = useState(service?.basePrice ?? "");
  const [status, setStatus] = useState<"0" | "1">(service?.status === 0 ? "0" : "1");
  const [rows, setRows] = useState<TierInput[]>(service?.priceTiers?.map(fromTier) ?? []);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const busy = mutations.create.isPending || mutations.update.isPending;
  const copy = uiMessages.printingServices;
  const existing = new Map(service?.priceTiers?.map((tier) => [tier.priceTierId, tier]) ?? []);

  function clear(key: string) {
    setErrors((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
    setGeneralError(null);
  }
  function editRow(key: number, field: keyof Omit<TierInput, "key" | "priceTierId">, value: string) {
    setRows((old) => old.map((row) => row.key === key ? { ...row, [field]: value } : row));
    clear(`row.${key}.${field}`);
  }
  function removeRow(key: number) {
    const row = rows.find((item) => item.key === key);
    if (row?.priceTierId) setRemovedIds((old) => [...old, row.priceTierId!]);
    setRows((old) => old.filter((item) => item.key !== key));
    setErrors((old) => Object.fromEntries(Object.entries(old).filter(([name]) => !name.startsWith(`row.${key}.`))));
  }
  function validate(): Errors {
    const issues: Errors = {};
    if (!name.trim()) issues.name = "اسم الخدمة مطلوب.";
    else if (name.trim().length > 150) issues.name = "اسم الخدمة يجب ألا يزيد عن 150 حرفًا.";
    if (basePrice.trim() && !validMoney(basePrice, true)) issues.basePrice = "السعر الأساسي يجب أن يكون مبلغًا صحيحًا حتى منزلتين عشريتين.";
    for (const row of rows) {
      if (!validMoney(row.price, false)) issues[`row.${row.key}.price`] = "سعر الشريحة يجب أن يكون أكبر من صفر.";
      for (const field of ["minQuantity", "maxQuantity"] as const) {
        if (row[field] && (!/^\d+$/.test(row[field]) || !Number.isSafeInteger(Number(row[field])) || Number(row[field]) < 1))
          issues[`row.${row.key}.${field}`] = "الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.";
      }
      if (row.minQuantity && row.maxQuantity && Number(row.minQuantity) > Number(row.maxQuantity))
        issues[`row.${row.key}.maxQuantity`] = "الحد الأقصى أقل من الحد الأدنى.";
    }
    return issues;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const issues = validate();
    setErrors(issues);
    if (Object.keys(issues).length) return;
    const commands: TierCommand[] = [];
    const commandKeys: (number | null)[] = [];

    let payload: CreateServicePayload | UpdateServicePayload;
    if (service) {
      const update: UpdateServicePayload = {};
      if (name.trim() !== service.name) update.name = name.trim();
      if ((basePrice.trim() || null) !== service.basePrice) update.basePrice = basePrice.trim() || null;
      if (Number(status) !== service.status) update.status = Number(status) as 0 | 1;
      for (const row of rows) {
        const original = row.priceTierId ? existing.get(row.priceTierId) : undefined;
        if (!original) {
          commands.push({ actionStatus: 1, ...toValues(row) });
          commandKeys.push(row.key);
        } else if (!equalTier(row, original)) {
          commands.push({ actionStatus: 2, priceTierId: original.priceTierId, ...toValues(row) });
          commandKeys.push(row.key);
        }
      }
      for (const id of removedIds) {
        commands.push({ actionStatus: 3, priceTierId: id });
        commandKeys.push(null);
      }
      if (commands.length) update.priceTiers = commands;
      if (!Object.keys(update).length) {
        toast.message("لا توجد تغييرات للحفظ.");
        navigate(`/printing-services/${service.id}`);
        return;
      }
      payload = update;
    } else {
      payload = {
        name: name.trim(), basePrice: basePrice.trim() || null,
        status: Number(status) as 0 | 1, priceTiers: rows.map(toValues),
      };
      commandKeys.push(...rows.map((row) => row.key));
    }
    try {
      const saved = service
        ? await mutations.update.mutateAsync({ id: service.id, payload: payload as UpdateServicePayload })
        : await mutations.create.mutateAsync(payload as CreateServicePayload);
      toast.success(service ? "تم تعديل خدمة الطباعة." : "تم إضافة خدمة الطباعة.");
      navigate(`/printing-services/${saved.id}`);
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422) {
        const byField = error.response.data?.errors;
        if (byField && Object.keys(byField).length) {
          const mapped: Errors = {};
          const other: string[] = [];
          for (const [key, messages] of Object.entries(byField)) {
            const match = key.match(/^priceTiers\.(\d+)\.(\w+)$/);
            if (match) {
              const index = Number(match[1]);
              const rowKey = commandKeys[index];
              if (rowKey !== null && rowKey !== undefined)
                mapped[`row.${rowKey}.${match[2]}`] = messages[0];
              else other.push(...messages);
            } else if (["name", "basePrice", "status"].includes(key)) mapped[key] = messages[0];
            else other.push(...messages);
          }
          setErrors(mapped);
          setGeneralError(other.length ? other.join(" ") : null);
          return;
        }
      }
      setGeneralError(getApiErrorMessage(error, "تعذّر حفظ خدمة الطباعة."));
    }
  }
  const err = (key: string) => errors[key] ? <span role="alert" className="mt-1 block text-xs text-destructive">{errors[key]}</span> : null;
  const currentType = (id: string) => !types.data?.some((x) => String(x.value) === id) && id !== "" && (
    <option value={id}>نوع العميل #{id} (غير متاح حاليًا)</option>
  );

  return <div className="mx-auto w-full max-w-6xl space-y-5">
    <Button asChild variant="ghost" className="px-0">
      <Link to={service ? `/printing-services/${service.id}` : "/printing-services"}>
        <ArrowRight className="size-4" /> العودة لخدمات الطباعة
      </Link>
    </Button>
    <header>
      <h1 className="text-xl font-semibold">{service ? "تعديل خدمة طباعة" : "إضافة خدمة طباعة"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">حدد بيانات الخدمة وأسعارها بالجنيه المصري.</p>
    </header>

    <form onSubmit={(event) => void save(event)} noValidate className="space-y-4">
      <section className="rounded-lg border bg-card p-4  sm:p-5">
        <h2 className="mb-4 font-bold">بيانات الخدمة</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block"><span className={fieldLabel}>اسم الخدمة *</span>
            <input aria-label="اسم الخدمة" aria-invalid={!!errors.name} className={fieldClass + " mt-2"}
              maxLength={150} value={name} disabled={busy}
              onChange={(e) => { setName(e.target.value); clear("name"); }} />
            {err("name")}
          </label>
          <label className="block"><span className={fieldLabel}>السعر الأساسي (اختياري)</span>
            <input aria-label="السعر الأساسي" aria-invalid={!!errors.basePrice} type="text"
              inputMode="decimal" dir="ltr" className={fieldClass + " mt-2"}
              placeholder={copy.emptyBasePrice} value={basePrice} disabled={busy}
              onChange={(e) => { setBasePrice(e.target.value); clear("basePrice"); }} />
            {err("basePrice")}
            <span className="mt-1.5 block text-[11px] leading-5 text-muted-foreground">{copy.zeroBasePrice}</span>
          </label>
          <label className="block"><span className={fieldLabel}>الحالة</span>
            <select aria-label="حالة الخدمة" className={fieldClass + " mt-2"} value={status}
              disabled={busy} onChange={(e) => { setStatus(e.target.value as "0" | "1"); clear("status"); }}>
              <option value="1">نشط</option>
              <option value="0">غير نشط</option>
            </select>
            {err("status")}
          </label>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5 text-xs leading-6 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {copy.quantityPriorityHelp}
        </p>
      </section>

      <section className="rounded-lg border bg-card " aria-labelledby="tiers-form-title">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div>
            <h2 id="tiers-form-title" className="font-bold">شرائح الأسعار</h2>
            <p className="mt-1 text-xs text-muted-foreground">{copy.tierPriorityHelp}</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={busy}
            onClick={() => setRows((old) => [...old, blankTier(nextKey.current--)])}>
            <Plus className="size-4" /> إضافة شريحة
          </Button>
        </header>
        <div className="space-y-3 p-4 sm:p-5">
          {types.isError && <p role="alert" className="text-sm text-destructive">
            تعذّر تحميل أنواع العملاء.{" "}
            <button type="button" className="underline" onClick={() => void types.refetch()}>إعادة المحاولة</button>
          </p>}
          {rows.length === 0 && <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            لا توجد شرائح مضافة. اضغط «إضافة شريحة» لتخصيص الأسعار حسب العميل أو الكمية.
          </p>}
          {rows.map((row, index) => {
            const isDefault = row.minQuantity === "" && row.maxQuantity === "";
            return <fieldset key={row.key} disabled={busy}
              className="min-w-0 rounded-xl border border-[#e6e9f2] bg-[#fafbff] p-3 sm:p-4">
              <legend className="px-2 text-xs font-bold text-[#596781]">شريحة {index + 1}</legend>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {isDefault ? copy.defaultTier : copy.rangeGroup}
                </span>
                <Button type="button" size="sm" variant="ghost"
                  className="text-destructive hover:bg-[#fff0f2] hover:text-destructive"
                  aria-label={`حذف الشريحة ${index + 1}`} title="حذف الشريحة"
                  onClick={() => removeRow(row.key)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  حذف الشريحة
                </Button>
              </div>
              <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1.1fr)]">
                <label className="block text-xs font-semibold">نوع العميل
                  <select aria-label={`نوع عميل الشريحة ${index + 1}`} className={fieldClass + " mt-2"}
                    value={row.customerTypeId}
                    onChange={event => editRow(row.key, "customerTypeId", event.target.value)}>
                    <option value="">كل أنواع العملاء</option>
                    {currentType(row.customerTypeId)}
                    {types.data?.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>{err(`row.${row.key}.customerTypeId`)}
                </label>
                <div role="group" aria-label={`${copy.rangeGroup} للشريحة ${index + 1}`} className="min-w-0">
                  <p className="text-xs font-semibold">{copy.rangeGroup}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="block min-w-0 text-[11px] text-muted-foreground">من
                      <input aria-label={`الكمية من للشريحة ${index + 1}`} className={fieldClass + " mt-1"}
                        type="number" min="1" value={row.minQuantity} placeholder="بدون حد"
                        onChange={event => editRow(row.key, "minQuantity", event.target.value)} />
                      {err(`row.${row.key}.minQuantity`)}
                    </label>
                    <label className="block min-w-0 text-[11px] text-muted-foreground">إلى
                      <input aria-label={`الكمية إلى للشريحة ${index + 1}`} className={fieldClass + " mt-1"}
                        type="number" min="1" value={row.maxQuantity} placeholder="بدون حد"
                        onChange={event => editRow(row.key, "maxQuantity", event.target.value)} />
                      {err(`row.${row.key}.maxQuantity`)}
                    </label>
                  </div>
                </div>
                <label className="block text-xs font-semibold">سعر الوحدة *
                  <input aria-label={`سعر الشريحة ${index + 1}`} className={fieldClass + " mt-2"}
                    dir="ltr" inputMode="decimal" value={row.price} placeholder="0.00"
                    onChange={event => editRow(row.key, "price", event.target.value)} />
                  {err(`row.${row.key}.price`)}
                </label>
              </div>
            </fieldset>;
          })}
          {hasAmbiguousQuantityRanges(rows) && <p role="status" className="flex items-start gap-2 rounded-lg border border-[#f3dda6] bg-[#fff8e8] px-3 py-2.5 text-xs leading-6 text-[#996610]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {copy.ambiguousRangesWarning}
          </p>}
          {err("priceTiers")}
          <p className="text-xs leading-6 text-muted-foreground">
            {copy.openQuantityHelp} {copy.quantityPriorityHelp}
          </p>
        </div>
      </section>

      {generalError && <p role="alert" className="rounded-lg border border-[#efbec6] bg-[#ffecf0] p-3 text-sm text-[#c73a4c]">{generalError}</p>}
      <footer className="flex flex-wrap justify-end gap-3 py-2">
        <Button asChild variant="outline">
          <Link to={service ? `/printing-services/${service.id}` : "/printing-services"}>إلغاء</Link>
        </Button>
        <Button type="submit" disabled={busy || types.isError}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {service ? "حفظ التعديلات" : "حفظ الخدمة"}
        </Button>
      </footer>
    </form>
  </div>;
}

export function PrintingServiceFormPage() {
  const { id: rawId } = useParams();
  const editing = rawId !== undefined;
  const id = Number(rawId);
  const service = usePrintingService(editing && Number.isSafeInteger(id) ? id : 0);
  if (editing && (!Number.isSafeInteger(id) || id < 1))
    return <p role="alert">معرّف الخدمة غير صحيح.</p>;
  if (editing && service.isPending) return <LoadingState />;
  if (editing && service.isError) return <ErrorState error={service.error} retry={() => void service.refetch()} />;
  return <PrintingServiceForm key={editing ? String(id) : "new"} service={editing ? service.data : undefined} />;
}
