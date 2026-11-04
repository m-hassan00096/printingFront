import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { Collection, CollectionPage } from "@/features/collections/types/collections.types";
import type { Order } from "../types/orders.types";

export type OrderDepositReceipt = Pick<
  Collection,
  "id" | "orderId" | "customerId" | "source" | "status" | "amount" |
  "receiptNumber" | "actualReceiptNumber" | "paymentMethodLabel" |
  "destinationLabel" | "collectedOn"
>;

/**
 * Read only real, posted order-deposit receipts. Draft payment plans are NOT
 * receipts; reversed or corrected originals must never appear as paid.
 *
 * The existing collection register supports order-number search but not
 * filter[orderId], so the result is narrowed again by the exact numeric id.
 */
export async function getOrderDepositReceipts(
  order: Pick<Order, "id" | "customerId" | "status" | "orderNumber">,
): Promise<OrderDepositReceipt[]> {
  if (order.status === 0) return [];
  if (!order.orderNumber) throw new Error("رقم الأوردر المؤكد غير متاح للتحقق من تحصيل العربون.");

  const receipts: OrderDepositReceipt[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const params = new URLSearchParams({
      "filter[search]": order.orderNumber,
      "filter[source]": "1", // ORDER_DEPOSIT (not delivery or general collection)
      "filter[status]": "1", // POSTED; excludes reversed/corrected receipts
      perPage: "100",
      page: String(page),
      sort: "-id",
    });
    const { data } = await apiClient.get<ApiResponse<CollectionPage>>("/finance/collections", { params });
    const result = data.data;
    if (!result || !Array.isArray(result.collections) ||
        !Number.isSafeInteger(result.pagination?.lastPage) ||
        result.pagination.lastPage < 1 || result.pagination.currentPage !== page) {
      throw new Error("تعذّر التحقق من إيصالات عربون الأوردر.");
    }
    // Never present a partial collection list as a complete amount.
    if (result.pagination.lastPage > 25) {
      throw new Error("عدد إيصالات التحصيل كبير جدًا؛ راجع الحسابات قبل طباعة الأوردر.");
    }
    lastPage = result.pagination.lastPage;
    receipts.push(...result.collections.filter(receipt =>
      receipt.orderId === order.id &&
      receipt.customerId === order.customerId &&
      receipt.source === 1 &&
      receipt.status === 1 &&
      receipt.receiptNumber.length > 0
    ));
    page += 1;
  } while (page <= lastPage);

  return receipts.sort((a, b) => a.id - b.id);
}

export function exactMoneyCents(amount: string): number {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(amount)) throw new Error("قيمة مالية غير صحيحة.");
  const [whole, fraction = ""] = amount.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("القيمة المالية كبيرة جدًا.");
  return cents;
}

export function depositedCents(receipts: readonly OrderDepositReceipt[]): number {
  return receipts.reduce((total, receipt) => {
    const next = total + exactMoneyCents(receipt.amount);
    if (!Number.isSafeInteger(next)) throw new Error("إجمالي العربون كبير جدًا.");
    return next;
  }, 0);
}
