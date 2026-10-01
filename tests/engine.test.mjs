import test from 'node:test';import assert from 'node:assert/strict';
import '../data.js';import '../engine.js';
const E=globalThis.HOH_ENGINE,defs=globalThis.HOH_DATA.buildings;
const base={tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:240,sparkCap:7000,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:2,premiumHome:3,premiumCulture:2},optional:['collectableSchoolV2','collectableArchitectsStudioV2','heroAcademy','collectableMinoanWatchtowerV2'],towerLevel:10,fullArmy:true};
test('storage: daytime and overnight collection; longer store does not change hourly production',()=>{assert.equal(E.collectedHours(3,3,8),19);assert.equal(E.collectedHours(6,3,8),22);assert.equal(E.collectedHours(8,3,8),24);assert.equal(E.collectedHours(3,6,8),12);assert.equal(E.collectedHours(3,3,0),24);});
test('range includes diagonal cells, excludes touching boundary; sources sum and cap',()=>{const source={x:0,y:0,w:2,h:2,range:2,points:2050};assert.equal(E.reaches(source,{x:3,y:3,w:2,h:2}),true);assert.equal(E.reaches(source,{x:4,y:3,w:2,h:2}),false);const target={x:3,y:3,w:4,h:3,happyMax:5450};assert.equal(E.happiness(target,[source,{...source,points:4390}]),5450);});
test('farm starts at 100%; happiness never takes production over 200%',()=>{const b=defs.find(x=>x.id==='ruralFarm');assert.equal(b.level,39);assert.equal(b.w*b.h,12);assert.equal(E.hourly(b,0,'food'),17000/3);assert.equal(E.hourly(b,5450,'food'),34000/3);assert.equal(E.hourly(b,99999,'food'),E.hourly(b,5450,'food'));for(const def of defs)for(const r of def.rewards)assert.ok(E.hourly(def,1e9,r.resource)<=2*E.hourly(def,0,r.resource));});
test('tower uses selected level, source range, happiness and worker count',()=>{const low=E.prepare(defs,{...base,towerLevel:1}).collectableMinoanWatchtowerV2,high=E.prepare(defs,base).collectableMinoanWatchtowerV2;assert.deepEqual([low.level,low.points,low.range,low.workers],[1,350,3,1]);assert.deepEqual([high.level,high.points,high.range,high.workers],[10,1750,3,3]);assert.throws(()=>E.validateOptions({...base,towerLevel:0}),/Wieży/);});
test('surplus is shown, but cannot improve capped production',()=>{const b={...defs.find(x=>x.id==='ruralFarm'),uid:1,x:0,y:0};const source={...defs.find(x=>x.id==='moderateCulture'),x:4,y:0,points:11000};const s=E.evaluate([b,source],base);assert.equal(s.details[0].raw,11000);assert.equal(s.details[0].excess,5550);assert.equal(s.details[0].happy,5450);assert.ok(s.food24>s.food);});
test('invalid inputs cannot start optimization',()=>{assert.throws(()=>E.validateOptions({...base,night:NaN}));assert.throws(()=>E.validateOptions({...base,premium:{premiumFarm:1.5}}));assert.throws(()=>E.validateOptions({...base,fountain:true,fountainPoints:0,fountainRange:2}));});
test('empty land returns actionable failure',async()=>{await assert.rejects(E.generate(defs,{...base,tiles:Array(80).fill(false)}),/Nie znalazłem/);});
test('unknown eras cannot silently use Gothic statistics',()=>{assert.throws(()=>E.validateOptions({...base,era:'unknown-era'}),/epoka/);E.validateOptions({...base,era:'late-gothic'});assert.equal(E.prepare(defs,{...base,era:'late-gothic'}).ruralFarm.level,42);});

const city={...base,balanced:true,tiles:base.tiles.map((_,i)=>!(i<40&&i%10<3||i>=40&&i<50&&i%10<2)),goodsTarget:2800,premium:{premiumFarm:0,premiumHome:0,premiumCulture:1},optional:['collectableMinoanWatchtowerV2'],towerLevel:3,fullArmy:false,fountain:true,fountainLevel:32,fountainPoints:5000,fountainRange:3};

const opts=overrides=>E.normalized({...city,balanced:false,searchStarts:3,oldCount:0,compareSparks:false,workshopCounts:{jeweler:2,glassblower:2,alchemist:2},...overrides});
const cache=new Map();function run(o){const k=JSON.stringify(o);if(!cache.has(k))cache.set(k,E.generate(defs,o));return cache.get(k);}
test('reference land is solved without a city template; exact requirements and capped happiness',async()=>{
 const o=opts(),r=await run(o),c=r.choices[0];assert.equal(E.validate(c.list,c.options,r.cat),null);assert.equal(c.pattern,'search');assert.equal(c.oldCount,0);assert.ok(c.stats.spare>=0);assert.ok(c.stats.food>0);assert.ok(c.stats.fountainBuildings>=20);assert.ok(c.stats.fountainProducers>0);
 for(const id of E.current)assert.equal(c.list.filter(b=>b.id===id).length,2);
 assert.equal(c.list.filter(b=>b.id==='premiumCulture').length,1);assert.equal(c.list.filter(b=>b.id==='collectableMinoanWatchtowerV2').length,1);
 const bad=c.list.map(b=>({...b}));bad[0].x=-1;assert.match(E.validate(bad,c.options,r.cat),/poza/);
 assert.match(E.validate(c.list.filter(b=>b.kind!=='home'),c.options,r.cat),/pracowników/);
 for(const b of c.list)for(const resource of b.rewards)assert.ok(E.hourly(b,E.happiness(b,c.list),resource.resource)<=2*E.hourly(b,0,resource.resource));
});
test('workshop goals may differ, including 3 each, and old workshops are optional',async()=>{
 const o=opts({tiles:Array(80).fill(true),workshopCounts:{jeweler:3,glassblower:3,alchemist:3}}),r=await run(o),c=r.choices[0];assert.equal(E.validate(c.list,c.options,r.cat),null);for(const id of E.current)assert.equal(c.list.filter(b=>b.id===id).length,3);assert.equal(c.oldCount,0);
 const bad={...o,workshopCounts:{jeweler:3,glassblower:2,alchemist:3}};assert.match(E.validate(c.list,bad,r.cat),/warsztatów/);
});
test('optional furnace comparison preserves baseline and covers actual collections',async()=>{
 const o=opts({compareSparks:true}),r=await run(o);assert.equal(r.choices.length,2);assert.equal(r.choices[0].oldCount,0);const c=r.choices[1];assert.equal(c.oldCount,6);assert.ok(c.stats.oldGoods>=7000);assert.equal(E.validate(c.list,c.options,r.cat),null);
 const file=E.projectFile(o,c);assert.equal(file.options.oldCount,6);assert.equal(file.options.requireFuel,true);assert.equal(E.readProject(defs,file).result.choices[0].oldCount,6);
});
test('food equivalent values full exchange batches exactly once, with independent gold limit',()=>{
 const o=opts({foodPerGood:181,foodPerSpark:181*70/95}),s={food:1000,goods:8000,oldGoods:7031,sparks:9500,coins:168001},v=E.equivalent(s,o);
 assert.equal(v.spent,7000);assert.equal(v.retained,1000);assert.equal(v.goldSpent,168000);assert.equal(v.goldSparks,340);assert.ok(Math.abs(v.goods+v.sparks-8000*181)<.001);assert.equal(v.total,v.food+v.goods+v.sparks+v.gold);
 const noGold=E.equivalent(s,{...o,goldSparksPerBatch:0});assert.equal(noGold.gold,0);
});
test('comparison still checks furnace output when the chosen old-workshop count already matches',async()=>{
 const r=await run(opts({oldCount:6,compareSparks:true}));assert.equal(r.choices.length,2);assert.equal(r.choices[0].oldCount,6);assert.equal(r.choices[1].oldCount,6);assert.equal(r.choices[1].options.requireFuel,true);assert.ok(r.choices[1].stats.oldGoods>=7000);
});
test('mirrored and centre-cut maps use their actual masks, not fixed coordinates',async()=>{
 const mirror=city.tiles.map((_,i)=>city.tiles[Math.floor(i/10)*10+9-i%10]);const cut=Array(80).fill(true).map((_,i)=>![0,1,2,3,4,5,6,7,8,9,34,35,44].includes(i));
 for(const tiles of [mirror,cut]){const o=opts({tiles}),r=await run(o);assert.equal(E.validate(r.choices[0].list,r.choices[0].options,r.cat),null);assert.ok(r.choices[0].stats.used<=tiles.filter(Boolean).length*16);}
});
test('strict army is never silently relaxed',async()=>{const o=opts({fullArmy:true});try{const r=await run(o);for(const c of r.choices){assert.equal(E.validate(c.list,c.options,r.cat),null);assert.ok(c.stats.army>=.99999);}}catch(error){assert.match(error.message,/Nie znalazłem/);}});
test('save restores positions and recalculates data; tampered maps and rates are rejected',async()=>{
 const o=opts(),r=await run(o),file=E.projectFile(o,r.choices[0]),restored=E.readProject(defs,structuredClone(file));assert.deepEqual(E.projectFile(restored.options,restored.result.choices[0]).layout,file.layout);assert.equal(restored.result.choices[0].stats.food,r.choices[0].stats.food);assert.equal(restored.result.choices[0].stats.equivalent.total,r.choices[0].stats.equivalent.total);assert.equal(E.readProject(defs,E.projectFile(o)).result,null);
 const bad=structuredClone(file);bad.layout[0].x=-1;assert.throws(()=>E.readProject(defs,bad),/mapa/);
 const forged=structuredClone(file);forged.layout[0].rewards=[{resource:'food',amount:1e12}];assert.equal(E.readProject(defs,forged).result.choices[0].stats.food,r.choices[0].stats.food);
 assert.throws(()=>E.validateOptions({...o,foodPerGood:NaN}));assert.throws(()=>E.validateOptions({...o,oldCount:1.5}));assert.throws(()=>E.validateOptions({...o,searchStarts:1000}));
});

test('all 14 eras select their own highest levels without future buildings',()=>{
 const eras=HOH_DATA.eras;assert.equal(eras.length,14);
 for(const era of eras){const o=E.normalized({...base,era:era.id,optional:[],premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},workshopCounts:Object.fromEntries(era.current.map(id=>[id,1])),oldCount:0});E.validateOptions(o);const cat=E.prepare(defs,o);for(const b of Object.values(cat)){const age=eras.find(e=>'age.'+e.sourceAge===b.age);assert.ok(age&&age.index<=era.index,b.sourceId);}assert.deepEqual(E.currentFor(o),era.current);assert.deepEqual(E.mandatoryFor(o),era.mandatory);}
 assert.equal(E.prepare(defs,{era:'stone-age'}).furnace,undefined);assert.equal(E.prepare(defs,{era:'stone-age'}).averageHome,undefined);assert.equal(E.oldFor({era:'classic-greece'}),null);assert.equal(E.oldFor({era:'byzantine'}),'stoneMason');
});
test('fountain uses level AND era, including range thresholds and final capped points',()=>{
 for(const era of HOH_DATA.eras){assert.equal(era.fountainLevels.length,50);for(const p of era.fountainLevels){const o={...base,era:era.id,optional:[],fountain:true,fountainMode:'catalog',fountainLevel:p.level,fountainPoints:999999,fountainRange:10};const f=E.prepare(defs,o).fountain;assert.equal(f.points,p.points);assert.equal(f.range,p.range);assert.equal(f.manual,false);}}
 const f=(era,level)=>E.prepare(defs,{...base,optional:[],era,fountain:true,fountainMode:'catalog',fountainLevel:level}).fountain;
 assert.deepEqual([f('early-gothic',32).points,f('early-gothic',32).range],[1980,4]);assert.equal(f('late-gothic',32).points,2150);assert.equal(f('early-gothic',38).range,4);assert.equal(f('early-gothic',39).range,5);assert.deepEqual([f('early-gothic',50).points,f('early-gothic',50).range],[2400,6]);assert.throws(()=>f('early-gothic',51),/poziom/);
 const legacy=E.prepare(defs,{...base,fountain:true,fountainLevel:32,fountainPoints:5000,fountainRange:3}).fountain;assert.equal(legacy.points,5000);assert.equal(legacy.manual,true);
});
