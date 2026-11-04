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
  attentionOrders: [], latestOrders: [],
};
const pagination = {currentPage:1,lastPage:1,perPage:15,total:0};
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
  if (path === "/orders") return success({orders:[],pagination});
  if (path === "/customers") return success({customers:[],pagination});
  if (path === "/finance/collections") return success({collections:[],pagination});
  if (path === "/finance/collections/summary") return success({
    totalCollected:"0.00",collectionsCount:0,cashTotal:"0.00",bankTotal:"0.00",walletTotal:"0.00",
  });
  if (path === "/finance/accounts") return success({accounts:[],pagination});
  if (path === "/selects") return success([{label:"customerTypes",options:[]},
    {label:"activeCustomers",options:[]},{label:"printingServices",options:[]}]);
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
    {width:768,height:1024,role:"admin"},
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
          viewport:innerWidth,docWidth:document.documentElement.scrollWidth,
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
        assert.ok(report.docWidth<=report.viewport+2,
          `${where}: document overflow ${report.docWidth} > ${report.viewport}`);
      };
      assertNoOverflow("dashboard");
      assert.ok(report.main?.width > width*0.90,`main too narrow: ${report.main?.width}/${width}`);
      assert.ok(report.stats?.width > width*0.85,`KPI grid too narrow: ${report.stats?.width}/${width}`);
      assert.ok(report.firstCard?.left >= -2 && report.firstCard?.right <= width+2,
        `KPI outside visible viewport: ${JSON.stringify(report.firstCard)}`);
      assert.ok(report.metric.every(s=>!s.includes("NaN")&&!s.includes("undefined")),
        "Metric missing or malformed");
      if(mobile) {
        assert.ok(report.nav?.width >= width-2, `bottom nav too narrow: ${report.nav?.width}/${width}`);
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
      for(const route of ["/customers","/orders","/collections"]) {
        await page.goto(base+route,{waitUntil:"domcontentloaded"});
        await page.locator(".tabaa-page").waitFor({timeout:15000});
        const info=await page.evaluate(()=>({
          docWidth:document.documentElement.scrollWidth,viewport:innerWidth,
          navWidth:document.querySelector(".tabaa-mobile-nav")?.getBoundingClientRect().width,
        }));
        assert.ok(info.docWidth<=info.viewport+2,`${route}: overflow ${info.docWidth}/${info.viewport}`);
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
