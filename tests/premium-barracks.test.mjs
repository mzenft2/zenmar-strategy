import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
const loaded=E.readProject(HOH_DATA.buildings,file),cat=loaded.result.cat;
// The reference is a manual save: the army is judged as saved, not against a full-happiness minimum.
const c={...loaded.result.choices[0],options:{...loaded.result.choices[0].options,fullArmy:false,enforceLayout:true}};

test('the premium source is moved next to two barracks only when the ranking prefers the whole move, and the city stays valid',()=>{
 const before=c.stats.equivalent.total,army=c.list.filter(b=>b.kind==='barracks');
 const n=E.premiumToBarracks(c,cat,Date.now()+5000);
 assert.equal(E.validate(c.list,c.options,cat),null,'the fixture itself is valid');
 assert.ok(n.stats.armyDeficit<=c.stats.armyDeficit+1e-5,'the barracks never lose happiness');
 assert.equal(E.validate(n.list,n.options,cat),null);
 assert.ok(n.stats.equivalent.total>=before*.995,'value kept within the band: '+n.stats.equivalent.total+' vs '+before);
 assert.equal(n.list.filter(b=>b.premium&&b.points).length,c.list.filter(b=>b.premium&&b.points).length,'the premium source is never lost');
 const prem=n.list.find(b=>b.premium&&b.points);
 if(n.premiumMoves)assert.ok(army.filter(b=>E.reaches(prem,b)).length>=2,'after a move the premium reaches two barracks');
 assert.ok(E.layoutQuality(n.list,n.options).free<=E.layoutQuality(c.list,c.options).free,'no new holes');
});

test('a city without two barracks or without a premium source is returned untouched',()=>{
 const noPremium={...c,list:c.list.filter(b=>!(b.premium&&b.points))};
 const n=E.premiumToBarracks(noPremium,cat,Date.now()+1000);
 assert.equal(n.list.length,noPremium.list.length);assert.equal(n.premiumMoves,0);
});
