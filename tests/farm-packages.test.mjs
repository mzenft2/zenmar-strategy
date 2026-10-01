import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
const loaded=E.readProject(HOH_DATA.buildings,file),cat=loaded.result.cat;
const c={...loaded.result.choices[0],options:{...loaded.result.choices[0].options,fullArmy:false,enforceLayout:true}};
const measure=list=>{const s=E.evaluate(list,c.options);s.equivalent=E.equivalent(s,c.options);return s;};

test('free cells next to a row get a farm with its two homes as one package, without waiting for spare workers',()=>{
 const farm=c.list.find(b=>b.kind==='farm'&&!b.premium&&b.w===4&&b.h===3);assert.ok(farm);
 const homes=c.list.filter(b=>b.id==='smallHome').slice(0,2);
 const list=c.list.filter(b=>b!==farm&&!homes.includes(b));
 const start={...c,list,stats:measure(list)};
 assert.equal(start.stats.spare,c.stats.spare,'a farm and its two homes cancel out: spare unchanged');
 assert.ok(E.layoutQuality(list,c.options).free>=20,'twenty free cells');
 const n=E.refineHappiness(start,cat,Date.now()+6000);
 const farms=l=>l.filter(b=>b.kind==='farm').length;
 assert.equal(farms(n.list),farms(c.list),'the farm is back: '+farms(list)+' -> '+farms(n.list));
 assert.ok(n.stats.spare>=0);assert.equal(E.validate(n.list,c.options,cat),null);
 assert.ok(n.stats.equivalent.total>=c.stats.equivalent.total*.99,'value restored: '+n.stats.equivalent.total+' vs '+c.stats.equivalent.total);
});
