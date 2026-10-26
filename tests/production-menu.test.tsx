import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductionItemCard } from "@/features/production/components/production-item-card";
import type { ProductionAction, ProductionItem } from "@/features/production/types/production.types";

const permissions=["production.items.undo","production.printing.change_location"];
const fixture:ProductionItem={
  id:103,orderId:8,orderNumber:"ORD-261026001",customerId:5,customerName:"أحمد",
  customerPhone:"01012345678",serviceId:5,serviceName:"رول أب",quantity:50,
  dueDate:null,isLate:false,productionStage:3,productionStageLabel:"في الطباعة",
  designerId:1,designerName:"محمد",designCompletedById:1,designCompletedByName:"محمد",
  printingLocationId:7,printingLocationName:"المطبعة الرئيسية",
};
afterEach(()=>{cleanup();vi.restoreAllMocks();});

function renderCard(onAction=vi.fn<(action:ProductionAction,item:ProductionItem)=>void>()) {
  render(<div data-testid="clipping-parent" className="overflow-hidden rounded-xl">
    <ProductionItemCard item={fixture} permissions={permissions} selected={false} busy={false}
      onSelect={()=>{}} onDetails={()=>{}} onAction={onAction}/>
  </div>);
  return onAction;
}
describe("Production card action menu overflow regression",()=>{
  it("portals its RTL actions outside overflowing Kanban card and opens correct workflow",async()=>{
    const onAction=renderCard();
    const user=userEvent.setup();
    const trigger=screen.getByRole("button",{name:"المزيد للعنصر 103"});
    await user.click(trigger);
    const menu=await screen.findByRole("menu",{name:"عمليات إضافية للعنصر 103"});
    expect(menu.parentElement).toBe(document.body);
    expect(within(screen.getByTestId("clipping-parent")).queryByRole("menu")).toBeNull();
    expect(menu.className).toContain("fixed");
    expect(menu.getAttribute("dir")).toBe("rtl");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await user.click(within(menu).getByRole("menuitem",{name:"تغيير مكان الطباعة"}));
    expect(onAction).toHaveBeenCalledWith("change-location",fixture);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("flips up above a trigger near the bottom of the visible viewport",async()=>{
    renderCard();
    const trigger=screen.getByRole("button",{name:"المزيد للعنصر 103"});
    vi.spyOn(trigger,"getBoundingClientRect").mockReturnValue({
      top:300,bottom:336,left:12,right:48,width:36,height:36,x:12,y:300,toJSON:()=>({}),
    } as DOMRect);
    vi.stubGlobal("innerHeight",380);
    try{
      await userEvent.setup().click(trigger);
      const menu=await screen.findByRole("menu");
      await waitFor(()=>expect(parseFloat(menu.style.top)).toBeLessThan(300));
      expect(parseFloat(menu.style.left)).toBeGreaterThanOrEqual(8);
    }finally{vi.unstubAllGlobals();}
  });

  it("closes when clicking outside or pressing Escape, and returns focus on Escape",async()=>{
    renderCard();
    const user=userEvent.setup();
    const trigger=screen.getByRole("button",{name:"المزيد للعنصر 103"});
    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.pointer({target:document.body,keys:"[MouseLeft]"});
    expect(screen.queryByRole("menu")).toBeNull();
    await user.click(trigger);
    const menu=screen.getByRole("menu");
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("supports Up/Down keyboard navigation without leaking into the card",async()=>{
    renderCard();
    const user=userEvent.setup();
    await user.click(screen.getByRole("button",{name:"المزيد للعنصر 103"}));
    const menu=screen.getByRole("menu");
    const options=within(menu).getAllByRole("menuitem");
    await waitFor(()=>expect(document.activeElement).toBe(options[0]));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[1]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[0]);
  });
});
