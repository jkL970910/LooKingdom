import {test,expect} from "@playwright/test";
test.use({extraHTTPHeaders:{"x-real-ip":"198.51.100.25"}});
test("wallet groups denominations and requests only the selected issued duration",async({browser})=>{
 const blue=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{"x-real-ip":"198.51.100.25"}});
 const red=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{"x-real-ip":"198.51.100.26"}});
 try{
 const b=await blue.newPage(),r=await red.newPage();
 await r.goto("/");await r.getByRole("button",{name:"我是红Loo",exact:false}).click();await r.getByRole("button",{name:"进入小窝"}).click();
 await expect(r.getByRole("button",{name:"小窝",exact:true})).toBeVisible();
 const title="揉头规格验证";
 for(const [minutes,count] of [[15,3],[30,1]]){
 const res=await r.request.post("/api/state",{data:{type:"coupon.create",requestId:crypto.randomUUID(),coupon:{title,description:"",owner:"blue",count,minutes,benefit:"揉揉头",useKind:"timed",art:0,color:"blue",expires:""}}});expect(res.ok()).toBeTruthy();
 }
 await b.goto("/");await b.getByRole("button",{name:"进入小窝"}).click();await b.getByRole("button",{name:"卡包",exact:true}).click();
 await b.getByRole("button",{name:"查看"+title,exact:true}).click();
 await expect(b.locator(".coupon-card")).toContainText("共 75 分钟");
 await expect(b.locator(".coupon-stats")).toContainText("4");
 await expect(b.getByRole("button",{name:"查看"+title,exact:true})).toHaveCount(1);
 await b.screenshot({path:"design/qa/grouped-cards.png",animations:"disabled"});
 await b.getByRole("button",{name:"选择卡片并使用",exact:true}).click();
 const select=b.getByLabel("选择要使用的卡片");await expect(select.locator("option")).toHaveCount(2);
 await expect(select.locator("option").first()).toContainText("15 分钟 · 剩余 3 张");
 await select.selectOption({label:"30 分钟 · 剩余 1 张"});
 await expect(b.getByRole("dialog").getByRole("spinbutton")).toHaveCount(0);
 await b.screenshot({path:"design/qa/card-denominations.png",animations:"disabled"});
 await b.getByRole("button",{name:"发送使用申请",exact:true}).click();
 const state=await(await b.request.get("/api/state")).json();
 const use=state.couponUses.find((u:{title:string})=>u.title===title);expect(use.minutes).toBe(30);
 const cancel=await b.request.post("/api/state",{data:{type:"coupon.cancel",id:use.id,reason:"验证完成"}});expect(cancel.ok()).toBeTruthy();
 }finally{await blue.close();await red.close();}
});
