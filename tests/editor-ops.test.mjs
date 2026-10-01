import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
const loaded=E.readProject(HOH_DATA.buildings,file),cat=loaded.result.cat,c=loaded.result.choices[0];

test('Delete removes a free building for good, required buildings can only be parked, D copies, the palette adds era buildings',()=>{
 const home=c.list.find(b=>b.id==='smallHome'),barracks=c.list.find(b=>b.kind==='barracks'),farm=c.list.find(b=>b.kind==='farm'&&!b.premium);
 assert.ok(E.freelyEditable(home)&&!E.freelyEditable(barracks)&&E.freelyEditable(farm));
 const removed=E.editLayout(c,cat,{type:'remove',uid:home.uid});
 assert.equal(removed.list.length,c.list.length-1);assert.equal(removed.parked.length,0);assert.equal(removed.manual,true);
 assert.throws(()=>E.editLayout(c,cat,{type:'remove',uid:barracks.uid}),/wymagany przez ustawienia/);
 assert.throws(()=>E.editLayout(c,cat,{type:'duplicate',uid:barracks.uid}),/ustawieniach/);
 assert.throws(()=>E.editLayout(c,cat,{type:'add',id:'jeweler'}),/ustawienia/);
 const copied=E.editLayout(removed,cat,{type:'duplicate',uid:farm.uid});
 assert.equal(copied.parked.length,1);assert.equal(copied.parked[0].id,farm.id);assert.equal(copied.added,copied.parked[0].uid);assert.ok(!copied.list.some(b=>b.uid===copied.added),'the copy waits in the tray');
 const added=E.editLayout(removed,cat,{type:'add',id:'smallHome'});
 assert.equal(added.parked[0].id,'smallHome');
 // The freed 2x2 spot takes the new small home back; the city is valid again under the manual rules.
 const back=E.editLayout(added,cat,{type:'move',uid:added.added,x:home.x,y:home.y});
 assert.equal(back.parked.length,0);assert.equal(back.list.length,c.list.length);
 assert.equal(E.validate(back.list,E.manualOptions(c.options),cat),null);
 assert.equal(Math.round(back.stats.equivalent.total),Math.round(c.stats.equivalent.total),'same city, same value');
});
