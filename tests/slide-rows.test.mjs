import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const base=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,foodPerGood:181,foodPerSpark:133.368421,goldPerBatch:84000,goldSparksPerBatch:170,goldCap:8400000,searchStarts:3,searchSeconds:30});
const cat=E.prepare(HOH_DATA.buildings,base),terrain=E.mask(base.tiles);
const at=(id,x,y,uid)=>({...cat[id],x,y,uid});

test('a square slides one cell and the homes in its row slide along until a free strip absorbs the shift',()=>{
 const square=at('moderateCulture',10,10,1),list=[square,at('smallHome',12,10,2),at('smallHome',14,10,3),at('ruralFarm',10,12,4)];
 const right=E.slideChain(list,square,1,0,terrain);
 assert.ok(right);assert.deepEqual(right.removed.map(b=>b.uid),[1,2,3]);
 assert.deepEqual(right.placed.map(b=>[b.uid,b.x,b.y]),[[1,11,10],[2,13,10],[3,15,10]]);
 assert.deepEqual(right.vacated,{x:10,y:10,w:1,h:2});
 const left=E.slideChain(list,square,-1,0,terrain);
 assert.ok(left);assert.deepEqual(left.removed.map(b=>b.uid),[1],'nothing on the left: the square moves alone');assert.deepEqual(left.vacated,{x:11,y:10,w:1,h:2});
 assert.equal(E.slideChain(list,square,0,1,terrain),null,'a farm below stops the chain');
 const up=E.slideChain(list,square,0,-1,terrain);assert.ok(up);assert.deepEqual(up.vacated,{x:10,y:11,w:2,h:1});
 assert.equal(E.slideChain([at('moderateCulture',38,10,1)],at('moderateCulture',38,10,1),1,0,terrain),null,'the board edge stops the chain');
 const blocked={...base,tiles:base.tiles.map((t,i)=>i!==23)};
 assert.equal(E.slideChain([square],square,1,0,E.mask(blocked.tiles)),null,'blocked land ahead stops the chain');
 assert.equal(E.slideChain(list,square,1,0,terrain,2),null,'a chain longer than the limit is refused');
});

test('sliding a barracks or a workshop is never proposed and the refinement reports its slides',()=>{
 const square=at('moderateCulture',10,10,1);
 assert.equal(E.slideChain([square,at('infantryBarracks',12,10,2)],square,1,0,terrain),null);
 assert.equal(E.slideChain([square,at('jeweler',12,9,2)],square,1,0,terrain),null);
 const strip=at('compactCulture',20,20,7);
 const r=E.slideChain([strip,at('smallHome',22,20,8)],strip,1,0,terrain);
 assert.ok(r);assert.deepEqual(r.vacated,{x:20,y:20,w:1,h:1});
});
