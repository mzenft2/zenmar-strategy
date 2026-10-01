import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const base=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:true,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,foodPerGood:181,foodPerSpark:133.368421,goldPerBatch:84000,goldSparksPerBatch:170,goldCap:8400000,searchStarts:3,searchSeconds:30});
const cat=E.prepare(HOH_DATA.buildings,base);
function city(fractions){const c=structuredClone(cat),list=[];c.cityHall.workers=100;const add=(id,x,y)=>list.push({...c[id],x,y,uid:list.length+1});add('cityHall',0,25);add('furnace',6,25);
 E.mandatory.filter(id=>id.endsWith('Barracks')).forEach((id,i)=>{add(id,i*7,10);const source='testSource'+i;c[source]={...c.littleCulture,id:source,points:c[id].happyMax*(fractions[id]??1),range:1};add(source,i*7,9);});return {c,list};}

test('each barracks keeps its own minimum happiness and the legacy siege exception still loads',()=>{
 const inf=cat.infantryBarracks,siege=cat.siegeBarracks;
 assert.equal(E.armyMinimum('infantryBarracks',base),100);assert.equal(E.armyMinimum('siegeBarracks',{...base,siegeMin:91}),91);
 assert.equal(E.armyNeed(inf,{...base,armyMin:{infantryBarracks:60}}),inf.happyMax*.6);
 assert.equal(E.armyNeed(siege,{...base,armyMin:{infantryBarracks:60}}),siege.happyMax);
 assert.equal(E.armyNeed(siege,{...base,siegeMin:91,armyMin:{siegeBarracks:80}}),siege.happyMax*.8);
 const {c,list}=city({infantryBarracks:.7,cavalryBarracks:.85});
 assert.match(E.validate(list,base,c),/Koszary/);
 assert.equal(E.validate(list,{...base,armyMin:{infantryBarracks:70,cavalryBarracks:85}},c),null);
 assert.match(E.validate(list,{...base,armyMin:{infantryBarracks:71,cavalryBarracks:85}},c),/Koszary/);
 assert.match(E.validate(list,{...base,armyMin:{infantryBarracks:70,cavalryBarracks:86}},c),/Koszary/);
 assert.equal(E.validate(list,{...base,fullArmy:false},c),null);
 E.validateOptions({...base,armyMin:{infantryBarracks:0,siegeBarracks:100}});
 assert.throws(()=>E.validateOptions({...base,armyMin:{infantryBarracks:101}}),/od 0% do 100%/);
 assert.throws(()=>E.validateOptions({...base,armyMin:{jeweler:50}}),/od 0% do 100%/);
 assert.throws(()=>E.validateOptions({...base,armyMin:{infantryBarracks:50.5}}),/od 0% do 100%/);
 assert.throws(()=>E.validateOptions({...base,ownedFarms:{ruralFarm:81}}),/od 0 do 80/);
 assert.throws(()=>E.validateOptions({...base,ownedFarms:{premiumFarm:1}}),/od 0 do 80/);
 E.validateOptions({...base,ownedFarms:{ruralFarm:25,domesticFarm:0}});
});

test('owned farms are reused first: only conversions count; since 8.58 the ranking ignores rebuilds and validity keeps 80%',()=>{
 const o={...base,fullArmy:false,ownedFarms:{ruralFarm:10,domesticFarm:0}};
 const mk=ids=>ids.map((id,i)=>({...cat[id],x:(i%8)*4,y:Math.floor(i/8)*4,uid:i+1}));
 assert.equal(E.farmRebuild(mk(Array(10).fill('ruralFarm')),o),0);
 assert.equal(E.farmRebuild(mk(Array(8).fill('ruralFarm')),o),0,'fewer farms is demolition, not a rebuild');
 assert.equal(E.farmRebuild(mk([...Array(7).fill('ruralFarm'),...Array(3).fill('domesticFarm')]),o),3);
 assert.equal(E.farmRebuild(mk([...Array(10).fill('ruralFarm'),'domesticFarm']),o),0,'an extra farm beyond the owned ones is a new build');
 assert.equal(E.farmRebuild(mk(Array(10).fill('domesticFarm')),base),0,'no owned farms, no preference');
 assert.equal(E.farmQuota(o,mk(Array(3).fill('ruralFarm'))),'ruralFarm');assert.equal(E.farmQuota(o,mk(Array(10).fill('ruralFarm'))),null);assert.equal(E.farmQuota(base,[]),null);
 assert.equal(E.farmQuota({...o,ownedFarms:{ruralFarm:2,domesticFarm:5}},mk(['ruralFarm','ruralFarm'])),'domesticFarm');
 assert.equal(E.primaryFarm({...o,ownedFarms:{ruralFarm:2,domesticFarm:5}}),'domesticFarm');assert.equal(E.primaryFarm(base),null);assert.equal(E.primaryFarm({...o,ownedFarms:{ruralFarm:0,domesticFarm:0}}),null);
 // Same used area: A keeps two owned rural farms, B converts both into domestic farms.
 const stats=total=>({equivalent:{total},armyDeficit:0,excess:0,fountainBuildings:0});
 const A={list:[{...cat.ruralFarm,x:0,y:0,uid:1},{...cat.ruralFarm,x:4,y:0,uid:2},{...cat.smallHome,x:0,y:3,uid:3},{...cat.smallHome,x:2,y:3,uid:4}],stats:stats(100),options:o};
 const B=total=>({list:[{...cat.domesticFarm,x:0,y:0,uid:1},{...cat.domesticFarm,x:4,y:0,uid:2}],stats:stats(total),options:o});
 assert.equal(E.layoutQuality(A.list,o).free,E.layoutQuality(B(100).list,o).free);
 // Marek, 20.09.2026: "the better city always wins" — rebuilds no longer weigh in the ranking; the owned farms are
 // protected by validity instead (at least OWNED_SHARE of every declared kind).
 assert.equal(E.rankChoices(A,B(100.9)),1,'the richer city wins whatever it rebuilds');
 assert.equal(E.rankChoices(B(99),A),1,'and the poorer one loses');
 assert.equal(E.OWNED_SHARE,.8);
});

test('constructors start from the owned farm kind',()=>{
 for(const [owned,seed] of [[{ruralFarm:0,domesticFarm:10},1],[{ruralFarm:12,domesticFarm:0},3]]){
  const o=E.normalized({...base,fullArmy:false,engineMode:'frontiers',enforceLayout:true,ownedFarms:owned});
  const c=E.searchFrontiers(cat,o,0,seed,Date.now()+20000);
  assert.ok(c,'city for '+JSON.stringify(owned));
  const n=E.farmCounts(c.list),want=E.primaryFarm(o),other=want==='ruralFarm'?'domesticFarm':'ruralFarm';
  assert.ok(n[want]>n[other],JSON.stringify(n));
 }
});
