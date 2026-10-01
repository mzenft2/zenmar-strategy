import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const base=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:1},optional:[],fullArmy:false,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,foodPerGood:181,foodPerSpark:133.368421,goldPerBatch:84000,goldSparksPerBatch:170,goldCap:8400000,searchStarts:3,searchSeconds:30});
const cat=E.prepare(HOH_DATA.buildings,base);
const at=(id,x,y,uid)=>({...cat[id],x,y,uid});
// Eight small homes around a 3x2 premium source: three above, three below, one on each side.
const ring=[[8,8],[10,8],[12,8],[8,12],[10,12],[12,12],[8,10],[13,10]].map(([x,y],i)=>at('smallHome',x,y,i+1));

test('every source knows its recipients and its target; premium 7, square 8, strip 3, the 1x1 none',()=>{
 assert.deepEqual(E.REACH_TARGET,{premiumCulture:7,moderateCulture:8,compactCulture:3});
 const r=E.sourceReach([...ring,at('premiumCulture',10,10,9)]);
 assert.equal(r.length,1);assert.equal(r[0].recipients,8);assert.equal(r[0].homes,8);assert.equal(r[0].hungry,8);assert.equal(r[0].target,7);
 const far=E.sourceReach([...ring,at('premiumCulture',30,25,9)]);
 assert.equal(far[0].recipients,0);
 assert.equal(E.reachShortfall([...ring,at('premiumCulture',10,10,9)]),0);
 assert.equal(E.reachShortfall([...ring,at('premiumCulture',30,25,9)]),7);
 assert.equal(E.sourceReach([at('littleCulture',0,0,1)])[0].target,0);
 assert.equal(E.sourceReach([at('fountain',0,0,1)]).length,0,'no fountain in the catalogue without the option');
});

test('the reach marks decide only at equal output; production goes first (Marek, 20.09.2026)',()=>{
 const stats=total=>({equivalent:{total},armyDeficit:0,excess:0,fountainBuildings:0});
 const A={list:[...ring,at('premiumCulture',10,10,9)],stats:stats(100),options:base};
 const B={list:[...ring,at('premiumCulture',30,25,9)],stats:stats(100.3),options:base};
 assert.equal(E.layoutQuality(A.list,base).free,E.layoutQuality(B.list,base).free);
 assert.equal(E.layoutQuality(A.list,base).cost+70,E.layoutQuality(B.list,base).cost);
 // Marek, 20.09.2026: "the better city always wins" — the reach marks break only exact ties.
 assert.equal(E.rankChoices(A,B),1,'a richer city wins even with seven missing recipients');
 assert.equal(E.rankChoices(A,{...B,stats:stats(100)}),-1,'at equal output the source that touches its targets wins');
 assert.equal(E.rankChoices(A,{...B,stats:stats(101)}),1,'a real output gain still wins');
});
