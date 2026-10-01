// Manual transcription of Marek's 2026-09-14 screenshot (430549dd/0d7d2d41/56ec2024).
// Geometry only. All levels and production parameters come from the active catalogue.
import '../data.js';import '../engine.js';import fs from 'node:fs';
const E=HOH_ENGINE,tiles=Array.from({length:80},(_,i)=>{const x=i%10,y=Math.floor(i/10);return y<4?x>=3:y===4?x>=2:true;});
const options=E.normalized({tiles,era:'early-gothic',interval:3,night:8,goodsTarget:0,sparkCap:7000,goodsPerBatch:70,sparksPerBatch:95,optional:['collectableMinoanWatchtowerV2'],towerLevel:3,premium:{premiumFarm:0,premiumHome:0,premiumCulture:1},fountain:true,fountainLevel:32,fountainPoints:5000,fountainRange:3,subscription:false,fullArmy:true,siegeMin:100,workshopCounts:{jeweler:2,glassblower:2,alchemist:2},oldCount:5,compareSparks:false,engineMode:'frontiers',searchSeconds:600});
const cat=E.prepare(HOH_DATA.buildings,options),list=[];
function add(id,x,y,w=cat[id].w,h=cat[id].h){list.push({...cat[id],x,y,w,h,uid:list.length+1});}
const home=(x,y)=>add('smallHome',x,y),square=(x,y)=>add('moderateCulture',x,y),thin=(x,y,w=2,h=1)=>add('compactCulture',x,y,w,h),farm=(x,y,w=3,h=4)=>add('ruralFarm',x,y,w,h);
add('furnace',12,0);add('cityHall',16,0);for(const y of [0,2,4])home(21,y);add('averageHome',23,0);add('averageHome',23,3);home(26,0);home(28,0);farm(26,2,4,3);farm(26,5,4,3);
add('heavyInfantryBarracks',30,0);add('siegeBarracks',35,0,5,6);add('cavalryBarracks',35,6,5,4);add('rangedBarracks',30,7,5,3);add('infantryBarracks',26,8);
thin(30,5,1,2);add('premiumCulture',31,5);thin(34,5,1,2);
home(12,4);home(14,4);thin(12,6);thin(14,6);home(16,5);home(18,5);add('littleCulture',20,5);farm(20,6);add('glassblower',23,6,3,4);farm(12,7,4,3);farm(16,7,4,3);
home(12,10);square(14,10);thin(16,10,1,2);home(17,10);thin(19,10,1,2);square(20,10);home(22,10);square(24,10);
for(const x of [30,34,36,38])home(x,10);square(32,10);
for(const y of [12,14])for(const x of [12,14])home(x,y);
for(const x of [16,19,22,25,28,31])farm(x,12);add('alchemist',34,12,3,4);add('stoneMason',37,12,3,4);
for(const x of [8,10,12,16,19,23,27,31,34,38])home(x,16);for(const x of [14,21,25,29,36])square(x,16);for(const x of [18,33])thin(x,16,1,2);
add('stoneMason',8,18,3,4);farm(11,18);add('jeweler',14,18,3,4);for(const x of [17,20,23,26,29,32,35])farm(x,18);home(38,18);home(38,20);
for(const x of [0,2,4,6])home(x,20);
for(const x of [0,2,4,6,8,10,14,16,18,23,25,29,31,35,38])home(x,22);for(const x of [12,21,27,33])square(x,22);thin(20,22,1,2);thin(37,22,1,2);
add('stoneMason',0,24,3,4);add('collectableMinoanWatchtowerV2',3,24);add('fountain',5,24);home(3,26);home(9,24);home(9,26);farm(11,24);farm(14,24);add('jeweler',17,24,3,4);add('alchemist',20,24,3,4);for(const x of [23,26,29,32])farm(x,24);add('glassblower',35,24,3,4);home(38,24);home(38,26);
for(const x of [0,2,4,14,16,20,22,26,28,32,34,38])home(x,28);for(const x of [12,18,24,30,36])square(x,28);add('stoneMason',6,28,3,4);add('stoneMason',9,28,3,4);
for(const x of [0,2,4,12,14,16,18,20,22,24,26,28,30,32,34,36,38])home(x,30);
const error=E.validate(list,E.manualOptions(options),cat);
const stats=E.evaluate(list,options);stats.equivalent=E.equivalent(stats,options);
const counts={};for(const b of list){counts[b.kind]=(counts[b.kind]||0)+b.w*b.h;}
console.log(JSON.stringify({counts,quality:E.layoutQuality(list,options),workers:[stats.needed,stats.available],army:stats.army,food:stats.food,food24:stats.food24,total:stats.equivalent.total,validation:E.validate(list,options,cat)},null,2));
if(error)throw Error(error);
fs.mkdirSync('references',{recursive:true});fs.writeFileSync('references/zenmar-normalized.json',JSON.stringify(E.projectFile(options,{list,stats,options,oldCount:5,manual:true}),null,2));
