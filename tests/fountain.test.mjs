import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
test('a producer at each fountain corner receives the full source points with one covered cell',()=>{
 const f={id:'fountain',x:12,y:12,w:4,h:4,range:3,points:5000},b={id:'farm',w:4,h:3,happyMax:5450};
 const points=E.sourceEdgePositions(f,b);
 for(const [x,y] of [[6,7],[18,7],[6,18],[18,18]]){
  const p=points.find(p=>p.x===x&&p.y===y);assert.ok(p);assert.ok(E.reaches(f,p));assert.equal(E.rawHappiness(p,[f,p]),5000);
 }
 assert.equal(E.reaches(f,{...b,x:5,y:7}),false);
 assert.ok(points.every(p=>p.x>=0&&p.y>=0&&p.x+p.w<=E.W&&p.y+p.h<=E.H));
});
test('fountain coverage counts useful building types, excluding administration and cultures',()=>{
 const f={id:'fountain',x:10,y:10,w:4,h:4,range:3,points:5000};
 const list=[f,...['home','farm','workshop','barracks','special','happiness'].map((kind,i)=>({id:String(i),kind,x:8,y:8,w:1,h:1,happyMax:i<4?2000:0}))];
 assert.deepEqual(E.fountainCoverage(list),{fountainBuildings:4,fountainHomes:1,fountainProducers:2,fountainBarracks:1});
});
test('gold sparks appear in total sparks and count exactly once in the city value',()=>{
 const loaded=E.readProject(HOH_DATA.buildings,JSON.parse(fs.readFileSync(new URL('../references/zenmar-optimized.json',import.meta.url)))),c=loaded.result.choices[0],m=E.cityMetrics(c),v=c.stats.equivalent;
 assert.ok(m.goldSparks>0);assert.equal(m.totalSparks,m.sparks+m.goldSparks);
 assert.equal(v.total,v.food+v.goods+v.sparks+v.gold);
 assert.equal(v.gold,m.goldSparks*c.options.foodPerSpark);
});
test('fountain neighbourhood moves preserve the strict saved city and its economic value',()=>{
 const loaded=E.readProject(HOH_DATA.buildings,JSON.parse(fs.readFileSync(new URL('../references/zenmar-optimized.json',import.meta.url)))),c=loaded.result.choices[0];c.options.enforceLayout=true;
 const n=E.refineHappiness(c,loaded.result.cat,Date.now()+1500);
 // 8.60: the reference city keeps a one-cell gap under its barracks that only crowding could fill, so the refinement may
 // not open new holes, pairs or crowding, but need not close what the rules forbid to fill.
 assert.equal(E.validate(n.list,n.options,loaded.result.cat),null);{const q=E.layoutQuality(n.list,n.options),q0=E.layoutQuality(c.list,c.options);assert.ok(q.free<=q0.free,'no new holes');assert.equal(q.pairs.length,0);assert.equal(q.clutter,0);}
 // Since 8.24 layout preferences may cost up to the 0.5% band, never more; holes are never created.
 assert.ok(n.stats.equivalent.total>=c.stats.equivalent.total*.995,'value kept within the band: '+n.stats.equivalent.total+' vs '+c.stats.equivalent.total);assert.equal(n.stats.army,1);
 assert.equal(n.list.filter(b=>b.id==='fountain').length,1);assert.equal(n.list.filter(b=>b.premium).length,c.list.filter(b=>b.premium).length);
});
