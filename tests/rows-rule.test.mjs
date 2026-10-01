import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
// Marek, 19.09.2026: "the engine did not force long, optimal rows — they should rule", then "rows appeared, but sideways,
// not like the schemes": a producer is in a row only with its long side across the row.
const o=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,compareSparks:false,goldSparksPerBatch:0}),cat=E.prepare(HOH_DATA.buildings,o);
const fw=cat.ruralFarm.w,fh=cat.ruralFarm.h;assert.ok(fw>fh,'the catalogue farm lies sideways: '+fw+'x'+fh);
const tall=(x,y)=>({...cat.ruralFarm,x,y,w:fh,h:fw}),wide=(x,y)=>({...cat.ruralFarm,x,y,w:fw,h:fh});
test('a straight run of three producers across the row is a row; sideways, staggered, paired or lone producers are loose',()=>{
 const row=[0,1,2,3].map(i=>tall(i*fh,0)),r=E.rowRuns([...row,tall(0,12),tall(4*fh,1)]);
 assert.equal(r.producers,6);assert.equal(r.runs.length,1);assert.equal(r.runs[0].length,4);assert.equal(r.loose,2);
 assert.equal(E.rowRuns([...row,{...cat.jeweler,x:4*fh,y:0,w:cat.jeweler.h,h:cat.jeweler.w}]).runs[0].length,5,'a rotated workshop at the end joins the row');
 assert.equal(E.rowRuns([...row,{...cat.jeweler,x:4*fh,y:0,w:cat.jeweler.h,h:cat.jeweler.w}]).runs[0].length,5,'a standing workshop joins the row');assert.equal(E.rowRuns([...row,{...cat.jeweler,x:4*fh,y:0}]).runs[0].length,4,'a lying workshop does not (Marek, 20.09.2026)');
 assert.equal(E.rowRuns([wide(0,20),wide(fw,20),wide(2*fw,20)]).loose,3,'sideways farms in a horizontal row are loose');
 assert.equal(E.rowRuns([wide(20,0),wide(20,fh),wide(20,2*fh)]).loose,0,'a vertical column of wide farms is a row');
 assert.equal(E.rowRuns([tall(0,20),tall(fh,20)]).loose,2,'two side by side are not a row');
});
test('a city with its producers in rows beats a looser one whatever the value; among row cities the value decides',()=>{
 const rows=[0,1,2,3].map(i=>tall(i*fh,0)),rowsB=[0,1,2,3].map(i=>tall(i*fh,10)),scattered=[tall(0,0),tall(0,10),tall(10,20),tall(20,4)],sideways=[0,1,2,3].map(i=>wide(i*fw,0));
 const choice=(list,total)=>({list,stats:{armyDeficit:0,equivalent:{total},used:list.reduce((n,b)=>n+b.w*b.h,0),spare:0},options:o});
 assert.ok(E.rowCompliant(E.layoutQuality(rows,o))&&!E.rowCompliant(E.layoutQuality(scattered,o))&&!E.rowCompliant(E.layoutQuality(sideways,o)));
 assert.ok(E.betterLayout(choice(rows,90),choice(scattered,100),o));
 assert.ok(E.betterLayout(choice(rows,90),choice(sideways,100),o),'a row of tall farms beats a richer row of sideways farms');
 assert.ok(!E.betterLayout(choice(scattered,100),choice(rows,90),o));
 assert.ok(E.betterLayout(choice(rowsB,100),choice(rows,90),o),'both in rows: value decides');
 assert.ok(!E.betterLayout(choice(rowsB,90),choice(rows,100),o));
});
