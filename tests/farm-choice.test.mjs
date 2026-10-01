import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const options=over=>E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,foodPerGood:181,foodPerSpark:133.368421,goldPerBatch:84000,goldSparksPerBatch:170,goldCap:8400000,searchStarts:3,searchSeconds:30,engineMode:'frontiers',enforceLayout:true,...over});
const cat=E.prepare(HOH_DATA.buildings,options({}));

test('the preferred farm follows the collection rhythm: hourly collection favours the rural farm, a night break the domestic one',()=>{
 assert.equal(E.preferredFarm(cat,options({interval:1,night:1})),'ruralFarm');
 assert.equal(E.preferredFarm(cat,options({interval:3,night:8})),'domesticFarm');
 assert.equal(E.preferredFarm(cat,options({interval:1,night:8})),'domesticFarm','the 3-hour store of the rural farm overflows at night');
 const per=E.farmPerCell(cat,options({interval:1,night:1}));
 assert.ok(per.ruralFarm.daily>per.domesticFarm.daily);assert.ok(per.ruralFarm.workers<per.domesticFarm.workers);assert.ok(per.ruralFarm.culture>per.domesticFarm.culture);
 assert.equal(per.ruralFarm.collected,24);assert.equal(per.domesticFarm.collected,24);
});

test('constructions start from the preferred kind unless the player owns farms of the other kind',()=>{
 const o=options({interval:3,night:8});
 const c=E.searchFrontiers(cat,o,0,1,Date.now()+20000);
 assert.ok(c);const n=E.farmCounts(c.list);
 assert.ok(n.domesticFarm>n.ruralFarm,'seed 1 with a night break builds domestic farms: '+JSON.stringify(n));
 const owned=options({interval:3,night:8,ownedFarms:{ruralFarm:15,domesticFarm:0}});
 const c2=E.searchFrontiers(cat,owned,0,1,Date.now()+20000);
 assert.ok(c2);const n2=E.farmCounts(c2.list);
 assert.ok(n2.ruralFarm>n2.domesticFarm,'owned rural farms win over the rhythm: '+JSON.stringify(n2));
});
