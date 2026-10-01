// Decode the public protobuf-net catalogue using its published Models.Hoh schema.
// Field numbers and enum values: Ingweland/forge-of-games, commit 17bf906e3b91ada869eefcec708bc62887b40014.
const fs=require('fs'),crypto=require('crypto');
function fields(b){let i=0,o={};const num=()=>{let n=0,k=0,v;do{if(i>=b.length||k>49)throw Error('Invalid protobuf number');v=b[i++];n+=(v&127)*2**k;k+=7;}while(v&128);return n;};while(i<b.length){const tag=num(),id=tag>>3,wire=tag&7;let v;if(wire===0)v=num();else if(wire===2){const n=num();if(i+n>b.length)throw Error('Truncated protobuf');v=b.subarray(i,i+n);i+=n;}else if(wire===1){v=b.readDoubleLE(i);i+=8;}else if(wire===5){v=b.readFloatLE(i);i+=4;}else throw Error('Unsupported protobuf wire '+wire);(o[id]??=[]).push(v);}return o;}
const first=(o,k,fallback=0)=>o?.[k]?.[0]??fallback,text=(o,k)=>String(first(o,k,'')),nested=(o,k)=>o?.[k]?.map(fields)||[];
const groups={1:'alchemist',2:'artisan',7:'averageHome',14:'carpenter',16:'cavalryBarracks',20:'cityHall',23:'collectableAmphitheatre',24:'collectableArchitectsStudioV2',25:'collectableMinoanWatchtowerV2',26:'collectableSchoolV2',27:'compactCulture',28:'domesticFarm',29:'fountain',34:'furnace',35:'glassblower',37:'heavyInfantryBarracks',38:'heroAcademy',41:'infantryBarracks',44:'jeweler',46:'largeCulture',47:'littleCulture',50:'moderateCulture',60:'premiumCulture',61:'premiumFarm',63:'premiumHome',74:'rangedBarracks',76:'ruralFarm',79:'scribe',80:'siegeBarracks',82:'smallHome',86:'spiceMerchant',87:'stoneMason',88:'tailor'};
module.exports=function readFog(){
 const file=fs.readFileSync('research/fog-coreData.json'),source=JSON.parse(file),root=fields(Buffer.from(source.data,'base64'));
 const ages=nested(root,16).map(a=>({sourceAge:text(a,1),index:first(a,2)})).filter(a=>a.index>=2&&a.index<=15).sort((a,b)=>a.index-b.index);
 const buildings=[];let fountain;
 for(const b of nested(root,2)){
  if(!b[3]?.includes(1)||!groups[first(b,8)])continue;
  const id=groups[first(b,8)],comps=nested(b,4),comp=n=>comps.flatMap(c=>nested(c,n)),culture=comp(102)[0],grant=comp(103)[0],prods=comp(106),p=prods[0],buff=nested(b,2)[0],age=nested(b,1)[0];
  const kind=({2:'barracks',5:'special',6:'special',7:'happiness',8:'special',10:'farm',13:'home',22:'special',23:'workshop'})[first(b,9)];if(!kind)continue;
  const item={id,sourceId:'building.'+text(b,5),name:id,kind,w:first(b,10),h:first(b,6),level:first(b,7),age:age?'age.'+text(age,1):null,workers:first(grant,1),needs:Math.max(0,...prods.map(p=>first(nested(p,7)[0],1))),hours:first(p,3)/3600,rewards:nested(p,4).flatMap(r=>nested(r,105).map(v=>({resource:text(v,2).replace(/^resource\./,''),amount:first(v,1)}))),happyMax:first(buff,3),factors:Object.fromEntries(nested(buff,2).map(v=>[text(v,2).replace(/^resource\./,''),first(v,1)])),factor:first(buff,1),range:first(culture,1),points:first(culture,3),premium:id.startsWith('premium'),oldWorkshop:false};
  if(id==='fountain'){
   const ranges=Object.fromEntries(nested(culture,2).map(v=>[first(v,1),first(v,2)]));
   fountain={...item,levelsByAge:Object.fromEntries(nested(culture,4).map(a=>{const points=Object.fromEntries(nested(a,2).map(v=>[first(v,1),first(v,2)])),last=Math.max(...Object.keys(points).map(Number));return [text(a,1),Object.keys(ranges).map(Number).sort((a,b)=>a-b).map(level=>({level,points:points[Math.min(level,last)],range:ranges[level]}))];}))};continue;
  }
  if(id==='collectableMinoanWatchtowerV2'){
   const points=first(culture,3),range=first(culture,1),workerLevels=Object.fromEntries(nested(grant,2).map(v=>[first(v,1),first(v,2)]));
   const dynamic=nested(culture,4);item._culture=dynamic;item._workers=workerLevels;
  }
  buildings.push(item);
 }
 return {ages,buildings,fountain,version:source.version,sha256:crypto.createHash('sha256').update(file).digest('hex')};
};
