import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const base={era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:7000,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},subscription:false};

test('the furnace target in goods per day becomes an old-workshop count from the collection rhythm',()=>{
 const per=E.fuelPerWorkshop(base);assert.ok(per>0);
 assert.equal(E.fuelWorkshops(base,7000),6,'7000 goods a day at 3 h / 8 h needs six stone masons, one gives '+per);
 assert.equal(E.fuelWorkshops(base,0),0);
 assert.equal(E.fuelWorkshops(base,per*6),6,'an exact multiple does not round up');
 assert.equal(E.fuelWorkshops(base,per*6+1),7,'one good more needs another workshop');
 assert.equal(E.fuelWorkshops({...base,era:'early-rome'},7000),0,'no old workshop group before Byzantium');
 assert.ok(E.fuelPerWorkshop({...base,interval:1,night:1})>per,'more collections a day mean more goods from one workshop');
 assert.ok(E.fuelPerWorkshop({era:'early-gothic'})>0,'missing rhythm falls back to defaults instead of NaN');
});

test('normalized options derive oldCount from fuelGoods and validate the daily goods',()=>{
 assert.equal(E.normalized({...base,fuelGoods:7000}).oldCount,6);
 assert.equal(E.normalized({...base,fuelGoods:7000,oldCount:2}).oldCount,2,'an explicit count wins');
 E.validateOptions(E.normalized({...base,fuelGoods:7000}));
 assert.throws(()=>E.validateOptions(E.normalized({...base,fuelGoods:-1})));
 assert.throws(()=>E.validateOptions(E.normalized({...base,fuelGoods:'dużo'})));
});
