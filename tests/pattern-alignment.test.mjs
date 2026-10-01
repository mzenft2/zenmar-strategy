import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import '../data.js';import '../engine.js';import '../patterns.js';
const E=HOH_ENGINE,file=JSON.parse(fs.readFileSync(new URL('../references/zenmar-normalized.json',import.meta.url)));
const loaded=E.readProject(HOH_DATA.buildings,file),base=loaded.options,full=HOH_PATTERNS[0];
// The library patterns span the whole board, so the fixture is a crop: places in columns 0-7
// and rows 0-6, with the buildings that lie entirely inside them. It can then move by one place.
const inside=b=>b.x+b.w<=32&&b.y+b.h<=28;
const pattern={name:'Wycinek',source:null,tiles:full.tiles.map((v,i)=>v&&i%10<8&&Math.floor(i/10)<7),layout:full.layout.filter(inside)};
const shiftedTiles=pattern.tiles.map((v,i)=>i%10>0&&pattern.tiles[i-1]),expected={x:4,y:0};
const mirroredTiles=pattern.tiles.map((v,i)=>pattern.tiles[Math.floor(i/10)*10+9-i%10]);

test('a pattern is placed where the land is: shifted land gives the same shift, mirrored land a mirror image',()=>{
 assert.ok(pattern.layout.length>80,'the crop keeps a real city: '+pattern.layout.length);
 const same=E.alignPattern(pattern.layout,pattern.tiles)[0];
 assert.equal(same.fit,1);assert.equal(same.symmetry,0);assert.deepEqual(same.shift,{x:0,y:0});assert.equal(same.shifted,false);
 const moved=E.alignPattern(pattern.layout,shiftedTiles)[0];
 assert.equal(moved.fit,1,'every building fits again after the shift');assert.equal(moved.symmetry,0);assert.deepEqual(moved.shift,expected);assert.equal(moved.shifted,true);
 assert.ok(moved.layout.every((b,i)=>b.x===pattern.layout[i].x+expected.x&&b.y===pattern.layout[i].y+expected.y&&b.id===pattern.layout[i].id));
 const mirrored=E.alignPattern(pattern.layout,mirroredTiles)[0];
 assert.equal(mirrored.fit,1);assert.equal(mirrored.layout.length,pattern.layout.length);assert.ok(mirrored.shifted);
 const terrain=E.mask(mirroredTiles);assert.ok(mirrored.layout.every(b=>E.fits(terrain,b.x,b.y,b.w,b.h)));
 // Without alignment a part of the pattern is lost on the shifted land; aligned, nothing is.
 const o=E.normalized({...base,tiles:shiftedTiles,engineMode:'frontiers',enforceLayout:true}),cat=E.prepare(HOH_DATA.buildings,o);
 const raw=E.patternStarter(cat,o,o.oldCount,pattern),aligned=E.patternStarter(cat,o,o.oldCount,{...pattern,layout:moved.layout});
 assert.ok(raw.info.dropped.outside>10,'raw placement loses buildings: '+raw.info.dropped.outside);
 assert.equal(aligned.info.dropped.outside,0);
 assert.deepEqual(E.alignPattern([],pattern.tiles),[]);
 assert.ok(E.alignPattern(pattern.layout,pattern.tiles,8).length<=8);
 // A whole-board pattern on its own land: the identity placement stays the best one.
 const fixed=E.alignPattern(full.layout,full.tiles)[0];assert.equal(fixed.fit,1);assert.equal(fixed.shifted,false);
});

test('tracing paper: on half the land a whole-board pattern is used in chunks, hanging over the board if needed',()=>{
 const right=full.tiles.map((v,i)=>v&&i%10>=5),terrain=E.mask(right);
 const placements=E.alignPattern(full.layout,right,3);
 assert.equal(placements.length,3);
 assert.ok(placements[0].fit>=.4&&placements[0].fit<=.6,'about half of the pattern lands on half the land: '+placements[0].fit.toFixed(2));
 assert.ok(placements.some(a=>a.symmetry===0&&Math.abs(a.shift.x)>=8),'another chunk of the same pattern is tried');
 assert.ok(placements.some(a=>a.symmetry!==0),'another symmetry is tried');
 for(const a of placements){assert.equal(a.layout.length,a.kept);assert.ok(a.layout.every(b=>E.fits(terrain,b.x,b.y,b.w,b.h)),'only buildings on the land remain');}
 const overhang=placements.find(a=>a.symmetry===0&&a.shift.x>=8);
 assert.ok(overhang&&overhang.fit>=.3,'a chunk from the left of the pattern lands on the right of the land: '+(overhang&&overhang.fit.toFixed(2)));
});

test('the placement queue gives every pattern its best placement first, then the other chunks, then the other symmetries',()=>{
 const far={name:'far',tiles:pattern.tiles.map(t=>!t),layout:pattern.layout};
 const queue=E.patternPlacements([far,pattern],shiftedTiles);
 assert.equal(queue.length,6);
 assert.deepEqual(queue.map(q=>q.rank),[0,0,1,1,2,2]);
 assert.equal(queue[0].p.name,pattern.name,'equal fit: the land that overlaps more goes first');assert.equal(queue[1].p.name,'far');
 assert.ok(queue.slice(2,4).every(q=>q.a.shifted&&q.a.symmetry===0),'rank 1 is another chunk of the same symmetry');
 assert.ok(queue.slice(4).every(q=>q.a.symmetry!==0),'rank 2 is another symmetry');
 assert.deepEqual(E.patternPlacements([],shiftedTiles),[]);
});

test('library mode rebuilds the most fitting placement on shifted land and reports the shift',()=>{
 const o=E.normalized({...base,tiles:shiftedTiles,engineMode:'reference-schemes',enforceLayout:true}),cat=E.prepare(HOH_DATA.buildings,o);
 const c=E.searchReferenceSchemes(cat,o,o.oldCount,7,Date.now()+30000,[pattern],0);
 assert.ok(c,'city built from the shifted pattern');
 assert.equal(E.validate(c.list,o,cat),null);
 assert.equal(c.schemeOrigin.name,pattern.name);assert.equal(c.schemeOrigin.similarity,1);assert.equal(c.schemeOrigin.library,1);
 assert.deepEqual(c.schemeOrigin.alignment.shift,expected);assert.equal(c.schemeOrigin.alignment.shifted,true);
 assert.equal(c.schemeOrigin.dropped.outside,0);
 assert.deepEqual(c.schemeOrigin.placement,{index:0,of:3,rank:0});
});
