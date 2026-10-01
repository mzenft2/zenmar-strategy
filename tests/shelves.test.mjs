import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';import '../patterns.js';
const E=HOH_ENGINE,patterns=globalThis.HOH_PATTERNS||[];
// Marek, 20.09.2026 ("nadal silnikowi brakuje logicznych działań, woli bazować niż proponować idealnie wyliczone układy",
// then "działaj"): the shelf planner computes the skeleton — production rows as tall as the farm's long side, two-cell
// channels of homes and culture, fixed blocks where rows lose the least — instead of finding it by trial.
const era=E.eraInfo({era:'early-gothic'}),fl=era.fountainLevels.find(p=>p.level===32);
const settings=tiles=>E.normalized({era:'early-gothic',tiles,interval:3,night:8,goodsTarget:0,sparkCap:7000,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:1},optional:['collectableMinoanWatchtowerV2'],towerLevel:3,fountain:true,fountainMode:'catalog',fountainLevel:fl.level,fullArmy:true,workshopCounts:{jeweler:2,glassblower:2,alchemist:2},oldCount:6,compareSparks:false,subscription:false,ownedFarms:{ruralFarm:24,domesticFarm:0},engineMode:'shelves',enforceLayout:true,requireFuel:false});
function check(o,seed){
 const cat=E.prepare(HOH_DATA.buildings,o),c=E.searchShelves(cat,o,6,seed,Date.now()+8000);
 assert.ok(c,'seed '+seed+' builds a city');
 assert.equal(E.validate(c.list,o,cat),null,'seed '+seed+' is valid');
 const q=E.layoutQuality(c.list,o);assert.ok(E.rowCompliant(q),'seed '+seed+': '+q.loose+' loose of '+q.producers);
 assert.equal(q.pairs.length,0,'no culture pairs');assert.equal(q.edges.length,0,'no culture on the edge');
 const {transposed,phi}=c.shelfOrigin,period=Math.max(cat.ruralFarm.w,cat.ruralFarm.h)+cat.smallHome.h;
 const farms=c.list.filter(b=>b.kind==='farm'&&!b.premium);
 assert.ok(farms.length>=12,'enough farms: '+farms.length);
 for(const b of farms){const v=transposed?b.x:b.y;assert.equal(((v-phi)%period+period)%period,0,'a farm starts its row band');assert.ok(transposed?b.w>=b.h:b.h>=b.w,'a farm stands across its row');}
 return c;
}
test('the planner builds a valid shelf city on the full board in both directions',()=>{const o=settings(Array(80).fill(true));const a=check(o,0),b=check(o,1);assert.ok(a.stats.equivalent.total>9e6&&b.stats.equivalent.total>9e6,'values '+Math.round(a.stats.equivalent.total)+' / '+Math.round(b.stats.equivalent.total));});
test('the planner copes with ragged land: rows shrink from their ends and the fixed blocks take the corners',()=>{const pat=patterns.find(p=>/zenmar/i.test(p.name||''));const o=settings(pat.tiles);const c=check(o,0);assert.ok(c.stats.equivalent.total>7e6,'value '+Math.round(c.stats.equivalent.total));});
test('the shelf concept runs through the compared search with a deadline and reports its origin',async()=>{const o={...settings(Array(80).fill(true)),workerBudgetMs:6000,startSeed:0,seedLayouts:[],patterns:[]};const r=await E.generate(HOH_DATA.buildings,o,()=>{});assert.ok(r.choices.length);const c=r.choices[0];assert.equal(c.engine,'shelves');assert.ok(c.title.includes('Plan półek'));assert.ok(c.shelfOrigin);assert.equal(E.validate(c.list,c.options,r.cat),null);});
