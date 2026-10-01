import test from 'node:test';import assert from 'node:assert/strict';import '../data.js';import '../engine.js';
const E=HOH_ENGINE;
const base=E.normalized({era:'early-gothic',tiles:Array(80).fill(true),interval:3,night:8,goodsTarget:0,sparkCap:0,goodsPerBatch:70,sparksPerBatch:95,premium:{premiumFarm:0,premiumHome:0,premiumCulture:0},optional:['collectableMinoanWatchtowerV2'],towerLevel:3,fullArmy:false,fountain:true,fountainLevel:32,workshopCounts:{jeweler:0,glassblower:0,alchemist:0},oldCount:0,foodPerGood:181,foodPerSpark:133.368421,goldPerBatch:84000,goldSparksPerBatch:170,goldCap:8400000,searchStarts:3,searchSeconds:30});
const cat=E.prepare(HOH_DATA.buildings,base);
const at=(id,x,y,uid)=>({...cat[id],x,y,uid});

test('a pair is two large sources of the same size touching; small ones in a column, a large one beside medium ones and the tower are not',()=>{
 assert.deepEqual(E.layoutQuality([at('moderateCulture',5,5,1),at('moderateCulture',7,5,2)],base).pairs,[[1,2]]);
 assert.equal(E.layoutQuality([at('littleCulture',5,5,1),at('littleCulture',5,6,2),at('littleCulture',5,7,3)],base).pairs.length,0,'a column of small sources');
 assert.equal(E.layoutQuality([at('moderateCulture',5,5,1),at('compactCulture',7,5,2),at('compactCulture',7,6,3)],base).pairs.length,0,'one large and two medium');
 assert.equal(E.layoutQuality([at('moderateCulture',5,5,1),at('collectableMinoanWatchtowerV2',7,5,2)],base).pairs.length,0,'the tower is not a culture of the same kind');
});

test('every source at the edge of the land is flagged, the fountain and the tower included; touching a range by one corner waters the whole building',()=>{
 assert.deepEqual(E.layoutQuality([at('fountain',0,5,1)],base).edges,[1]);
 assert.deepEqual(E.layoutQuality([at('collectableMinoanWatchtowerV2',0,5,1)],base).edges,[1]);
 assert.deepEqual(E.layoutQuality([at('moderateCulture',0,5,1)],base).edges,[1]);
 assert.deepEqual(E.layoutQuality([at('fountain',10,10,1)],base).edges,[]);
 const fountain=at('fountain',10,10,1),farm=at('domesticFarm',10+4+fountain.range-1,10+4+fountain.range-1,2);
 assert.ok(E.reaches(fountain,farm),'one corner inside the range is enough');
 assert.ok(!E.reaches(fountain,{...farm,x:farm.x+1}),'one column further and the range is missed');
 assert.equal(E.rawHappiness(farm,[fountain,farm]),fountain.points,'the corner touch delivers the full points');
});

test('a hole costs two average cells of output: a few holes lose unless the output pays for them, and the rule is transitive',()=>{
 const one={...base,tiles:Array(80).fill(false).map((_,i)=>i===0)},four={...base,tiles:Array(80).fill(false).map((_,i)=>i<2||i===10||i===11)};
 const homes=(o,n)=>{const out=[];for(let y=0;y<8&&out.length<n;y+=2)for(let x=0;x<8&&out.length<n;x+=2)if(E.fits(E.mask(o.tiles),x,y,2,2))out.push(at('smallHome',x,y,out.length+1));return out;};
 const stats=total=>({equivalent:{total},armyDeficit:0,excess:0,fountainBuildings:0});
 // 16 cells, value 100: a hole costs 2 × 100/16 = 12.5, so four holes cost half the output.
 const full={list:homes(one,4),stats:stats(100),options:one},gappy=total=>({list:homes(one,3),stats:stats(total),options:one});
 assert.equal(E.layoutQuality(gappy(101).list,one).free-E.layoutQuality(full.list,one).free,4);
 assert.equal(E.rankChoices(gappy(101),full),1,'one percent more output does not pay for four holes');
 assert.equal(E.rankChoices(gappy(240),full),-1,'output well above the cost of the holes does');
 assert.equal(E.rankChoices(gappy(100),full),1,'equal output: the complete city wins');
 const complete={list:homes(four,16),stats:stats(100),options:four},holey={list:homes(four,10),stats:stats(120),options:four};
 assert.equal(E.layoutQuality(holey.list,four).free,24);
 assert.equal(E.rankChoices(complete,holey),-1,'twenty-four holes in sixty-four cells are not paid for by twenty percent');
 const mid={list:homes(four,14),stats:stats(110),options:four};
 assert.ok([complete,mid,holey].every(x=>E.rankChoices(x,x)===0));
 assert.equal(E.rankChoices(complete,mid),-1);assert.equal(E.rankChoices(mid,holey),-1);assert.equal(E.rankChoices(complete,holey),-1,'transitive');
});

test('at equal output and equal border cost, the better used culture wins; output is never traded for it',()=>{
 const stats=total=>({equivalent:{total},armyDeficit:0,excess:0,fountainBuildings:0});
 // The same footprints and the same single edge source; only the source placement differs. A large source without a reach target, not a 1x1:
 // since 8.56 a small piece reaching a barracks is clutter and costs (Marek: "hyper-watering around the barracks").
 const A={list:[at('largeCulture',0,0,1),at('infantryBarracks',4,0,2)],stats:stats(100),options:base};
 const B={list:[at('largeCulture',0,12,1),at('infantryBarracks',4,0,2)],stats:stats(100),options:base};
 assert.equal(E.layoutQuality(A.list,base).cost,E.layoutQuality(B.list,base).cost);
 assert.equal(E.usefulCulture(A.list),1);assert.equal(E.usefulCulture(B.list),0);
 assert.equal(E.rankChoices(A,B),-1);assert.equal(E.rankChoices(B,A),1);
 assert.equal(E.rankChoices(A,{...B,stats:stats(101)}),1,'a value gain above the band still wins');
 assert.equal(E.rankChoices(A,{...B,stats:stats(100.2)}),1,'even a small value gain is not traded for a nicer coefficient');
});
