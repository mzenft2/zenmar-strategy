import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
const loaded=E.readProject(HOH_DATA.buildings,file),cat=loaded.result.cat;
const c={...loaded.result.choices[0],options:{...loaded.result.choices[0].options,fullArmy:false,enforceLayout:true}};
const measure=list=>{const s=E.evaluate(list,c.options);s.equivalent=E.equivalent(s,c.options);return s;};

test('spare workers turn filler homes back into a farm instead of staying idle',()=>{
 const farm=c.list.find(b=>b.kind==='farm'&&!b.premium&&b.w===4&&b.h===3);assert.ok(farm,'fixture has a 4x3 farm');
 const uid=Math.max(...c.list.map(b=>b.uid))+1;
 const list=c.list.filter(b=>b!==farm).concat({...cat.smallHome,x:farm.x,y:farm.y,uid},{...cat.smallHome,x:farm.x+2,y:farm.y,uid:uid+1});
 const start={...c,list,stats:measure(list)};
 assert.ok(start.stats.spare>=2,'two filler homes leave spare workers: '+start.stats.spare);
 const n=E.refineHappiness(start,cat,Date.now()+6000);
 const farms=l=>l.filter(b=>b.kind==='farm').length;
 assert.ok(farms(n.list)>farms(list),'a farm came back: '+farms(list)+' -> '+farms(n.list));
 assert.ok(n.spareRepairs>=1,'the spare-workers pass reports its move');
 assert.ok(n.stats.spare<start.stats.spare,'fewer idle workers: '+start.stats.spare+' -> '+n.stats.spare);
 assert.equal(E.validate(n.list,c.options,cat),null);
});

test('sector waste maps the whole board and the ranking puts same-size culture pairs before value',()=>{
 const waste=E.sectorWaste(c.list,c.options);assert.equal(waste.length,80);assert.ok(waste.every(v=>v>=0));
 const q=E.layoutQuality(c.list,c.options);
 if(q.pairs.length===0){const sq=c.list.filter(b=>b.id==='moderateCulture');assert.ok(sq.length>=2);
  // Move one square next to another: the pair costs the layout its rank even when the value would say otherwise.
  const a=sq[0],b=sq[1],g=E.mask(c.options.tiles);for(const t of c.list)if(t!==b)E.paint?E.paint(g,t,1):null;
  const spot=[[a.x+a.w,a.y],[a.x-b.w,a.y],[a.x,a.y+a.h],[a.x,a.y-b.h]].find(([x,y])=>x>=0&&y>=0&&x+b.w<=E.W&&y+b.h<=E.H&&E.fits(g,x,y,b.w,b.h));
  if(spot){const moved=c.list.map(t=>t===b?{...b,x:spot[0],y:spot[1]}:t),m={...c,list:moved,stats:measure(moved)};assert.ok(E.layoutQuality(moved,c.options).pairs.length>0);assert.ok(E.betterLayout(c,m,c.options),'the pair-free city wins');}
 }
});
