import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
// Marek, 20.09.2026, screen of 8.59 and one word: "nadal" — six strips end to end between the barracks rows. Small culture
// crammed side by side around the barracks is an error under the layout rules; a strip beside a square or a home is fine.
const o=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,compareSparks:false,enforceLayout:true}),cat=E.prepare(HOH_DATA.buildings,o);
const at=(id,x,y,w,h,uid)=>({...cat[id],x,y,w:w||cat[id].w,h:h||cat[id].h,uid});
const barracks=at('infantryBarracks',0,0,4,4,1);
test('two strips touching beside a barracks crowd it; a strip beside a square, a home or far from the army does not',()=>{
 const a=at('compactCulture',0,4,2,1,2),b=at('compactCulture',2,4,2,1,3);
 assert.ok(E.crowdsBarracks(a,[barracks,a,b]));assert.ok(E.crowdsBarracks(b,[barracks,a,b]));
 assert.ok(!E.crowdsBarracks(a,[barracks,a,at('moderateCulture',2,4,2,2,3)]),'a square beside a strip is a spacer, not clutter');
 assert.ok(!E.crowdsBarracks(a,[barracks,a,at('smallHome',2,4,2,2,3)]));
 assert.ok(!E.crowdsBarracks(at('compactCulture',20,20,2,1,4),[barracks,at('compactCulture',20,20,2,1,4),at('compactCulture',22,20,2,1,5)]),'far from any barracks two strips may touch');
 const q=E.layoutQuality([barracks,a,b],o);assert.equal(q.clutter,1);assert.deepEqual(q.clutterPairs,[[2,3]]);assert.equal(q.complete,false);
});
test('the ranking puts a crowded city behind an uncrowded one and the repairs see the crowded pieces as defects',()=>{
 const stats=total=>({equivalent:{total},armyDeficit:0,excess:0,fountainBuildings:0,used:0});
 const crowded={list:[barracks,at('compactCulture',0,4,2,1,2),at('compactCulture',2,4,2,1,3)],stats:stats(101),options:o};
 const clean={list:[barracks,at('compactCulture',0,4,2,1,2),at('moderateCulture',2,4,2,2,3)],stats:stats(100),options:o};
 assert.equal(E.rankChoices(clean,crowded),-1,'crowding loses whatever the value');
 assert.equal(E.rankChoices(crowded,clean),1);
});
