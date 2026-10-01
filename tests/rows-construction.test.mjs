import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
// Marek, 20.09.2026 ("wdróż"): the 8.53 row rule (farms across the row) applies where cities are built and rebuilt, not
// only in the ranking. Before 8.54 every odd seed of the row constructors and every second sixteen of the edge constructor
// built rows of farms lying along, which the ranking then discarded (probe of 19.09.2026 with owned rural farms: 8 of 16 each).
const era=E.eraInfo({era:'early-gothic'}),fl=era.fountainLevels.find(p=>p.level===32);
const base=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:7000,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:1},optional:['collectableMinoanWatchtowerV2'],towerLevel:3,fountain:true,fountainMode:'catalog',fountainLevel:fl.level,fullArmy:true,workshopCounts:{jeweler:2,glassblower:2,alchemist:2},oldCount:6,compareSparks:false,subscription:false,ownedFarms:{ruralFarm:24,domesticFarm:0}}),cat=E.prepare(HOH_DATA.buildings,base);
test('row and edge constructions stand their farms across the row for the seeds that used to lay them along',()=>{
 for(const [mode,seed] of [['rows-horizontal',1],['rows-horizontal',3],['rows-vertical',1],['edge-bands',17]]){
  const o={...base,engineMode:mode,enforceLayout:true,requireFuel:false};
  const c=mode==='edge-bands'?E.searchEdgeBands(cat,o,6,seed,Date.now()+6000):E.searchFrontiers(cat,o,6,seed,Date.now()+6000);
  assert.ok(c,mode+' seed '+seed+' builds a city');
  const q=E.layoutQuality(c.list,o);
  assert.ok(E.rowCompliant(q),mode+' seed '+seed+': '+q.loose+' loose of '+q.producers);
 }
});
test('district fragments stand their producers across the row in every variant; the turns give the columns',()=>{
 for(let index=0;index<16;index++){const f=E.fragmentSeed(cat,[],index);const producers=f.list.filter(b=>b.kind==='farm'||b.kind==='workshop');assert.ok(producers.length>=4);for(const b of producers)assert.ok(index<8?b.h>=b.w:b.w>=b.h,'fragment '+index);}
});
test('a farm joins a row only with its long side across it; a workshop in either orientation',()=>{
 const tall=(x,y)=>({...cat.ruralFarm,x,y,w:3,h:4}),wide=(x,y)=>({...cat.ruralFarm,x,y,w:4,h:3});
 assert.ok(E.joinsRowAcross(tall(3,0),[tall(0,0)]));
 assert.ok(!E.joinsRowAcross(wide(3,0),[tall(0,0)]),'a farm lying along does not join');
 assert.ok(!E.joinsRowAcross(tall(4,0),[wide(0,0)]),'a farm cannot join a lying farm');
 assert.ok(E.joinsRowAcross(wide(0,3),[wide(0,0)]),'a column of wide farms');
 assert.ok(!E.joinsRowAcross({...cat.jeweler,x:3,y:0,w:4,h:3},[tall(0,0)]),'a workshop lying does not join (Marek, 20.09.2026)');assert.ok(E.joinsRowAcross({...cat.jeweler,x:3,y:0,w:3,h:4},[tall(0,0)]),'a standing workshop joins');
 assert.ok(!E.joinsRowAcross(tall(3,5),[tall(0,0)]),'no contact, no row');
});
test('precomputed geometry gives the ranking the same verdict, and the reach shortfall matches the per-source report',()=>{
 const list=[0,1,2,3].map(i=>({...cat.ruralFarm,x:i*3,y:0,w:3,h:4,uid:i+1})).concat({...cat.moderateCulture,x:2,y:4,uid:9},{...cat.smallHome,x:0,y:4,uid:10}),other=list.map(b=>b.uid===9?{...b,x:6}:b);
 const choice=l=>{const s=E.evaluate(l,base);s.equivalent={total:100};return {list:l,stats:s};},a=choice(list),b=choice(other);
 assert.equal(E.betterLayout(a,b,base),E.betterLayout(a,b,base,E.layoutQuality(a.list,base),E.layoutQuality(b.list,base)));
 assert.equal(E.reachShortfall(list),E.sourceReach(list).reduce((n,r)=>n+Math.max(0,r.target-r.recipients),0));
 const memo=E.qualityMemo(base),q1=memo(list),q2=memo(list),q3=memo(other);assert.equal(q1,q2);assert.notEqual(q1,q3);assert.equal(q3.free,E.layoutQuality(other,base).free);
});
