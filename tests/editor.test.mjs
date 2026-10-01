import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
// trim=true cuts the terrain down to the places the fixture uses, so growth passes (8.47 farm packages) stay out of the picture.
function fixture(trim=false){
 const o=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:1,glassblower:0,alchemist:0},oldCount:1,compareSparks:false,goldSparksPerBatch:0}),cat=E.prepare(HOH_DATA.buildings,o),list=[];
 const add=(id,x,y)=>list.push({...cat[id],x,y,uid:list.length+1});
 for(const [id,x,y] of [['cityHall',25,14],['furnace',30,14],['infantryBarracks',0,20],['rangedBarracks',5,20],['cavalryBarracks',11,20],['heavyInfantryBarracks',17,20],['siegeBarracks',23,20],['stoneMason',4,4],['jeweler',20,4],['moderateCulture',8,2],['moderateCulture',8,4],['moderateCulture',8,6],['moderateCulture',24,4]])add(id,x,y);
 for(let x=0;x<16;x+=2)add('smallHome',x,28);
 assert.equal(E.validate(list,o,cat),null);
 if(trim){const tiles=Array(80).fill(false);for(const b of list)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)tiles[Math.floor(y/4)*10+Math.floor(x/4)]=true;const o2=E.normalized({...o,tiles}),cat2=E.prepare(HOH_DATA.buildings,o2);assert.equal(E.validate(list,o2,cat2),null);const stats=E.evaluate(list,o2);stats.equivalent=E.equivalent(stats,o2);return {cat:cat2,c:{list,stats,options:o2,oldCount:1}};}
 const stats=E.evaluate(list,o);stats.equivalent=E.equivalent(stats,o);
 return {cat,c:{list,stats,options:o,oldCount:1}};
}
test('raw happiness retains surplus while production stays capped at 200%',()=>{const {c}=fixture(),b=c.list.find(b=>b.id==='stoneMason'),d=c.stats.details.find(d=>d.id===b.uid);assert.ok(d.raw>4000);assert.equal(d.happy,2000);assert.equal(d.excess,d.raw-2000);assert.equal(E.hourly(b,d.raw,b.rewards[0].resource),E.hourly(b,d.happy,b.rewards[0].resource));});
test('refinement can exchange distant workshops to use surplus beyond the old workshop cap',()=>{const {c,cat}=fixture(true),n=E.refineHappiness(c,cat,Date.now()+900);assert.equal(E.validate(n.list,n.options,cat),null);assert.ok(n.stats.byType.jeweler>c.stats.byType.jeweler);assert.ok(n.stats.equivalent.total>c.stats.equivalent.total);assert.equal(n.list.find(b=>b.id==='jeweler').x,4);});
test('manual editor swaps occupied equal footprints and rejects collisions without mutation',()=>{const {c,cat}=fixture(),m=c.list.find(b=>b.id==='stoneMason'),j=c.list.find(b=>b.id==='jeweler'),original=JSON.stringify(c);const n=E.editLayout(c,cat,{type:'move',uid:m.uid,x:j.x,y:j.y});assert.equal(n.list.find(b=>b.uid===m.uid).x,j.x);assert.equal(n.list.find(b=>b.uid===j.uid).x,m.x);assert.equal(E.validate(n.list,c.options,cat),null);assert.equal(JSON.stringify(c),original);assert.throws(()=>E.editLayout(c,cat,{type:'move',uid:m.uid,x:8,y:4}),/zajęte/);assert.throws(()=>E.editLayout(c,cat,{type:'move',uid:m.uid,x:39,y:31}),/teren/);assert.throws(()=>E.editLayout(c,cat,{type:'move',uid:m.uid,x:1.5,y:0}),/teren/);assert.equal(JSON.stringify(c),original);});
test('parking removes contributions, prevents incomplete saves, supports placing and rotating',()=>{const {c,cat}=fixture(),m=c.list.find(b=>b.id==='stoneMason');let n=E.editLayout(c,cat,{type:'park',uid:m.uid});assert.equal(n.parked.length,1);assert.equal(n.stats.oldGoods,0);assert.throws(()=>E.projectFile(n.options,n),/odłożone/);n=E.editLayout(n,cat,{type:'move',uid:m.uid,x:12,y:8});n=E.editLayout(n,cat,{type:'rotate',uid:m.uid});assert.equal(n.parked.length,0);const b=n.list.find(b=>b.uid===m.uid);assert.equal(b.w,m.h);assert.equal(b.h,m.w);assert.equal(n.list.length,c.list.length);assert.equal(E.validate(n.list,c.options,cat),null);});
test('manual save roundtrip keeps actual map and production, reports unmet goals without weakening inventory checks',()=>{const {c,cat}=fixture();c.options={...c.options,fullArmy:true};const m=c.list.find(b=>b.id==='stoneMason'),n=E.editLayout(c,cat,{type:'move',uid:m.uid,x:12,y:8}),file=E.projectFile(n.options,n);assert.equal(file.manual,true);const loaded=E.readProject(HOH_DATA.buildings,file).result.choices[0];assert.equal(loaded.manual,true);assert.equal(loaded.stats.equivalent.total,n.stats.equivalent.total);assert.equal(loaded.options.fullArmy,true);assert.ok(loaded.stats.army<1);assert.throws(()=>E.readProject(HOH_DATA.buildings,{...file,manual:false}),/Koszary/);const missing={...file,layout:file.layout.filter(b=>b.id!=='cityHall')};assert.throws(()=>E.readProject(HOH_DATA.buildings,missing),/wymaganego/);});
test('an off-map building can rotate before being placed into a differently shaped gap',()=>{const {c,cat}=fixture(),m=c.list.find(b=>b.id==='stoneMason');const p=E.editLayout(c,cat,{type:'park',uid:m.uid}),r=E.editLayout(p,cat,{type:'rotate',uid:m.uid});assert.equal(r.parked[0].w,m.h);assert.equal(r.parked[0].h,m.w);assert.deepEqual(r.stats,p.stats);assert.equal(r.list.length,p.list.length);const placed=E.editLayout(r,cat,{type:'move',uid:m.uid,x:12,y:8});assert.equal(E.validate(placed.list,c.options,cat),null);});


test('browser parking releases selection and swaps furnace with four parked homes',async()=>{
 const {chromium}=await import('playwright');const {resolve}=await import('node:path');const {pathToFileURL}=await import('node:url');
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(pathToFileURL(resolve('Furia-generator.html')).href);await p.locator('#projectInput').setInputFiles('references/zenmar-optimized.json');await p.waitForFunction(()=>!!result);
 const initial=await p.evaluate(()=>{const c=result.choices[chosen],homes=c.list.filter(b=>b.id==='smallHome');for(const a of homes){const block=[[0,0],[2,0],[0,2],[2,2]].map(([dx,dy])=>homes.find(b=>b.x===a.x+dx&&b.y===a.y+dy));if(block.every(Boolean))return {furnace:c.list.find(b=>b.id==='furnace'),homes:block,count:c.list.length,geometry:c.list.map(b=>[b.id,b.x,b.y,b.w,b.h].join(',')).sort()};}throw Error('No 4x4 housing block in fixture');});
 await p.locator('#editBuildings').click();
 const parked=()=>p.locator('#parkedBuildings button').count();
 async function selectOnMap(b){await p.locator(`#map [data-uid="${b.uid}"]`).click();assert.match(await p.locator('#editSelected').textContent(),new RegExp(b.name));assert.equal(await p.locator('#parkBuilding').isEnabled(),true);}
 async function park(b){await selectOnMap(b);await p.locator('#parkBuilding').click();assert.equal(await p.locator('#map .placement-preview').count(),0);assert.equal(await p.locator('#parkedBuildings [aria-pressed=true]').count(),0);}
 async function point(b){await p.locator('#map').scrollIntoViewIfNeeded();return p.evaluate(b=>{const svg=document.querySelector('#map svg'),pt=new DOMPoint((b.x+.2)*22,(b.y+.2)*22).matrixTransform(svg.getScreenCTM());return {x:pt.x,y:pt.y};},b);}
 // Exact reported sequence: park furnace, then select and park several houses.
 await park(initial.furnace);assert.equal(await parked(),1);
 // Even when intentionally holding the furnace, an occupied cell selects its building.
 await p.locator(`#parkedBuildings [data-uid="${initial.furnace.uid}"]`).click();await selectOnMap(initial.homes[0]);await p.locator('#parkBuilding').click();assert.equal(await parked(),2);
 await p.locator(`#parkedBuildings [data-uid="${initial.furnace.uid}"]`).click();let blocked=await point(initial.homes[0]);await p.mouse.click(blocked.x,blocked.y);assert.equal(await parked(),2);assert.match(await p.locator('#editStatus').textContent(),/zajęte/);
 for(const h of initial.homes.slice(1))await park(h);assert.equal(await parked(),5);assert.equal(await p.locator('#applyEdit').isDisabled(),true);
 // Holding a parked item is cancellable and does not remove it from inventory.
 await p.locator('#parkedBuildings button').first().click();await p.keyboard.press('Escape');assert.equal(await parked(),5);assert.equal(await p.locator('#parkedBuildings [aria-pressed=true]').count(),0);
 // Dropping a tray item back outside the map, or cancelling its drag, must not re-arm it via a synthetic click.
 for(const cancel of [false,true]){const button=p.locator('#parkedBuildings button').first();await button.scrollIntoViewIfNeeded();const r=await button.boundingBox();await p.mouse.move(r.x+10,r.y+10);await p.mouse.down();await p.mouse.move(r.x+80,r.y+25,{steps:5});if(cancel)await p.keyboard.press('Escape');await p.mouse.up();assert.equal(await parked(),5);assert.equal(await p.locator('#parkedBuildings [aria-pressed=true]').count(),0);}
 // Place furnace in the housing block, and all four homes in its old footprint.
 await p.locator(`#parkedBuildings [data-uid="${initial.furnace.uid}"]`).click();let pos=await point(initial.homes[0]);await p.mouse.click(pos.x,pos.y);assert.equal(await parked(),4);
 for(let i=0;i<4;i++){const h=initial.homes[i];await p.locator(`#parkedBuildings [data-uid="${h.uid}"]`).click();pos=await point({x:initial.furnace.x+i%2*2,y:initial.furnace.y+Math.floor(i/2)*2});await p.mouse.click(pos.x,pos.y);}
 assert.equal(await parked(),0);await p.locator('#undoEdit').click();assert.equal(await parked(),1);await p.locator('#redoEdit').click();assert.equal(await parked(),0);
 await p.locator('#applyEdit').click();assert.equal(await p.locator('#editor').isHidden(),true);await p.reload();await p.waitForFunction(()=>!!result);
 const final=await p.evaluate(()=>{const c=result.choices[0];return {count:c.list.length,furnace:c.list.find(b=>b.id==='furnace'),error:E.validate(c.list,E.manualOptions(c.options),result.cat)};});
 assert.equal(final.count,initial.count);assert.equal(final.error,null);assert.equal(final.furnace.x,initial.homes[0].x);assert.equal(final.furnace.y,initial.homes[0].y);
 // Repeat selection and cancellation at a mobile viewport, retaining every item.
 await p.setViewportSize({width:390,height:844});await p.locator('#editBuildings').click();const h=await p.evaluate(()=>result.choices[0].list.find(b=>b.id==='smallHome'));await park(h);await p.locator('#cancelEdit').click();assert.equal(await p.evaluate(()=>result.choices[0].list.length),initial.count);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({parkedFive:true,selectWhileHolding:true,escape:true,exchangedFurnaceWithFourHomes:true,undoRedo:true,reload:true,mobileCancel:true,errors}));
}finally{await browser.close();}});

test('browser selects eras and fountain levels, preserves legacy saves and computes with real workers',async()=>{
 const {chromium}=await import('playwright'),{resolve}=await import('node:path'),{pathToFileURL}=await import('node:url');
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:1300,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(pathToFileURL(resolve('Furia-generator.html')).href);assert.equal(await p.locator('#era option').count(),14);
 await p.locator('#fountainLevel').selectOption('32');assert.match(await p.locator('#fountainStats').textContent(),/1\s?980/);
 await p.locator('#era').selectOption('late-gothic');assert.match(await p.locator('#fountainStats').textContent(),/2\s?150/);
 await p.locator('#fountainLevel').selectOption('50');assert.match(await p.locator('#fountainStats').textContent(),/zasięg 6/);
 await p.locator('#era').selectOption('bronze-age');assert.equal(await p.locator('[name=artisanCount]').count(),1);assert.equal(await p.locator('[name=jewelerCount]').count(),0);assert.equal(await p.locator('[name=goldCap]').inputValue(),'0');assert.equal(await p.locator('#towerLevel').isDisabled(),true);
 await p.locator('#era').selectOption('stone-age');assert.equal(await p.locator('#workshopFields input').count(),0);assert.doesNotMatch(await p.locator('#requiredBuildings').textContent(),/Piec|oblężniczych/);
 await p.locator('#era').selectOption('byzantine');assert.equal(await p.locator('[name=scribeCount]').count(),1);assert.equal(await p.locator('[name=fuelSuggested]').isEnabled(),true);assert.ok(Number(await p.locator('[name=fuelCount]').getAttribute('max'))>0,'the furnace slider has a range');assert.equal(await p.locator('#towerLevel').isDisabled(),false);assert.equal(await p.locator('[name=goldCap]').inputValue(),'8400000');
 // A legacy map keeps its original fountain in local storage and in the editor.
 await p.locator('#projectInput').setInputFiles('references/zenmar-optimized.json');await p.waitForFunction(()=>!!result);
 const legacy=await p.evaluate(()=>result.choices[0].list.find(b=>b.id==='fountain').points);await p.reload();await p.waitForFunction(()=>!!result);assert.equal(await p.evaluate(()=>result.choices[0].list.find(b=>b.id==='fountain').points),legacy);
 // Actual portfolio workers receive the selected era and catalogue fountain.
 await p.locator('#era').selectOption('late-gothic');await p.locator('#allLand').click();await p.locator('[name=fullArmy]').uncheck();await p.locator('#towerLevel').selectOption('3');await p.locator('[name=fuelSuggested]').uncheck();await p.locator('[name=fuelCount]').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});await p.locator('[name=searchSeconds]').selectOption('30');await p.locator('#generate').click();
 // An early checkpoint can still have no farms, and either farm type is valid.
 await p.waitForFunction(()=>result?.choices?.[0]?.list.some(b=>b.kind==='farm'),{},{timeout:45000});if(await p.locator('#cancel').isVisible())await p.locator('#cancel').click();await p.waitForFunction(()=>!worker);
 const output=await p.evaluate(()=>{const c=result.choices[0],farm=c.list.find(b=>b.kind==='farm');return {era:c.options.era,farm:farm?.level,expectedFarm:E.eraInfo(c.options).buildings.find(b=>b.id===farm?.id)?.level,fountain:c.list.find(b=>b.id==='fountain'),tower:c.list.find(b=>b.id==='collectableMinoanWatchtowerV2')?.level,error:E.validate(c.list,c.options,result.cat)};});assert.equal(output.era,'late-gothic');assert.ok(output.farm>0);assert.equal(output.farm,output.expectedFarm);assert.equal(output.fountain.points,2150);assert.equal(output.tower,3);assert.equal(output.error,null);
 await p.reload();await p.waitForFunction(()=>!!result);assert.equal(await p.locator('#era').inputValue(),'late-gothic');assert.equal(await p.locator('#fountainLevel').inputValue(),'32');assert.equal(await p.locator('#towerLevel').inputValue(),'3');
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'qa/eras-v816-mobile.png'});assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
