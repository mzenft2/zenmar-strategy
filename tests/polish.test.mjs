import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
const loaded=E.readProject(HOH_DATA.buildings,file),cat=loaded.result.cat;
const c={...loaded.result.choices[0],options:{...loaded.result.choices[0].options,fullArmy:false,enforceLayout:true}};

test('an optional building the player did not tick makes the layout invalid, so a continued search adapts the city instead of keeping it',()=>{
 assert.equal(E.validate(c.list,c.options,cat),null,'the fixture itself is valid');
 const present=c.list.map(b=>b.id).filter(id=>E.OPTIONAL_IDS.includes(id));
 assert.ok(present.length,'the fixture has an optional building: '+present.join(','));
 const without={...c.options,optional:c.options.optional.filter(id=>id!==present[0])};
 assert.match(E.validate(c.list,without,cat)||'',/Budynek niezaznaczony/);
 if(c.options.fountain&&c.list.some(b=>b.id==='fountain'))assert.match(E.validate(c.list,{...c.options,fountain:false},cat)||'',/niezaznaczony: fountain/);
});

test('polishing keeps the city valid and never hands back a worse layout than the start',()=>{
 const n=E.polishLayout(c,cat,c.options,3,Date.now()+4000);
 assert.equal(E.validate(n.list,c.options,cat),null);
 assert.ok(n.polishRounds>=1,'at least one round in 4 s');
 assert.ok(!E.betterLayout(c,n,c.options),'the start never beats the polished result');
 assert.ok(n.stats.equivalent.total>=c.stats.equivalent.total*.995,'value kept: '+n.stats.equivalent.total+' vs '+c.stats.equivalent.total);
});
