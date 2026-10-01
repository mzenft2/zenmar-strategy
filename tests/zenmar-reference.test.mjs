import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
test('transcribed Zenmar geometry agrees with all six area totals from the screenshot',()=>{
 const E=HOH_ENGINE,file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url))),loaded=E.readProject(HOH_DATA.buildings,file),c=loaded.result.choices[0];
 const areas={};for(const b of c.list)areas[b.kind]=(areas[b.kind]||0)+b.w*b.h;
 assert.deepEqual(areas,{special:61,home:358,farm:300,barracks:106,happiness:99,workshop:132});
 assert.equal(c.stats.used,1056);assert.equal(E.layoutQuality(c.list,c.options).free,0);
 assert.equal(c.list.filter(b=>b.kind==='farm').length,25);assert.equal(c.list.filter(b=>b.oldWorkshop).length,5);
 const m=E.cityMetrics(c);assert.equal(m.culture,99);assert.equal(m.specialCulture,20);assert.equal(m.needed,95);assert.equal(m.available,95);
 // The reference is deliberately not relabelled as meeting stricter constraints.
 assert.match(E.validate(c.list,c.options,loaded.result.cat),/Koszary/);
 assert.equal(E.validate(c.list,E.manualOptions(c.options),loaded.result.cat),null);
});
// Marek, 20.09.2026: "the better city always wins" — an edge source stays when moving it would cost output; the repair
// must still fill the pocket, keep the farms and the workforce, and never add a pair or an edge source.
test('small source-block repair fills the pocket without sacrificing farms or workforce; an edge source is not traded for output',()=>{
 const E=HOH_ENGINE,file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url))),loaded=E.readProject(HOH_DATA.buildings,file),c=loaded.result.choices[0];c.options.enforceLayout=true;
 const repaired=E.repairSourceBlocks(c,loaded.result.cat,Date.now()+2500),q=E.layoutQuality(repaired.list,c.options),m=E.cityMetrics(repaired);
 assert.equal(q.free,0);assert.ok(q.edges.length<=E.layoutQuality(c.list,c.options).edges.length,'no new edge source');assert.equal(q.pairs.length,0);assert.equal(m.farms,25);assert.ok(m.culture<=99);assert.ok(repaired.stats.equivalent.total>=c.stats.equivalent.total-.001,'output never drops');assert.ok(m.available>=m.needed);
 assert.equal(E.validate(repaired.list,E.manualOptions(c.options),loaded.result.cat),null);
 // Never disguise an unresolved siege deficit as a valid 100% army.
 assert.ok(repaired.stats.armyDeficit>0);
});
