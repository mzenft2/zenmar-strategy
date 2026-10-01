import test from 'node:test';
import assert from 'node:assert/strict';
import '../data.js';import '../engine.js';import '../city-summary.js';import '../translations.js';
const E=HOH_ENGINE,S=HOH_CITY_SUMMARY;
function fixture(subscription=false){const options=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,subscription,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,sparkCap:7000,goodsPerBatch:70,sparksPerBatch:95,goldCap:8400000,goldPerBatch:84000,goldSparksPerBatch:170,foodPerGood:181,foodPerSpark:133.368421,fullArmy:false}),cat=E.prepare(HOH_DATA.buildings,options);
 const list=[{...cat.ruralFarm,x:4,y:4,uid:1},{...cat.smallHome,x:8,y:4,uid:2},{...cat.furnace,x:4,y:8,uid:3},{...cat.moderateCulture,x:7,y:7,points:100000,uid:4}];return {options,list};}
test('summary reconciles daily collection, nominal production, area and happiness without counting furnace as a recipient',()=>{
 const c=fixture(),r=S.calculate(c),farm=c.list[0],s=E.evaluate(c.list,c.options),food=r.production.find(p=>p.id==='food');
 assert.equal(food.collected,s.food);assert.equal(food.nominal,s.food24);assert.equal(food.hourly,E.hourly(farm,farm.happyMax,'food'));assert.equal(food.storage,food.hourly*3);assert.ok(food.collected<food.nominal);
 assert.equal(Object.values(r.area).reduce((a,b)=>a+b,0)+r.free,r.land);assert.equal(r.buildings.reduce((n,b)=>n+b.area,0),r.used);assert.equal(r.sourcePoints,100000);assert.equal(r.required,farm.happyMax+c.list[1].happyMax);assert.equal(r.missing,0);assert.equal(r.excess,(100000-farm.happyMax)+(100000-c.list[1].happyMax));assert.equal(r.available,s.available);assert.equal(r.needed,s.needed);
});
test('subscription changes storage and real collection, never hourly or nominal rates',()=>{
 const a=S.calculate(fixture()).production.find(p=>p.id==='food'),b=S.calculate(fixture(true)).production.find(p=>p.id==='food');assert.equal(b.storage,a.storage*2);assert.equal(b.hourly,a.hourly);assert.equal(b.nominal,a.nominal);assert.ok(b.collected>a.collected);
});
test('parking removes all contributions and zero source utilization is not infinity',()=>{
 const c=fixture(),full=S.calculate(c);c.parked=[c.list.pop()];const r=S.calculate(c);assert.equal(r.parked,1);assert.equal(r.sourcePoints,0);assert.equal(r.sourceTiles,0);assert.equal(r.utilization,null);assert.equal(r.consumed,0);assert.equal(r.excess,0);assert.equal(r.missing,r.required);assert.ok(r.food<full.food);assert.ok(r.free>full.free);
});
test('summary uses the shared dictionary with complete labels in all eight languages',()=>{assert.equal(S.labels.length,48);for(const key of S.labels){const row=ZENMAR_TRANSLATIONS.find(r=>r[0]===key);assert.ok(row,key);assert.equal(row.length,8);assert.ok(row.every(v=>typeof v==='string'&&v.length));}});
test('passive furnace production stays separate from sparks obtained by converting goods or gold',()=>{const c=fixture(),r=S.calculate(c),f=r.production.find(p=>p.id==='furnace');assert.equal(f.hourly,125);assert.equal(f.nominal,3000);assert.equal(f.collected,3000);assert.equal(r.goodsSparks,0);assert.equal(r.totalSparks,r.goodsSparks+r.goldSparks);});
