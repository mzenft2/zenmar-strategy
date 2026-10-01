import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
// 8.50: slideChain returns {removed, placed, vacated}; two callers treated it as a building list and threw
// "list is not iterable" whenever a slide succeeded — on sparse maps that killed the sector sweep and the polishing thread.
function sparse(){
 const base={era:'early-gothic',interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:1,glassblower:0,alchemist:0},oldCount:1,compareSparks:false,goldSparksPerBatch:0};
 const o0=E.normalized({...base,tiles:Array(80).fill(true)}),cat0=E.prepare(HOH_DATA.buildings,o0),list=[];
 const add=(id,x,y)=>list.push({...cat0[id],x,y,uid:list.length+1});
 for(const [id,x,y] of [['cityHall',25,14],['furnace',30,14],['infantryBarracks',0,20],['rangedBarracks',5,20],['cavalryBarracks',11,20],['heavyInfantryBarracks',17,20],['siegeBarracks',23,20],['stoneMason',4,4],['jeweler',20,4],['moderateCulture',8,2],['moderateCulture',8,4],['moderateCulture',8,6],['moderateCulture',24,4]])add(id,x,y);
 for(let x=0;x<16;x+=2)add('smallHome',x,28);
 const tiles=Array(80).fill(false);for(const b of list)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)tiles[Math.floor(y/4)*10+Math.floor(x/4)]=true;
 const o=E.normalized({...base,tiles}),cat=E.prepare(HOH_DATA.buildings,o);assert.equal(E.validate(list,o,cat),null);
 const stats=E.evaluate(list,o);stats.equivalent=E.equivalent(stats,o);return {cat,o,c:{list,stats,options:o,oldCount:1}};
}
test('a successful slide inside the sector sweep yields a valid layout instead of throwing',()=>{
 const {c,cat,o}=sparse(),n=E.refineHappiness(c,cat,Date.now()+1200);
 assert.ok(Array.isArray(n.list));assert.equal(E.validate(n.list,o,cat),null);assert.ok(n.stats.equivalent.total>=c.stats.equivalent.total);
});
test('polishing with slide kicks keeps a building list',()=>{
 const {c,cat,o}=sparse();for(const seed of [1,2,3]){const n=E.polishLayout(c,cat,o,seed,Date.now()+700);assert.ok(Array.isArray(n.list),'seed '+seed);assert.equal(E.validate(n.list,o,cat),null,'seed '+seed);}
});
