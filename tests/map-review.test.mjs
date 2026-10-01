import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const base=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:true,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,foodPerGood:181,foodPerSpark:133.368421,goldPerBatch:84000,goldSparksPerBatch:170,goldCap:8400000,searchStarts:3,searchSeconds:30});
const cat=E.prepare(HOH_DATA.buildings,base);
const at=(id,x,y,uid)=>({...cat[id],x,y,uid});

test('a hungry barracks with a free 2x1 strip beside it gets a strip of culture, not two 1x1 pieces',()=>{
 // Barracks at (10,10); homes leave exactly the cells (10,9) and (11,9) free above it.
 const list=[at('infantryBarracks',10,10,1),at('smallHome',8,8,2),at('smallHome',12,8,3),at('smallHome',10,7,4),at('smallHome',8,10,5),at('smallHome',14,10,6),at('cityHall',20,20,7)];
 const fed=E.feedBarracks(list,cat,base,Date.now()+2000);
 const added=fed.filter(b=>!list.some(t=>t.uid===b.uid));
 assert.ok(added.length>0,'something was added');
 assert.ok(added.some(b=>b.id==='compactCulture'&&b.x===10&&b.y===9&&b.w===2&&b.h===1),'the free strip took a 2x1 culture: '+JSON.stringify(added.map(b=>[b.id,b.x,b.y])));
 assert.equal(added.filter(b=>b.id==='littleCulture').length,0,'no 1x1 culture where a strip fits');
});

test('two 1x1 cultures side by side cost more than one strip, and a lone free cell that no home can take gets a 1x1 culture',()=>{
 const one={...base,tiles:Array(80).fill(false).map((_,i)=>i===0)};
 assert.equal(E.layoutQuality([at('littleCulture',5,5,1),at('littleCulture',6,5,2)],base).crowded,2);
 assert.equal(E.layoutQuality([at('littleCulture',5,5,1),at('littleCulture',7,5,2)],base).crowded,0);
 const barracks=at('infantryBarracks',5,6,9);
 assert.ok(E.layoutQuality([at('littleCulture',5,5,1),at('littleCulture',6,5,2),barracks],base).cost>E.layoutQuality([{...cat.compactCulture,x:5,y:5,w:2,h:1,uid:1},barracks],base).cost,'two crowded 1x1 cost more than one strip feeding the same barracks');
 // One place: homes and a strip leave the single cell (2,3) free, beside a home; (3,3) holds a 1x1 culture already.
 const list=[at('smallHome',0,0,1),at('smallHome',2,0,2),at('smallHome',0,2,3),{...cat.compactCulture,x:2,y:2,w:2,h:1,uid:4},at('littleCulture',3,3,5)];
 assert.equal(E.layoutQuality(list,one).free,1);
 const filled=E.fillHoles(list,cat,one);
 assert.equal(filled.length,6);assert.deepEqual(filled[5].id==='littleCulture'&&[filled[5].x,filled[5].y],[2,3]);
 assert.equal(E.layoutQuality(filled,one).free,0);
 // A 2x2 hole is left for a home, not for culture.
 const open=[at('smallHome',0,0,1),at('smallHome',2,0,2),at('smallHome',0,2,3)];
 assert.equal(E.fillHoles(open,cat,one).length,3);
});
