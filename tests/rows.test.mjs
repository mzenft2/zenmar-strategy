import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
const E=HOH_ENGINE,base=E.readProject(HOH_DATA.buildings,JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)))).options;
const slots=list=>new Set(list.filter(b=>b.kind==='farm'||b.kind==='workshop').map(b=>`${b.x},${b.y},${b.w},${b.h}`));
for(const [engineMode,seed]of [['rows-horizontal',937197],['rows-vertical',938246]])test(engineMode+' constructs real rows from terrain and retains them while polishing',()=>{
 const o={...base,engineMode,enforceLayout:true},cat=E.prepare(HOH_DATA.buildings,o),c=E.searchFrontiers(cat,o,o.oldCount,seed,Date.now()+12000);
 assert.ok(c,'expected a constructed city');assert.equal(c.pattern,engineMode);assert.equal(E.validate(c.list,o,cat),null);assert.ok(c.list.filter(b=>b.kind==='farm').length>=10);
 const original=c.rowSlots.split(';'),polished=E.refineHappiness(E.repairLayout(c,cat,Date.now()+500),cat,Date.now()+500),after=slots(polished.list);
 assert.ok(original.filter(s=>after.has(s)).length===original.length);assert.equal(E.validate(polished.list,o,cat),null);
 const again=E.readProject(HOH_DATA.buildings,E.projectFile(o,polished));assert.equal(again.options.engineMode,engineMode);assert.equal(again.result.choices[0].stats.food,polished.stats.food);
});
