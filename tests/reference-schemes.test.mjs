import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';import '../search-pool.js';import '../patterns.js';
const E=HOH_ENGINE,file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
const loaded=E.readProject(HOH_DATA.buildings,file),base=loaded.options,pattern=HOH_PATTERNS[0];
const same=(a,b)=>a.filter(x=>b.some(y=>y.id===x.id&&y.x===x.x&&y.y===x.y&&y.w===x.w&&y.h===x.h)).length;
const settings=over=>E.normalized({...base,...over,engineMode:'frontiers',enforceLayout:true});
const cut=i=>base.tiles.map((t,j)=>j===i?false:t),add=i=>base.tiles.map((t,j)=>j===i?true:t);

test('built-in library holds geometry only and the starter trims, protects and remaps it',()=>{
 assert.ok(HOH_PATTERNS.length>=2);assert.ok(HOH_PATTERNS.every(p=>Array.isArray(p.tiles)&&p.tiles.length===80&&p.layout.every(b=>Object.keys(b).sort().join()==='h,id,w,x,y')));
 const o=settings({}),cat=E.prepare(HOH_DATA.buildings,o),st=E.patternStarter(cat,o,o.oldCount,pattern);
 assert.equal(st.info.kept,162);assert.deepEqual(st.info.missing,[]);
 assert.ok(st.list.filter(b=>b.kind==='farm'||b.kind==='workshop'||b.kind==='barracks').every(b=>b.edgeBand));
 assert.ok(st.list.filter(b=>b.kind==='home'||(b.kind==='happiness'&&!b.premium)).every(b=>!b.edgeBand));
 const smaller=settings({tiles:cut(79)}),st2=E.patternStarter(E.prepare(HOH_DATA.buildings,smaller),smaller,smaller.oldCount,pattern);
 assert.equal(st2.info.dropped.outside,4);assert.equal(st2.info.kept,158);
 const terrain=E.mask(smaller.tiles);assert.ok(st2.list.every(b=>E.fits(terrain,b.x,b.y,b.w,b.h)));
 const era=settings({era:'high-middle-ages',workshopCounts:{carpenter:2,scribe:2,spiceMerchant:2}}),cat3=E.prepare(HOH_DATA.buildings,era),st3=E.patternStarter(cat3,era,era.oldCount,pattern);
 assert.deepEqual(st3.info.missing,[]);assert.equal(st3.list.filter(b=>b.kind==='workshop').length,11);assert.ok(st3.list.every(b=>cat3[b.id]&&cat3[b.id].w*cat3[b.id].h===b.w*b.h));
 const counts=settings({workshopCounts:{jeweler:3,glassblower:1,alchemist:2},oldCount:3}),st4=E.patternStarter(E.prepare(HOH_DATA.buildings,counts),counts,3,pattern);
 assert.deepEqual(st4.info.missing,[]);assert.equal(st4.info.dropped.surplus,2);assert.equal(st4.list.filter(b=>b.id==='jeweler').length,3);
});

test('pattern adaptation returns validated cities on the same, larger and smaller terrain and with other counts',()=>{
 for(const [label,over,minKept] of [['same',{},55],['larger',{tiles:add(2)},55],['smaller',{tiles:cut(79)},25],['counts',{workshopCounts:{jeweler:3,glassblower:1,alchemist:2},oldCount:3},25]]){
  const o=settings(over),cat=E.prepare(HOH_DATA.buildings,o),st=E.patternStarter(cat,o,o.oldCount,pattern);
  // Repairs are time-boxed, so the kept counts vary with machine load; thresholds stay loose.
  const c=E.searchPattern(cat,o,o.oldCount,3,Date.now()+40000,pattern);
  assert.ok(c,label);assert.equal(E.validate(c.list,o,cat),null,label);
  assert.ok(c.list.every(b=>b.edgeBand===undefined),label+': released');
  assert.ok(same(st.list,c.list)>=minKept,label+': kept '+same(st.list,c.list));
  assert.equal(c.schemeOrigin.name,pattern.name);assert.equal(c.schemeOrigin.kept,st.info.kept);
 }
});

test('library mode tries the most similar terrain first and falls back to generic constructors without a library',()=>{
 const o=E.normalized({...base,engineMode:'reference-schemes',enforceLayout:true}),cat=E.prepare(HOH_DATA.buildings,o);
 const far={name:'far',tiles:base.tiles.map(t=>!t),layout:pattern.layout};
 const c=E.searchReferenceSchemes(cat,o,o.oldCount,7,Date.now()+25000,[far,HOH_PATTERNS[1]],0);
 assert.equal(c.schemeOrigin.name,HOH_PATTERNS[1].name);assert.equal(c.schemeOrigin.similarity,1);assert.equal(c.schemeOrigin.library,2);assert.equal(E.validate(c.list,o,cat),null);
 const g=E.searchReferenceSchemes(cat,o,o.oldCount,2,Date.now()+15000,[]);
 assert.ok(g);assert.equal(g.schemeOrigin.kind,'generic');assert.equal(E.validate(g.list,g.options,cat),null);
});

test('a saved city whose terrain lost a place is adapted as a pattern instead of being discarded',async()=>{
 const o={...base,tiles:cut(79),compareSparks:false,engineMode:'frontiers',workerBudgetMs:16000,startSeed:5};
 const seed={list:loaded.result.choices[0].list.map(({id,x,y,w,h})=>({id,x,y,w,h})),seed:1,districtAttempts:0};
 const r=await E.generate(HOH_DATA.buildings,{...o,seedLayouts:[seed]},()=>{});
 const best=r.choices[0];
 assert.ok(best.comparisonStart,'comparison start recorded from the adapted city');
 assert.equal(E.validate(best.list,best.options,r.cat),null);
 assert.ok(['continued','frontiers'].includes(best.pattern));
 assert.ok(best.comparisonStart.total>7e6,'adapted start keeps most of the production: '+best.comparisonStart.total);
});

test('scheme option uses the existing worker budget, can be disabled, and passes the library to every worker',()=>{
 for(const enabled of [true,false]){const jobs=[],pool=HOH_SEARCH_POOL('test',()=>({postMessage(v){jobs.push(v);},terminate(){}}),5);pool.onmessage=()=>{};pool.postMessage({...base,referenceSchemes:enabled,searchSeconds:30,patterns:HOH_PATTERNS});assert.equal(jobs.length,4);assert.equal(jobs[0].engineMode,enabled?'reference-schemes':'frontiers');/* 8.42: the fresh search launches first, polishing (only with a saved map) is unshifted before it */assert.ok(jobs.every(j=>j.patterns.length===HOH_PATTERNS.length));pool.terminate();}
});
