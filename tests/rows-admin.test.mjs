import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
test('row protection cannot break a line by moving a single producer',()=>{
 const list=Array.from({length:20},(_,i)=>({kind:'farm',x:i%10*4,y:Math.floor(i/10)*6,w:4,h:3})),signature=list.map(b=>`${b.x},${b.y},${b.w},${b.h}`).join(';');
 assert.equal(E.productionRows(list).longest,10);assert.ok(E.preservesRows(list,signature));
 const moved=list.map((b,i)=>i===3?{...b,y:b.y+1}:b);assert.equal(E.preservesRows(moved,signature),false);
 assert.ok(E.preservesRows(list.map(b=>({...b,kind:'workshop'})),signature));
});
test('administration trades covered land for homes without losing any building or output',()=>{
 const o=E.normalized({tiles:Array(80).fill(true),optional:[],premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},fullArmy:false,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,interval:3,night:8,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,compareSparks:false}),cat=E.prepare(HOH_DATA.buildings,o),list=[];
 const add=(id,x,y)=>list.push({...cat[id],x,y,uid:list.length+1});
 for(const [id,x,y] of [['furnace',8,8],['moderateCulture',6,8],['cityHall',25,0],['infantryBarracks',25,6],['rangedBarracks',30,6],['cavalryBarracks',34,6],['heavyInfantryBarracks',25,12],['siegeBarracks',31,12]])add(id,x,y);
 const g=E.mask(o.tiles);for(const b of list)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)g[y*E.W+x]=1;
 for(let y=0;y<E.H;y++)for(let x=0;x<E.W;x++)if(E.fits(g,x,y,2,2)){add('smallHome',x,y);for(let yy=y;yy<y+2;yy++)for(let xx=x;xx<x+2;xx++)g[yy*E.W+xx]=1;}
 assert.equal(E.validate(list,o,cat),null);const stats=E.evaluate(list,o);stats.equivalent=E.equivalent(stats,o);const c={list,stats,options:o};
 const n=E.relocateAdministration(c,cat,Date.now()+2000);assert.equal(E.validate(n.list,o,cat),null);
 assert.ok(n.stats.coins>stats.coins);assert.ok(n.stats.equivalent.total>=stats.equivalent.total-.001);assert.equal(n.list.length,list.length);
 assert.equal(n.stats.food,stats.food);assert.equal(n.stats.goods,stats.goods);assert.ok(n.administrationMoves>0);
 for(const b of list.filter(b=>b.kind!=='home'&&b.id!=='furnace'))assert.deepEqual(n.list.find(t=>t.uid===b.uid),b);
 assert.equal(n.list.find(b=>b.id==='furnace').happyMax,0);assert.notEqual(n.list.find(b=>b.id==='furnace').x,8);
 assert.deepEqual(n.list.map(b=>b.uid).sort((a,b)=>a-b),list.map(b=>b.uid).sort((a,b)=>a-b));
});
