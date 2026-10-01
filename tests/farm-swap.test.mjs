import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';import '../patterns.js';
const E=HOH_ENGINE,ref=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
// Marek's land of 15.09.2026: row 1 only in columns 6-9, rows 2-7 complete. It is the vertical
// mirror image of player scheme 1, and his settings need six producers more than the scheme has.
const tiles=Array.from({length:80},(_,i)=>{const r=Math.floor(i/10),c=i%10;return r>=2||(r===1&&c>=6);});
const o=E.normalized({...ref.options,tiles,optional:['collectableMinoanWatchtowerV2'],towerLevel:3,fountain:true,fountainLevel:32,fountainMode:'catalog',workshopCounts:{jeweler:2,glassblower:2,alchemist:2},oldCount:5,fullArmy:true,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},engineMode:'reference-schemes',enforceLayout:true});
const cat=E.prepare(HOH_DATA.buildings,o);
const scheme=HOH_PATTERNS.find(p=>p.name.startsWith('Schemat gracza 1'));
const placement=E.patternPlacements([scheme],tiles)[0];
const pattern={...scheme,layout:placement.a.layout};

test('a missing producer of a farm footprint takes the place of a farm, chosen by the resulting city value',()=>{
 assert.equal(placement.a.fit,1);assert.equal(placement.a.symmetryName,'flip-y');
 const st=E.patternStarter(cat,o,o.oldCount,pattern);
 assert.deepEqual([...st.info.missing].sort(),['alchemist','stoneMason','stoneMason','stoneMason','stoneMason','stoneMason']);
 const farmsBefore=st.list.filter(b=>b.kind==='farm').length,homesBefore=st.list.filter(b=>b.kind==='home').length;
 const swapped=E.swapFarmsForProducers(st.list,st.info.missing.map(id=>cat[id]),o);
 assert.deepEqual(swapped.left,[]);
 assert.equal(swapped.list.filter(b=>b.kind==='farm').length,farmsBefore-6);
 assert.equal(swapped.list.filter(b=>b.kind==='home').length,homesBefore,'no home is evicted');
 assert.equal(swapped.list.filter(b=>b.id==='stoneMason').length,5);assert.equal(swapped.list.filter(b=>b.id==='alchemist').length,2);
 const spots=new Set(st.list.filter(b=>b.kind==='farm').map(b=>b.x+','+b.y));
 assert.ok(swapped.list.filter(b=>b.id==='stoneMason'||(b.id==='alchemist'&&!st.list.some(t=>t.uid===b.uid&&t.id==='alchemist'))).every(b=>spots.has(b.x+','+b.y)),'producers stand on former farm spots');
 assert.ok(E.evaluate(swapped.list,o).spare>=0,'the worker balance stays positive');
 const odd=E.swapFarmsForProducers(st.list,[cat.cityHall],o);
 assert.deepEqual(odd.left,[cat.cityHall],'a footprint no farm has cannot be swapped');
});

test('the mirrored scheme adapted to more producers keeps most of its farms and beats a city built from scratch',()=>{
 const c=E.searchPattern(cat,o,o.oldCount,3,Date.now()+45000,pattern);
 assert.ok(c,'the scheme yields a city');
 assert.equal(E.validate(c.list,o,cat),null);
 assert.equal(c.schemeOrigin.swapped,6);
 const farms=c.list.filter(b=>b.kind==='farm').length;
 assert.ok(farms>=17,'farms kept: '+farms+' (scheme had 27, six became workshops)');
 assert.equal(c.list.filter(b=>b.id==='stoneMason').length,5);
 const f=E.searchFrontiers(cat,{...o,engineMode:'frontiers'},o.oldCount,1,Date.now()+30000);
 assert.ok(f);
 assert.ok(c.stats.equivalent.total>f.stats.equivalent.total*.97,'scheme '+Math.round(c.stats.equivalent.total)+' vs scratch '+Math.round(f.stats.equivalent.total));
});
