import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE,o=E.normalized({tiles:Array(80).fill(true),optional:[],premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},fullArmy:true,interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,compareSparks:false}),cat=E.prepare(HOH_DATA.buildings,o);
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
test('parametric production and military fragments rotate without losing objects or overlapping',()=>{
 const removed=[...E.current,...E.mandatory.filter(id=>id.endsWith('Barracks'))].map((id,i)=>({...cat[id],uid:i+1}));const seen=new Set();
 for(let i=0;i<64;i++){const f=E.fragmentSeed(cat,removed,i);seen.add(f.kind);assert.ok(f.width>0&&f.height>0);for(const [j,b] of f.list.entries()){
  assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=f.width&&b.y+b.h<=f.height);assert.ok((b.w===cat[b.id].w&&b.h===cat[b.id].h)||(b.w===cat[b.id].h&&b.h===cat[b.id].w));assert.ok(!f.list.slice(j+1).some(c=>overlap(b,c)));
 }if(f.kind==='military')for(const b of removed.filter(b=>b.kind==='barracks'))assert.equal(f.list.filter(t=>t.uid===b.uid).length,1);
 else assert.ok(f.list.some(b=>b.kind==='workshop'));
 const cultures=f.list.filter(b=>b.id==='moderateCulture');for(const a of cultures)for(const b of cultures)if(a!==b)assert.ok(!(a.x+a.w===b.x&&a.y<b.y+b.h&&b.y<a.y+a.h)&&!(a.y+a.h===b.y&&a.x<b.x+b.w&&b.x<a.x+a.w));
 }assert.deepEqual([...seen].sort(),['military','production']);
});
function city(siegeFraction=1,otherFraction=1){const c=structuredClone(cat),list=[];c.cityHall.workers=100;const add=(id,x,y)=>list.push({...c[id],x,y,uid:list.length+1});add('cityHall',0,25);add('furnace',6,25);
 E.mandatory.filter(id=>id.endsWith('Barracks')).forEach((id,i)=>{add(id,i*7,10);const source='testSource'+i;c[source]={...c.littleCulture,id:source,points:c[id].happyMax*(id==='siegeBarracks'?siegeFraction:otherFraction),range:1};add(source,i*7,9);});return {c,list};}
test('siege tolerance applies per building and never excuses another barracks deficit',()=>{
 let {c,list}=city(.95);assert.equal(E.validate(list,{...o,siegeMin:95},c),null);assert.match(E.validate(list,o,c),/Koszary/);assert.match(E.validate(list,{...o,siegeMin:96},c),/Koszary/);
 ({c,list}=city(1,.999));assert.match(E.validate(list,{...o,siegeMin:90},c),/Koszary/);
 ({c,list}=city(.94));assert.match(E.validate(list,{...o,siegeMin:95},c),/Koszary/);
 assert.throws(()=>E.validateOptions({...o,siegeMin:89}),/oblężniczych/);assert.throws(()=>E.validateOptions({...o,siegeMin:NaN}),/oblężniczych/);
});
test('external neighbours and saturation change the real economic value of a fragment',()=>{
 const f=E.fragmentSeed(cat,[],0),list=f.list.map((b,i)=>({...b,x:b.x+8,y:b.y+8,uid:i+1}));const source={...cat.moderateCulture,uid:1000,x:8,y:6,points:10000};
 const value=l=>{const s=E.evaluate(l,o);return E.equivalent(s,o).total;};assert.ok(value([...list,source])>value(list));const saturated=list.map(b=>b.points?{...b,points:1e7}:b);assert.equal(value([...saturated,source]),value(saturated));
});
test('long bands span more than one former window in both axes, with legal shared channels',()=>{
 for(const vertical of [false,true])for(const span of [24,30,36])for(let index=0;index<8;index++){
  const f=E.fragmentSeed(cat,[],index,{span,vertical});assert.ok((vertical?f.height:f.width)>16);
  for(const [i,b] of f.list.entries()){
   assert.ok(!f.list.slice(i+1).some(t=>overlap(b,t)));
   assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=f.width&&b.y+b.h<=f.height);
   assert.ok((b.w===cat[b.id].w&&b.h===cat[b.id].h)||(b.h===cat[b.id].w&&b.w===cat[b.id].h));
  }
 }
});
