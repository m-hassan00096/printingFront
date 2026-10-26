import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProductionItemCard } from "@/features/production/components/production-item-card";
import type { ProductionItem, ProductionStage } from "@/features/production/types/production.types";

const base: ProductionItem = {
  id: 110, orderId: 15, orderNumber: "ORD-261026001",
  customerId: 20, customerName: "عميل اختبار", customerPhone: "01000000000",
  serviceId: 30, serviceName: "رول أب 120×50",
  quantity: 50, dueDate: null, isLate: false, productionStage: 1,
  productionStageLabel: "قيد التصميم",
  designerId: 9, designerName: "أحمد محمد",
  designCompletedById: null, designCompletedByName: null,
  printingLocationId: null, printingLocationName: null,
};
function show(stage: ProductionStage, update: Partial<ProductionItem> = {}) {
  render(<ProductionItemCard item={{...base, ...update, productionStage: stage}}
    permissions={[]} selected={false} busy={false}
    onSelect={()=>{}} onAction={()=>{}} onDetails={()=>{}}/>);
  return screen.getByRole("article", {name:"عنصر رول أب 120×50"});
}
afterEach(cleanup);

describe("Production designer visibility on Kanban cards", () => {
  it("identifies the designer in progress without requiring the detail modal", () => {
    const card=show(1);
    expect(within(card).getByText("المصمم المسؤول")).toBeTruthy();
    expect(within(card).getByText("أحمد محمد")).toBeTruthy();
    expect(within(card).getByText("قيد التصميم")).toBeTruthy();
    expect(within(card).getByText("الكمية: 50")).toBeTruthy();
  });

  it("identifies who actually completed design, distinct from the employee who started", () => {
    const card=show(2, {
      designCompletedById:12, designCompletedByName:"سارة علي",
    });
    expect(within(card).getByText("أنهى التصميم:")).toBeTruthy();
    expect(within(card).getByText("سارة علي")).toBeTruthy();
    expect(within(card).getByText("المصمم المسؤول")).toBeTruthy();
    expect(within(card).getByText("أحمد محمد")).toBeTruthy();
  });

  it("does not claim completion by the original designer if completion identity is missing", () => {
    const card=show(2);
    expect(within(card).getByText("المصمم المسؤول")).toBeTruthy();
    expect(within(card).getByText("أحمد محمد")).toBeTruthy();
    expect(within(card).queryByText("أنهى التصميم:")).toBeNull();
  });

  it("provides a visible fallback if assignment name is unavailable", () => {
    const card=show(1, {designerId:null,designerName:null});
    expect(within(card).getByText("غير محدد")).toBeTruthy();
  });

  it("does not clutter the not-started or printing cards with a designer panel", () => {
    const first=show(0);
    expect(within(first).queryByText("المصمم المسؤول")).toBeNull();
    cleanup();
    const printing=show(3);
    expect(within(printing).queryByText("المصمم المسؤول")).toBeNull();
    expect(within(printing).queryByText("أنهى التصميم:")).toBeNull();
    expect(within(printing).getByText("مكان الطباعة: —")).toBeTruthy();
  });

  it("shows the server quantity consistently after design is completed", () => {
    const card=show(2,{quantity:125,designCompletedByName:"سارة علي"});
    expect(within(card).getByText("الكمية: 125")).toBeTruthy();
    expect(within(card).getByText("أحمد محمد")).toBeTruthy();
  });
});
