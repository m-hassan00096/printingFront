/** Browser-level mobile layout regression checks, run on real Chromium.
 * API responses are mocked at the network layer; no production accounts are used.
 * Run: npm install --no-save playwright && npx playwright install chromium && node tests/browser/responsive.mjs
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const base = "http://127.0.0.1:5173";
const screenshotDir = ".artifacts/responsive";
await fs.mkdir(screenshotDir, {recursive: true});
const adminPermissions = [
  "orders.list","orders.view","orders.create","customers.view","customers.create",
  "finance.balances.view","finance.ledger.view","finance.collections.view",
  "finance.collections.create","deliveries.list","production.items.list",
];
const receptionistPermissions = [
  "orders.list","orders.view","orders.create","customers.view","finance.collections.view",
  "finance.collections.create","deliveries.list",
];
const dashboard = {
  asOfDate: "2026-11-04",
  metrics: {activeOrders:0,overdueOrders:0,readyForDelivery:0,dueToday:0,readyDueToday:0},
  productionPressure: {notStarted:0,design:0,printing:0,ready:0},
  attentionOrders: [], latestOrders: [
    {id:1,orderNumber:"ORD-261104001",customerName:"شركة المصرية لخدمات الطباعة",
     dueDate:"2026-11-07",productionStatus:2,productionStatusLabel:"جارٍ التنفيذ",isOverdue:false},
    {id:2,orderNumber:"ORD-261104002",customerName:"مؤسسة الرحمن",
     dueDate:"2026-11-09",productionStatus:3,productionStatusLabel:"جاهز",isOverdue:false},
  ],
};
const pagination = {currentPage:1,lastPage:1,perPage:15,total:1};
const longName = "شركة المصرية الحديثة للطباعة والتصميم والإعلان والتوريدات";
const customer = {id:101,name:longName,phone:"01012345678",address:"المنصورة",
  customerTypeId:21,customerType:{id:21,name:"شركة"},status:1,statusLabel:"نشط"};
const order = {id:101,orderNumber:"ORD-261104001",customerId:101,customerName:longName,
  customerPhone:"01012345678",customerTypeId:21,customerTypeName:"شركة",
  source:0,sourceLabel:"مباشر",status:1,statusLabel:"مؤكد",
  productionStatus:1,productionStatusLabel:"تحت التنفيذ",
  delayStatus:null,delayStatusLabel:null,dueDate:"2026-11-07",
  notes:null,itemsCount:1,totalAmount:"1250.00",
  createdAt:"2026-11-04T10:00:00Z",updatedAt:"2026-11-04T10:00:00Z",
  confirmedAt:"2026-11-04T10:00:00Z",deliveredAt:null,cancelledAt:null};
const collection = {id:51,receiptNumber:"COL-2026-00051",actualReceiptNumber:null,
  customerId:101,customerName:longName,customerPhone:"01012345678",
  orderId:null,orderNumber:null,correctedFromId:null,correctedToId:null,
  amount:"250.00",paymentMethod:0,paymentMethodLabel:"نقدي",
  paymentDestinationId:null,destinationLabel:null,
  source:0,sourceLabel:"تحصيل عام",status:1,statusLabel:"معتمد",
  collectedOn:"2026-11-04",note:null,createdBy:1,createdAt:"2026-11-04T10:00:00Z",
  reversedAt:null,reversalReason:null};
const account = {customerId:101,customerName:longName,customerPhone:"01012345678",
  amount:"1000.00",type:1,typeLabel:"مدين",openingBalanceExists:false};
const readyOrder = {orderId:101,orderNumber:"ORD-261104001",customerId:101,
  customerName:longName,customerPhone:"01012345678",dueDate:"2026-11-07",
  orderTotal:"1250.00",productionStatus:4,productionStatusLabel:"جاهز",
  readyItemsCount:1,totalItemsCount:1,isReadyForDelivery:true,canDeliver:true,
  customerBalance:{amount:"1000.00",type:1,typeLabel:"مدين"},
  items:[{id:1,serviceName:"رول أب",quantity:10,productionStage:4,productionStageLabel:"جاهز"}]};
const productionItem = {id:1,orderId:101,orderNumber:"ORD-261104001",
  customerId:101,customerName:longName,customerPhone:"01012345678",
  serviceId:11,serviceName:"رول أب",quantity:10,dueDate:"2026-11-07",
  isLate:false,productionStage:0,productionStageLabel:"لم يبدأ",
  designerId:null,designerName:null,designCompletedById:null,designCompletedByName:null,
  printingLocationId:null,printingLocationName:null};
const success = data => ({success:true,message:"",data});
const mockResponse = (url,role) => {
  const path = new URL(url).pathname.replace(/^\/api\/v1/, "");
  if (path === "/auth/me") return success({
    name: role === "admin" ? "مدير" : "استقبال",
    username: role === "admin" ? "admin" : "user3",
    role: role === "admin" ? "superadmin" : "reception",
    roleAlias: role === "admin" ? "مدير النظام" : "الاستقبال",
    status:1,statusLabel:"نشط",
    permissions:role === "admin" ? adminPermissions : receptionistPermissions,
  });
  if (path === "/dashboard") return success(dashboard);
  if (path === "/orders") return success({orders:[order],pagination});
  if (path === "/customers") return success({customers:[customer],pagination});
  if (path === "/finance/collections") return success({collections:[collection],pagination});
  if (path === "/finance/collections/summary") return success({
    totalCollected:"0.00",collectionsCount:0,cashTotal:"0.00",bankTotal:"0.00",walletTotal:"0.00",
  });
  if (path === "/finance/customer-balances") return success({accounts:[account],pagination});
  if (path === "/deliveries/ready") return success({orders:[readyOrder],pagination});
  if (path === "/deliveries") return success({deliveries:[],pagination});
  if (path === "/production/items") return success({items:[productionItem],pagination});
  if (path === "/production/summary") return success({
    notStartedCount:1,designInProgressCount:0,designCompletedCount:0,
    printingCount:0,readyCount:0,lateOrdersCount:0,
  });
  if (path === "/selects") return success([
    {label:"customerTypes",options:[{value:21,label:"شركة"}]},
    {label:"customers",options:[{value:101,label:longName+" - 01012345678"}]},
    {label:"deliveryCustomers",options:[{value:101,label:longName}]},
    {label:"activeCustomers",options:[{value:101,label:longName}]},
    {label:"printingServices",options:[{value:11,label:"رول أب"}]},
    {label:"printingLocations",options:[]},
    {label:"bankAccounts",options:[]},{label:"eWallets",options:[]},
  ]);
  return success([]);
};
async function startServer() {
  const proc=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5173","--strictPort"],{stdio:"pipe"});
  let errors="";
  proc.stderr.on("data",data=>{ errors += String(data); });
  for(let i=0;i<100;i++) {
    if(proc.exitCode!==null) throw Error("Vite exited unexpectedly: "+errors);
    try { const res=await fetch(base+"/"); if(res.ok) return proc; }
    catch { /* still booting */ }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  proc.kill();
  throw Error("Vite did not start: "+errors);
}
const failures = [];
const metrics = [];
const server = await startServer();
let browser;
try {
  browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
  const matrix = [
    {width:320,height:740,role:"admin"},
    {width:360,height:780,role:"admin"},
    {width:375,height:812,role:"admin"},
    {width:390,height:844,role:"admin"},
    {width:414,height:896,role:"admin"},
    {width:568,height:320,role:"admin"},
    {width:640,height:360,role:"admin"},
    {width:768,height:1024,role:"admin"},
    {width:991,height:800,role:"admin"},
    {width:1024,height:768,role:"admin"},
    {width:1280,height:800,role:"admin"},
    {width:360,height:780,role:"reception"},
    {width:390,height:844,role:"reception"},
  ];
  for (const item of matrix) {
    const {width,height,role} = item;
    const mobile = width < 1024;
    const name = role+"-"+width;
    const ctx = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
      isMobile:mobile,hasTouch:mobile,locale:"ar-EG"});
    await ctx.route("**/api/v1/**",route=>route.fulfill({status:200,
      contentType:"application/json",body:JSON.stringify(mockResponse(route.request().url(),role))}));
    await ctx.route("**/sanctum/csrf-cookie", route=>route.fulfill({status:204,body:""}));
    const page = await ctx.newPage();
    const errors=[];
    page.on("pageerror", err=>errors.push(err.message));
    try {
      await page.goto(base+"/",{waitUntil:"domcontentloaded"});
      await page.getByRole("region",{name:"المؤشرات الرئيسية"}).waitFor({timeout:15000});
      await page.screenshot({path:`${screenshotDir}/${name}-dashboard.png`,fullPage:true});
      const report=await page.evaluate(()=>{
        const rect = element => {
          if(!element) return null;
          const b=element.getBoundingClientRect();
          return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,left:b.left};
        };
        const nav=document.querySelector('[aria-label="التنقل السريع للموبايل"]');
        return {
          viewport:document.documentElement.clientWidth,
          layoutViewport:innerWidth,
          visualViewport:window.visualViewport?.width ?? null,
          docWidth:document.documentElement.scrollWidth,
          bodyWidth:document.body.scrollWidth,
          header:rect(document.querySelector(".tabaa-app header")),
          main:rect(document.querySelector(".tabaa-app-main")),
          stats:rect(document.querySelector('[aria-label="المؤشرات الرئيسية"]')),
          firstCard:rect(document.querySelector('[aria-label="المؤشرات الرئيسية"] article')),
          nav:rect(nav),
          navLinks:[...nav?.querySelectorAll("a,button")??[]].map(el=>({
            label:el.getAttribute("aria-label"),...rect(el),
          })),
          metric:[...document.querySelectorAll('[aria-label="المؤشرات الرئيسية"] article')].map(el=>el.textContent),
        };
      });
      metrics.push({name,...report});
      console.log('GEOMETRY',JSON.stringify({name,...report}));
      const assertNoOverflow=where=>{
        assert.ok(report.docWidth<=width+2,
          `${where}: document width ${report.docWidth} > device viewport ${width}`);
        assert.ok(report.bodyWidth<=width+2,
          `${where}: body width ${report.bodyWidth} > device viewport ${width}`);
        assert.ok(report.layoutViewport<=width+2,
          `${where}: mobile layout viewport expanded ${report.layoutViewport} > ${width}`);
      };
      assertNoOverflow("dashboard");
      if (mobile) {
        // A sideways swipe or a programmatic horizontal scroll must not shift the app.
        const scrollCheck = await page.evaluate(() => {
          const root = document.scrollingElement;
          if (!root) return {left: 0, extra: 0};
          root.scrollLeft = 9999;
          return {left: root.scrollLeft, extra: root.scrollWidth - root.clientWidth};
        });
        assert.ok(Math.abs(scrollCheck.left) <= 2 && scrollCheck.extra <= 2,
          `mobile dashboard scrolls sideways: ${JSON.stringify(scrollCheck)}`);
        const navPosition = await page.locator(".tabaa-mobile-nav").boundingBox();
        assert.ok(navPosition && navPosition.x >= -2 && navPosition.x + navPosition.width <= width + 2,
          "bottom nav shifts after horizontal scrolling");
      }
      const available=width-(width>=1024?238:0);
      assert.ok(report.main?.width > available*0.98,`main too narrow: ${report.main?.width}/${available}`);
      assert.ok(report.main.left>=-2 && report.main.right<=width+2,
        `main shifted off physical screen: ${JSON.stringify(report.main)}`);
      assert.ok(report.stats?.width > available*0.85,`KPI grid too narrow: ${report.stats?.width}/${available}`);
      assert.ok(report.firstCard?.left >= -2 && report.firstCard?.right <= width+2,
        `KPI outside visible viewport: ${JSON.stringify(report.firstCard)}`);
      assert.ok(report.metric.every(s => /0/.test(s)),
        "Expected legible Western zero in dashboard metric cards");
      assert.ok(report.metric.every(s=>!s.includes("NaN")&&!s.includes("undefined")),
        "Metric missing or malformed");
      if(mobile) {
        assert.ok(report.nav?.width >= width-2 && report.nav?.width <= width+2,
          `bottom nav width incorrect: ${report.nav?.width}/${width}`);
        assert.ok(report.nav?.left>=-2 && report.nav?.right<=width+2,
          `bottom nav shifted outside viewport: ${JSON.stringify(report.nav)}`);
        assert.ok(report.navLinks?.length===4, `expected 4 nav slots: ${report.navLinks?.length}`);
        for(const link of report.navLinks) assert.ok(link.left>=-2 && link.right<=width+2,
          `clipped nav link: ${JSON.stringify(link)}`);
        const more=page.getByRole("button",{name:"المزيد"});
        await more.click();
        await page.getByRole("dialog",{name:"القائمة الرئيسية"}).waitFor();
        const drawer=await page.locator("#tabaa-mobile-sidebar").boundingBox();
        assert.ok(drawer.x>=-2&&drawer.x+drawer.width<=width+2,"drawer overflow");
        await page.getByRole("button",{name:"إغلاق القائمة الرئيسية"}).click();
      } else {
        const visible=await page.locator('[aria-label="التنقل السريع للموبايل"]').isVisible();
        assert.equal(visible,false,"desktop should not show bottom nav");
      }
      const routes = role === "admin"
        ? ["/customers","/orders","/collections","/finance","/deliveries","/production"]
        : ["/customers","/orders","/collections","/deliveries"];
      for(const route of routes) {
        await page.goto(base+route,{waitUntil:"domcontentloaded"});
        await page.locator(".tabaa-page").waitFor({timeout:15000});
        await page.waitForTimeout(200);
        const info=await page.evaluate(()=>({
          docWidth:document.documentElement.scrollWidth,
          bodyWidth:document.body.scrollWidth,
          viewport:document.documentElement.clientWidth,
          navWidth:document.querySelector(".tabaa-mobile-nav")?.getBoundingClientRect().width,
          uncaughtErrors:[...document.querySelectorAll('[role="alert"]')].map(el=>el.textContent?.trim()),
        }));
        assert.ok(info.docWidth<=width+2 && info.bodyWidth<=width+2,
          `${route}: overflow ${info.docWidth}/${info.bodyWidth} vs device ${width}`);
        assert.equal(info.uncaughtErrors.length,0,
          `${route}: unexpected errors ${JSON.stringify(info.uncaughtErrors)}`);
      }
      assert.deepEqual(errors,[],"Browser uncaught JS errors");
      console.log("PASS",name,JSON.stringify({docWidth:report.docWidth,main:report.main?.width,nav:report.nav?.width,metric:report.metric.map(s=>s.slice(0,48))}));
    } catch (error) {
      failures.push({name,message:String(error),errors});
      console.error("FAIL",name,error);
      try{await page.screenshot({path:`${screenshotDir}/${name}-failure.png`,fullPage:true});}catch{}
    } finally { await ctx.close(); }
  }
} finally {
  if(browser) await browser.close();
  server.kill();
  await fs.writeFile(`${screenshotDir}/report.json`,JSON.stringify({metrics,failures},null,2));
}
if(failures.length) {
  console.error("Responsive browser matrix:",failures.length,"failures");
  process.exitCode=1;
}else console.log("All mobile and desktop responsive browser checks passed");
