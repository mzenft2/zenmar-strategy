import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
function fixture(){const o=E.normalized({tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:[],fullArmy:false,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,compareSparks:false,goldSparksPerBatch:0}),cat=E.prepare(HOH_DATA.buildings,o),list=[];let uid=1;const add=(id,x,y,w=cat[id].w,h=cat[id].h)=>list.push({...cat[id],x,y,w,h,uid:uid++});
for(const [id,x,y] of [['cityHall',25,0],['furnace',30,0],['infantryBarracks',25,6],['rangedBarracks',30,6],['cavalryBarracks',34,6],['heavyInfantryBarracks',25,12],['siegeBarracks',31,12]])add(id,x,y);
add('ruralFarm',4,4,3,4);add('ruralFarm',9,4,3,4);add('ruralFarm',16,4,3,4);for(const y of [2,4,6,8])add('moderateCulture',7,y);
const g=E.mask(o.tiles);for(const b of list)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)g[y*E.W+x]=1;
for(let y=0;y<E.H;y+=2)for(let x=0;x<E.W;x+=2)if(E.fits(g,x,y,2,2)){add('smallHome',x,y);for(let yy=y;yy<y+2;yy++)for(let xx=x;xx<x+2;xx++)g[yy*E.W+xx]=1;}
assert.equal(E.validate(list,o,cat),null);const stats=E.evaluate(list,o);stats.equivalent=E.equivalent(stats,o);return {cat,c:{list,stats,options:o,oldCount:0}};}
test('relocating redundant shared sources improves actual food and preserves required buildings',()=>{const {cat,c}=fixture(),n=E.refineHappiness(c,cat,Date.now()+2500);assert.equal(E.validate(n.list,n.options,cat),null);assert.ok(n.stats.food>c.stats.food);assert.ok(n.happinessRepairs>0);for(const id of E.mandatory)assert.equal(n.list.filter(b=>b.id===id).length,1);assert.ok(n.list.filter(b=>b.kind==='farm').length>=3,'farms are only added (8.45: spare workers become farms)');assert.ok(n.stats.equivalent.total>=c.stats.equivalent.total);});
test('an expired refinement budget leaves the valid layout intact',()=>{const {cat,c}=fixture(),n=E.refineHappiness(c,cat,Date.now()-1);assert.deepEqual(n.list,c.list);assert.equal(n.stats.food,c.stats.food);});

test('surplus culture is reclaimed as housing without lowering the city value',()=>{
 const {cat,c}=fixture();c.options.oldCount=3;c.options.enforceLayout=true;
 c.list=c.list.map(b=>b.kind==='farm'?{...cat.stoneMason,x:b.x,y:b.y,w:b.w,h:b.h,uid:b.uid}:b);
 c.stats=E.evaluate(c.list,c.options);c.stats.equivalent=E.equivalent(c.stats,c.options);
 assert.ok(c.stats.details.some(d=>d.raw>=4000&&c.list.find(b=>b.uid===d.id).id==='stoneMason'));
 const before=E.cityMetrics(c),snapshot=JSON.stringify(c),n=E.refineHappiness(c,cat,Date.now()+2000),after=E.cityMetrics(n);
 assert.equal(E.validate(n.list,n.options,cat),null);
 // Squares are reclaimed; fillers in holes (8.34: 1x1 pieces, merged into strips) are not culture that stayed.
 const squares=list=>list.filter(b=>b.id==='moderateCulture').reduce((s,b)=>s+b.w*b.h,0);
 assert.ok(squares(n.list)<squares(c.list),'square culture reclaimed: '+squares(c.list)+' -> '+squares(n.list));
 // 8.45: spare workers turn homes into farms, so the home count may fall; the reclaimed cells must hold homes or farms.
 const gone=c.list.filter(b=>b.id==='moderateCulture'&&!n.list.some(t=>t.id==='moderateCulture'&&t.x===b.x&&t.y===b.y));assert.ok(gone.length>0);
 for(const b of gone)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)assert.ok(n.list.some(t=>(t.kind==='home'||t.kind==='farm')&&x>=t.x&&x<t.x+t.w&&y>=t.y&&y<t.y+t.h),'reclaimed cell '+x+','+y+' holds a home or a farm');
 assert.ok(after.total>=before.total);assert.ok(n.stats.goods>=c.stats.goods);
 assert.equal(new Set(n.list.map(b=>b.uid)).size,n.list.length);assert.equal(JSON.stringify(c),snapshot);
});

test('a source shared with a hungry farm is not removed just because its stone mason is saturated',()=>{
 const {cat,c}=fixture();c.options.oldCount=1;c.options.enforceLayout=true;
 c.list=c.list.map(b=>b.id==='ruralFarm'&&b.x===4?{...cat.stoneMason,x:b.x,y:b.y,w:b.w,h:b.h,uid:b.uid}:b);
 c.stats=E.evaluate(c.list,c.options);c.stats.equivalent=E.equivalent(c.stats,c.options);
 const farm=c.list.find(b=>b.id==='ruralFarm'&&b.x===9),mason=c.list.find(b=>b.id==='stoneMason');
 assert.ok(E.rawHappiness(mason,c.list)>=2*mason.happyMax);
 const n=E.refineHappiness(c,cat,Date.now()+2000),after=n.list.find(b=>b.uid===farm.uid);
 assert.equal(E.validate(n.list,n.options,cat),null);
 // Output first (15.09.2026): the farm may lose happiness only when the whole city gains from it.
 assert.ok(n.stats.equivalent.total>=c.stats.equivalent.total);
 assert.ok(E.happiness(after,n.list)>=E.happiness(farm,c.list)||n.stats.equivalent.total>c.stats.equivalent.total);
 assert.ok(n.stats.food>=c.stats.food);assert.ok(n.stats.equivalent.total>=c.stats.equivalent.total);
});

test('district rebuild changes farm inventory while preserving requirements and best result',()=>{const {cat,c}=fixture(),snapshot=JSON.stringify(c),n=E.rebuildDistricts(c,cat,Date.now()+2000);assert.equal(E.validate(n.list,n.options,cat),null);assert.ok(n.stats.equivalent.total>c.stats.equivalent.total);assert.ok(n.list.filter(b=>b.kind==='farm').length>3);assert.equal(JSON.stringify(c),snapshot);assert.ok(n.districtImprovements>0);assert.equal(new Set(n.list.map(b=>b.uid)).size,n.list.length);});
test('expired district budget returns the original geometry and production',()=>{const {cat,c}=fixture(),n=E.rebuildDistricts(c,cat,Date.now()-1);assert.deepEqual(n.list,c.list);assert.equal(n.stats.equivalent.total,c.stats.equivalent.total);assert.equal(n.districtAttempts,0);});

test('spatial repair separates culture without losing required buildings or worker feasibility',()=>{const {cat,c}=fixture();c.options.enforceLayout=true;const before=E.layoutQuality(c.list,c.options),n=E.repairLayout(c,cat,Date.now()+2000),after=E.layoutQuality(n.list,n.options);assert.equal(E.validate(n.list,n.options,cat),null);assert.ok(after.cost<before.cost);assert.ok(after.pairs.length<before.pairs.length);for(const id of E.mandatory)assert.equal(n.list.filter(b=>b.id===id).length,1);});
