/* Happiness geometry and hourly bonus follow Forge of Games (AGPL-3.0).
 * Adapted to plain JavaScript on 2026-09-14. See NOTICE.md and SOURCES.md.
 * Layout search, collection schedule and validation are local additions. */
(function(root){
'use strict';
const W=40,H=32, N=W*H;
const mandatory=['cityHall','furnace','infantryBarracks','rangedBarracks','cavalryBarracks','heavyInfantryBarracks','siegeBarracks'];
// Ordinary farm kinds the player may already own (Marek, 15.09.2026): the engine reuses
// them first and converts one kind into the other only when the city gains at least
// FARM_REBUILD_BAND of its value per rebuilt farm. Removing a surplus farm is not a rebuild.
const FARM_KINDS=['ruralFarm','domesticFarm'],FARM_REBUILD_BAND=.005;
// Marek, 20.09.2026: a city must use at least this share of every farm kind the player declared, or it is not valid.
const OWNED_SHARE=.8;
function farmCounts(list){const n={ruralFarm:0,domesticFarm:0};for(const b of list)if(n[b.id]!==undefined)n[b.id]++;return n;}
function farmQuota(o,list){if(!o.ownedFarms)return null;const n=farmCounts(list),need=FARM_KINDS.map(id=>Math.max(0,(o.ownedFarms[id]||0)-n[id]));if(!need[0]&&!need[1])return null;return need[0]>=need[1]?'ruralFarm':'domesticFarm';}
function farmOrder(o,list,fallback,only=false){const q=farmQuota(o,list);if(!q)return fallback;return only?[q]:[q,...fallback.filter(id=>id!==q)];}
// Lampii via Marek, 16.09.2026: the farm kind a construction starts from follows the
// player's collection rhythm (daily food per cell at full happiness), not the seed; the
// seed still tries the other kind in a minority of attempts and the ranking decides.
function preferredFarm(cat,o){const r=cat.ruralFarm,d=cat.domesticFarm;if(!r||!d)return r?'ruralFarm':'domesticFarm';const per=b=>hourly(b,b.happyMax,'food')*hours(b,o)/(b.w*b.h);return per(d)>per(r)?'domesticFarm':'ruralFarm';}
function otherFarm(id){return id==='ruralFarm'?'domesticFarm':'ruralFarm';}
function farmPerCell(cat,o){return Object.fromEntries(FARM_KINDS.filter(id=>cat[id]).map(id=>{const b=cat[id];return [id,{daily:hourly(b,b.happyMax,'food')*hours(b,o)/(b.w*b.h),workers:b.needs/(b.w*b.h),culture:b.happyMax/(b.w*b.h),storage:b.hours,collected:hours(b,o)}];}));}
function primaryFarm(o){if(!o.ownedFarms)return null;const r=o.ownedFarms.ruralFarm||0,d=o.ownedFarms.domesticFarm||0;return r||d?(r>=d?'ruralFarm':'domesticFarm'):null;}
function farmRebuild(list,o){if(!o.ownedFarms)return 0;const n=farmCounts(list);let unused=0,built=0;for(const id of FARM_KINDS){const owned=o.ownedFarms[id]||0;unused+=Math.max(0,owned-n[id]);built+=Math.max(0,n[id]-owned);}return Math.min(unused,built);}
const current=['jeweler','glassblower','alchemist'];

function eraInfo(o={}){const era=root.HOH_DATA?.eras?.find(e=>e.id===(o.era||'early-gothic'));if(!era)throw Error('Ta epoka nie została jeszcze opracowana.');return era;}
function currentFor(o){return eraInfo(o).current;}
function mandatoryFor(o){return eraInfo(o).mandatory;}
function oldFor(o){return eraInfo(o).oldWorkshop;}
// Marek, 16.09.2026: the furnace target is stated as goods burnt per day. The number of old workshops
// follows from the player's rhythm at full happiness, the same way the furnace variant counts them.
function fuelPerWorkshop(o){const era=eraInfo(o),old=era.oldWorkshop&&era.buildings.find(b=>b.id===era.oldWorkshop);if(!old||!old.rewards?.[0]||!old.hours)return 0;const rhythm={...o};if(!Number.isFinite(rhythm.interval))rhythm.interval=3;if(!Number.isFinite(rhythm.night))rhythm.night=8;return hourly(old,old.happyMax,old.rewards[0].resource)*hours(old,rhythm);}
// Output of the era's farm, home and furnace relative to early gothic, where Marek's reference numbers were taken.
function eraScale(o){const era=eraInfo(o),ref=root.HOH_DATA?.eras?.find(e=>e.id==='early-gothic')||era,rate=(e,id)=>{const b=e.buildings.find(b=>b.id===id);return b&&b.hours&&b.rewards?.[0]?b.rewards[0].amount/b.hours:0;},ratio=id=>{const a=rate(era,id),b=rate(ref,id);return a&&b?a/b:1;};return {farm:ratio('ruralFarm'),home:ratio('smallHome'),furnace:ratio('furnace')};}
function fuelWorkshops(o,goods){const per=fuelPerWorkshop(o);return per>0&&goods>0?Math.min(50,Math.ceil(goods/per-1e-9)):0;}
function fountainProfile(o){if(o.fountainMode==='manual'||o.fountainMode===undefined&&Number.isFinite(o.fountainPoints)&&Number.isFinite(o.fountainRange))return {level:o.fountainLevel||1,points:o.fountainPoints,range:o.fountainRange,manual:true};const p=eraInfo(o).fountainLevels.find(p=>p.level===o.fountainLevel);if(!p)throw Error('Wybierz poziom Fontanny Młodości z katalogu.');return {...p,sourceId:root.HOH_DATA.fountainSourceId,manual:false};}
const engineModes=['legacy','frontiers','compare','rows-horizontal','rows-vertical','edge-bands','reference-schemes','portfolio','polish','shelves'];
const rowMode=mode=>mode==='rows-horizontal'||mode==='rows-vertical';
// Structured concepts build whole cities and keep their producer slots while repairing (rows, edge bands, shelves).
const structured=mode=>rowMode(mode)||mode==='edge-bands'||mode==='shelves';
// Row searches may exchange products between slots, but cannot dissolve the
// production shelves during local housing/culture repairs.
function rowSlots(list){return list.filter(b=>b.kind==='farm'||b.kind==='workshop').map(b=>`${b.x},${b.y},${b.w},${b.h}`).sort().join(';');}
function preservesRows(list,signature){if(!signature)return true;const slots=signature.split(';'),current=new Set(rowSlots(list).split(';'));return slots.every(p=>current.has(p));}
// Marek, 19.09.2026: "long, optimal rows should rule". A row is a straight run of producers (farms and
// workshops) touching end to end inside one band; a producer outside a run of at least ROW_MIN is loose.
// A city keeps its loose producers within LOOSE_SHARE of all producers, or it loses to any city that does.
const ROW_MIN=3,LOOSE_SHARE=.25;
function rowRuns(list){
 const producers=list.filter(b=>b.kind==='farm'||b.kind==='workshop'),inRun=new Set(),runs=[];
 for(const horizontal of [true,false]){
  // Marek, 19.09.2026: "rows appeared, but sideways — not like the schemes": a producer belongs to a row only with its
  // long side across the row (tall farms in a horizontal row, wide ones in a vertical column), as in his city and the library.
  // Marek, 20.09.2026: "farms and workshops, new and old, side by side, touching by the longer side — then the square
  // culture is used best": every producer joins only with its long side across the row.
  const across=b=>horizontal?b.h>=b.w:b.w>=b.h;
  const next=a=>{let best=null,overlap=0;for(const b of producers){if(b===a||!across(b)||!(horizontal?a.x+a.w===b.x:a.y+a.h===b.y))continue;const o=horizontal?Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y):Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);if(o>=Math.min(horizontal?a.h:a.w,horizontal?b.h:b.w)&&o>overlap){overlap=o;best=b;}}return best;};
  const followed=new Set();for(const a of producers){if(!across(a))continue;const n=next(a);if(n)followed.add(n);}
  for(const start of producers){if(followed.has(start)||!across(start))continue;const run=[start],seen=new Set(run);let cur=start,n;while((n=next(cur))&&!seen.has(n)){run.push(n);seen.add(n);cur=n;}if(run.length>=ROW_MIN){runs.push(run);run.forEach(b=>inRun.add(b));}}
 }
 return {producers:producers.length,runs:runs.sort((a,b)=>b.length-a.length),inRows:inRun.size,loose:producers.length-inRun.size};
}
function rowCompliant(q){return q.loose<=Math.floor(q.producers*LOOSE_SHARE);}
// Marek, 20.09.2026 ("nadal", screen of 8.59: six strips end to end between the barracks rows): small culture pieces
// crammed side by side around the barracks are clutter. With the layout rules on, two small ordinary pieces touching
// where either reaches a barracks is an error the repairs must resolve; a strip is a spacer, never a filler.
function smallCulture(b){return b.points>0&&!b.premium&&b.id!=='fountain'&&b.w*b.h<4;}
function crowdsBarracks(p,list){if(!smallCulture(p))return false;const army=list.filter(b=>b.kind==='barracks');if(!army.length)return false;const near=b=>army.some(a=>reaches(b,a));return list.some(t=>t!==p&&smallCulture(t)&&neighbours(p,t)&&(near(p)||near(t)));}
// 8.54: does producer p continue a row end to end with its long side across the row? Since 8.57 workshops too (Marek).
function joinsRowAcross(p,list){
 for(const b of list){
  if(b===p||(b.kind!=='farm'&&b.kind!=='workshop'))continue;
  if((b.x+b.w===p.x||p.x+p.w===b.x)&&Math.min(p.y+p.h,b.y+b.h)-Math.max(p.y,b.y)>=Math.min(p.h,b.h)&&p.h>=p.w&&b.h>=b.w)return true;
  if((b.y+b.h===p.y||p.y+p.h===b.y)&&Math.min(p.x+p.w,b.x+b.w)-Math.max(p.x,b.x)>=Math.min(p.w,b.w)&&p.w>=p.h&&b.w>=b.h)return true;
 }
 return false;
}
// 8.54: the gates compare every candidate with the current city; its geometry is computed once per city, not once per candidate
// (measured 19.09.2026: 0.70 ms per refinement move, 0.43 ms with the current geometry remembered).
function qualityMemo(o){let list=null,quality=null;return l=>{if(l!==list){list=l;quality=layoutQuality(l,o);}return quality;};}
function productionRows(list){
 const producers=list.filter(b=>b.kind==='farm'||b.kind==='workshop');let longest=0;
 for(const horizontal of [true,false]){
  const groups=new Map();
  for(const b of producers){const key=horizontal?`${b.y},${b.h}`:`${b.x},${b.w}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
  for(const row of groups.values()){
   row.sort((a,b)=>horizontal?a.x-b.x:a.y-b.y);let count=0,end=-1;
   for(const b of row){const start=horizontal?b.x:b.y;count=start===end?count+1:1;end=start+(horizontal?b.w:b.h);longest=Math.max(longest,count);}
  }
 }
 return {longest};
}
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function reaches(a,b){return overlap({x:a.x-a.range,y:a.y-a.range,w:a.w+2*a.range,h:a.h+2*a.range},b);}
function collectedHours(storage,interval,night){if(storage<=0)return 0; const day=24-night,n=Math.floor(day/interval),remaining=day-n*interval;return n*Math.min(storage,interval)+Math.min(storage,remaining)+Math.min(storage,night);}
function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
function prepare(data,options){const cat=Object.fromEntries((options.era&&options.era!=='early-gothic'?eraInfo(options).buildings:data).map(b=>[b.id,{...b}])); if(options.fountain){cat.fountain={id:'fountain',name:'Fontanna Młodości',w:4,h:4,kind:'special',level:options.fountainLevel||1,workers:0,needs:0,hours:0,rewards:[],happyMax:0,factors:{},factor:0,...fountainProfile(options)};}if(options.optional?.includes('collectableMinoanWatchtowerV2')){const tower=cat.collectableMinoanWatchtowerV2,profile=tower.levels.find(p=>p.level===options.towerLevel);if(!profile)throw Error('Wybierz posiadany poziom Wieży Minojskiej.');Object.assign(tower,profile);}return cat;}
function mask(tiles){const grid=new Int16Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++)grid[y*W+x]=tiles[Math.floor(y/4)*10+Math.floor(x/4)]?0:-1;return grid;}
function fits(grid,x,y,w,h){if(x<0||y<0||x+w>W||y+h>H)return false;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(grid[j*W+i]!==0)return false;return true;}
function paint(grid,b,value){for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)grid[y*W+x]=value;}
function rawHappiness(b,list){return list.reduce((s,p)=>s+(p.points&&p!==b&&reaches(p,b)?p.points:0),0);}
function happiness(b,list){return Math.min(b.happyMax,rawHappiness(b,list));}
function fountainCoverage(list){const f=list.find(b=>b.id==='fountain'),targets=f?list.filter(b=>b.happyMax&&reaches(f,b)):[];return {fountainBuildings:targets.length,fountainHomes:targets.filter(b=>b.kind==='home').length,fountainProducers:targets.filter(b=>b.kind==='farm'||b.kind==='workshop').length,fountainBarracks:targets.filter(b=>b.kind==='barracks').length};}
// Touch a single row/column of the coverage, including its corner cells.
// These are proposals, not extra range or a weaker collision rule.
function sourceEdgePositions(s,b){
 const left=s.x-s.range,top=s.y-s.range,right=s.x+s.w+s.range,bottom=s.y+s.h+s.range,out=[],seen=new Set();
 const add=(x,y)=>{const key=x+','+y;if(x<0||y<0||x+b.w>W||y+b.h>H||seen.has(key))return;seen.add(key);out.push({...b,x,y});};
 for(let x=left-b.w+1;x<right;x++){add(x,top-b.h+1);add(x,bottom-1);}
 for(let y=top-b.h+1;y<bottom;y++){add(left-b.w+1,y);add(right-1,y);}
 return out;
}
function hours(b,o){return collectedHours(b.hours*(o.subscription?2:1),o.interval,o.night);}
function hourly(b,happy,resource){const reward=b.rewards.find(r=>r.resource===resource);if(!reward||!b.hours)return 0;const base=reward.amount/b.hours;return Math.min(2*base,base+Math.floor(Math.min(happy,b.happyMax)*(b.factors[resource]??b.factor??0)+1e-8));}
// Minimum happiness per barracks (Marek, 15.09.2026): armyMin holds a percentage for each
// barracks id; siegeMin stays as the legacy single exception read from older saves.
function armyMinimum(id,o){const v=o.armyMin?.[id];return Number.isFinite(v)?v:id==='siegeBarracks'?(o.siegeMin??100):100;}
function armyNeed(b,o){return b.happyMax*armyMinimum(b.id,o)/100;}
function armyGain(b,before,after,o){const limit=armyNeed(b,o);return (Math.min(after,limit)-Math.min(before,limit))/Math.max(1,b.happyMax);}
function evaluate(list,o){let armyDeficit=0;let food=0,food24=0,excess=0,consumed=0,coins=0,goods=0,oldGoods=0,available=0,needed=0,army=0,armyCount=0,full=0,happyCount=0;const byType={},byType24={},details=[];let oldGoods24=0;for(const b of list){const raw=rawHappiness(b,list),happy=Math.min(raw,b.happyMax),fraction=b.happyMax?happy/b.happyMax:1;available+=b.workers;needed+=b.needs;const effective=hours(b,o);food+=hourly(b,happy,'food')*effective;food24+=hourly(b,happy,'food')*24;if(b.happyMax){excess+=Math.max(0,raw-b.happyMax);consumed+=happy;}coins+=hourly(b,happy,'coins')*effective;let output=0;if(b.kind==='workshop'){const resource=b.rewards[0]?.resource;output=resource?hourly(b,happy,resource)*effective:0;goods+=output;const output24=resource?hourly(b,happy,resource)*24:0;byType24[b.id]=(byType24[b.id]||0)+output24;if(b.oldWorkshop){oldGoods+=output;oldGoods24+=output24;}byType[b.id]=(byType[b.id]||0)+output;}if(b.kind==='barracks'){army+=fraction;armyCount++;armyDeficit+=Math.max(0,armyNeed(b,o)-happy)/Math.max(1,b.happyMax);}if(b.happyMax){happyCount++;if(fraction>=.999)full++;}details.push({id:b.uid,happy,raw,excess:Math.max(0,raw-b.happyMax),fraction,food:hourly(b,happy,'food')*effective,goods:output});}
const converted=Math.min(o.sparkCap,oldGoods);const sparks=Math.floor(converted/o.goodsPerBatch)*o.sparksPerBatch;
return {armyDeficit,food,food24,oldGoods24,byType24,...fountainCoverage(list),sparks24:Math.floor(Math.min(o.sparkCap,oldGoods24)/o.goodsPerBatch)*o.sparksPerBatch,excess,consumed,coins,goods,oldGoods,sparks,converted,available,needed,spare:available-needed,army:armyCount?army/armyCount:1,full,happyCount,byType,details,used:list.reduce((s,b)=>s+b.w*b.h,0),buildings:list.length};}
function validateOptions(o){if(o.siegeMin!==undefined&&(!Number.isFinite(o.siegeMin)||o.siegeMin<90||o.siegeMin>100))throw Error('Minimum szczęścia oblężniczych musi wynosić od 90% do 100%.');if(o.armyMin!==undefined&&(!o.armyMin||typeof o.armyMin!=='object'||Object.entries(o.armyMin).some(([id,v])=>!mandatory.includes(id)||!id.endsWith('Barracks')||!Number.isInteger(v)||v<0||v>100)))throw Error('Minimum szczęścia koszar musi wynosić od 0% do 100%.');if(o.ownedFarms!==undefined&&(!o.ownedFarms||typeof o.ownedFarms!=='object'||Object.entries(o.ownedFarms).some(([id,v])=>!FARM_KINDS.includes(id)||!Number.isInteger(v)||v<0||v>80)))throw Error('Liczba posiadanych farm musi wynosić od 0 do 80.');if(o.searchSeconds!==undefined&&![30,60,120,300,600].includes(o.searchSeconds))throw Error('Wybierz 30 s, 1, 2, 5 albo 10 minut szukania.');if(o.engineMode!==undefined&&!engineModes.includes(o.engineMode))throw Error('Nieznany silnik układania.');if(o.searchStarts!==undefined&&(!Number.isInteger(o.searchStarts)||o.searchStarts<3||o.searchStarts>12))throw Error('Nieprawidłowa dokładność wyszukiwania');if(o.workshopCounts){for(const id of currentFor(o))if(!Number.isInteger(o.workshopCounts[id])||o.workshopCounts[id]<0||o.workshopCounts[id]>20)throw Error('Nieprawidłowa liczba warsztatów');if(!Number.isInteger(o.oldCount)||o.oldCount<0||o.oldCount>50)throw Error('Nieprawidłowa liczba starych warsztatów');if(o.fuelGoods!==undefined&&(!Number.isFinite(o.fuelGoods)||o.fuelGoods<0||o.fuelGoods>100000))throw Error('Nieprawidłowa wartość: fuelGoods');for(const id of ['foodPerGood','foodPerSpark','goldPerBatch','goldSparksPerBatch','goldCap'])if(!Number.isFinite(o[id])||o[id]<(id==='goldPerBatch'?1:0)||o[id]>1e10)throw Error('Nieprawidłowy przelicznik: '+id);}if(!eraInfo(o).mandatory.includes('furnace')&&((o.goldCap||0)>0||(o.sparkCap||0)>0))throw Error('Piec nie jest dostępny w tej epoce — limity wymiany muszą wynosić zero.');if(o.oldCount&&!oldFor(o))throw Error('W tej epoce nie ma starszych warsztatów do wybranego wariantu pieca.');if(!Array.isArray(o.tiles)||o.tiles.length!==80||o.tiles.some(v=>typeof v!=='boolean'))throw Error('Zaznacz dostępny teren.');for(const [key,min,max] of [['interval',.25,16],['night',0,16],['goodsTarget',0,5000],['sparkCap',0,100000],['goodsPerBatch',1,10000],['sparksPerBatch',1,100000]])if(!Number.isFinite(o[key])||o[key]<min||o[key]>max)throw Error('Nieprawidłowa wartość: '+key);for(const v of Object.values(o.premium||{}))if(!Number.isInteger(v)||v<0||v>100)throw Error('Liczba premium musi być całkowita (0–100).');if(o.optional?.includes('collectableMinoanWatchtowerV2')&&(!Number.isInteger(o.towerLevel)||o.towerLevel<1||o.towerLevel>10))throw Error('Wybierz posiadany poziom Wieży Minojskiej.');if(o.fountain){const p=fountainProfile(o);if(!Number.isInteger(p.level)||p.level<1||p.level>100||!Number.isFinite(p.points)||p.points<1||!Number.isInteger(p.range)||p.range<1||p.range>10)throw Error('Nieprawidłowe dane Fontanny.');}for(const id of o.optional||[])if(!eraInfo(o).buildings.some(b=>b.id===id))throw Error('Budynek nie jest dostępny w tej epoce: '+id);}
function development(s,o){return o.balanced?s.byType24:s.byType;}
function fuel(s,o){return o.balanced?s.oldGoods24:s.oldGoods;}
// Buildings the player ticks in the form. DominikRahl, 16.09.2026: an unticked academy stayed on the map,
// because validation demanded the ticked ones but tolerated the rest. Now an unticked one is a fault,
// so a continued search adapts the previous city (which drops surplus) instead of keeping it as is.
const OPTIONAL_IDS=['collectableSchoolV2','collectableArchitectsStudioV2','heroAcademy','collectableMinoanWatchtowerV2'];
function validate(list,o,cat){const grid=mask(o.tiles),counts={};for(const b of list){if(!cat[b.id])return 'Nieznany budynek';const def=cat[b.id];if(!((b.w===def.w&&b.h===def.h)||(b.w===def.h&&b.h===def.w)))return 'Błędne wymiary';if(!Number.isInteger(b.x)||!Number.isInteger(b.y)||!fits(grid,b.x,b.y,b.w,b.h))return 'Budynek poza terenem lub kolizja';paint(grid,b,1);counts[b.id]=(counts[b.id]||0)+1;}for(const id of [...mandatoryFor(o),...o.optional,...(o.fountain?['fountain']:[])])if(counts[id]!==1)return 'Brak wymaganego budynku: '+id;for(const id of OPTIONAL_IDS)if(counts[id]&&!(o.optional||[]).includes(id))return 'Budynek niezaznaczony: '+id;
// Marek, 20.09.2026: "two cultures of the same size touching is always an error, there is always a better solution" — with the
// layout rules on, such a city is not valid at all; the repairs must replace one of the pair.
if(o.enforceLayout){const src=list.filter(b=>b.points);for(let i=0;i<src.length;i++)for(let j=i+1;j<src.length;j++)if(sameCultureClass(src[i],src[j])&&neighbours(src[i],src[j]))return 'Dwie kultury tej samej wielkości stykają się bokiem';for(const s of src)if(crowdsBarracks(s,list))return 'Stłoczona mała kultura przy koszarach';}if(counts.fountain&&!o.fountain)return 'Budynek niezaznaczony: fountain';for(const [id,n] of Object.entries(o.premium))if((counts[id]||0)!==n)return 'Nie zachowano premium: '+id;if(o.enforceLayout)for(const [id,n] of Object.entries(o.ownedFarms||{}))if(n>0&&(counts[id]||0)<Math.ceil(n*OWNED_SHARE))return 'Za mało posiadanych farm w mieście: '+id;const s=evaluate(list,o);if(s.spare<0)return 'Brak pracowników';if(o.fullArmy&&s.armyDeficit>1e-5)return 'Koszary nie osiągają wymaganego szczęścia';if(o.workshopCounts){for(const id of currentFor(o))if((counts[id]||0)!==o.workshopCounts[id])return 'Nie zachowano liczby warsztatów: '+id;if((list.filter(b=>b.oldWorkshop).length)!==o.oldCount)return 'Nie zachowano liczby starych warsztatów';if(o.requireFuel&&s.oldGoods+.01<o.sparkCap)return 'Za mało odbieranych towarów do pieca';return null;}if(o.balanced&&s.oldGoods24+.01<o.sparkCap)return 'Za mało produkcji starych towarów na pełny limit pieca';if(currentFor(o).some(id=>(development(s,o)[id]||0)+.01<o.goodsTarget))return 'Nie osiągnięto celu towarów';return null;}
function positions(grid,b,score,rng,limit=1){if(!b)return [];const best=[];for(const [w,h] of b.w===b.h?[[b.w,b.h]]:[[b.w,b.h],[b.h,b.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){if(!fits(grid,x,y,w,h))continue;const p={...b,x,y,w,h};let contact=0;for(let i=x;i<x+w;i++){if(y===0||grid[(y-1)*W+i])contact++;if(y+h===H||grid[(y+h)*W+i])contact++;}for(let j=y;j<y+h;j++){if(x===0||grid[j*W+x-1])contact++;if(x+w===W||grid[j*W+x+w])contact++;}const v=score(p)+contact*.03+rng()*.02;p._score=v;if(best.length<limit||v>best[best.length-1]._score){best.push(p);best.sort((a,b)=>b._score-a._score);if(best.length>limit)best.pop();}}return best;}
// General grid neighbourhood search. No city coordinates or building-row templates.
function normalized(input){
 const o={...input};
 if(!o.workshopCounts)o.workshopCounts=Object.fromEntries(currentFor(o).map(id=>[id,Math.ceil((o.goodsTarget||0)/1440)]));
 if(!mandatoryFor(o).includes('furnace')){o.goldCap=0;o.sparkCap=0;}if(o.oldCount===undefined&&Number.isFinite(o.fuelGoods))o.oldCount=fuelWorkshops(o,o.fuelGoods);o.oldCount??=0;o.compareSparks??=true;
 // Marek, 20.09.2026: goods, sparks and gold are worth what the era's farm and home produce, not the late-era numbers.
 const scale=eraScale(o);o.foodPerGood??=Math.round(181*scale.farm*1e6)/1e6;o.foodPerSpark??=Math.round(181*70/95*scale.farm*1e6)/1e6;o.searchStarts??=6;o.goldPerBatch??=Math.max(1,Math.round(84000*scale.home));o.goldSparksPerBatch??=170;o.goldCap??=8400000;
 if(o.engineMode!==undefined&&!engineModes.includes(o.engineMode))throw Error('Nieznany silnik układania.');
 return o;
}
function equivalent(s,o){
 // Only full furnace batches are spent. Never value both spent goods and their sparks.
 const spent=Math.floor(Math.min(o.sparkCap,s.oldGoods)/o.goodsPerBatch)*o.goodsPerBatch;
 const goldSpent=Math.floor(Math.min(o.goldCap,s.coins)/o.goldPerBatch)*o.goldPerBatch;
 const goldSparks=goldSpent/o.goldPerBatch*o.goldSparksPerBatch;
 const retained=s.goods-spent;
 const parts={food:s.food,goods:retained*o.foodPerGood,sparks:s.sparks*o.foodPerSpark,gold:goldSparks*o.foodPerSpark};
 return {...parts,total:Object.values(parts).reduce((a,b)=>a+b,0),retained,spent,goldSparks,goldSpent};
}
function searchCity(cat,o,oldCount,seed,deadline=Infinity){
 const rng=random(seed),terrain=mask(o.tiles);let nextUid=1,examined=0;
 const make=(id,p)=>({...cat[id],...p,uid:nextUid++});
 const gridOf=list=>{const g=terrain.slice();for(const b of list)paint(g,b,1);return g;};
 const edge=p=>{const x=seed%2?p.x:W-p.x-p.w,y=seed%3?p.y:H-p.y-p.h;return -(x+y*W)*.02;};
 const fixed=b=>mandatoryFor(o).includes(b.id)||o.optional.includes(b.id)||b.premium||b.id==='fountain'||b.kind==='workshop';
 let list=[],grid=terrain.slice();
 // Requirements are assembled before farms; geometry is recomputed on the selected mask.
 const required=[...mandatoryFor(o),...o.optional].map(id=>cat[id]);
 for(const [id,n] of Object.entries(o.premium))for(let k=0;k<n;k++)required.push(cat[id]);
 const first=required.filter(b=>!b.points&&b.kind!=='home'&&b.kind!=='farm').sort((a,b)=>b.w*b.h-a.w*a.h);
 const put=b=>{const p=make(b.id,b);list.push(p);paint(grid,p,1);return p;};
 for(const b of first){const p=positions(grid,b,edge,rng)[0];if(!p)return null;put(p);}
 if(o.fountain){
  const potential=p=>{let n=0;for(let y=p.y-2*Math.ceil(p.range/2);y<p.y+p.h+p.range;y+=2)for(let x=p.x-2*Math.ceil(p.range/2);x<p.x+p.w+p.range;x+=2){const h={x,y,w:2,h:2};if(!overlap(p,h)&&reaches(p,h)&&fits(grid,x,y,2,2))n++;}return n;};
  const p=positions(grid,cat.fountain,p=>potential(p)*100+edge(p)*.01,rng)[0];if(!p)return null;put(p);
 }
 const rest=required.filter(b=>!first.includes(b));
 for(const id of currentFor(o))for(let k=0;k<o.workshopCounts[id];k++)rest.push(cat[id]);
 for(let k=0;k<oldCount;k++)rest.push(cat[oldFor(o)]);
 for(const b of rest){
  const p=positions(grid,b,p=>{const f=list.find(t=>t.id==='fountain');if(b.kind==='home')return (f&&reaches(f,p)?1000:0)+edge(p);if(b.points)return list.reduce((v,t)=>v+(t.happyMax&&reaches(p,t)?Math.min(b.points,t.happyMax)/t.happyMax:0),0)*100+edge(p)*.1;
   return edge(p)+(f&&reaches(f,p)?1000:0);},rng)[0];if(!p)return null;put(p);
 }
 const houseFill=(items,allowed=null)=>{
  const g=gridOf(items),out=[...items];
  const permitted=p=>{if(!allowed)return true;for(let y=p.y;y<p.y+p.h;y++)for(let x=p.x;x<p.x+p.w;x++)if(!allowed[y*W+x])return false;return true;};
  // Choose both home sizes by residual geometric fit; never add speculative workers to a fixed count.
  for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++){
   const x=xx,y=yy;if(g[y*W+x])continue;
   let width=0,height=0;while(x+width<W&&g[y*W+x+width]===0)width++;while(y+height<H&&g[(y+height)*W+x]===0)height++;
   const medium=fits(g,x,y,3,3)&&(width===3||height===3);
   const types=medium?['averageHome','smallHome']:['smallHome','averageHome'];for(const id of types){const b=cat[id];if(!b)continue;const p={...b,x,y};if(fits(g,x,y,b.w,b.h)&&permitted(p)){const h=make(id,p);out.push(h);paint(g,h,1);break;}}
  }return out;
 };
 list=houseFill(list);
 const initialFountain=list.find(b=>b.id==='fountain');
 if(initialFountain){
  const coverage=items=>fountainCoverage(items).fountainBuildings;
  let best=list,count=coverage(list);
  for(const h of list.filter(b=>b.id==='smallHome')){
   const block=list.filter(b=>b.id==='smallHome'&&b.x>=h.x&&b.y>=h.y&&b.x+2<=h.x+4&&b.y+2<=h.y+4);if(block.length!==4)continue;
   const moved={...initialFountain,x:h.x,y:h.y},homes=block.map((b,i)=>({...b,x:initialFountain.x+i%2*2,y:initialFountain.y+Math.floor(i/2)*2}));
   const candidate=list.filter(b=>b!==initialFountain&&!block.includes(b)).concat(moved,homes),n=coverage(candidate);
   if(n>count){best=candidate;count=n;}
  }list=best;
 }
 const stats=items=>{examined++;const s=evaluate(items,o);s.equivalent=equivalent(s,o);return s;};
 const utility=s=>s.equivalent.total-
  Math.max(0,s.spare)*1800-Math.max(0,-s.spare)*1e8-
  (o.fullArmy?s.armyDeficit*1e9:0)-(o.requireFuel?Math.max(0,o.sparkCap-s.oldGoods)*10000:0)-s.excess*.005;
 let s=stats(list),value=utility(s);
 function accept(candidate,tolerance=0){const ns=stats(candidate),v=utility(ns);if(ns.spare<0||v<=value+tolerance)return false;list=candidate;s=ns;value=v;return true;}
 // Rebuild only the tiles vacated by the move. Required buildings are never discarded.
 function carve(items,p,canRemove,refill=true){
  if(!fits(terrain,p.x,p.y,p.w,p.h))return null;
  const removed=items.filter(t=>overlap(t,p));if(removed.some(t=>!canRemove(t)))return null;
  const allowed=new Uint8Array(N);for(const b of removed)paint(allowed,b,1);
  let out=items.filter(t=>!removed.includes(t)).concat(p);
  if(refill)out=houseFill(out);return out;
 }
 function supplies(rounds=1){
  for(let round=0;round<rounds&&Date.now()<deadline;round++){
   let best=null,bestValue=value;
   const targets=list.filter(b=>b.happyMax),raw=new Map(targets.map(b=>[b,rawHappiness(b,list)]));
   const placements=[];
   for(const id of ['littleCulture','compactCulture','moderateCulture','largeCulture']){
    const def=cat[id];if(!def)continue;for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
     const p={...def,x,y,w,h};if(!fits(terrain,x,y,w,h))continue;
     const hit=list.filter(b=>overlap(b,p));if(hit.some(b=>fixed(b)||b.kind==='farm')||hit.reduce((n,b)=>n+b.workers,0)>s.spare)continue;
     let gain=0;for(const b of targets){if(!reaches(p,b)||hit.includes(b))continue;const before=raw.get(b),after=Math.min(b.happyMax,before+p.points);gain+=(hourly(b,after,'food')-hourly(b,before,'food'))*hours(b,o);if(b.kind==='workshop'){const r=b.rewards[0].resource;gain+=(hourly(b,after,r)-hourly(b,before,r))*hours(b,o)*o.foodPerGood;}if(o.fullArmy&&b.kind==='barracks')gain+=armyGain(b,before,after,o)*1e8;}
     if(gain>0)placements.push({p,gain:gain/Math.max(1,w*h)});
    }
   }
   placements.sort((a,b)=>b.gain-a.gain);
   for(const {p} of placements.slice(0,35)){
    const candidate=carve(list,make(p.id,p),b=>!fixed(b)&&b.kind!=='farm');if(!candidate)continue;
    const ns=stats(candidate),v=utility(ns);if(ns.spare>=0&&v>bestValue+.01){bestValue=v;best=candidate;}
   }
   if(!best)break;accept(best);
  }
 }
 function farms(){
  if(Date.now()>=deadline)return false;
  const candidates=[];
  for(const id of farmOrder(o,list,seed%3===2?[otherFarm(preferredFarm(cat,o)),preferredFarm(cat,o)]:[preferredFarm(cat,o),otherFarm(preferredFarm(cat,o))],true)){
   const def=cat[id];if(!def)continue;for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
    const p={...def,x,y,w,h};if(!fits(terrain,x,y,w,h))continue;
    const hit=list.filter(b=>overlap(b,p));if(hit.some(b=>fixed(b)||b.kind==='farm'))continue;
    const lost=hit.reduce((v,b)=>v+b.workers,0);if(s.spare-lost-p.needs<0)continue;
    const others=list.filter(b=>!hit.includes(b)),happy=happiness(p,others);
    let gain=hourly(p,happy,'food')*hours(p,o);
    gain-=hit.reduce((n,b)=>n+hourly(b,happiness(b,list),'coins')*hours(b,o),0)*o.goldSparksPerBatch/o.goldPerBatch*o.foodPerSpark;
    candidates.push({p,gain:gain/(p.w*p.h+p.needs*4)});
   }
  }
  candidates.sort((a,b)=>b.gain-a.gain);
  let best=null,bv=0;for(const {p} of candidates.slice(0,60)){
   const candidate=carve(list,make(p.id,p),b=>!fixed(b)&&b.kind!=='farm');const ns=stats(candidate),v=(utility(ns)-value)/(p.w*p.h+p.needs*4);if(ns.spare>=0&&v>bv){best=candidate;bv=v;}
  }return best?accept(best):false;
 }
 // Alternating additions use the actual marginal benefit of shared sources and farms.
 supplies(3);
 for(let n=0;n<64;n++){if(!farms())break;supplies(2);}
 supplies(8);
 // Exchange equally sized producers, homes and supply across the entire city.
 // Cooling accepts temporary setbacks, then returns the best feasible state encountered.
 let bestList=list,bestS=s,bestUtility=value;
 for(let step=0;step<7000&&Date.now()<deadline;step++){
  const a=list[Math.floor(rng()*list.length)],same=list.filter(b=>b!==a&&((b.w===a.w&&b.h===a.h)||(b.w===a.h&&b.h===a.w)));
  if(!same.length)continue;const b=same[Math.floor(rng()*same.length)];if(a.id===b.id||a.id==='fountain'||b.id==='fountain')continue;
  const candidate=list.map(t=>t===a?{...a,x:b.x,y:b.y,w:b.w,h:b.h}:t===b?{...b,x:a.x,y:a.y,w:a.w,h:a.h}:t),ns=stats(candidate),v=utility(ns);
  const temperature=10000*Math.pow(.002,step/7000);
  if(ns.spare>=0&&(v>value||rng()<Math.exp((v-value)/temperature))){list=candidate;s=ns;value=v;}
  if(value>bestUtility){bestList=list;bestS=s;bestUtility=value;}
 }
 list=bestList;s=bestS;value=bestUtility;
 // Variable-size neighbourhood: relocate or resize a farm, remove only adjustable
 // housing/supply at the destination, then repack the vacated tiles. This changes
 // the geometry itself rather than merely exchanging labels on existing footprints.
 for(let step=0;step<1200&&Date.now()<deadline;step++){
  const movable=list.filter(b=>b.kind==='farm'&&!b.premium);if(!movable.length)break;
  const old=movable[Math.floor(rng()*movable.length)];
  const id=farmQuota(o,list.filter(b=>b!==old))||(rng()<.3?(old.id==='ruralFarm'?'domesticFarm':'ruralFarm'):old.id),def=cat[id],rotate=rng()<.5;
  const w=rotate?def.h:def.w,h=rotate?def.w:def.h;
  const x=rng()<.15?Math.floor(rng()*(W-w+1)):old.x+Math.floor(rng()*9)-4;
  const y=rng()<.15?Math.floor(rng()*(H-h+1)):old.y+Math.floor(rng()*9)-4;
  const candidate=carve(list.filter(b=>b!==old),make(id,{x,y,w,h}),b=>!fixed(b)&&b.kind!=='farm');
  if(!candidate)continue;const ns=stats(candidate),v=utility(ns),temperature=20000*Math.pow(.005,step/1200);
  if(ns.spare>=0&&(v>value||rng()<Math.exp((v-value)/temperature))){list=candidate;s=ns;value=v;}
  if(step%200===0){farms();supplies(1);}
  if(value>bestUtility){bestList=list;bestS=s;bestUtility=value;}
 }
 list=bestList;s=bestS;value=bestUtility;
 // Repack the adjustable housing on the true residual mask, reclaiming odd-width pockets.
 const homes=list.filter(b=>b.kind==='home'&&!b.premium);
 const repacked=houseFill(list.filter(b=>!homes.includes(b))),packedStats=stats(repacked);
 if(packedStats.spare>s.spare&&packedStats.food+.001>=s.food&&packedStats.goods+.001>=s.goods){list=repacked;s=packedStats;value=utility(s);}
 // Trade a source's occupied plot for smaller sources in genuine empty pockets.
 // This can free housing capacity and let another farm fit; zero-benefit filler is not kept.
 for(const source of [...list].filter(b=>b.kind==='happiness'&&!b.premium&&b.w*b.h>=4)){
  if(Date.now()>=deadline)break;
  if(!list.includes(source))continue;
  let candidate=houseFill(list.filter(b=>b!==source));
  for(let k=0;k<3;k++){
   const ns=stats(candidate);
   if(ns.food+.001>=s.food&&ns.goods+.001>=s.goods&&(!o.fullArmy||ns.armyDeficit<=1e-5)&&ns.spare>s.spare){list=candidate;s=ns;value=utility(ns);break;}
   const g=gridOf(candidate),targets=candidate.filter(b=>b.happyMax),raw=new Map(targets.map(b=>[b,rawHappiness(b,candidate)]));let best=null;
   for(const id of ['compactCulture','littleCulture']){
    const p=positions(g,cat[id],p=>{let gain=0;for(const b of targets){if(!reaches(p,b))continue;const before=raw.get(b),after=Math.min(b.happyMax,before+p.points);gain+=(hourly(b,after,'food')-hourly(b,before,'food'))*hours(b,o);if(b.kind==='workshop'){const r=b.rewards[0].resource;gain+=(hourly(b,after,r)-hourly(b,before,r))*hours(b,o)*o.foodPerGood;}if(o.fullArmy&&b.kind==='barracks')gain+=armyGain(b,before,after,o)*b.happyMax*10000;}return gain/(p.w*p.h);},rng)[0];
    if(p&&p._score>1&&(!best||p._score>best._score))best=p;
   }if(!best)break;candidate.push(make(best.id,best));
  }
 }
 supplies(8);for(let n=0;n<8;n++){if(!farms())break;supplies(2);}
 // Remove useless sources, then refill their space with homes where geometrically possible.
 for(const b of [...list].filter(b=>b.kind==='happiness'&&!b.premium)){
  const candidate=list.filter(t=>t!==b),ns=stats(candidate);
  if(ns.food+.001>=s.food&&ns.goods+.001>=s.goods&&(!o.fullArmy||ns.armyDeficit<=s.armyDeficit+.00001)&&ns.coins+.001>=s.coins){list=candidate;s=ns;value=utility(ns);}
 }
 list=houseFill(list);s=stats(list);
 const requirements={...o,oldCount,searchVersion:7};
 if(validate(list,requirements,cat))return null;
 return {list,stats:s,oldCount,seed,pattern:'search',options:requirements,examined};
}
// A second constructor grows production shelves from opposing boundaries. Shelves
// are derived from catalog dimensions, not coordinates from any player's city.
// Boundary-first construction. No administration, fountain or barracks have
// coordinates yet: only their area and workforce costs are reserved.
function edgeBandStarter(cat,o,oldCount,seed,deadline=Infinity){
 const terrain=mask(o.tiles),turn=seed%4,wide=turn%2?H:W,tall=turn%2?W:H;
 const world=(u,v,w,h)=>turn===0?{x:u,y:v,w,h}:turn===1?{x:W-v-h,y:u,w:h,h:w}:turn===2?{x:W-u-w,y:H-v-h,w,h}:{x:v,y:H-u-w,w:h,h:w};
 const localTerrain=new Int16Array(N);for(let y=0;y<tall;y++)for(let x=0;x<wide;x++){const p=world(x,y,1,1);localTerrain[y*wide+x]=terrain[p.y*W+p.x];}
 const required=[...mandatoryFor(o),...o.optional].map(id=>cat[id]);for(const [id,n]of Object.entries(o.premium))for(let k=0;k<n;k++)required.push(cat[id]);for(const id of currentFor(o))for(let k=0;k<o.workshopCounts[id];k++)required.push(cat[id]);for(let k=0;k<oldCount;k++)required.push(cat[oldFor(o)]);
 const area=o.tiles.filter(Boolean).length*16,reserved=required.reduce((n,b)=>n+b.w*b.h+4*(b.needs-b.workers),o.fountain?16:0);
 const farm=cat[primaryFarm(o)||(Math.floor(seed/4)%4===3?otherFarm(preferredFarm(cat,o)):preferredFarm(cat,o))],fw=Math.max(farm.w,farm.h),fh=farm.w*farm.h/fw,channel=cat.smallHome.w;
 const boxes=[];
 for(let height=2*fh;height<=tall;height+=2*fh)for(let columns=1;columns<=6;columns++){
  const width=channel+(fw+channel)*columns+channel;if(width>wide)break;
  // Include housing for the farms even before selecting the channel pattern.
  if(width*height+reserved+columns*height/fh*farm.needs*4>area-32)continue;
  for(let y=0;y<=tall-height;y+=2)for(let x=0;x<=wide-width;x+=2){
   if(Date.now()>=deadline)return null;
   let boundary=true;for(let yy=y;yy<y+height;yy++)if(x&&localTerrain[yy*wide+x-1]===0){boundary=false;break;}
   if(!boundary)continue;const box=world(x,y,width,height);if(!fits(terrain,box.x,box.y,box.w,box.h))continue;
   boxes.push({x,y,width,height,columns,score:columns*height/fh});
  }
 }
 if(!boxes.length)return null;
 boxes.sort((a,b)=>b.score-a.score||b.height-a.height||a.y-b.y);
 const box=boxes[Math.floor(seed/32)%Math.min(12,boxes.length)],base=[];
 const add=(id,u,v,w=cat[id].w,h=cat[id].h)=>base.push({...cat[id],...world(box.x+u,box.y+v,w,h)});
 for(let y=0;y<box.height;y+=cat.smallHome.h)add('smallHome',0,y);
 for(let col=0;col<box.columns;col++)for(let y=0;y<box.height;y+=fh)add(farm.id,2*channel+col*(fw+channel),y,fw,fh);
 const unitFood=hourly(farm,farm.happyMax,'food')*hours(farm,o)/(fw*fh+4*farm.needs),workerValue=4*unitFood;
 const score=list=>{const s=evaluate(list,o);return equivalent(s,o).total+(s.available-s.needed)*workerValue;};
 let list=base,patterns=[];
 // Beam search tiles each entire service channel. Farm positions on both
 // sides are already present, so a source is priced for shared coverage.
 for(let col=0;col<=box.columns;col++){
  const u=channel+col*(fw+channel),states=Array.from({length:box.height+1},()=>[]);states[0]=[{list:[],score:score(list)}];
  for(let y=0;y<box.height;y++)for(const state of states[y]){
   if(Date.now()>=deadline)return null;
   for(const id of ['smallHome','moderateCulture','compactCulture']){
    if(id==='compactCulture'&&state.list.at(-1)?.id==='compactCulture')continue;
    const def=cat[id],w=channel,h=def.w*def.h/channel;if(!Number.isInteger(h)||y+h>box.height)continue;
    const p={...def,...world(box.x+u,box.y+y,w,h)},others=list.concat(state.list);
    if(p.points&&(atEdge(p,terrain)||others.some(b=>sameCultureClass(p,b)&&neighbours(p,b))))continue;
    const next=state.list.concat(p),value=score(list.concat(next)),bucket=states[y+h];bucket.push({list:next,score:value});bucket.sort((a,b)=>b.score-a.score);if(bucket.length>12)bucket.length=12;
   }
  }
  if(!states[box.height].length)return null;
  const selected=states[box.height][Math.floor(seed/128)%Math.min(3,states[box.height].length)];list=list.concat(selected.list);patterns.push(selected.list.map(b=>b.id));
 }
 list=list.map((b,i)=>({...b,uid:i+1}));
 return {list,info:{kind:'boundary-first',turn,columns:box.columns,farms:box.columns*box.height/fh,footprint:world(box.x,box.y,box.width,box.height),patterns,initialValue:equivalent(evaluate(list,o),o).total}};
}
function searchEdgeBands(cat,o,oldCount,seed,deadline=Infinity){
 const starter=edgeBandStarter(cat,o,oldCount,seed,Math.min(deadline,Date.now()+1500));if(!starter)return null;
 return searchFrontiers(cat,o,oldCount,seed,deadline,starter);
}

// Player layouts are starting points, not protected templates. A library entry is
// trimmed to the current terrain, remapped to the current era and requirement
// counts, and handed to the frontier constructor, which places whatever is still
// missing. Homes and sources are rebuilt around the kept producers.
function patternStarter(cat,o,oldCount,pattern){
 const terrain=mask(o.tiles),layout=Array.isArray(pattern?.layout)?pattern.layout:[];
 const pending=[...mandatoryFor(o),...o.optional].map(id=>cat[id]);
 for(const [id,n] of Object.entries(o.premium||{}))for(let k=0;k<n;k++)pending.push(cat[id]);
 for(const id of currentFor(o))for(let k=0;k<(o.workshopCounts?.[id]||0);k++)pending.push(cat[id]);
 for(let k=0;k<oldCount;k++)pending.push(cat[oldFor(o)]);
 if(o.fountain&&cat.fountain)pending.push(cat.fountain);
 const required=pending.filter(Boolean),kindOf=id=>cat[id]?.kind||root.HOH_DATA?.buildings?.find(b=>b.id===id)?.kind;
 const footprint=(d,w,h)=>!!d&&((d.w===w&&d.h===h)||(d.w===h&&d.h===w));
 const grid=terrain.slice(),list=[],dropped={outside:0,surplus:0,unknown:0};
 for(const raw of layout){
  if(!raw||![raw.x,raw.y,raw.w,raw.h].every(Number.isInteger))continue;
  const {x,y,w,h}=raw;
  let def=cat[raw.id],index=-1;
  if(footprint(def,w,h)){
   index=required.findIndex(r=>r.id===def.id);
   // A known building the player does not need still offers its footprint: a workshop of
   // another kind or era becomes one of the missing workshops (Marek, 15.09.2026: swapping
   // producer types is required, not optional).
   if(index<0&&def.kind!=='home'&&def.kind!=='happiness'&&!(def.kind==='farm'&&!def.premium)){const alt=required.findIndex(r=>r.kind===def.kind&&footprint(r,w,h));if(alt>=0){index=alt;def=required[alt];}}
   // Homes and ordinary sources stay as unprotected starting positions; the constructor may replace them.
   if(index<0&&!(def.kind==='farm'&&!def.premium)&&!(!def.premium&&(def.kind==='home'||def.kind==='happiness'))){dropped.surplus++;continue;}
  }else{
   // Another era or catalogue: reuse the footprint for a still missing building of the same kind.
   const kind=kindOf(raw.id);
   index=kind?required.findIndex(r=>r.kind===kind&&footprint(r,w,h)):-1;
   if(index<0){dropped.unknown++;continue;}
   def=required[index];
  }
  if(!fits(grid,x,y,w,h)){dropped.outside++;continue;}
  if(index>=0)required.splice(index,1);
  const b={...def,x,y,w,h,uid:list.length+1,edgeBand:index>=0||def.kind==='farm'};list.push(b);paint(grid,b,1);
 }
 return {list,info:{kind:'pattern',protected:list.filter(b=>b.edgeBand).length,name:pattern?.name||'Wzorzec',source:pattern?.source||null,total:layout.length,kept:list.length,farms:list.filter(b=>b.kind==='farm').length,dropped,missing:required.map(b=>b.id)}};
}
// Insert the requirements a trimmed pattern lacks. A building may take free cells
// or evict unprotected homes and sources; farms and kept requirements stay put.
function placeMissing(list,missing,terrain){
 let out=list.map(b=>({...b}));
 for(const def of [...missing].sort((a,b)=>b.w*b.h-a.w*a.h)){
  const owner=new Int16Array(N);owner.fill(-1);out.forEach((b,i)=>paint(owner,b,i));
  let best=null,score=-Infinity;
  for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
   if(!fits(terrain,x,y,w,h))continue;
   const evict=new Set();let free=0,blocked=false;
   for(let yy=y;yy<y+h&&!blocked;yy++)for(let xx=x;xx<x+w;xx++){const i=owner[yy*W+xx];if(i<0){free++;continue;}const t=out[i];if(t.edgeBand||t.premium||(t.kind!=='home'&&t.kind!=='happiness')){blocked=true;break;}evict.add(i);}
   if(blocked)continue;
   const lost=[...evict].reduce((n,i)=>n+out[i].w*out[i].h,0);
   let contact=0;for(let i=x;i<x+w;i++){if(y===0||owner[(y-1)*W+i]>=0||terrain[(y-1)*W+i])contact++;if(y+h===H||owner[(y+h)*W+i]>=0||terrain[(y+h)*W+i])contact++;}for(let j=y;j<y+h;j++){if(x===0||owner[j*W+x-1]>=0||terrain[j*W+x-1])contact++;if(x+w===W||owner[j*W+x+w]>=0||terrain[j*W+x+w])contact++;}
   const v=free*3-lost+contact*.2;
   if(v>score){score=v;best={x,y,w,h,evict};}
  }
  if(!best)return null;
  out=out.filter((_,i)=>!best.evict.has(i));out.push({...def,x:best.x,y:best.y,w:best.w,h:best.h,edgeBand:true});
 }
 return out;
}
// Marek, 15.09.2026: a missing producer with a farm's footprint takes a farm's place
// instead of evicting homes, so the pasted pattern keeps its blocks and its workers. The
// farm to give up is the one whose replacement leaves the city the most valuable.
function swapFarmsForProducers(list,missing,o){
 let out=list.map(b=>({...b}));const left=[];
 for(const def of missing){
  if(!def||def.kind==='home'||def.kind==='happiness'){left.push(def);continue;}
  const farms=out.map((b,i)=>({b,i})).filter(({b})=>b.kind==='farm'&&!b.premium&&((b.w===def.w&&b.h===def.h)||(b.w===def.h&&b.h===def.w)));
  if(!farms.length){left.push(def);continue;}
  let best=null,bv=-Infinity;
  for(const {b,i} of farms){
   const candidate=out.map((t,j)=>j===i?{...def,x:b.x,y:b.y,w:b.w,h:b.h,uid:b.uid,edgeBand:true}:t);
   const s=evaluate(candidate,o),v=equivalent(s,o).total-(s.spare<0?1e12:0);
   if(v>bv){bv=v;best=candidate;}
  }
  out=best;
 }
 return {list:out,left};
}
// A pasted pattern whose barracks lack happiness under the player's settings gets sources
// next to the hungry barracks, on homes or free cells, before any district is rebuilt or a
// farm is released (Marek, 15.09.2026: the pasted start was excellent, keep it).
function feedBarracks(list,cat,o,deadline=Infinity){
 let out=list.map(b=>({...b}));const ids=['moderateCulture','compactCulture','littleCulture'].filter(id=>cat[id]),terrain=mask(o.tiles);
 for(let step=0;step<40&&Date.now()<deadline;step++){
  const army=out.filter(b=>b.kind==='barracks'),raw=new Map(army.map(b=>[b,rawHappiness(b,out)]));
  const hungry=army.filter(b=>raw.get(b)+1e-6<armyNeed(b,o));if(!hungry.length)break;
  const owner=new Int16Array(N);owner.fill(-1);out.forEach((b,i)=>paint(owner,b,i));
  let best=null,bs=0;
  for(const id of ids){const def=cat[id];for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
   if(!fits(terrain,x,y,w,h))continue;const p={...def,x,y,w,h};if(!hungry.some(b=>reaches(p,b)))continue;
   const evict=new Set();let blocked=false;
   for(let yy=y;yy<y+h&&!blocked;yy++)for(let xx=x;xx<x+w;xx++){const i=owner[yy*W+xx];if(i<0)continue;const t=out[i];if(t.kind!=='home'||t.premium){blocked=true;break;}evict.add(i);}
   if(blocked)continue;
   if(o.enforceLayout&&(atEdge(p,terrain)||out.some(t=>sameCultureClass(p,t)&&neighbours(p,t))||crowdsBarracks(p,out)))continue;
   let gain=0;for(const b of army){if(!reaches(p,b))continue;const need=armyNeed(b,o);gain+=Math.min(raw.get(b)+p.points,need)-Math.min(raw.get(b),need);}
   if(gain<=0)continue;
   const consumed=Math.max(w*h,[...evict].reduce((n,i)=>n+out[i].w*out[i].h,0)),lost=[...evict].reduce((n,i)=>n+out[i].workers,0);
   const score=gain/consumed*(id==='littleCulture'?.5:1)-lost*100;
   if(score>bs){bs=score;best={p,evict};}
  }}
  if(!best)break;
  const uid=Math.max(0,...out.map(b=>b.uid))+1;out=out.filter((_,i)=>!best.evict.has(i));out.push({...best.p,uid});
 }
 return out;
}
// Adapt one pattern: trim, swap farms for missing producers of the same footprint, complete
// the rest of the requirements, feed the barracks, then run the same repairs a saved city receives. Only a validated city is returned; otherwise a cluster of
// the pattern's farms is released to make room and the attempt is repeated.
function searchPattern(cat,o,oldCount,seed,deadline=Infinity,pattern){
 const base=patternStarter(cat,o,oldCount,pattern);
 if(!base.list.length)return null;
 const settings={...o,oldCount,engineMode:o.engineMode||'frontiers'},terrain=mask(settings.tiles),rng=random((seed||0)+911);
 const measure=list=>{const s=evaluate(list,settings);s.equivalent=equivalent(s,settings);return s;};
 const wanted=base.info.missing.map(id=>cat[id]).filter(Boolean),swapped=swapFarmsForProducers(base.list,wanted,settings),missing=swapped.left;
 base.list=swapped.list;base.info.swapped=wanted.length-missing.length;base.info.farms=base.list.filter(b=>b.kind==='farm').length;
 // Ordinary pockets become homes at once; remaining holes are retiled with the bounded exact search.
 const fillPockets=list=>{const grid=terrain.slice();list.forEach(b=>paint(grid,b,1));let uid=Math.max(0,...list.map(b=>b.uid))+1;const out=[...list];for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(const id of ['smallHome','averageHome'])if(cat[id]&&fits(grid,x,y,cat[id].w,cat[id].h)){const b={...cat[id],x,y,uid:uid++};out.push(b);paint(grid,b,1);break;}return out;};
 const retileHoles=c=>{let best=c;for(const i of layoutQuality(best.list,settings).freeCells){if(Date.now()>=deadline)break;const cost=layoutQuality(best.list,settings).cost;for(const radius of [2,3,4]){const x=Math.max(0,i%W-radius),y=Math.max(0,Math.floor(i/W)-radius),region={x,y,w:Math.min(W-x,2*radius+2),h:Math.min(H-y,2*radius+2)};const list=packHomes(best.list,cat,settings,region,Math.min(deadline,Date.now()+40));if(list&&!validate(list,settings,cat)&&layoutQuality(list,settings).cost<cost){best={...best,list,stats:measure(list)};break;}}}return best;};
 let starter=base,released=0;
 for(let round=0;round<8&&Date.now()<deadline;round++){
  const placed=placeMissing(starter.list,missing,terrain);
  if(placed){
   let list=fillPockets(placed.map(({edgeBand,...b},i)=>({...b,uid:i+1})));
   if(settings.fullArmy)list=fillPockets(feedBarracks(list,cat,settings,Math.min(deadline,Date.now()+1500)));
   let c={list,options:settings,oldCount,seed:Number.isSafeInteger(seed)&&seed>0?seed:1,districtAttempts:0,pattern:'pattern',examined:1};
   c.stats=measure(c.list);
   const budget=Math.max(1,deadline-Date.now());
   if(validate(c.list,settings,cat)||!layoutQuality(c.list,settings).complete)c=repairSourceBlocks(c,cat,Math.min(deadline,Date.now()+Math.min(2500,budget*.3)));
   if(validate(c.list,settings,cat))c=repairLayout(c,cat,Math.min(deadline,Date.now()+Math.min(1500,budget*.2)));
   if(validate(c.list,settings,cat))c=rebuildDistricts(c,cat,Math.min(deadline,Date.now()+Math.min(6000,budget*.6)));
   // Fill the holes left by trimming and eviction before the city competes on layout cost.
   if(!validate(c.list,settings,cat)&&!layoutQuality(c.list,settings).complete)c=retileHoles(c);
   if(!validate(c.list,settings,cat))return {...c,pattern:'pattern',schemeOrigin:{...base.info,released,rounds:round+1}};
  }
  // No room or no feasible repair: release farms one more per round, nearest the
  // hungry barracks if the army is short, otherwise around a random anchor.
  const farms=starter.list.filter(b=>b.kind==='farm'&&!b.premium);
  if(!farms.length)return null;
  const center=b=>[b.x+b.w/2,b.y+b.h/2];
  const hungry=settings.fullArmy?starter.list.filter(b=>b.kind==='barracks'&&rawHappiness(b,starter.list)+1e-6<armyNeed(b,settings)):[];
  const [ax,ay]=hungry.length?[hungry.reduce((n,b)=>n+center(b)[0],0)/hungry.length,hungry.reduce((n,b)=>n+center(b)[1],0)/hungry.length]:center(farms[Math.floor(rng()*farms.length)]);
  const cluster=new Set([...farms].sort((a,b)=>{const [px,py]=center(a),[qx,qy]=center(b);return Math.hypot(px-ax,py-ay)-Math.hypot(qx-ax,qy-ay);}).slice(0,1+round).map(b=>b.uid));
  released+=cluster.size;
  starter={...starter,list:starter.list.filter(b=>!cluster.has(b.uid)).map((b,i)=>({...b,uid:i+1}))};
 }
 return null;
}
// Library mode: start from the player layouts closest to the current terrain; the
// seed cycles through the library. Without a usable entry, fall back to the
// generic constructors so the slot still produces cities.
// Marek, 15.09.2026: a pattern is rebuilt where the player's land is, not where its author's
// land was. Every symmetry of the board (flips, transpose) and every translation is scored
// by the pattern area that lands inside the available places; the best placement of each
// symmetry is kept so the search can try several ways of laying the same city.
const SYMMETRY_NAMES=['identity','flip-x','flip-y','rotate-180','transpose','rotate-90','rotate-270','anti-transpose'];
const alignCache=new Map();
function alignPattern(layout,tiles,limit=3){
 const items=(Array.isArray(layout)?layout:[]).filter(b=>b&&[b.x,b.y,b.w,b.h].every(Number.isInteger)&&b.w>0&&b.h>0);
 if(!items.length)return [];
 const key=limit+'|'+(Array.isArray(tiles)?tiles.map(t=>t?1:0).join(''):'')+'|'+items.length+'|'+items.reduce((n,b)=>(n*31+b.x*7+b.y*13+b.w+b.h*3)%1000000007,7);
 if(alignCache.has(key))return alignCache.get(key);
 const terrain=mask(tiles),S=W+1,sums=new Int32Array(S*(H+1));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)sums[(y+1)*S+x+1]=sums[y*S+x+1]+sums[(y+1)*S+x]-sums[y*S+x]+(terrain[y*W+x]!==0?1:0);
 const blocked=(x,y,w,h)=>x<0||y<0||x+w>W||y+h>H||sums[(y+h)*S+x+w]-sums[y*S+x+w]-sums[(y+h)*S+x]+sums[y*S+x]>0;
 const totalArea=items.reduce((n,b)=>n+b.w*b.h,0),origin={x:Math.min(...items.map(b=>b.x)),y:Math.min(...items.map(b=>b.y))};
 const all=[],frames=[];
 for(let sym=0;sym<8;sym++){
  const flipX=sym&1,flipY=sym&2,transpose=sym&4;
  let mapped=items.map(b=>transpose?{...b,x:b.y,y:b.x,w:b.h,h:b.w}:{...b});
  const minX=Math.min(...mapped.map(b=>b.x)),minY=Math.min(...mapped.map(b=>b.y)),bw=Math.max(...mapped.map(b=>b.x+b.w))-minX,bh=Math.max(...mapped.map(b=>b.y+b.h))-minY;
  mapped=mapped.map(b=>({...b,x:flipX?bw-(b.x-minX+b.w):b.x-minX,y:flipY?bh-(b.y-minY+b.h):b.y-minY}));
  frames[sym]=mapped;
  // Tracing paper over a sheet (Marek, 15.09.2026): the pattern may hang over the board and
  // over the land; only the buildings that land on available places count, half a city is fine.
  for(let dy=1-bh;dy<H;dy++)for(let dx=1-bw;dx<W;dx++){
   let area=0,kept=0;for(const b of mapped)if(!blocked(b.x+dx,b.y+dy,b.w,b.h)){area+=b.w*b.h;kept++;}
   if(area)all.push({sym,dx,dy,area,kept,drift:sym?Infinity:Math.abs(dx-origin.x)+Math.abs(dy-origin.y)});
  }
 }
 all.sort((a,b)=>b.area-a.area||a.drift-b.drift||a.sym-b.sym);
 const far=(a,b)=>a.sym!==b.sym||Math.abs(a.dx-b.dx)+Math.abs(a.dy-b.dy)>=8;
 const chosen=[];
 if(all.length){
  const best=all[0];chosen.push(best);
  // Always try another chunk of the same pattern (a distant translation) and another symmetry.
  const shifted=all.find(c=>c.sym===best.sym&&far(c,best));if(shifted)chosen.push(shifted);
  const other=all.find(c=>c.sym!==best.sym);if(other)chosen.push(other);
  for(const c of all){if(chosen.length>=limit)break;if(chosen.every(k=>far(c,k)))chosen.push(c);}
 }
 const out=chosen.slice(0,Math.max(limit,3)).map(c=>({symmetry:c.sym,symmetryName:SYMMETRY_NAMES[c.sym],shift:c.sym?null:{x:c.dx-origin.x,y:c.dy-origin.y},shifted:c.sym!==0||c.dx!==origin.x||c.dy!==origin.y,dx:c.dx,dy:c.dy,kept:c.kept,keptArea:c.area,total:items.length,totalArea,fit:c.area/totalArea,layout:frames[c.sym].map(b=>({...b,x:b.x+c.dx,y:b.y+c.dy})).filter(b=>!blocked(b.x,b.y,b.w,b.h))}));
 if(alignCache.size>40)alignCache.clear();alignCache.set(key,out);
 return out;
}
// The queue of pattern placements (Marek, 15.09.2026: every pattern must really get its
// turn, chunks included). Rank first: the best placement of every pattern, then the other
// chunk of every pattern, then the other symmetry; inside a rank the better fit goes first.
function patternPlacements(patterns,tiles){
 const library=(Array.isArray(patterns)?patterns:[]).filter(p=>Array.isArray(p?.layout)&&p.layout.length);
 const blocks=(tiles||[]).map(Boolean);
 const overlap=p=>{const t=Array.isArray(p.tiles)?p.tiles:[];let both=0,any=0;for(let i=0;i<blocks.length;i++){const a=blocks[i],b=!!t[i];if(a&&b)both++;if(a||b)any++;}return any?both/any:0;};
 const scored=[];for(const p of library){const land=overlap(p);alignPattern(p.layout,tiles,3).forEach((a,rank)=>scored.push({p,a,land,rank,similarity:a.fit}));}
 return scored.sort((x,y)=>x.rank-y.rank||y.similarity-x.similarity||y.land-x.land||x.a.symmetry-y.a.symmetry);
}
function searchReferenceSchemes(cat,o,oldCount,seed,deadline=Infinity,patterns=[],turn=seed){
 const library=(Array.isArray(patterns)?patterns:[]).filter(p=>Array.isArray(p?.layout)&&p.layout.length);
 if(library.length){
  const scored=patternPlacements(library,o.tiles);
  if(scored.length){
   const index=((turn%scored.length)+scored.length)%scored.length,pick=scored[index];
   const c=searchPattern(cat,o,oldCount,Math.floor(seed/scored.length),deadline,{...pick.p,layout:pick.a.layout});
   if(c)return {...c,pattern:'reference-schemes',schemeOrigin:{...c.schemeOrigin,similarity:pick.similarity,library:library.length,placements:scored.length,placement:{index,of:scored.length,rank:pick.rank},alignment:{symmetry:pick.a.symmetry,symmetryName:pick.a.symmetryName,shift:pick.a.shift,shifted:pick.a.shifted,kept:pick.a.kept,total:pick.a.total,fit:pick.a.fit}}};
  }
 }
 const family=((seed%4)+4)%4;
 const mode=['rows-vertical','rows-horizontal','edge-bands','rows-horizontal'][family];
 const settings={...o,engineMode:mode};
 const c=(mode==='edge-bands'?searchEdgeBands:searchFrontiers)(cat,settings,oldCount,Math.floor(seed/4),deadline);
 if(!c)return null;
 const list=c.list.map(({edgeBand,...b})=>b);
 const {rowSlots,edgeOrigin,...rest}=c;
 return {...rest,list,options:{...o,oldCount},pattern:'reference-schemes',schemeOrigin:{kind:'generic',family:['vertical-columns','horizontal-bands','farm-block','mixed-bands'][family]}};
}

function searchFrontiers(cat,o,oldCount,seed,deadline=Infinity,starter=null){
 const terrain=mask(o.tiles),rng=random(seed),area=o.tiles.filter(Boolean).length*16;
 let uid=1,examined=0,best=null;
 const make=(id,p)=>({...cat[id],...p,uid:uid++});
 const gridOf=items=>{const g=terrain.slice();for(const b of items)paint(g,b,1);return g;};
 const measure=items=>{examined++;const s=evaluate(items,o);s.equivalent=equivalent(s,o);return s;};
 const rows=rowMode(o.engineMode),transposed=rows?o.engineMode==='rows-vertical':seed%2===0,wide=transposed?H:W,tall=transposed?W:H;
 const rect=(u,v,w,h)=>transposed?{x:v,y:u,w:h,h:w}:{x:u,y:v,w,h};
 const local=b=>transposed?{u:b.y,v:b.x,w:b.h,h:b.w}:{u:b.x,v:b.y,w:b.w,h:b.h};
 const required=[...mandatoryFor(o),...o.optional].map(id=>cat[id]);
 for(const [id,n] of Object.entries(o.premium))for(let k=0;k<n;k++)required.push(cat[id]);
 for(const id of currentFor(o))for(let k=0;k<o.workshopCounts[id];k++)required.push(cat[id]);
 for(let k=0;k<oldCount;k++)required.push(cat[oldFor(o)]);
 // A pattern starter may already contain required buildings: construct only the rest.
 if(starter)for(const b of starter.list){const i=required.findIndex(r=>r.id===b.id);if(i>=0)required.splice(i,1);}
 const farmId=primaryFarm(o)||(seed%3===0?otherFarm(preferredFarm(cat,o)):preferredFarm(cat,o)),farm=cat[farmId];
 const housingCost=required.reduce((n,b)=>n+b.w*b.h+4*(b.needs-b.workers),(o.fountain?16:0)+(starter?.list||[]).reduce((n,b)=>n+b.w*b.h+4*(b.needs-b.workers),0));
 const upper=Math.max(0,Math.floor((area-housingCost-60)/(farm.w*farm.h+4*farm.needs)));
 function fillHomes(items){
  const out=[...items],g=gridOf(out);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   if(g[y*W+x])continue;let rw=0,rh=0;while(x+rw<W&&!g[y*W+x+rw])rw++;while(y+rh<H&&!g[(y+rh)*W+x])rh++;
   for(const id of rw===3||rh===3?['averageHome','smallHome']:['smallHome','averageHome']){
    const b=cat[id];if(!b)continue;if(fits(g,x,y,b.w,b.h)){const p=make(id,{x,y});out.push(p);paint(g,p,1);break;}
   }
  }return out;
 }
 function support(items){
  let list=fillHomes(items),s=measure(list);
  // Exchange homes for sources by actual useful output. Army requirements have
  // priority; an infeasible worker budget is rejected, never silently relaxed.
  for(let step=0;step<95;step++){
   const armyMissing=o.fullArmy&&s.armyDeficit>1e-5;
   if(!armyMissing&&s.spare<0)return null;
   const g=gridOf(list),owner=new Int16Array(N);owner.fill(-1);
   list.forEach((b,i)=>paint(owner,b,i));
   const targets=list.filter(b=>b.happyMax),raw=new Map(targets.map(b=>[b,rawHappiness(b,list)]));
   let choice=null,score=0,squareChoice=null,squareScore=0;
   for(const id of ['moderateCulture','compactCulture','littleCulture']){
    const def=cat[id];if(!def)continue;for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
     if(!fits(terrain,x,y,w,h))continue;const removed=new Set();let blocked=false;
     for(let yy=y;yy<y+h&&!blocked;yy++)for(let xx=x;xx<x+w;xx++){const i=owner[yy*W+xx];if(i>=0){const b=list[i];if(b.kind!=='home'||b.premium||b.edgeBand){blocked=true;break;}removed.add(i);}}
     if(blocked)continue;const lost=[...removed].reduce((n,i)=>n+list[i].workers,0);
     if(!armyMissing&&lost>s.spare)continue;
     const p={...def,x,y,w,h};if((rows||o.enforceLayout)&&(atEdge(p,terrain)||list.some(t=>sameCultureClass(p,t)&&neighbours(p,t))||crowdsBarracks(p,list)))continue;let gain=0,armyDelta=0,reach=0;
     for(const b of targets){if(!reaches(p,b))continue;reach++;const before=Math.min(raw.get(b),b.happyMax),after=Math.min(before+p.points,b.happyMax);
      if(b.kind==='barracks')armyDelta+=armyGain(b,before,after,o);
      gain+=(hourly(b,after,'food')-hourly(b,before,'food'))*hours(b,o);
      if(b.kind==='workshop'){const r=b.rewards[0].resource;gain+=(hourly(b,after,r)-hourly(b,before,r))*hours(b,o)*o.foodPerGood;}
     }
     if(armyMissing&&armyDelta<=0)continue;
     // The area term favours shared sources; it does not reward excess points.
     // Shared sources win, a 1x1 only where nothing else fits (Marek's targets per kind).
     const shared=1+.02*Math.min(reach,10),small=id==='littleCulture'?.5:1;
     const v=(armyMissing?armyDelta*1e8/(1+lost*.15+w*h*.03)+gain:gain/(1+w*h*.04+lost*.08))*shared*small;
     if(v>score+.001){score=v;choice={p,removed};}
     if(id==='moderateCulture'&&lost<=s.spare&&v>squareScore+.001){squareScore=v;squareChoice={p,removed};}
    }
   }
   if(!choice)break;
   let changed=false;
   // Squares provide the main coverage. Smaller sources are considered only
   // after the best feasible square fails to improve the current city.
   for(const proposal of [squareChoice,choice].filter(Boolean)){
    const candidate=fillHomes(list.filter((_,i)=>!proposal.removed.has(i)).concat(make(proposal.p.id,proposal.p))),ns=measure(candidate);
    if(!armyMissing&&ns.equivalent.total<=s.equivalent.total+.001)continue;
    list=candidate;s=ns;changed=true;break;
   }if(!changed)break;
  }
  if(s.spare<0||o.fullArmy&&s.armyDeficit>1e-5){if(root.HOH_DEBUG_FRONTIERS)console.log('  wsparcie: wolni '+s.spare+' deficyt wojska '+s.armyDeficit.toFixed(3)+' koszary: '+list.filter(b=>b.kind==='barracks').map(b=>b.id.replace('Barracks','')+'@'+b.x+','+b.y+'='+Math.round(rawHappiness(b,list))).join(' '));return null;}
  // Patch odd gaps only when a source contributes; no decorative filler.
  return {list,s};
 }
 // Vary farm count as well as geometry. Each attempt repacks every requirement.
 const counts=[...new Set([upper,upper-2,upper-4,upper-6,upper-8,upper-10,upper-13,0].map(n=>Math.max(0,n)))];
 for(const count of counts){
  if(Date.now()>=deadline)break;
  if(rows&&count<Math.floor(upper*.65))continue;
  let list=[],grid=terrain.slice();const put=p=>{const b=make(p.id,p);list.push(b);paint(grid,b,1);};
  if(starter)for(const b of starter.list)put({...b,edgeBand:b.edgeBand!==false});
  const admin=required.filter(b=>!b.happyMax&&!b.points&&b.kind!=='home');
  for(const b of [...admin].sort((a,b)=>b.w*b.h-a.w*a.h)){
   const p=positions(grid,b,p=>{const q=local(p);return -(q.u+(seed%4<2?q.v:tall-q.v-q.h)*wide);},rng)[0];if(!p){list=null;break;}put(p);
  }if(!list)continue;
  if(o.fountain&&!list.some(b=>b.id==='fountain')){
   const p=positions(grid,cat.fountain,p=>{if(rows&&(p.x%2||p.y%2||atEdge(p,terrain)))return -1e15;let homes=0;for(let y=p.y-2*Math.ceil(p.range/2);y<p.y+p.h+p.range;y+=2)for(let x=p.x-2*Math.ceil(p.range/2);x<p.x+p.w+p.range;x+=2){const h={x,y,w:2,h:2};if(!overlap(h,p)&&reaches(p,h)&&fits(grid,x,y,2,2))homes++;}const q=local(p);return homes*1000-q.u-q.v*.1;},rng)[0];
   if(!p)continue;put(p);
   // Alternate compact inner housing with the older wider housing proposal.
   // The compact proposal leaves the outer coverage cells for large producers.
   const inset=seed%2?1:0;
   for(let y=p.y-2*Math.ceil(p.range/2);y<p.y+p.h+p.range;y+=2)for(let x=p.x-2*Math.ceil(p.range/2);x<p.x+p.w+p.range;x+=2){const h={x,y,w:2,h:2};if(inset&&(x<p.x-p.range+1||y<p.y-p.range+1||x+2>p.x+p.w+p.range-1||y+2>p.y+p.h+p.range-1))continue;if(reaches(p,h)&&fits(grid,x,y,2,2))put({...cat.smallHome,...h});}
  }
  // 8.60: with the layout rules on, every constructor lays the barracks as one block with its own two-cell channel
  // (Marek's military-quarter patent); barracks side by side in a band leave one-cell gaps that only crowding could feed.
  let armyPlaced=false;
  if(rows||o.enforceLayout){
   const army=required.filter(b=>b.kind==='barracks'),fragment=fragmentSeed(cat,army,2*(seed%64));
   let spot=null,value=-Infinity;
   for(let y=0;y<=H-fragment.height;y++)for(let x=0;x<=W-fragment.width;x++){
    if(!fragment.list.every(b=>fits(grid,x+b.x,y+b.y,b.w,b.h)&&(!b.points||!atEdge({...b,x:x+b.x,y:y+b.y},terrain))))continue;
    const q=local({x,y,w:fragment.width,h:fragment.height});
    const slivers=[x,y,W-x-fragment.width,H-y-fragment.height].filter(n=>n===1).length;
    // A shorter barracks row must not leave an unusable 1-cell lane at the
    // boundary. Try an interior block with room for housing on every side.
    const housingBorder=fits(terrain,x-2,y-2,fragment.width+4,fragment.height+4);
    // 8.60: the block always keeps a two-cell border for culture and homes; against the edge a barracks stays hungry.
    const v=(seed%4<2?q.u:wide-q.u-q.w)*wide+(seed%8<4?q.v:tall-q.v-q.h)-slivers*1e6+(housingBorder?1e7:0);
    if(v>value){value=v;spot={x,y};}
   }
   if(!spot)continue;
   for(const b of fragment.list)put({...b,x:b.x+spot.x,y:b.y+spot.y});
   armyPlaced=true;
  }
  let producers=required.filter(b=>!admin.includes(b)&&b.kind!=='home'&&!b.points&&(!armyPlaced||b.kind!=='barracks'));
  // Owned farms come first: the primary kind up to its owned count, then the other owned kind, then the primary kind again.
  {const owned=o.ownedFarms||{},otherId=farmId==='ruralFarm'?'domesticFarm':'ruralFarm',present=farmCounts(list);
  for(let k=0;k<count;k++){const pick=(owned[farmId]||0)>present[farmId]||(owned[otherId]||0)<=present[otherId]||!cat[otherId]?farm:cat[otherId];producers.push(pick);present[pick.id]++;}}
  const fountain=list.find(b=>b.id==='fountain');
  if(fountain&&seed%2&&!rows){
   // Place complete buildings at the tips, largest first: a rim cell that touches a big
   // producer waters the whole building, a rim cell on a small home waters almost nothing.
   for(const b of [...producers].sort((a,b)=>b.w*b.h-a.w*a.h)){
    const candidates=[];
    for(const [w,h] of b.w===b.h?[[b.w,b.h]]:[[b.w,b.h],[b.h,b.w]])for(const p of sourceEdgePositions(fountain,{...b,w,h}))if(fits(grid,p.x,p.y,w,h))candidates.push(p);
    candidates.sort((a,b)=>Math.abs(a.x-fountain.x)+Math.abs(a.y-fountain.y)-Math.abs(b.x-fountain.x)-Math.abs(b.y-fountain.y));
    if(candidates.length){put(candidates[0]);producers.splice(producers.indexOf(b),1);}
   }
  }
  // The two fronts share one occupancy grid. Both leave service strips derived
  // from the square source/home width, and stop before colliding in the middle.
  let lo=seed%4===0?0:cat.smallHome.h,hi=tall-(seed%4===1?0:cat.smallHome.h),turn=0;
  while(producers.length&&lo<hi){
   const bottom=rows?false:turn%2===0;turn++;
   const army=producers.filter(b=>b.kind==='barracks');
   const pool=bottom&&army.length?army:producers.filter(b=>b.kind!=='barracks');
   const active=pool.length?pool:producers;
   // 8.54: a production band is as tall as the farm's long side, so farms stand across the row (8.53). Odd seeds
   // used to build bands of the short side, i.e. rows of farms lying along, which the ranking then discarded.
   const height=active.some(b=>b.kind==='barracks')?Math.max(...active.map(b=>Math.min(b.w,b.h))):Math.max(farm.w,farm.h);
   if(hi-lo<height)break;const v=bottom?hi-height:lo;
   const ordered=[...active].sort((a,b)=>(b.kind==='workshop')-(a.kind==='workshop')||b.w*b.h-a.w*a.h);
   for(const b of ordered){
    let candidate=null,bv=-Infinity;
    for(const [w,h] of b.w===b.h?[[b.w,b.h]]:[[b.w,b.h],[b.h,b.w]]){if(h>height)continue;
     for(let u=0;u<=wide-w;u++)for(const vv of [v,v+height-h]){const p=rect(u,vv,w,h);if(!fits(grid,p.x,p.y,p.w,p.h))continue;
      // Prefer interior production; a 2-cell border remains available for homes.
      const inside=rect(u-2,vv,w+4,h),margin=fits(terrain,inside.x,inside.y,inside.w,inside.h)?1:0;
      const val=margin*wide*(rows?(Math.floor(seed/2)%3-1):1)-(seed%3===1?wide-u-w:u)-Math.abs(height-h)*wide*2;
      if(val>bv){bv=val;candidate={...b,...p};}
     }
    }if(candidate){put(candidate);producers.splice(producers.indexOf(b),1);}
   }
   if(bottom)hi=v-cat.moderateCulture.h;else lo=v+height+cat.moderateCulture.h;
  }
  // At the meeting line try remaining rectangles in actual pockets. Failure
  // causes a complete retry with fewer farms, not omission of a requirement.
  if(rows&&producers.length)continue;
  for(const b of producers){const p=positions(grid,b,p=>-Math.abs(local(p).v-(lo+hi)/2),rng)[0];if(!p){list=null;break;}put(p);}if(!list)continue;
  for(const b of required.filter(b=>b.kind==='home'||b.points)){
   const p=positions(grid,b,p=>{if(b.points&&o.enforceLayout&&(atEdge(p,terrain)||list.some(t=>sameCultureClass(b,t)&&neighbours(p,t))||crowdsBarracks({...b,...p},list)))return -1e15;const f=list.find(t=>t.id==='fountain');return b.points?list.reduce((n,t)=>n+(t.happyMax&&reaches(p,t)?(t.kind==='barracks'&&o.fullArmy?4:t.kind==='home'?(b.id==='collectableMinoanWatchtowerV2'||b.premium?.3:.05):t.oldWorkshop&&b.premium?.4:1)*Math.min(b.points,Math.max(0,t.happyMax-rawHappiness(t,list)))/t.happyMax+.03:0),0):f&&reaches(f,p)?100:0;},rng)[0];if(!p||p._score<-1e14){list=null;break;}put(p);
  }if(!list)continue;
  const supported=support(list);if(!supported){if(root.HOH_DEBUG_FRONTIERS)console.log('  pasy: bez wsparcia, farm',count);continue;}
  const requirements={...o,oldCount,searchVersion:8};
  {const err=validate(supported.list,requirements,cat);if(err){if(root.HOH_DEBUG_FRONTIERS)console.log('  pasy: farm',count,err);continue;}}
  let c={list:supported.list,stats:supported.s,oldCount,seed,pattern:'frontiers',options:requirements,examined};
  // Judge complete row proposals before discarding lower-count alternatives.
  // Previously a high-output proposal with unfillable holes could win every retry.
  if(rows||starter){c.rowSlots=rowSlots(c.list.filter(b=>!starter||b.edgeBand));c=repairLayout(c,cat,Math.min(deadline,Date.now()+450));}
  if(!best||((rows||starter)?betterLayout(c,best,requirements):c.stats.equivalent.total>best.stats.equivalent.total))best=c;
 }
 if(best&&starter){const c={...best,pattern:'edge-bands',edgeOrigin:starter.info,rowSlots:rowSlots(best.list.filter(b=>b.edgeBand)),groupRepairs:0};return repairLayout(c,cat,Math.min(deadline,Date.now()+1500));}
 if(best&&rows){const c={...best,pattern:o.engineMode,rowSlots:rowSlots(best.list),groupRepairs:0};return repairLayout(c,cat,Math.min(deadline,Date.now()+1500));}
 if(best){
  let accepted=0;
  // Rebuild whole windows across the meeting line and elsewhere. Every contained
  // building can move, including administration, barracks and the fountain.
  // Surrounding rectangles stay intact; mandatory/premium counts stay exact.
  for(let step=0;step<90&&Date.now()<deadline;step++){
   const g=gridOf(best.list),holes=[];for(let n=0;n<N;n++)if(g[n]===0)holes.push(n);
   const anchor=holes.length&&step%2===0?holes[Math.floor(rng()*holes.length)]:Math.floor(rng()*N);
   const w=8+Math.floor(rng()*9),h=6+Math.floor(rng()*9),x=Math.max(0,Math.min(W-w,anchor%W-Math.floor(w/2))),y=Math.max(0,Math.min(H-h,Math.floor(anchor/W)-Math.floor(h/2)));
   const removed=best.list.filter(b=>b.x>=x&&b.y>=y&&b.x+b.w<=x+w&&b.y+b.h<=y+h);
   if(removed.length<3)continue;
   const outside=best.list.filter(b=>!removed.includes(b)),candidate=[...outside],packing=gridOf(outside);
   for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(xx<x||xx>=x+w||yy<y||yy>=y+h)packing[yy*W+xx]=-1;
   const movable=removed.filter(b=>b.kind!=='home'||b.premium).map(b=>({b,order:rng()}));
   movable.sort((a,b)=>!!a.b.points-!!b.b.points||(b.b.w*b.b.h-a.b.w*a.b.h)*(step%3?1:0)||a.order-b.order);
   let failed=false;
   for(const {b} of movable){
    const p=positions(packing,b,p=>{
     if(b.points){if(o.enforceLayout&&(atEdge(p,terrain)||candidate.some(t=>sameCultureClass(b,t)&&neighbours(p,t))||crowdsBarracks({...b,...p},candidate)))return -1e15;return candidate.reduce((v,t)=>v+(t.happyMax&&reaches(p,t)?Math.min(b.points,Math.max(0,t.happyMax-rawHappiness(t,candidate)))*(t.kind==='home'?.05:t.kind==='barracks'&&o.fullArmy?20:1):0),0);}
     const q=local(p);return -(step%2?q.u:wide-q.u-q.w)*.08-(step%4<2?q.v:tall-q.v-q.h)*.4;
    },rng)[0];if(!p||p._score<-1e14){failed=true;break;}candidate.push({...b,x:p.x,y:p.y,w:p.w,h:p.h});paint(packing,p,1);
   }if(failed)continue;
   const next=fillHomes(candidate),s=measure(next);
   if(s.spare<0||o.fullArmy&&s.armyDeficit>1e-5||o.requireFuel&&s.oldGoods+.01<o.sparkCap)continue;
   const delta=s.equivalent.total-best.stats.equivalent.total;
   if(delta>.001||Math.abs(delta)<.001&&s.used>best.stats.used){best={...best,list:next,stats:s};accepted++;}
  }
  // Replace an oversized source with a smaller rectangle when capped output
  // remains intact. Freed cells can join existing holes and become housing.
  for(const source of [...best.list].filter(b=>b.kind==='happiness'&&!b.premium)){
   if(Date.now()>=deadline)break;
   const base=best.list.filter(b=>b!==source),g=gridOf(base),candidates=[base];
   for(const id of ['compactCulture','littleCulture']){
    const def=cat[id];if(!def)continue;if(def.w*def.h>=source.w*source.h)continue;
    for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=source.y;y<=source.y+source.h-h;y++)for(let x=source.x;x<=source.x+source.w-w;x++)if(fits(g,x,y,w,h)&&!(o.enforceLayout&&crowdsBarracks({...def,x,y,w,h},base)))candidates.push(base.concat(make(id,{x,y,w,h})));
   }
   for(const items of candidates){
    const list=fillHomes(items),s=measure(list);
    if(s.spare<0||s.food+.001<best.stats.food||s.goods+.001<best.stats.goods||o.fullArmy&&s.armyDeficit>1e-5)continue;
    if(s.equivalent.total>best.stats.equivalent.total+.001||Math.abs(s.equivalent.total-best.stats.equivalent.total)<.001&&s.used>best.stats.used){best={...best,list,stats:s};accepted++;}
   }
  }
  best.examined=examined;best.groupRepairs=accepted;
  best=repairLayout(best,cat,Math.min(deadline,Date.now()+750),true);
  if(validate(best.list,best.options,cat))return null;
 }return best;
}
// Marek, 20.09.2026 ("działaj"): the sixth concept plans the city's skeleton from the numbers and the land instead of
// finding it by trial. A shelf is a production row as tall as the farm's long side, then a channel two cells deep of
// homes and culture, then a row again; the period repeats across the land in one of the two directions. Fixed blocks
// (barracks with their own channel, city hall, furnace, fountain) go where rows would lose the fewest cells, workshops
// and farms fill the rows longest first, every channel is filled by a beam search on the exact happiness arithmetic,
// spare row ends become homes. Only the ragged remainder is left to the search.
function searchShelves(cat,o,oldCount,seed,deadline=Infinity){
 const terrain=mask(o.tiles),rng=random(seed*31+17);
 let uid=1,examined=0;
 const make=(id,p)=>({...cat[id],...p,uid:uid++});
 const transposed=seed%2===1,wide=transposed?H:W,tall=transposed?W:H;
 const rect=(u,v,w,h)=>transposed?{x:v,y:u,w:h,h:w}:{x:u,y:v,w,h};
 const measure=list=>{examined++;const s=evaluate(list,o);s.equivalent=equivalent(s,o);return s;};
 const required=[...mandatoryFor(o),...o.optional].map(id=>cat[id]);
 for(const [id,n] of Object.entries(o.premium))for(let k=0;k<n;k++)required.push(cat[id]);
 for(const id of currentFor(o))for(let k=0;k<o.workshopCounts[id];k++)required.push(cat[id]);
 for(let k=0;k<oldCount;k++)required.push(cat[oldFor(o)]);
 const army=required.filter(b=>b.kind==='barracks'),workshops=required.filter(b=>b.kind==='workshop'&&!b.premium);
 const blocks=required.filter(b=>!army.includes(b)&&!workshops.includes(b)&&!b.points&&b.kind!=='home'&&b.kind!=='farm').sort((a,b)=>b.w*b.h-a.w*a.h);
 const extras=required.filter(b=>!army.includes(b)&&!workshops.includes(b)&&!blocks.includes(b));
 const farmId=primaryFarm(o)||(seed%3===2?otherFarm(preferredFarm(cat,o)):preferredFarm(cat,o)),farm=cat[farmId];
 if(!farm||!cat.smallHome)return null;
 const fw=Math.min(farm.w,farm.h),fh=Math.max(farm.w,farm.h),ch=cat.smallHome.h,period=fh+ch;
 const unitFood=hourly(farm,farm.happyMax,'food')*hours(farm,o)/(fw*fh+4*farm.needs),workerValue=4*unitFood;
 const coinValue=o.goldSparksPerBatch/o.goldPerBatch*o.foodPerSpark;
 const area=o.tiles.filter(Boolean).length*16,housingCost=required.reduce((n,b)=>n+b.w*b.h+4*(b.needs-b.workers),o.fountain?16:0);
 const upper=Math.max(0,Math.floor((area-housingCost-60)/(fw*fh+4*farm.needs)));
 const square=cat.moderateCulture,strip=cat.compactCulture,requirements={...o,oldCount,searchVersion:8};
 const cellFree=(g,u,v)=>{const p=rect(u,v,1,1);return g[p.y*W+p.x]===0;};
 function fillHomes(items){
  const out=[...items],g=terrain.slice();for(const b of out)paint(g,b,1);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
   if(g[y*W+x])continue;let rw=0,rh=0;while(x+rw<W&&!g[y*W+x+rw])rw++;while(y+rh<H&&!g[(y+rh)*W+x])rh++;
   for(const id of rw===3||rh===3?['averageHome','smallHome']:['smallHome','averageHome']){const b=cat[id];if(!b)continue;if(fits(g,x,y,b.w,b.h)){const p=make(id,{x,y});out.push(p);paint(g,p,1);break;}}
  }return out;
 }
 function attempt(phi,cap){
  let list=[];const grid=terrain.slice(),extrasLeft=[...extras];
  const put=(id,p)=>{const b=make(id,p);list.push(b);paint(grid,b,1);return b;};
  const inRow=v=>((v-phi)%period+period)%period<fh;
  // Row cells: where a production row of this phase would lie on available land.
  const rowsGrid=new Uint8Array(wide*tall);for(let v=0;v<tall;v++)for(let u=0;u<wide;u++)if(inRow(v)&&cellFree(terrain,u,v))rowsGrid[v*wide+u]=1;
  const freeAt=(u,v,w,h)=>{const p=rect(u,v,w,h);return fits(grid,p.x,p.y,p.w,p.h);};
  // A block costs the row cells it covers; it prefers the land's corners and contact with what already stands.
  const blockCost=(u,v,bw,bh,corner=true)=>{let c=0;for(let vv=v;vv<v+bh;vv++)for(let uu=u;uu<u+bw;uu++)c+=rowsGrid[vv*wide+uu]?1:.4;
   let contact=0;for(let uu=u;uu<u+bw;uu++){if(v===0||!cellFree(grid,uu,v-1))contact++;if(v+bh===tall||!cellFree(grid,uu,v+bh))contact++;}for(let vv=v;vv<v+bh;vv++){if(u===0||!cellFree(grid,u-1,vv))contact++;if(u+bw===wide||!cellFree(grid,u+bw,vv))contact++;}
   // Splitting a row in its middle costs more than shortening it from an end.
   let split=0;for(let vv=v;vv<v+bh;vv++){if(!inRow(vv))continue;let left=0,right=0;for(let uu=u-1;uu>=0&&rowsGrid[vv*wide+uu]&&cellFree(grid,uu,vv);uu--)left++;for(let uu=u+bw;uu<wide&&rowsGrid[vv*wide+uu]&&cellFree(grid,uu,vv);uu++)right++;if(left&&right)split+=.5*Math.min(left,right);}
   return c+split+(corner?.03*(Math.min(u,wide-u-bw)+Math.min(v,tall-v-bh)):0)-.02*contact;};
  const placeGroup=(items,bw,bh,extra=null,corner=true)=>{
   let at=null,bestCost=Infinity;
   for(let v=0;v+bh<=tall;v++)for(let u=0;u+bw<=wide;u++){
    let ok=true;
    for(const it of items){const p=rect(u+it.x,v+it.y,it.w,it.h);if(!fits(grid,p.x,p.y,p.w,p.h)||it.points&&(atEdge(p,terrain)||list.some(t=>sameCultureClass(it,t)&&neighbours(p,t)))){ok=false;break;}}
    if(!ok)continue;
    const c=blockCost(u,v,bw,bh,corner)+(extra?extra(u,v):0)+rng()*.01;
    if(c<bestCost){bestCost=c;at={u,v};}
   }
   if(!at)return null;
   for(const it of items){const p=rect(at.u+it.x,at.v+it.y,it.w,it.h);put(it.id,{...it,...p});}
   return at;
  };
  // Barracks as one block with its own channel; the rest of the fixed buildings one by one, largest first.
  // The barracks block keeps its two-cell gap open: the channel search fills it with the army's hunger in the score.
  const armyChannels=[];
  if(army.length>=2){const frag=fragmentSeed(cat,army,2*(Math.floor(seed/2)%16)),inner=frag.list.filter(b=>b.kind!=='barracks'),at=placeGroup(frag.list.filter(b=>b.kind==='barracks'),frag.width,frag.height);if(!at)return null;
   if(inner.length){const x0=Math.min(...inner.map(b=>b.x)),x1=Math.max(...inner.map(b=>b.x+b.w));armyChannels.push({v:at.v+inner[0].y,u0:at.u+x0,len:x1-x0,army:true});}}
  else for(const b of army)if(!placeGroup([{...b,x:0,y:0,w:b.w,h:b.h}],b.w,b.h))return null;
  for(const b of blocks)if(!placeGroup([{...b,x:0,y:0,w:b.w,h:b.h}],b.w,b.h))return null;
  if(o.fountain&&cat.fountain){
   const f=cat.fountain,r=f.range;
   const reach=(u,v)=>{let n=0;for(let vv=Math.max(0,v-r);vv<Math.min(tall,v+f.h+r);vv++)for(let uu=Math.max(0,u-r);uu<Math.min(wide,u+f.w+r);uu++)if(rowsGrid[vv*wide+uu]&&!(uu>=u&&uu<u+f.w&&vv>=v&&vv<v+f.h))n++;const p=rect(u,v,f.w,f.h);let a=0;for(const b of list)if(b.kind==='barracks'&&reaches({...p,range:r},b))a+=b.w*b.h;return -.3*n-.6*a+((p.x%2||p.y%2)?.5:0);};
   if(!placeGroup([{...f,x:0,y:0,w:f.w,h:f.h}],f.w,f.h,reach,false))return null;
  }
  // Production rows: the free runs of every row band, longest first; workshops and then farms stand across the row.
  const runs=[];
  for(let v=phi;v+fh<=tall;v+=period){let u=0;while(u<wide){while(u<wide&&!freeAt(u,v,1,fh))u++;const u0=u;while(u<wide&&freeAt(u,v,1,fh))u++;if(u>u0)runs.push({v,u0,len:u-u0});}}
  runs.sort((a,b)=>b.len-a.len||a.v-b.v);
  const pool=workshops.map(b=>({def:b,w:Math.min(b.w,b.h),h:Math.max(b.w,b.h)})).filter(it=>it.h<=fh),leftover=workshops.filter(b=>Math.max(b.w,b.h)>fh);
  let farmsLeft=cap,farms=0;
  for(const run of runs){
   let used=0;const items=[];
   while(used<run.len){
    const it=pool.length?pool[0]:farmsLeft>0?{def:farm,w:fw,h:fh}:null;
    if(!it||used+it.w>run.len)break;
    if(pool.length)pool.shift();else farmsLeft--;
    items.push(it);used+=it.w;
   }
   // An even remainder takes 2x2 homes; an odd one would leave a one-cell strip.
   if(items.length&&(run.len-used)%2===1&&items[items.length-1].w%2===1){const it=items.pop();used-=it.w;if(it.def===farm)farmsLeft++;else pool.unshift(it);}
   if(items.length<ROW_MIN&&items.every(it=>it.def===farm)){farmsLeft+=items.length;continue;}
   let u=run.u0;for(const it of items){put(it.def.id,rect(u,run.v,it.w,it.h));u+=it.w;if(it.def===farm)farms++;}
  }
  // Workers still missing after the rows, counting the homes the row remainders will take; a channel home is worth
  // a worker only while the city lacks one, otherwise its coins alone.
  let freeRowCells=0;for(let v=0;v<tall;v++)for(let u=0;u<wide;u++)if(rowsGrid[v*wide+u]&&cellFree(grid,u,v))freeRowCells++;
  let deficit=list.reduce((n,b)=>n+b.needs-b.workers,0)-Math.floor(freeRowCells/(cat.smallHome.w*cat.smallHome.h))*cat.smallHome.workers;
  const homeCoins=hourly(cat.smallHome,0,'coins')*hours(cat.smallHome,o)*coinValue;
  // Channels: a beam search along every free run, scored by the exact happiness arithmetic of what already stands.
  const fillChannel=chan=>{
   const targets=list.filter(b=>b.happyMax>0),raw0=new Map(targets.map(t=>[t,rawHappiness(t,list)]));
   const gainOf=(p,raw,points)=>{let gain=0;const hit=[];for(const t of targets){if(!reaches(p,t))continue;const before=Math.min(raw.get(t),t.happyMax),after=Math.min(before+points,t.happyMax);if(after<=before)continue;hit.push(t);
     gain+=(hourly(t,after,'food')-hourly(t,before,'food'))*hours(t,o)+(hourly(t,after,'coins')-hourly(t,before,'coins'))*hours(t,o)*coinValue;
     if(t.kind==='workshop'){const res=t.rewards[0]?.resource;if(res)gain+=(hourly(t,after,res)-hourly(t,before,res))*hours(t,o)*o.foodPerGood;}
     if(o.fullArmy&&t.kind==='barracks')gain+=armyGain(t,before,after,o)*1e7;}
    return {gain,hit};};
   const premiumKinds=chan.army?extrasLeft.filter(b=>b.premium&&b.points&&Math.min(b.w,b.h)===ch).map(b=>({def:b,w:Math.max(b.w,b.h),h:ch,points:b.points,premium:true})):[];
   const kinds=[...premiumKinds,{def:cat.smallHome,w:cat.smallHome.w,h:ch,points:0},square?{def:square,w:square.w,h:ch,points:square.points}:null,strip?{def:strip,w:Math.min(strip.w,strip.h),h:ch,points:strip.points}:null].filter(Boolean);
   const buckets=Array.from({length:chan.len+1},()=>[]);buckets[0].push({items:[],raw:raw0,lastSquare:false,lastSmall:false,score:0,homes:0,prem:false});
   for(let pos=0;pos<chan.len;pos++){
    for(const st of buckets[pos]){
     for(const k of kinds){
      if(pos+k.w>chan.len)continue;
      const p={...k.def,...rect(chan.u0+pos,chan.v,k.w,k.h)};
      if(k.points){if(k.premium&&st.prem||k.w*k.h>=4&&!k.premium&&st.lastSquare||k.w*k.h<4&&st.lastSmall||atEdge(p,terrain)||list.some(t=>sameCultureClass(p,t)&&neighbours(p,t))||crowdsBarracks(p,list))continue;
       const {gain,hit}=gainOf(p,st.raw,k.points);const raw=new Map(st.raw);for(const t of hit)raw.set(t,raw.get(t)+k.points);
       buckets[pos+k.w].push({items:st.items.concat({id:k.def.id,p,premium:!!k.premium}),raw,lastSquare:k.w*k.h>=4&&!k.premium,lastSmall:k.w*k.h<4,score:st.score+gain-(k.w*k.h<4?.2*workerValue:0),homes:st.homes,prem:st.prem||!!k.premium});}
      else buckets[pos+k.w].push({items:st.items.concat({id:k.def.id,p}),raw:st.raw,lastSquare:false,lastSmall:false,score:st.score+homeCoins+(st.homes*cat.smallHome.workers<deficit?workerValue:0),homes:st.homes+1,prem:st.prem});
     }
     // A single cell may stay open when nothing else fits; the repairs retile it.
     buckets[pos+1].push({items:st.items,raw:st.raw,lastSquare:false,lastSmall:false,score:st.score-workerValue,homes:st.homes,prem:st.prem});
    }
    const next=buckets[pos+1];if(next.length>10){next.sort((a,b)=>b.score-a.score);next.length=10;}
    const two=buckets[pos+2];if(two&&two.length>10){two.sort((a,b)=>b.score-a.score);two.length=10;}
   }
   const final=buckets[chan.len].sort((a,b)=>b.score-a.score)[0];
   if(final){for(const it of final.items){put(it.id,it.p);if(it.premium){const i=extrasLeft.findIndex(b=>b.id===it.id);if(i>=0)extrasLeft.splice(i,1);}}deficit-=final.homes*cat.smallHome.workers;}
  };
  for(const chan of armyChannels)fillChannel(chan);
  const channels=[];
  for(let v=phi-ch;v+ch<=tall;v+=period){if(v<0)continue;if(inRow(v))continue;let u=0;while(u<wide){while(u<wide&&!freeAt(u,v,1,ch))u++;const u0=u;while(u<wide&&freeAt(u,v,1,ch))u++;if(u>u0)channels.push({v,u0,len:u-u0});}}
  for(const chan of channels)fillChannel(chan);
  // Workshops the rows could not take, sources and premium extras: where the model rewards them most.
  for(const b of [...leftover,...pool.map(it=>it.def),...extrasLeft]){
   const p=positions(grid,b,p=>{const f=list.find(t=>t.id==='fountain');
    if(b.points)return atEdge(p,terrain)?-1e9:list.reduce((n,t)=>n+(t.happyMax&&reaches(p,t)?(t.kind==='barracks'&&o.fullArmy?4:t.kind==='home'?(b.id==='collectableMinoanWatchtowerV2'||b.premium?.3:.05):t.oldWorkshop&&b.premium?.4:1)*Math.min(b.points,Math.max(0,t.happyMax-rawHappiness(t,list)))/t.happyMax+.03:0),0);
    if(b.kind==='home')return f&&reaches(f,p)?100:0;
    return Math.min(rawHappiness(p,list),p.happyMax||1)/(p.happyMax||1)*10+(f&&reaches(f,p)?50:0);},rng)[0];
   if(!p)return null;put(p.id,p);
  }
  list=fillHomes(list);let s=measure(list);
  if(o.fullArmy&&s.armyDeficit>1e-5){list=fillHomes(feedBarracks(list,cat,o,Math.min(deadline,Date.now()+300)));s=measure(list);}
  return {list,s,error:validate(list,requirements,cat),farms,phi};
 }
 let best=null;
 const phis=[...Array(period).keys()].sort(()=>rng()-.5);
 for(const phi of phis){
  if(Date.now()>=deadline)break;
  // The farm count: cut by the worker deficit, then add one at a time while the workers allow it.
  let cap=upper;const tried=new Set();
  for(let k=0;k<8&&Date.now()<deadline;k++){
   if(tried.has(cap))break;tried.add(cap);
   const r=attempt(phi,cap);
   if(root.HOH_DEBUG_SHELVES)console.log('  plan',transposed?'pion':'poziom','faza',phi,'cap',cap,r?'farm '+r.farms+' wolnych prac. '+r.s.spare+' '+(r.error||'OK '+Math.round(r.s.equivalent.total)):'brak');
   if(!r)break;
   if(r.error){if(r.s.spare<0&&r.farms>0){cap=Math.max(0,r.farms-Math.max(2,Math.ceil(-r.s.spare/6)));continue;}break;}
   const c={list:r.list,stats:r.s,oldCount,seed,pattern:'shelves',options:requirements,examined,shelfOrigin:{transposed,phi,farms:r.farms,upper,farm:farmId}};
   if(!best||betterLayout(c,best,requirements))best=c;
   if(r.s.spare>=2&&r.farms>=cap){cap=r.farms+1;continue;}
   break;
  }
 }
 if(!best)return null;
 best.examined=examined;best.rowSlots=rowSlots(best.list);best.groupRepairs=0;
 return repairLayout(best,cat,Math.min(deadline,Date.now()+450));
}
async function generate(data,input,progress=()=>{}){
 const {seedLayouts=[],patterns=[],...settings}=input;const o=normalized(settings);validateOptions(o);const cat=prepare(data,o);
 if(o.optional.some(id=>!cat[id])||Object.keys(o.premium).some(id=>!cat[id]?.premium))throw Error('Nieznany budynek w ustawieniach.');
 const old=cat[oldFor(o)],oldDaily=fuelPerWorkshop(o);
 const alternative=Math.ceil(o.sparkCap/Math.max(1,oldDaily));
 const plans=[{count:o.oldCount,title:'Twój cel'}];
 if(old&&o.compareSparks&&o.sparkCap>0)plans.push({count:alternative,title:'Wariant z produkcją do pieca'});
 if(o.engineMode)return generateCompared(cat,o,plans,progress,Array.isArray(seedLayouts)?seedLayouts:[],Array.isArray(patterns)?patterns:[]);
 const choices=[],warnings=[];let done=0,tried=0;const starts=o.searchStarts,total=plans.length*starts;
 for(const plan of plans){let best=null;for(let seed=1;seed<=starts;seed++){
  const c=searchCity(cat,{...o,requireFuel:plan.title!=='Twój cel'},plan.count,seed);tried+=c?.examined||0;
  if(c&&(!best||c.stats.equivalent.total>best.stats.equivalent.total))best=c;
  progress(++done,total);await new Promise(resolve=>setTimeout(resolve,0));
 }if(best){best.title=plan.title;choices.push(best);}else warnings.push('Nie znaleziono poprawnego układu: '+plan.title+'. To wynik ograniczonego wyszukiwania, nie dowód, że miasto się nie mieści.');}
 if(!choices.length)throw Error('Nie znalazłem poprawnego układu w tym przebiegu. Wymagania pozostają zachowane. '+warnings.join(' '));
 return {choices,cat,tried,frontier:choices.length,warnings,balanced:false,searchVersion:7};
}

// Swap an entire housing rectangle with administration. Coverage is useful only
// to the homes; neither the furnace nor other zero-demand buildings earns it.
function relocateAdministration(choice,cat,deadline=Infinity){
 const o=normalized(choice.options),terrain=mask(o.tiles);let best=choice,moves=0,uid=Math.max(0,...choice.list.map(b=>b.uid))+1;
 const admins=choice.list.filter(b=>b.id==='furnace'),current=qualityMemo(o);
 const measure=list=>{const s=evaluate(list,o);s.equivalent=equivalent(s,o);return s;};
 for(const original of admins){
  if(Date.now()>=deadline)break;
  const b=best.list.find(t=>t.uid===original.uid);if(!b)continue;const fed=rawHappiness(b,best.list)>0;
  const proposals=[];
  for(let y=0;y<=H-b.h;y++)for(let x=0;x<=W-b.w;x++){
   if(Date.now()>=deadline)break;
   const p={...b,x,y};if(overlap(p,b)||!fits(terrain,x,y,b.w,b.h))continue;
   const homes=best.list.filter(t=>overlap(t,p));
   if(!homes.length||homes.some(t=>t.kind!=='home'||t.premium||t.x<x||t.y<y||t.x+t.w>x+b.w||t.y+t.h>y+b.h))continue;
   if(homes.reduce((s,t)=>s+t.w*t.h,0)!==b.w*b.h)continue;
   const moved=homes.map(t=>({...t,x:t.x+b.x-x,y:t.y+b.y-y}));
   const gain=moved.reduce((s,t,i)=>s+hourly(t,happiness(t,best.list),'coins')-hourly(homes[i],happiness(homes[i],best.list),'coins'),0);
   // Marek, 16.09.2026: an unfed furnace may also give its place to homes when the homes
   // gathered beside it can then be watered; such swaps are tried together with one new square.
   const together=best.list.filter(t=>t.kind==='home'&&!homes.includes(t)&&moved.some(m=>neighbours(m,t))).length;
   if(gain>0||!fed&&together>0)proposals.push({p,homes,moved,gain,together});
  }
  proposals.sort((a,b)=>b.gain-a.gain||b.together-a.together);
  for(const {p,homes,moved,gain} of proposals.slice(0,40)){
   if(Date.now()>=deadline)break;
   const list=best.list.filter(t=>t!==b&&!homes.includes(t)).concat(p,moved);
   if(!preservesRows(list,choice.rowSlots)||validate(list,o,cat))continue;
   const stats=measure(list);
   if(gain>0&&layoutQuality(list,o).cost<=current(best.list).cost&&stats.equivalent.total>=best.stats.equivalent.total-.001&&stats.coins>best.stats.coins+.001){best={...best,list,stats};moves++;break;}
   if(!cat.moderateCulture)continue;
   let combo=null;
   for(const t of list.filter(t=>t.kind==='home'&&!t.premium&&t.w===2&&t.h===2&&moved.some(m=>m===t||neighbours(m,t)))){
    if(Date.now()>=deadline)break;
    const square={...cat.moderateCulture,x:t.x,y:t.y,uid:uid++};
    if(o.enforceLayout&&(atEdge(square,terrain)||list.some(u=>sameCultureClass(square,u)&&neighbours(square,u))))continue;
    const withSquare=list.filter(u=>u!==t).concat(square);
    if(validate(withSquare,o,cat))continue;
    const s=measure(withSquare);if(!combo||s.equivalent.total>combo.stats.equivalent.total)combo={list:withSquare,stats:s};
   }
   if(combo&&combo.stats.equivalent.total>best.stats.equivalent.total+.001&&layoutQuality(combo.list,o).cost<=current(best.list).cost+10){best={...best,list:combo.list,stats:combo.stats};moves++;break;}
  }
 }
 return {...best,administrationMoves:(choice.administrationMoves||0)+moves};
}
// Marek, 16.09.2026: a premium source belongs where big buildings need many points. When it
// can reach two barracks, it is tried there; the ordinary culture it makes redundant around
// the barracks is released, holes become homes, and the whole move is judged by the ranking.
function premiumToBarracks(choice,cat,deadline=Infinity){
 const o=normalized(choice.options),terrain=mask(o.tiles);let best=choice,moves=0;
 const measure=list=>{const s=evaluate(list,o);s.equivalent=equivalent(s,o);return s;};
 const refillHomes=list=>{const out=[...list],g=terrain.slice();out.forEach(b=>paint(g,b,1));let uid=Math.max(0,...out.map(b=>b.uid))+1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(const id of ['smallHome','averageHome'])if(cat[id]&&fits(g,x,y,cat[id].w,cat[id].h)){const b={...cat[id],x,y,uid:uid++};out.push(b);paint(g,b,1);break;}return fillHoles(out,cat,o);};
 const army=choice.list.filter(b=>b.kind==='barracks');if(army.length<2)return {...choice,premiumMoves:choice.premiumMoves||0};
 for(const original of choice.list.filter(b=>b.points&&(b.premium||b.id==='fountain'))){
  if(Date.now()>=deadline)break;
  const prem=best.list.find(b=>b.uid===original.uid),need=prem?.id==='fountain'?3:2;if(!prem||army.filter(b=>reaches(prem,b)).length>=need)continue;
  const spots=[];
  for(const [w,h] of prem.w===prem.h?[[prem.w,prem.h]]:[[prem.w,prem.h],[prem.h,prem.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
   if(!fits(terrain,x,y,w,h))continue;const p={...prem,x,y,w,h};
   const hit=best.list.filter(b=>b!==prem&&overlap(b,p));
   if(hit.some(b=>b.premium||(b.kind!=='home'&&b.kind!=='happiness')))continue;
   const reach=army.filter(b=>reaches(p,b)).length;if(reach<need)continue;
   if(o.enforceLayout&&atEdge(p,terrain))continue;
   spots.push({p,hit,reach});
  }
  spots.sort((a,b)=>b.reach-a.reach||a.hit.length-b.hit.length);
  for(const {p,hit} of spots.slice(0,12)){
   if(Date.now()>=deadline)break;
   let list=best.list.filter(b=>b!==prem&&!hit.includes(b)).concat(p);
   // Release ordinary culture around the barracks while the army stays fed and the value holds.
   const armyFloor=evaluate(best.list,o).armyDeficit+1e-5;
   let changed=true;while(changed&&Date.now()<deadline){changed=false;const value=measure(list).equivalent.total;for(const s of list.filter(b=>b.points&&!b.premium&&b.id!=='fountain'&&b.id!=='collectableMinoanWatchtowerV2'&&army.some(a=>reaches(b,a)))){const t=list.filter(b=>b!==s);const st=evaluate(t,o);if(st.armyDeficit>armyFloor)continue;if(equivalent(st,o).total<value-.001)continue;list=t;changed=true;break;}}
   if(evaluate(list,o).armyDeficit>armyFloor)continue;
   list=refillHomes(list);
   if(!preservesRows(list,choice.rowSlots)||validate(list,o,cat))continue;
   const n={...best,list,stats:measure(list)};
   if(betterLayout(n,best,o)){best=n;moves++;break;}
  }
 }
 return {...best,premiumMoves:(choice.premiumMoves||0)+moves};
}
// Improve an already feasible city. Sources and their neighbouring homes are
// exchanged as one move; producer pairs can be rotated to open a shared channel.
// Marek, 15.09.2026: move a culture square by one cell and let the whole row slide along
// like a snake, until a free strip absorbs the shift; the strip the square vacates takes a
// thin culture. Homes and culture move, producers and required buildings stop the chain.
const SLIDE_KINDS=new Set(['home','happiness']);
function slideChain(list,source,dx,dy,terrain,limit=16){
 const chain=[source],seen=new Set([source.uid]);
 const ahead=b=>dx>0?{x:b.x+b.w,y:b.y,w:1,h:b.h}:dx<0?{x:b.x-1,y:b.y,w:1,h:b.h}:dy>0?{x:b.x,y:b.y+b.h,w:b.w,h:1}:{x:b.x,y:b.y-1,w:b.w,h:1};
 for(let i=0;i<chain.length;i++){
  const strip=ahead(chain[i]);
  if(!fits(terrain,strip.x,strip.y,strip.w,strip.h)&&(strip.x<0||strip.y<0||strip.x+strip.w>W||strip.y+strip.h>H||[...Array(strip.w*strip.h).keys()].some(k=>terrain[(strip.y+Math.floor(k/strip.w))*W+strip.x+k%strip.w]===-1)))return null;
  for(const b of list){if(seen.has(b.uid)||!overlap(b,strip))continue;if(!SLIDE_KINDS.has(b.kind))return null;if(chain.length>=limit)return null;chain.push(b);seen.add(b.uid);}
 }
 const placed=chain.map(b=>({...b,x:b.x+dx,y:b.y+dy}));
 if(placed.some(p=>!fits(terrain,p.x,p.y,p.w,p.h)))return null;
 const vacated=dx>0?{x:source.x,y:source.y,w:1,h:source.h}:dx<0?{x:source.x+source.w-1,y:source.y,w:1,h:source.h}:dy>0?{x:source.x,y:source.y,w:source.w,h:1}:{x:source.x,y:source.y+source.h-1,w:source.w,h:1};
 return {removed:chain,placed,vacated};
}
// Marek, 16.09.2026: holes are filled. A free cell that no home can take gets a 1x1
// culture, provided it waters at least one building.
function fillHoles(list,cat,o){
 if(!cat.littleCulture)return list;const terrain=mask(o.tiles),g=terrain.slice();list.forEach(b=>paint(g,b,1));
 const out=[...list];let uid=Math.max(0,...list.map(b=>b.uid))+1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if(g[y*W+x]!==0)continue;
  if(fits(g,x,y,2,2)||fits(g,x-1,y,2,2)||fits(g,x,y-1,2,2)||fits(g,x-1,y-1,2,2))continue;
  const p={...cat.littleCulture,x,y,w:1,h:1,uid:uid++};
  if(o.enforceLayout&&crowdsBarracks(p,out))continue;
  if(!out.some(b=>b.happyMax&&reaches(p,b)))continue;
  out.push(p);paint(g,p,1);
 }
 return out;
}
function refineHappiness(choice,cat,deadline=Infinity){
 const adminStart=Date.now();choice=relocateAdministration(choice,cat,Number.isFinite(deadline)?adminStart+Math.max(0,deadline-adminStart)*.15:adminStart+500);
 const o=normalized(choice.options),terrain=mask(o.tiles);let best=choice,uid=Math.max(...choice.list.map(b=>b.uid))+1,checked=0,moves=0,channels=0,spacers=0,slides=0,spareMoves=0,sweeps=0;
 // Layout preferences may cost at most the band below the value this refinement started
 // from, never more, and no refinement move may open a hole.
 const anchor=choice.stats?.equivalent?.total||0,budgetLive=Date.now()<deadline;
 const thin=list=>list.filter(b=>['compactCulture','littleCulture'].includes(b.id)).length,current=qualityMemo(o);
 const gridOf=list=>{const g=terrain.slice();for(const b of list)paint(g,b,1);return g;};
 function refill(list){
  const out=[...list],g=gridOf(out);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!g[y*W+x]){
   let width=0,height=0;while(x+width<W&&!g[y*W+x+width])width++;while(y+height<H&&!g[(y+height)*W+x])height++;
   for(const id of width===3||height===3?['averageHome','smallHome']:['smallHome','averageHome']){const b=cat[id];if(!b)continue;if(fits(g,x,y,b.w,b.h)){const p={...b,x,y,uid:uid++};out.push(p);paint(g,p,1);break;}}
  }return out;
 }
 function rebuild(removed,placed){
  if(placed.some(p=>!fits(terrain,p.x,p.y,p.w,p.h)))return null;
  for(let i=0;i<placed.length;i++)if(placed.slice(i+1).some(p=>overlap(p,placed[i])))return null;
  const hits=best.list.filter(b=>!removed.includes(b)&&placed.some(p=>overlap(b,p)));
  if(hits.some(b=>b.kind!=='home'||b.premium))return null;
  return refill(best.list.filter(b=>!removed.includes(b)&&!hits.includes(b)).concat(placed));
 }
 // Marek, 16.09.2026: spare workers must become farms that extend a production strip, not stay as filler homes
 // ("skasować domy, dać farmy i pociągnąć kolejkę budowy dalej"). Homes only give way; nothing else moves.
 // Marek, 16.09.2026, on bought places: "dostawić farmę i 2 domki, farmę i dwa domki" — a farm with the homes it
 // needs is worker-neutral, so new cells get such packages first; the refill adds the homes around the farm.
 function spendSpareWorkers(until){
  let progress=true;
  while(progress&&Date.now()<until){
   progress=false;const spare=best.stats.spare;const g0=gridOf(best.list);let freeTotal=0;for(let i=0;i<N;i++)if(!g0[i])freeTotal++;if(spare<1&&freeTotal<4)return;
   const first=preferredFarm(cat,o),kinds=[first,otherFarm(first)].filter(id=>cat[id]);
   const g=gridOf(best.list),producers=best.list.filter(b=>b.kind==='farm'||b.kind==='workshop'),candidates=[];
   for(const id of kinds){const def=cat[id];for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
    if(!fits(terrain,x,y,w,h))continue;const p={...def,x,y,w,h};
    const hits=best.list.filter(b=>overlap(b,p));if(hits.some(b=>!((b.kind==='home'||b.kind==='happiness')&&!b.premium&&b.id!=='fountain'&&b.id!=='collectableMinoanWatchtowerV2')))continue;
    const lost=hits.reduce((n,b)=>n+b.workers,0);let free=0;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(!g[yy*W+xx])free++;
    if(lost+(def.needs||0)>spare+Math.floor(Math.max(0,freeTotal-free)/4))continue;
    const inline=joinsRowAcross(p,producers);
    candidates.push({p,hits,score:(inline?40:0)+free*2-lost*3-hits.length});
   }}
   candidates.sort((a,b)=>b.score-a.score);
   for(const c of candidates.slice(0,24)){if(Date.now()>=until)return;const p={...c.p,uid:uid++};if(consider(fillHoles(refill(best.list.filter(b=>!c.hits.includes(b)).concat(p)),cat,o))){progress=true;spareMoves++;break;}}
  }
 }
 // Marek, 16.09.2026: scan the map for the worst-scoring sectors and work there; a perfect sector is left alone.
 // In a bad sector every ordinary source tries one cell in each direction (pushing neighbours or swapping with a
 // home of the same size); the two worst sectors also exchange same-size buildings between themselves.
 function sweepSectors(until){
  const waste=sectorWaste(best.list,o),order=[...waste.keys()].filter(k=>waste[k]>0).sort((a,b)=>waste[b]-waste[a]).slice(0,12);
  const inSector=(b,k)=>{const sx=(k%10)*4,sy=Math.floor(k/10)*4;return b.x<sx+4&&b.x+b.w>sx&&b.y<sy+4&&b.y+b.h>sy;};
  for(const k of order){
   if(Date.now()>=until)return;
   for(const src of best.list.filter(b=>b.kind==='happiness'&&!b.premium&&inSector(b,k))){
    if(Date.now()>=until)return;const live=best.list.find(b=>b.uid===src.uid);if(!live)continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const moved=slideChain(best.list,live,dx,dy,terrain);if(moved&&consider(rebuild(moved.removed,moved.placed))){sweeps++;break;}
     const p={...live,x:live.x+dx,y:live.y+dy};if(!fits(terrain,p.x,p.y,p.w,p.h))continue;
     const hit=best.list.filter(b=>b!==live&&overlap(b,p));
     if(hit.length===1&&hit[0].kind==='home'&&!hit[0].premium&&hit[0].w===live.w&&hit[0].h===live.h){const other={...hit[0],x:live.x,y:live.y};if(consider(best.list.filter(b=>b!==live&&b!==hit[0]).concat(p,other))){sweeps++;break;}}
    }
   }
  }
  // Marek: farms "standing sideways" next to a row of culture — in a bad sector each rectangular producer tries a turn.
  for(const k of order){if(Date.now()>=until)return;for(const b of best.list.filter(t=>(t.kind==='farm'||t.kind==='workshop')&&!t.premium&&t.w!==t.h&&inSector(t,k))){const live=best.list.find(t=>t.uid===b.uid);if(!live)continue;const g=gridOf(best.list.filter(t=>t!==live));if(fits(g,live.x,live.y,live.h,live.w)&&consider(best.list.filter(t=>t!==live).concat({...live,w:live.h,h:live.w})))sweeps++;}}
  if(order.length>=2&&Date.now()<until){
   const [k1,k2]=order,movable=b=>(b.kind==='home'||b.kind==='happiness'||b.kind==='farm')&&!b.premium;let tried=0;
   for(const a of best.list.filter(b=>movable(b)&&inSector(b,k1)))for(const b of best.list.filter(t=>movable(t)&&inSector(t,k2)&&t.w===a.w&&t.h===a.h&&t.id!==a.id)){
    if(Date.now()>=until||++tried>40)return;const la=best.list.find(t=>t.uid===a.uid),lb=best.list.find(t=>t.uid===b.uid);if(!la||!lb)continue;
    if(consider(best.list.filter(t=>t!==la&&t!==lb).concat({...la,x:lb.x,y:lb.y},{...lb,x:la.x,y:la.y}))){sweeps++;break;}
   }
  }
 }
 function consider(list,keepValue=false,ql=null){
  if(!list||!preservesRows(list,choice.rowSlots))return false;checked++;const s=evaluate(list,o);s.equivalent=equivalent(s,o);
  if(s.spare<0||o.fullArmy&&s.armyDeficit>1e-5||o.requireFuel&&s.oldGoods+.01<o.sparkCap)return false;
  const qcur=current(best.list);ql??=layoutQuality(list,o);
  // Marek, 20.09.2026: the better city always wins — a move may not open a hole; the value itself is judged by the ranking.
  if(ql.free>qcur.free)return false;
  // Rows rule inside the refinement too: a move may not push loose producers past the current count or the tolerance.
  if(ql.loose>Math.max(qcur.loose,Math.floor(ql.producers*LOOSE_SHARE)))return false;
  const delta=s.equivalent.total-best.stats.equivalent.total;
  if(keepValue&&delta<-.001)return false;
  const tie=Math.abs(delta)<.001;
  if(o.enforceLayout?betterLayout({list,stats:s},best,o,ql,qcur):delta>.001||tie&&(thin(list)<thin(best.list)||thin(list)===thin(best.list)&&(s.used>best.stats.used||s.used===best.stats.used&&s.excess<best.stats.excess))){best={...best,list,stats:s};uid=Math.max(uid,...list.map(b=>b.uid))+1;moves++;return true;}return false;
 }
 // Scan the culture squares and strips from a corner; try each one cell over with the row
 // sliding along, first with a thin culture in the vacated strip, then plain.
 function slideRows(until,reverse=false){
  const order=[...best.list].filter(b=>b.kind==='happiness'&&!b.premium&&(b.id==='moderateCulture'||b.id==='compactCulture')).sort((a,b)=>(a.y-b.y||a.x-b.x)*(reverse?-1:1));
  for(const original of order){
   if(Date.now()>=until)break;
   const source=best.list.find(b=>b.uid===original.uid);if(!source)continue;
   for(const [dx,dy] of reverse?[[-1,0],[0,-1],[1,0],[0,1]]:[[1,0],[0,1],[-1,0],[0,-1]]){
    if(Date.now()>=until)break;
    const chain=slideChain(best.list,source,dx,dy,terrain);if(!chain)continue;
    const v=chain.vacated,strip=cat.compactCulture&&v.w*v.h===2?{...cat.compactCulture,x:v.x,y:v.y,w:v.w,h:v.h,uid:uid++}:null;
    if(strip&&consider(rebuild(chain.removed,[...chain.placed,strip]))){slides++;break;}
    if(consider(rebuild(chain.removed,chain.placed))){slides++;break;}
   }
  }
 }
 // Two 1x1 cultures side by side become one strip (Marek: a 1x1 is never aimed at a building).
 function mergeLittles(until){
  if(!cat.compactCulture)return;
  for(const a of [...best.list].filter(b=>b.id==='littleCulture')){
   if(Date.now()>=until)break;
   const live=best.list.find(b=>b.uid===a.uid);if(!live)continue;
   const mate=best.list.find(b=>b.id==='littleCulture'&&b!==live&&neighbours(live,b)&&(b.y===live.y||b.x===live.x));if(!mate)continue;
   const strip={...cat.compactCulture,x:Math.min(live.x,mate.x),y:Math.min(live.y,mate.y),w:live.y===mate.y?2:1,h:live.y===mate.y?1:2,uid:uid++};
   const merged=rebuild([live,mate],[strip]);
   if(consider(merged))continue;
   // The strip carries 30 points less than two 1x1 pieces; when that breaks a barracks
   // minimum, feed the barracks again and judge the pair of moves together.
   if(merged&&o.fullArmy&&evaluate(merged,o).armyDeficit>1e-5)consider(refill(feedBarracks(merged,cat,o,Math.min(until,Date.now()+300))));
  }
 }
 function spreadFountain(until){
  const f=best.list.find(b=>b.id==='fountain');if(!f)return;
  const producers=best.list.filter(b=>['farm','workshop','barracks'].includes(b.kind)).sort((a,b)=>Number(reaches(f,b))-Number(reaches(f,a)));
  for(const original of producers){
   if(Date.now()>=until)break;const b=best.list.find(t=>t.uid===original.uid);
   const g=gridOf(best.list.filter(t=>t!==b&&(t.kind!=='home'||t.premium)));
   let accepted=false;
   for(const [w,h] of b.w===b.h?[[b.w,b.h]]:[[b.w,b.h],[b.h,b.w]]){
    for(const p of sourceEdgePositions(f,{...b,w,h})){
     if(Date.now()>=until)break;if(!fits(g,p.x,p.y,w,h))continue;
     const candidate=rebuild([b],[p]);
     if(consider(candidate,true)){accepted=true;break;}
     // Moving a 3x4 footprint can leave odd strips. Retile the released
     // neighbourhood as part of this move, rather than judging the hole alone.
     if(candidate){const x=Math.max(0,b.x-2),y=Math.max(0,b.y-2),region={x,y,w:Math.min(W,b.x+b.w+2)-x,h:Math.min(H,b.y+b.h+2)-y};
      if(consider(packHomes(candidate,cat,o,region,Math.min(until,Date.now()+8)),true)){accepted=true;break;}
     }
    }
    if(accepted)break;
   }
  }
 }
 // Test removal and smaller sources BEFORE the relocation heuristic filters
 // on direct coverage gain. Reclaimed housing (and workers) is part of the
 // same complete proposal, never a bonus assigned to raw surplus itself.
 function reclaimCulture(until){
  const demand=best.list.filter(b=>b.happyMax),raw=new Map(demand.map(b=>[b,rawHappiness(b,best.list)]));
  const useful=source=>demand.reduce((n,b)=>n+(reaches(source,b)?Math.min(source.points,Math.max(0,b.happyMax-raw.get(b)+source.points))/b.happyMax:0),0)/(source.w*source.h);
  const sources=best.list.filter(b=>b.kind==='happiness'&&!b.premium).sort((a,b)=>useful(a)-useful(b)||b.w*b.h-a.w*a.h);
  for(const original of sources){
   if(Date.now()>=until)break;
   const source=best.list.find(b=>b.uid===original.uid);if(!source)continue;
   const replacements=[[]];
   for(const id of ['moderateCulture','compactCulture','littleCulture']){
    const def=cat[id];if(!def)continue;if(def.w*def.h>=source.w*source.h)continue;
    for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]]){
     if(w>source.w||h>source.h)continue;
     for(let y=source.y;y<=source.y+source.h-h;y++)for(let x=source.x;x<=source.x+source.w-w;x++)replacements.push([{...def,x,y,w,h,uid:source.uid}]);
    }
   }
   for(const placed of replacements){
    if(Date.now()>=until)break;
    const base=best.list.filter(b=>b!==source).concat(placed);
    // Reclaiming is a housing step: a smaller source that leaves new holes is not it,
    // even when the output figure alone would prefer it under the value-first hierarchy.
    const filled=refill(base),qf=layoutQuality(filled,o);
    if(qf.free<=current(best.list).free&&consider(filled,true,qf))break;
    // A vacated 1x1/1x2 need not remain a hole: retile nearby ordinary homes.
    let accepted=false;
    for(const margin of [2,3]){
     if(Date.now()>=until)break;
     const x=Math.max(0,source.x-margin),y=Math.max(0,source.y-margin);
     const region={x,y,w:Math.min(W,source.x+source.w+margin)-x,h:Math.min(H,source.y+source.h+margin)-y};
     if(consider(packHomes(base,cat,o,region,Math.min(until,Date.now()+15)),true)){accepted=true;break;}
    }
    if(accepted)break;
   }
  }
 }
 function relocate(until){
  const sources=[...best.list].filter(b=>b.points);
  // First inspect sources with overlapping coverage / large unused surplus.
  sources.sort((a,b)=>best.list.reduce((v,t)=>v+(t.happyMax&&reaches(b,t)?Math.max(0,rawHappiness(t,best.list)-t.happyMax):0)-(t.happyMax&&reaches(a,t)?Math.max(0,rawHappiness(t,best.list)-t.happyMax):0),0));
  for(const original of sources){
   if(Date.now()>=until)break;const source=best.list.find(b=>b.uid===original.uid);if(!source)continue;
   const targets=best.list.filter(b=>b.happyMax),before=new Map(targets.map(b=>[b,rawHappiness(b,best.list)]));
   const fixedGrid=gridOf(best.list.filter(b=>b!==source&&(b.kind!=='home'||b.premium)));
   const ids=source.kind==='happiness'&&!source.premium?['moderateCulture',source.id,'compactCulture','littleCulture']:[source.id];
   const candidates=[];
   for(const id of new Set(ids)){
    const def=cat[id];if(!def)continue;for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
     if(Date.now()>=until)break;if(!fits(fixedGrid,x,y,w,h))continue;
     const p={...def,x,y,w,h,uid:source.uid};let gain=0,surplus=0;
     for(const b of targets){const old=Math.min(before.get(b),b.happyMax),next=Math.min(b.happyMax,before.get(b)-(reaches(source,b)?source.points:0)+(reaches(p,b)?p.points:0));
      if(o.fullArmy&&b.kind==='barracks'&&next+1e-6<armyNeed(b,o)){gain=-Infinity;break;}
      gain+=(hourly(b,next,'food')-hourly(b,old,'food'))*hours(b,o);
      if(b.kind==='workshop'){const r=b.rewards[0].resource;gain+=(hourly(b,next,r)-hourly(b,old,r))*hours(b,o)*o.foodPerGood*(source.premium&&b.oldWorkshop?.6:1);}
      gain+=(hourly(b,next,'coins')-hourly(b,old,'coins'))*hours(b,o)*o.goldSparksPerBatch/o.goldPerBatch*o.foodPerSpark;
      surplus+=Math.max(0,before.get(b)-(reaches(source,b)?source.points:0)+(reaches(p,b)?p.points:0)-b.happyMax);
     }
     if(gain>=-.001){const reach=targets.filter(b=>reaches(p,b)).length;candidates.push({p,gain:gain*(1+.02*Math.min(reach,10))*(p.id==='littleCulture'?.5:1),surplus});candidates.sort((a,b)=>b.gain-a.gain||a.surplus-b.surplus||b.p.w*b.p.h-a.p.w*a.p.h);if(candidates.length>18)candidates.pop();}
    }
   }
   for(const {p} of candidates){if(Date.now()>=until)break;if(consider(rebuild([source],[p])))break;}
   // A thin rectangle may act as a spacer: move a square by one cell and use
   // its vacated 1x2 strip for the last missing points, if the whole move pays.
   const live=best.list.find(b=>b.uid===source.uid);
   if(live?.id==='moderateCulture')for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const square={...live,x:live.x+dx,y:live.y+dy};const strip={...cat.compactCulture,x:dx>0?live.x:dx<0?live.x+1:live.x,y:dy>0?live.y:dy<0?live.y+1:live.y,w:dx?1:2,h:dx?2:1,uid:uid++};
    if(consider(rebuild([live],[square,strip]))){spacers++;break;}
   }
  }
 }
 // Extend existing production rows into excess housing. Construction can
 // leave a feasible pocket after the military/fountain blocks were filled.
 // New farms must align with a surviving row and pay for lost home workers.
 if(choice.rowSlots){
  for(let step=0;step<10&&Date.now()<deadline;step++){
   const producers=best.list.filter(b=>b.kind==='farm'||b.kind==='workshop');
   const fixedGrid=gridOf(best.list.filter(b=>b.kind!=='home'||b.premium));
   let added=false;
   for(const id of farmOrder(o,best.list,[preferredFarm(cat,o),otherFarm(preferredFarm(cat,o))])){
    const def=cat[id];if(!def)continue;
    for(const [w,h] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let y=0;y<=H-h;y++)for(let x=0;x<=W-w;x++){
     if(Date.now()>=deadline)break;
     if(!fits(fixedGrid,x,y,w,h))continue;
     const alongX=o.engineMode==='rows-horizontal'||choice.edgeOrigin?.turn%2===1;
     const aligned=producers.some(b=>alongX?b.y===y&&b.h===h:b.x===x&&b.w===w);
     if(!aligned)continue;
     if(consider(rebuild([],[{...def,x,y,w,h,uid:uid++}]))){added=true;break;}
    }
    if(added)break;
   }
   if(!added)break;
  }
 }
 // No producer is an anchor: exchange equal footprints anywhere in the city.
 // This can give the high-coverage location of a stone mason to a hungrier
 // workshop/farm, without first accepting a temporary production loss.
 const exchanges=best.list.filter(b=>b.kind==='farm'||b.kind==='workshop');
 for(let i=0;i<exchanges.length&&Date.now()<deadline;i++)for(let j=i+1;j<exchanges.length&&Date.now()<deadline;j++){
  const a=best.list.find(b=>b.uid===exchanges[i].uid),b=best.list.find(b=>b.uid===exchanges[j].uid);
  if(a.id===b.id||!((a.w===b.w&&a.h===b.h)||(a.w===b.h&&a.h===b.w)))continue;
  consider(best.list.map(t=>t===a?{...a,x:b.x,y:b.y,w:b.w,h:b.h}:t===b?{...b,x:a.x,y:a.y,w:a.w,h:a.h}:t));
 }
 // First give high-coverage positions to producers that can use them; only
 // then reclaim sources. Otherwise pruning can erase a profitable swap.
 // Marek, 16.09.2026: "dopiero po 5 minutach poszedł w tym kierunku" — the package pass used to get the last
 // milliseconds of one-second cycles. New fields are grown first, with a guaranteed slice.
 {const growStart=Date.now();spendSpareWorkers(Number.isFinite(deadline)?growStart+Math.max(0,Math.min(deadline-growStart,Math.max(600,(deadline-growStart)*.25))):growStart+1500);}
 const fountainStart=Date.now();
 spreadFountain(Number.isFinite(deadline)?fountainStart+Math.max(0,deadline-fountainStart)*.3:fountainStart+1500);
 const cleanupStart=Date.now();
 reclaimCulture(Number.isFinite(deadline)?cleanupStart+Math.max(0,deadline-cleanupStart)*.2:cleanupStart+1000);
 spendSpareWorkers(Number.isFinite(deadline)?Date.now()+Math.max(0,deadline-Date.now())*.15:Date.now()+600);
 const start=Date.now(),firstDeadline=Number.isFinite(deadline)?start+(deadline-start)*.4:start+2000;
 relocate(firstDeadline);
 sweepSectors(Number.isFinite(deadline)?Date.now()+Math.max(0,deadline-Date.now())*.15:Date.now()+600);
 const slideStart=Date.now();slideRows(Number.isFinite(deadline)?slideStart+Math.max(0,deadline-slideStart)*.25:slideStart+1000);
 const producers=best.list.filter(b=>b.kind==='farm'||b.kind==='workshop');
 outer:for(let i=0;i<producers.length;i++)for(let j=i+1;j<producers.length;j++){
  if(Date.now()>=deadline)break outer;
  const a=best.list.find(b=>b.uid===producers[i].uid),b=best.list.find(b=>b.uid===producers[j].uid);
  if(a.w*a.h!==b.w*b.h||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>12)continue;
  const sources=best.list.filter(s=>s.id==='moderateCulture'&&Math.min(Math.abs(s.x-a.x)+Math.abs(s.y-a.y),Math.abs(s.x-b.x)+Math.abs(s.y-b.y))<9).slice(0,3);
  for(const source of sources){
   const live=best.list.find(s=>s.uid===source.uid);if(!live)continue;
   for(const [w,h] of a.w===a.h?[[a.w,a.h]]:[[a.w,a.h],[a.h,a.w]]){
    if(!((w===b.w&&h===b.h)||(w===b.h&&h===b.w)))continue;
    for(const vertical of [false,true])for(const anchor of [a,b])for(const shift of [-2,-1,0,1,2]){
     if(Date.now()>=deadline)break outer;
     const x=anchor.x+(vertical?shift:0),y=anchor.y+(vertical?0:shift),gap=cat.moderateCulture.w;
     const p={...a,x,y,w,h},q={...b,x:x+(vertical?0:w+gap),y:y+(vertical?h+gap:0),w,h};
     for(const offset of [0,Math.max(0,(vertical?w:h)-gap)]){
      const s={...live,x:x+(vertical?offset:w),y:y+(vertical?h:offset),w:gap,h:gap};
      if(consider(rebuild([a,b,live],[p,q,s]))){channels++;continue outer;}
     }
    }
   }
  }
 }
 const secondStart=Date.now();slideRows(Number.isFinite(deadline)?secondStart+Math.max(0,deadline-secondStart)*.3:secondStart+1000,true);
 {const moved=premiumToBarracks(best,cat,Number.isFinite(deadline)?Date.now()+Math.max(0,deadline-Date.now())*.25:Date.now()+800);if(moved.premiumMoves>(best.premiumMoves||0)){best=moved;uid=Math.max(uid,...best.list.map(b=>b.uid))+1;}}
 mergeLittles(Number.isFinite(deadline)?Date.now()+Math.max(0,deadline-Date.now())*.2:Date.now()+500);
 relocate(deadline);
 spendSpareWorkers(Number.isFinite(deadline)?Date.now()+Math.max(0,deadline-Date.now())*.3:Date.now()+400);
 if(budgetLive&&current(best.list).free){const filled=fillHoles(best.list,cat,o);if(filled.length>best.list.length&&consider(filled))mergeLittles(Date.now()+300);}
 if(validate(best.list,o,cat))return choice;
 return {...best,happinessRepairs:(choice.happinessRepairs||0)+moves,channelRepairs:(choice.channelRepairs||0)+channels,spacerRepairs:(choice.spacerRepairs||0)+spacers,slideRepairs:(choice.slideRepairs||0)+slides,spareRepairs:(choice.spareRepairs||0)+spareMoves,sweepRepairs:(choice.sweepRepairs||0)+sweeps,examined:(choice.examined||0)+checked};
}

// Spatial rules are independent from game validity and production arithmetic.
function neighbours(a,b){return ((a.x+a.w===b.x||b.x+b.w===a.x)&&a.y<b.y+b.h&&b.y<a.y+a.h)||((a.y+a.h===b.y||b.y+b.h===a.y)&&a.x<b.x+b.w&&b.x<a.x+a.w);}
function sameCultureClass(a,b){return a.kind==='happiness'&&b.kind==='happiness'&&a.w*a.h>=4&&a.w*a.h===b.w*b.h;}
// Marek, 15.09.2026 (screens of 8.24): a pair means two large sources of the same size
// touching. A large source beside two medium ones, or a column of small ones, is allowed.
// A building touched by one corner of a range gets the full bonus, so the rim of every
// source should touch large producers rather than small homes; the fountain itself is an
// ordinary source for the edge rule (its range wastes outside the land like any other).
function usefulCulture(list){return cultureReport(list).ratioUseful||0;}
function atEdge(b,terrain){
 const off=(x,y)=>x<0||y<0||x>=W||y>=H||terrain[y*W+x]===-1;
 for(let x=b.x;x<b.x+b.w;x++)if(off(x,b.y-1)||off(x,b.y+b.h))return true;
 for(let y=b.y;y<b.y+b.h;y++)if(off(b.x-1,y)||off(b.x+b.w,y))return true;
 return false;
}
// Marek, 15.09.2026: a source is well placed when it touches as many buildings as possible.
// Targets per kind: premium at least 7 (8-10 is excellent), a square 8-9 (shifted by a
// strip it touches the homes beside it and three producers above and below), a strip 3-5,
// a 1x1 only where it must go, the fountain and the tower simply as many as they can.
const REACH_TARGET={premiumCulture:7,moderateCulture:8,compactCulture:3};
function sourceReach(list){
 const needy=list.filter(b=>b.happyMax);
 return list.filter(b=>b.points>0).map(s=>{const rest=list.filter(b=>b!==s);const reached=needy.filter(b=>reaches(s,b));return {uid:s.uid,id:s.id,name:s.name,recipients:reached.length,hungry:reached.filter(b=>rawHappiness(b,rest)<b.happyMax).length,homes:reached.filter(b=>b.kind==='home').length,target:REACH_TARGET[s.id]||0};});
}
// 8.54: only the recipient counts matter here; the per-source report with its hungry recipients stays in sourceReach.
function reachShortfall(list){const needy=list.filter(b=>b.happyMax);let n=0;for(const s of list){const target=s.points>0?REACH_TARGET[s.id]||0:0;if(!target)continue;let reached=0;for(const b of needy)if(reaches(s,b))reached++;n+=Math.max(0,target-reached);}return n;}
function layoutQuality(list,o){
 const terrain=mask(o.tiles),g=terrain.slice(),pairs=[],edges=[],sources=list.filter(b=>b.points);
 list.forEach(b=>paint(g,b,1));const free=[];for(let i=0;i<N;i++)if(g[i]===0)free.push(i);
 for(let i=0;i<sources.length;i++){const a=sources[i];if(atEdge(a,terrain))edges.push(a.uid);for(let j=i+1;j<sources.length;j++)if(sameCultureClass(a,sources[j])&&neighbours(a,sources[j]))pairs.push([a.uid,sources[j].uid]);}
 let minX=W,maxX=0,minY=H,maxY=0;for(let i=0;i<N;i++)if(terrain[i]===0){minX=Math.min(minX,i%W);maxX=Math.max(maxX,i%W);minY=Math.min(minY,Math.floor(i/W));maxY=Math.max(maxY,Math.floor(i/W));}
 const horizontal=maxX-minX>=maxY-minY,farms=list.filter(b=>b.kind==='farm');
 const isolated=farms.filter(b=>!farms.some(t=>t!==b&&neighbours(t,b))).length;
 const reach=reachShortfall(list);
 // Marek, 16.09.2026: a 1x1 culture goes only where nothing else fits, never in rows; each
 // one touching another costs like a missing recipient and a half. Holes cost more than that.
 const littles=list.filter(b=>b.id==='littleCulture'),crowded=littles.filter(a=>littles.some(b=>b!==a&&neighbours(a,b))).length;
 // Marek, 20.09.2026: "around the barracks hyper-watering, in the density of culture" — every small ordinary piece that
 // reaches a barracks is clutter; a quarter fed by the fountain, the premium and shared squares wins inside the band.
 const smalls=sources.filter(smallCulture),armyList=list.filter(b=>b.kind==='barracks'),nearArmy=b=>armyList.some(a=>reaches(b,a)),clutterPairs=[];
 for(let i=0;i<smalls.length;i++)for(let j=i+1;j<smalls.length;j++)if(neighbours(smalls[i],smalls[j])&&(nearArmy(smalls[i])||nearArmy(smalls[j])))clutterPairs.push([smalls[i].uid,smalls[j].uid]);
 const clutter=clutterPairs.length;
 const rows=rowRuns(list);
 return {free:free.length,freeCells:free,pairs,edges,rows,producers:rows.producers,inRows:rows.inRows,loose:rows.loose,isolated,horizontal,reach,crowded,clutter,clutterPairs,complete:!free.length&&!pairs.length&&!clutterPairs.length,cost:pairs.length*100+edges.length*30+free.length*25+reach*10+crowded*15+clutter*10};
}
// Hierarchy (Marek, 15.09.2026): city output first. Sources on the edge and same-size
// neighbours decide only between cities within half a percent of each other; an edge
// source that still pays for itself is allowed, its lost coverage is already missing from
// the output figure. Free cells stay ahead of output: unused land is unrealized output,
// and a draft with holes must not displace a complete city on a partial figure.
// A hole is unrealised output: it costs HOLE_WEIGHT average cells of the city's value in
// the comparison. So a draft with nine holes and a better output beats one with eight
// (Marek's mirrored scheme, 15.09.2026), a draft full of holes still loses, and the rule
// is transitive, unlike a tolerance on the hole count, so chained comparisons cannot drift.
const LAYOUT_BAND=.005,HOLE_WEIGHT=2,PAIR_BAND=.03;
// Marek, 20.09.2026: "the better city always wins, amen". Validity already holds his hard rules (pairs, the army minimum
// from the slider, at least OWNED_SHARE of the owned farms); here only the rows rule stands above the value, the pairs
// count keeps repairs honest on cities still being fixed, and the geometry marks break exact ties only.
function betterLayout(a,b,o,qa,qb){
 qa??=layoutQuality(a.list,o);qb??=layoutQuality(b.list,o);
 {const fa=qa.pairs.length+qa.clutter,fb=qb.pairs.length+qb.clutter;if(fa!==fb)return fa<fb;}
 // Marek, 19.09.2026: "rows should rule" — a city whose producers stand in rows beats a looser one whatever the value.
 {const rowsA=rowCompliant(qa),rowsB=rowCompliant(qb);if(rowsA!==rowsB)return rowsA;}
 const cells=x=>x.stats.used||x.list.reduce((n,t)=>n+t.w*t.h,0);
 const perCell=Math.max(a.stats.equivalent.total,b.stats.equivalent.total)/Math.max(1,cells(a),cells(b));
 // A hole is unrealised output: it costs HOLE_WEIGHT average cells of the city's value (Marek, 15.09.2026).
 const va=a.stats.equivalent.total-qa.free*perCell*HOLE_WEIGHT,vb=b.stats.equivalent.total-qb.free*perCell*HOLE_WEIGHT;
 if(Math.abs(va-vb)>.001)return va>vb;
 if(qa.free!==qb.free)return qa.free<qb.free;
 if(qa.cost!==qb.cost)return qa.cost<qb.cost;
 const ua=usefulCulture(a.list),ub=usefulCulture(b.list);
 if(Math.abs(ua-ub)>.01)return ua>ub;
 const ca=cultureArea(a.list),cb=cultureArea(b.list);
 if(ca!==cb)return ca<cb;
 if(a.stats.fountainBuildings!==b.stats.fountainBuildings)return a.stats.fountainBuildings>b.stats.fountainBuildings;
 return qa.loose+qa.isolated<qb.loose+qb.isolated||qa.loose+qa.isolated===qb.loose+qb.isolated&&a.stats.excess<b.stats.excess;
}
// Order for display and for the shared pool: the same hierarchy as betterLayout.
function rankChoices(a,b){return betterLayout(a,b,a.options)?-1:betterLayout(b,a,b.options)?1:0;}
// Culture bookkeeping shown to the player: points produced by sources, points delivered to
// buildings that need them (planner style, surplus included), points used up to each
// building's maximum, and happiness landing on buildings without any need.
function cultureReport(list){
 const sources=list.filter(b=>b.points>0),needy=list.filter(b=>b.happyMax>0),idle=list.filter(b=>!b.happyMax&&!b.points&&b.kind!=='home');
 const produced=sources.reduce((n,s)=>n+s.points,0);
 let delivered=0,useful=0;for(const b of needy){const r=rawHappiness(b,list);delivered+=r;useful+=Math.min(r,b.happyMax);}
 const wasted=idle.map(b=>({id:b.id,name:b.name,points:rawHappiness(b,list)})).filter(g=>g.points>0).sort((a,b)=>b.points-a.points);
 return {sources:sources.length,produced,delivered,useful,ratio:produced?delivered/produced:null,ratioUseful:produced?useful/produced:null,wasted,wastedTotal:wasted.reduce((n,g)=>n+g.points,0)};
}
// Retile homes around a hole with a bounded exact search. No dummy 1x1 fillers.
function packHomes(list,cat,o,region,deadline,includeFarms=false){
 const terrain=mask(o.tiles),removed=list.filter(b=>(b.kind==='home'||includeFarms&&(b.kind==='happiness'||includeFarms===true&&b.kind==='farm'||includeFarms==='support'&&b.id==='furnace'))&&!b.premium&&b.x>=region.x&&b.y>=region.y&&b.x+b.w<=region.x+region.w&&b.y+b.h<=region.y+region.h);
 const fixed=list.filter(b=>!removed.includes(b)),g=terrain.slice();fixed.forEach(b=>paint(g,b,1));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x<region.x||x>=region.x+region.w||y<region.y||y>=region.y+region.h)g[y*W+x]=1;
 let uid=Math.max(0,...list.map(b=>b.uid))+1,nodes=0,farmsLeft=removed.filter(b=>b.kind==='farm').length;const remaining=removed.filter(b=>b.kind!=='home'&&b.kind!=='farm'),placed=[],dead=new Set();
 function search(){
  if(++nodes>2500||Date.now()>=deadline)return false;
  const i=g.indexOf(0);if(i<0)return farmsLeft===0&&!remaining.length&&(!includeFarms||!validate(fixed.concat(placed),o,cat));const key=farmsLeft+':'+remaining.map(b=>b.id).sort().join(',')+':'+g.join(',');if(dead.has(key))return false;
  const x=i%W,y=Math.floor(i/W);
  for(const id of [...(farmsLeft?farmOrder(o,fixed.concat(placed),[preferredFarm(cat,o),otherFarm(preferredFarm(cat,o))]):[]),...new Set(remaining.map(b=>b.id)),'smallHome','averageHome']){const b=cat[id];if(!b)continue;for(const [w,h] of b.w===b.h?[[b.w,b.h]]:[[b.w,b.h],[b.h,b.w]]){if(!fits(g,x,y,w,h))continue;const p={...b,x,y,w,h,uid:uid++};if(b.points&&(atEdge(p,terrain)||fixed.concat(placed).some(t=>sameCultureClass(p,t)&&neighbours(p,t))||crowdsBarracks(p,fixed.concat(placed))))continue;const r=remaining.findIndex(t=>t.id===b.id),source=r>=0?remaining.splice(r,1)[0]:null;paint(g,p,1);placed.push(p);if(b.kind==='farm')farmsLeft--;if(search())return true;if(b.kind==='farm')farmsLeft++;if(source)remaining.splice(r,0,source);placed.pop();paint(g,p,0);}}
  dead.add(key);return false;
 }
 return search()?fixed.concat(placed):null;
}
function repairLayout(choice,cat,deadline=Date.now()+2000,keepValue=false){
 const o=normalized(choice.options),terrain=mask(o.tiles);let best={...choice,quality:layoutQuality(choice.list,o)},moves=0;
 // Pairs are judged by the ranking here, so a city with two pairs can lose them one at a time.
 const plain={...o,enforceLayout:false};
 function consider(list){if(!list||!preservesRows(list,choice.rowSlots)||validate(list,plain,cat))return false;const stats=evaluate(list,o);stats.equivalent=equivalent(stats,o);if(keepValue&&stats.equivalent.total<best.stats.equivalent.total-.001)return false;const n={...best,list,stats,quality:layoutQuality(list,o)};if(n.quality.free>best.quality.free)return false;if(betterLayout(n,best,o,n.quality,best.quality)){best=n;moves++;return true;}return false;}
 const sources=[...best.list.filter(b=>b.points)].sort((a,b)=>Number(atEdge(b,terrain))-Number(atEdge(a,terrain)));
 for(const source of sources){
  if(Date.now()>=deadline)break;
  const live=best.list.find(b=>b.uid===source.uid),q=best.quality;
  if(!q.edges.includes(live.uid)&&!q.pairs.some(pair=>pair.includes(live.uid))&&!q.clutterPairs.some(pair=>pair.includes(live.uid)))continue;
  const fixed=best.list.filter(b=>b.uid!==live.uid&&(b.kind!=='home'||b.premium)),g=terrain.slice();fixed.forEach(b=>paint(g,b,1));
  const candidates=positions(g,live,p=>{
   if(atEdge(p,terrain)||fixed.some(t=>sameCultureClass(p,t)&&neighbours(p,t))||crowdsBarracks(p,fixed))return -1e15;
   let useful=0;for(const t of fixed)if(t.happyMax&&reaches(p,t))useful+=Math.min(p.points,Math.max(0,t.happyMax-rawHappiness(t,fixed)))/t.happyMax*(t.kind==='barracks'?20:1);
   return useful;
  },random(live.uid),24);
  for(const p of candidates){
   if(Date.now()>=deadline)break;if(p._score<0)continue;
   let list=best.list.filter(b=>b.uid!==live.uid&&!overlap(b,p)).concat({...p,uid:live.uid});
   // Fill ordinary 2x2/3x3 spaces before comparing the complete proposal.
   const grid=terrain.slice();list.forEach(b=>paint(grid,b,1));let uid=Math.max(...list.map(b=>b.uid))+1;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(const id of ['smallHome','averageHome'])if(cat[id]&&fits(grid,x,y,cat[id].w,cat[id].h)){const b={...cat[id],x,y,uid:uid++};list.push(b);paint(grid,b,1);break;}
   if(consider(list))break;
  }
 }
 // Retile neighbourhoods, expanding beyond a single hole rather than decorating it.
 for(const i of [...best.quality.freeCells]){
  if(Date.now()>=deadline)break;
  for(const radius of [2,3,4,5]){
   const x=Math.max(0,i%W-radius),y=Math.max(0,Math.floor(i/W)-radius),region={x,y,w:Math.min(W-x,2*radius+2),h:Math.min(H-y,2*radius+2)};
   if(consider(packHomes(best.list,cat,o,region,Math.min(deadline,Date.now()+35))))break;
   if(radius>=3&&consider(packHomes(best.list,cat,o,region,Math.min(deadline,Date.now()+60),'support')))break;
   if(radius>=3&&!choice.rowSlots&&consider(packHomes(best.list,cat,o,region,Math.min(deadline,Date.now()+60),true)))break;
  }
 }
 // Last resort: only genuinely useful, interior thin sources, never dummy tiles.
 for(const i of [...best.quality.freeCells]){
  if(Date.now()>=deadline)break;const g=terrain.slice();best.list.forEach(b=>paint(g,b,1));
  for(const id of ['compactCulture','littleCulture']){const b=cat[id];if(!b)continue;let done=false;for(const [w,h] of b.w===b.h?[[b.w,b.h]]:[[b.w,b.h],[b.h,b.w]]){const p={...b,x:i%W,y:Math.floor(i/W),w,h,uid:Math.max(...best.list.map(t=>t.uid))+1};if(!fits(g,p.x,p.y,w,h)||atEdge(p,terrain)||crowdsBarracks(p,best.list))continue;
   if(!best.list.some(t=>t.happyMax&&rawHappiness(t,best.list)<t.happyMax&&reaches(p,t)))continue;
   if(consider(best.list.concat(p))){done=true;break;}
  }if(done)break;}
 }
 return {...best,spatialRepairs:(choice.spatialRepairs||0)+moves};
}

// Parametric neighbourhood proposals, derived from building dimensions rather
// than coordinates of a player's city. They must compete in the full-city model.
function fragmentSeed(cat,removed,index=0,band=null){
 const rng=random(index+4117),military=removed.filter(b=>b.kind==='barracks');
 const militaryMode=!band&&military.length>=2&&index%2===0;
 let list=[],width=0,height=0;
 const put=(b,x,y,w=b.w,h=b.h)=>list.push({...cat[b.id],...(b.uid?{uid:b.uid}:{}),x,y,w,h});
 if(militaryMode){
  const rows=[[],[]],widths=[0,0],heights=[0,0];
  for(const b of [...military].sort(()=>rng()-.5)){
   const turn=rng()<.5,w=turn?b.h:b.w,h=turn?b.w:b.h,r=widths[0]<=widths[1]?0:1;
   rows[r].push({b,x:widths[r],w,h});widths[r]+=w;heights[r]=Math.max(heights[r],h);
  }
  width=Math.max(...widths);height=heights[0]+2+heights[1];
  rows.forEach((row,r)=>row.forEach(p=>put(p.b,p.x,r?heights[0]+2:heights[0]-p.h,p.w,p.h)));
  for(let x=0;x+2<=width;x+=2)put(cat[(x/2+index)%2?'smallHome':'moderateCulture'],x,heights[0]);
 }else{
  const workshops=removed.filter(b=>b.kind==='workshop'&&!b.premium&&b.w*b.h===12);
  // 8.54: producers stand across their row (3 wide, 4 tall); the turns below give the column variants.
  const vertical=index%2===0,pw=3,ph=4;
  const columns=band?Math.max(2,Math.floor(band.span/pw)):vertical?2+2*(Math.floor(index/2)%2):2+Math.floor(index/2)%2;
  const outerChannels=!!band&&Math.floor(index/4)%2===0;
  width=pw*columns;height=2*ph+(outerChannels?6:2);
  const slots=2*columns,ids=[...workshops].sort(()=>rng()-.5).slice(0,slots);
  for(let i=0;i<slots;i++){
   const b=ids[i]||cat.ruralFarm;put(b,(i%columns)*pw,(i<columns?0:ph+2)+(outerChannels?2:0),pw,ph);
  }
  // Every second square is a home. The offset changes which producers share a
  // source. Thin sources can subsequently repair a measured residual deficit.
  for(const y of outerChannels?[0,ph+2,2*ph+4]:[ph])for(let x=0;x+2<=width;x+=2)put(cat[(x/2+Math.floor(index/4))%2?'smallHome':'moderateCulture'],x,y);
 }
 const turns=band?(band.vertical?1:0):Math.floor(index/8)%4,mirror=Math.floor(index/32)%2;
 if(mirror)list=list.map(b=>({...b,x:width-b.x-b.w}));
 for(let i=0;i<turns;i++){list=list.map(b=>({...b,x:height-b.y-b.h,y:b.x,w:b.h,h:b.w}));[width,height]=[height,width];}
 return {list,width,height,kind:militaryMode?'military':'production'};
}

// Destroy and jointly rebuild a neighbourhood. Drafts may lack workers/happiness;
// only complete, validated cities enter the search or become a returned result.
function repairSourceBlocks(choice,cat,deadline=Date.now()+1500){
 const o=normalized(choice.options),terrain=mask(o.tiles);let best=choice;const current=qualityMemo(o);
 function consider(list){
  if(validate(list,{...manualOptions(o),enforceLayout:false},cat))return;
  const stats=evaluate(list,o);stats.equivalent=equivalent(stats,o);
  if(o.requireFuel&&stats.oldGoods+.01<o.sparkCap)return;
  const candidate={...best,list,stats},deficit=o.fullArmy?stats.armyDeficit:0,previous=o.fullArmy?best.stats.armyDeficit:0;
  if(deficit<previous-1e-5)best=candidate;else if(Math.abs(deficit-previous)<1e-5){const q=layoutQuality(list,o),qb=current(best.list);if(q.free<=qb.free&&betterLayout(candidate,best,o,q,qb))best=candidate;}
 }
 // Equal-footprint exchanges keep every cell occupied and preserve workforce.
 // They may repair military happiness without destroying the surrounding farms.
 const original=best;
 const sources=original.list.filter(b=>b.kind==='happiness'&&!b.premium),homes=original.list.filter(b=>b.kind==='home'&&!b.premium);
 for(const a of sources)for(const b of homes){
  if(Date.now()>=deadline)return best;
  if(a.w!==b.w||a.h!==b.h)continue;
  consider(original.list.map(t=>t===a?{...a,x:b.x,y:b.y}:t===b?{...b,x:a.x,y:a.y}:t));
 }
 // Retile small source/home blocks exactly. Unlike packHomes, the source types
 // may change, e.g. two 2x1 sources and two homes into a 3x3 home plus 1x2 and 1x1.
 const defects=layoutQuality(best.list,o),ids=new Set([...defects.edges,...defects.pairs.flat(),...defects.clutterPairs.flat()]);
 const patches=best.list.filter(b=>ids.has(b.uid)&&b.kind==='happiness'&&!b.premium).concat(defects.freeCells.map(i=>({x:i%W,y:Math.floor(i/W),w:1,h:1})));
 for(const source of patches){
  for(const [w,h] of [[4,3],[3,4],[4,4],[6,4],[4,6]])for(let y=Math.max(0,source.y-h+source.h);y<=source.y;y++)for(let x=Math.max(0,source.x-w+source.w);x<=source.x;x++){
   if(Date.now()>=deadline)return best;
   const region={x,y,w,h},removed=best.list.filter(b=>overlap(b,region));
   if(removed.some(b=>b.premium||!['home','happiness'].includes(b.kind)||b.x<x||b.y<y||b.x+b.w>x+w||b.y+b.h>y+h))continue;
   const fixed=best.list.filter(b=>!removed.includes(b)),grid=terrain.slice();fixed.forEach(b=>paint(grid,b,1));
   for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(xx<x||xx>=x+w||yy<y||yy>=y+h)grid[yy*W+xx]=1;
   const placed=[],baseUid=Math.max(...best.list.map(b=>b.uid))+1;let nodes=0;
   function visit(){
    if(++nodes>1200||Date.now()>=deadline)return;
    const i=grid.indexOf(0);if(i<0){consider(fixed.concat(placed));return;}
    const xx=i%W,yy=Math.floor(i/W);
    for(const id of ['averageHome','smallHome','moderateCulture','compactCulture','littleCulture']){
     const b=cat[id];if(!b)continue;for(const [bw,bh] of b.w===b.h?[[b.w,b.h]]:[[b.w,b.h],[b.h,b.w]]){
      if(!fits(grid,xx,yy,bw,bh))continue;const p={...b,x:xx,y:yy,w:bw,h:bh,uid:baseUid+placed.length};
      if(p.points&&(atEdge(p,terrain)||fixed.concat(placed).some(t=>sameCultureClass(p,t)&&neighbours(p,t))||crowdsBarracks(p,fixed.concat(placed))))continue;
      placed.push(p);paint(grid,p,1);visit();paint(grid,p,0);placed.pop();
     }
    }
   }visit();
  }
 }
 return best;
}
function rebuildDistricts(choice,cat,deadline=Date.now()+2000){
 const o=normalized(choice.options),terrain=mask(o.tiles),rng=random((choice.seed||1)+7919+(choice.districtAttempts||0));
 let best=choice,walk=choice,attempts=0,accepted=0,fragmentTrials=0,fragmentEvaluated=0,fragmentAccepted=0,bandTrials=0,bandEvaluated=0,bandAccepted=0,uid=Math.max(...choice.list.map(b=>b.uid))+1;
 const start=Date.now(),duration=Math.max(1,deadline-start);
 const variable=b=>!b.premium&&(b.kind==='home'||b.kind==='farm'||b.kind==='happiness');
 const measure=list=>{const s=evaluate(list,o);s.equivalent=equivalent(s,o);return s;};
 const better=(a,b)=>a.equivalent.total>b.equivalent.total+.001||Math.abs(a.equivalent.total-b.equivalent.total)<.001&&(a.used>b.used||a.used===b.used&&a.excess<b.excess);
 while(Date.now()<deadline){
  attempts++;
  if(attempts%8===0)walk=best;
  const occupied=terrain.slice();walk.list.forEach(b=>paint(occupied,b,1));
  const holes=[];for(let i=0;i<N;i++)if(!occupied[i])holes.push({x:i%W,y:Math.floor(i/W)});
  const excess=walk.list.filter((b,i)=>walk.stats.details[i]?.excess>0);
  const pool=attempts%3===0&&holes.length?holes:excess.length?excess:walk.list;
  const anchor=pool[Math.floor(rng()*pool.length)];
  // 8.60: crowded culture at the barracks means the quarter itself is wrong (one-cell gaps between barracks); rebuild the
  // whole military block as one fragment, as for a hungry army.
  const militaryRepair=o.fullArmy&&walk.stats.armyDeficit>1e-5||o.enforceLayout&&layoutQuality(walk.list,o).clutter>0;
  const bandAttempt=!militaryRepair&&o.bandSearch!==false&&attempts%4===0,verticalBand=rng()<.5;
  const fragmentAttempt=militaryRepair||bandAttempt||attempts%3===0;
  let w=bandAttempt?(verticalBand?14:W):fragmentAttempt?12+4*Math.floor(rng()*2):8+Math.floor(rng()*9),h=bandAttempt?(verticalBand?H:14):fragmentAttempt?12+4*Math.floor(rng()*2):8+Math.floor(rng()*9);
  let x=Math.max(0,Math.min(W-w,anchor.x-(fragmentAttempt?2*Math.floor(rng()*w/2):Math.floor(rng()*w)))),y=Math.max(0,Math.min(H-h,anchor.y-(fragmentAttempt?2*Math.floor(rng()*h/2):Math.floor(rng()*h))));
  if(militaryRepair){const army=walk.list.filter(b=>b.kind==='barracks');x=Math.max(0,Math.min(...army.map(b=>b.x))-2);y=Math.max(0,Math.min(...army.map(b=>b.y))-2);w=Math.min(W,Math.max(...army.map(b=>b.x+b.w))+2)-x;h=Math.min(H,Math.max(...army.map(b=>b.y+b.h))+2)-y;}
  const inside=b=>b.x>=x&&b.y>=y&&b.x+b.w<=x+w&&b.y+b.h<=y+h;
  const removed=walk.list.filter(inside);if(removed.length<4)continue;
  let fragment=null;const assigned=new Set();
  let list=walk.list.filter(b=>!inside(b));const g=terrain.slice();list.forEach(b=>paint(g,b,1));
  for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(xx<x||xx>=x+w||yy<y||yy>=y+h)g[yy*W+xx]=-1;
  const add=p=>{const b={...p,uid:p.uid||uid++};list.push(b);paint(g,b,1);};
  // Propose a complete producer/source/home or barracks group in one move.
  if(fragmentAttempt){
   fragmentTrials++;if(bandAttempt)bandTrials++;
   // The span comes from free space in this draft, never from a saved city template.
   // Shorten a full band at irregular borders; required objects are reinserted below.
   const free=removed.filter(b=>variable(b));
   const span=free.length?Math.max(...free.map(b=>verticalBand?b.y+b.h:b.x+b.w))-Math.min(...free.map(b=>verticalBand?b.y:b.x)):0;
   let origin=null;
   if(bandAttempt){
    for(let length=Math.max(6,span-2*(attempts%3));length>=6&&!origin&&Date.now()<deadline;length-=3){
     fragment=fragmentSeed(cat,removed,(choice.districtAttempts||0)+attempts,{span:length,vertical:verticalBand});
     for(let yy=y;yy<=y+h-fragment.height;yy++)for(let xx=x;xx<=x+w-fragment.width;xx++){
      if(!fits(g,xx,yy,fragment.width,fragment.height))continue;
      if(o.enforceLayout&&fragment.list.some(b=>b.points&&(atEdge({...b,x:b.x+xx,y:b.y+yy},terrain)||list.some(t=>sameCultureClass(b,t)&&neighbours({...b,x:b.x+xx,y:b.y+yy},t)))))continue;
      const score=rng()+removed.filter(b=>b.kind==='farm'&&overlap(b,{x:xx,y:yy,w:fragment.width,h:fragment.height})).length;
      if(!origin||score>origin.score)origin={x:xx,y:yy,score};
     }
    }
    if(!origin)continue;
   }else fragment=fragmentSeed(cat,removed,militaryRepair?2*((choice.districtAttempts||0)+attempts):(choice.districtAttempts||0)+attempts);
   if(fragment.width>w||fragment.height>h)continue;
   const ox=origin?.x??x+2*Math.floor(rng()*(Math.floor((w-fragment.width)/2)+1)),oy=origin?.y??y+2*Math.floor(rng()*(Math.floor((h-fragment.height)/2)+1));
   let blocked=false;
   for(const b of fragment.list){const p={...b,x:b.x+ox,y:b.y+oy};
    if(!fits(g,p.x,p.y,p.w,p.h)||o.enforceLayout&&p.points&&(atEdge(p,terrain)||list.some(t=>sameCultureClass(p,t)&&neighbours(p,t)))){blocked=true;break;}
    if(b.uid)assigned.add(b.uid);add(p);
   }
   if(blocked)continue;
  }
  // Required objects are preserved, but may move with the surrounding district.
  const required=removed.filter(b=>!variable(b)&&!assigned.has(b.uid)).map(b=>({...b,_order:rng()})).sort((a,b)=>b.w*b.h-a.w*a.h||a._order-b._order);
  let failed=false;
  for(const b of required){const p=positions(g,b,p=>rng()*3+(b.points?list.reduce((v,t)=>v+(t.happyMax&&reaches(p,t)?Math.min(b.points,Math.max(0,t.happyMax-rawHappiness(t,list)))/t.happyMax:0),0):0),rng)[0];if(!p){failed=true;break;}add(p);}
  if(failed)continue;
  const farms=removed.filter(b=>b.kind==='farm'&&!b.premium);
  const count=Math.max(0,farms.length+[-1,0,1,1,2][attempts%5]-(fragment?.list.filter(b=>b.kind==='farm').length||0));
  // Source-first and producer-first proposals both compete by measured output.
  if(!fragment&&attempts%2===0){
   const n=Math.max(1,removed.filter(b=>b.kind==='happiness'&&!b.premium).length+Math.floor(rng()*3)-1);
   for(let k=0;k<n;k++){
    const p=positions(g,cat.moderateCulture,p=>{
     if(o.enforceLayout&&(atEdge(p,terrain)||list.some(t=>sameCultureClass(p,t)&&neighbours(p,t))))return -1e15;
     let potential=0;for(let yy=Math.max(y,p.y-p.range);yy<Math.min(y+h,p.y+p.h+p.range);yy++)for(let xx=Math.max(x,p.x-p.range);xx<Math.min(x+w,p.x+p.w+p.range);xx++)if(!g[yy*W+xx])potential++;
     return potential-list.filter(t=>t.points&&reaches(p,t)).length*8+rng()*12;
    },rng)[0];if(p&&(!o.enforceLayout||!atEdge(p,terrain)&&!list.some(t=>sameCultureClass(p,t)&&neighbours(p,t))))add(p);
   }
  }
  for(let k=0;k<count;k++){
   const def=cat[farmQuota(o,list)||(attempts%4===0&&rng()<.5?otherFarm(preferredFarm(cat,o)):preferredFarm(cat,o))];
   // 8.54: a farm continuing a row with its long side across it is worth a point; the old nudge towards farms lying
   // along the land's long axis proposed exactly what the ranking rejects since 8.53.
   const p=positions(g,def,p=>Math.min(rawHappiness(p,list),p.happyMax)/p.happyMax*5+rng()*2+(joinsRowAcross(p,list)?1:0)+list.filter(t=>t.kind==='farm'&&neighbours(t,p)).length*.1,rng)[0];
   if(!p){failed=true;break;}add(p);
  }if(failed)continue;
  const fill=()=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(!g[yy*W+xx]){
   for(const id of rng()<.15?['averageHome','smallHome']:['smallHome','averageHome']){const b=cat[id];if(!b)continue;if(fits(g,xx,yy,b.w,b.h)){add({...b,x:xx,y:yy});break;}}
  }};
  fill();let stats=measure(list);
  // Repair the whole draft before judging it: a temporary deficit is allowed here.
  for(let step=0;step<18&&Date.now()<deadline;step++){
   const targets=list.filter(b=>b.happyMax),raw=targets.map(b=>rawHappiness(b,list));
   const armyMissing=o.fullArmy&&stats.armyDeficit>1e-5;
   const candidates=[];
   for(const id of ['moderateCulture','compactCulture','littleCulture']){
    const def=cat[id];if(!def)continue;for(const [bw,bh] of def.w===def.h?[[def.w,def.h]]:[[def.w,def.h],[def.h,def.w]])for(let yy=y;yy<=y+h-bh;yy++)for(let xx=x;xx<=x+w-bw;xx++){
     const p={...def,x:xx,y:yy,w:bw,h:bh};if(!fits(terrain,xx,yy,bw,bh)||o.enforceLayout&&(atEdge(p,terrain)||list.some(t=>sameCultureClass(p,t)&&neighbours(p,t))||crowdsBarracks(p,list)))continue;
     const hits=list.filter(b=>overlap(b,p));if(hits.some(b=>b.kind!=='home'||b.premium||!inside(b)))continue;
     const lost=hits.reduce((n,b)=>n+b.workers,0);if(lost>stats.spare)continue;
     let gain=0;for(let i=0;i<targets.length;i++){const b=targets[i];if(!reaches(p,b)||hits.includes(b))continue;const before=Math.min(raw[i],b.happyMax),after=Math.min(before+p.points,b.happyMax);
      if(b.kind==='barracks'&&armyMissing)gain+=armyGain(b,before,after,o)*1e8;
      for(const r of b.rewards)gain+=(hourly(b,after,r.resource)-hourly(b,before,r.resource))*hours(b,o)*(b.kind==='farm'?1:b.kind==='workshop'?o.foodPerGood:0);
     }
     if(gain>0)candidates.push({p,hits,gain:gain/(1+bw*bh*.04)});
    }
   }
   candidates.sort((a,b)=>b.gain-a.gain);
   // Square is the first proposal, thinner pieces are only fallback repairs.
   const square=candidates.find(c=>c.p.id==='moderateCulture');
   let changed=false;
   for(const c of [square,...candidates.slice(0,8)].filter(Boolean)){
    const next=list.filter(b=>!c.hits.includes(b)).concat({...c.p,uid:uid++}),ns=measure(next);
    if(ns.equivalent.total>stats.equivalent.total+.001||armyMissing&&ns.armyDeficit<stats.armyDeficit){list=next;stats=ns;changed=true;break;}
   }if(!changed)break;
  }
  // Source replacement can evict several homes: repack the released cells too.
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)g[yy*W+xx]=terrain[yy*W+xx];
  list.forEach(b=>paint(g,b,1));fill();stats=measure(list);
  if(validate(list,o,cat))continue;
  if(fragment)fragmentEvaluated++;if(bandAttempt)bandEvaluated++;
  let candidate={...walk,list,stats};
  // A promising group must get a chance to repair its seams before a complete
  // incumbent rejects it for a small temporary gap created by the replacement.
  if(fragment&&o.enforceLayout&&stats.equivalent.total>=best.stats.equivalent.total*.97){
   candidate=repairLayout(candidate,cat,Math.min(deadline,Date.now()+(bandAttempt?1200:350)));
   list=candidate.list;stats=candidate.stats;
  }
  if(o.enforceLayout?betterLayout(candidate,best,o):better(stats,best.stats)){best=candidate;accepted++;if(fragment)fragmentAccepted++;if(bandAttempt)bandAccepted++;}
  // Keep a separate exploratory city; never replace the best with a worse one.
  const temperature=Math.max(1,best.stats.equivalent.total*.03*(1-(Date.now()-start)/duration));
  const delta=stats.equivalent.total-walk.stats.equivalent.total-(o.enforceLayout?(layoutQuality(list,o).cost-layoutQuality(walk.list,o).cost)*best.stats.equivalent.total*.0001:0);
  if(delta>=0||rng()<Math.exp(delta/temperature))walk=candidate;
 }
 return {...best,districtAttempts:(choice.districtAttempts||0)+attempts,districtImprovements:(choice.districtImprovements||0)+accepted,fragmentTrials:(choice.fragmentTrials||0)+fragmentTrials,fragmentEvaluated:(choice.fragmentEvaluated||0)+fragmentEvaluated,fragmentAccepted:(choice.fragmentAccepted||0)+fragmentAccepted,bandTrials:(choice.bandTrials||0)+bandTrials,bandEvaluated:(choice.bandEvaluated||0)+bandEvaluated,bandAccepted:(choice.bandAccepted||0)+bandAccepted};
}

// Rigorous upper bound for the implemented catalogue/model: remove the geometric
// and happiness-source costs, retain area, integer building counts and workers.
function productionBound(cat,input,oldCount=input.oldCount||0){
 const o=normalized(input),fixed=[];
 for(const id of [...mandatoryFor(o),...o.optional,...(o.fountain?['fountain']:[])])fixed.push(cat[id]);
 for(const [id,n] of Object.entries(o.premium))for(let k=0;k<n;k++)fixed.push(cat[id]);
 for(const id of currentFor(o))for(let k=0;k<o.workshopCounts[id];k++)fixed.push(cat[id]);
 for(let k=0;k<oldCount;k++)fixed.push(cat[oldFor(o)]);
 const area=o.tiles.filter(Boolean).length*16-fixed.reduce((v,b)=>v+b.w*b.h,0);
 const need=fixed.reduce((v,b)=>v+b.needs-b.workers,0);
 const output=(b,r)=>hourly(b,b.happyMax,r)*hours(b,o);
 let food=fixed.reduce((v,b)=>v+output(b,'food'),0),coins=fixed.reduce((v,b)=>v+output(b,'coins'),0),goods=0,old=0;
 for(const b of fixed.filter(b=>b.kind==='workshop')){const n=output(b,b.rewards[0].resource);if(b.oldWorkshop)old+=n;else goods+=n;}
 if(area<0)return {feasible:false,total:null,reason:'Wymagane budynki przekraczają powierzchnię.'};
 const small=cat.smallHome,medium=cat.averageHome||cat.smallHome,sw=small.workers,mw=medium.workers,sa=small.w*small.h,ma=medium.w*medium.h;
 const maxWorkers=Math.floor(area*Math.max(sw/sa,mw/ma)),stride=maxWorkers+1;
 const houseCoins=new Float64Array((area+1)*stride);houseCoins.fill(-Infinity);
 for(let n=0;n*sa<=area;n++)for(let m=0;n*sa+m*ma<=area;m++){
  const a=n*sa+m*ma,w=n*sw+m*mw;houseCoins[a*stride+w]=Math.max(houseCoins[a*stride+w],n*output(small,'coins')+m*output(medium,'coins'));
 }
 // Query any used area <= a and workforce >= w.
 for(let a=0;a<=area;a++)for(let w=maxWorkers;w>=0;w--){const i=a*stride+w;houseCoins[i]=Math.max(houseCoins[i],a?houseCoins[(a-1)*stride+w]:-Infinity,w<maxWorkers?houseCoins[i+1]:-Infinity);}
 const batch=o.goodsPerBatch,k=Math.floor(Math.min(o.sparkCap,old)/batch),d=o.sparksPerBatch*o.foodPerSpark-batch*o.foodPerGood;
 // Just below a lossy exchange threshold may beat full output; taking the
 // supremum there keeps the bound valid without counting goods and sparks twice.
 const oldValue=Math.max(old*o.foodPerGood+k*d,k? k*batch*o.foodPerGood+(k-1)*d:0);
 const fixedValue=goods*o.foodPerGood+oldValue;
 const r=cat.ruralFarm,t=cat.domesticFarm;let best=-Infinity,maxFood=0,plan=null;
 for(let nr=0;nr*r.w*r.h<=area;nr++)for(let nt=0;nr*r.w*r.h+nt*t.w*t.h<=area;nt++){
  const a=area-nr*r.w*r.h-nt*t.w*t.h,w=Math.max(0,need+nr*r.needs+nt*t.needs);if(w>maxWorkers)continue;
  const gold=houseCoins[a*stride+w];if(!Number.isFinite(gold))continue;
  const f=food+nr*output(r,'food')+nt*output(t,'food');maxFood=Math.max(maxFood,f);
  const goldValue=Math.floor(Math.min(o.goldCap,coins+gold)/o.goldPerBatch)*o.goldSparksPerBatch*o.foodPerSpark;
  const value=f+fixedValue+goldValue;if(value>best){best=value;plan={rural:nr,domestic:nt};}
 }
 return Number.isFinite(best)?{feasible:true,total:Math.ceil(best+1e-6),maxFood:Math.ceil(maxFood+1e-6),plan,relaxation:'area-workforce-free-happiness',note:'Pułap optymistyczny: pełne szczęście bez powierzchni kultur i bez ograniczeń geometrii. To nie jest obietnica osiągalnego wyniku.'}:{feasible:false,total:null,reason:'Brak miejsca na pracowników wymaganych budynków.'};
}
function cultureArea(list){return list.reduce((n,b)=>n+(b.kind==='happiness'?b.w*b.h:0),0);}
function cityMetrics(choice){
 const s=choice.stats,list=choice.list;
 return {total:s.equivalent.total,food:s.food,goods:s.goods,sparks:s.sparks,gold:s.coins,goldSparks:s.equivalent.goldSparks,totalSparks:s.sparks+s.equivalent.goldSparks,culture:cultureArea(list),specialCulture:list.filter(b=>b.id==='fountain'||b.id==='collectableMinoanWatchtowerV2').reduce((n,b)=>n+b.w*b.h,0),farms:list.filter(b=>b.kind==='farm').length,ruralFarms:list.filter(b=>b.id==='ruralFarm').length,domesticFarms:list.filter(b=>b.id==='domesticFarm').length,farmRebuild:farmRebuild(list,choice.options),homes:list.filter(b=>b.kind==='home').length,needed:s.needed,available:s.available,army:s.army,free:choice.options.tiles.filter(Boolean).length*16-s.used};
}
function boundGap(choice,cat){
 const bound=productionBound(cat,choice.options,choice.oldCount),q=layoutQuality(choice.list,choice.options);
 return {...bound,gap:bound.feasible?bound.total-choice.stats.equivalent.total:null,gapPercent:bound.feasible&&bound.total>0?100*(bound.total-choice.stats.equivalent.total)/bound.total:null,eligible:q.complete};
}
async function generateCompared(cat,o,plans,progress,seeds=[],patterns=[]){
 const modes=o.engineMode==='compare'?['legacy','frontiers']:o.engineMode==='portfolio'?['edge-bands','rows-horizontal','rows-vertical',o.referenceSchemes?'reference-schemes':'frontiers']:[o.engineMode],names={'reference-schemes':'Schematy graczy i ich ulepszanie',legacy:'Swobodne przestawianie',frontiers:'Pasy z dwóch stron', 'rows-horizontal':'Rzędy poziome od zera','rows-vertical':'Rzędy pionowe od zera','edge-bands':'Od brzegu: domy, kultura i farmy',polish:'Szlifowanie najlepszego układu',shelves:'Plan półek: rzędy i kanały z liczb'};
 const choices=[],benchmarks=[],warnings=[];let tried=0,done=0;
 const total=plans.length*modes.length,budgetMs=Number.isFinite(o.workerBudgetMs)?Math.max(1,o.workerBudgetMs)/total:o.searchSeconds!==undefined?o.searchSeconds*1000/total:o.searchStarts*1000;
 const bounds=new Map(plans.map(p=>[p.count,productionBound(cat,o,p.count)]));
 for(const plan of plans){const found=[];
  for(const mode of modes){
   const started=performance.now(),deadline=Date.now()+budgetMs,requirements={...o,engineMode:mode,enforceLayout:true,oldCount:plan.count,requireFuel:plan.title!=='Twój cel'};
   let best=null,working=null,runs=Number.isSafeInteger(o.startSeed)?o.startSeed:0,round=0,lastCheckpoint=-Infinity,attemptCursor=0,comparisonStart=null;const fragmentReport={trials:0,evaluated:0,accepted:0,bands:0,bandsEvaluated:0,bandsAccepted:0};
   const measure=list=>{const s=evaluate(list,requirements);s.equivalent=equivalent(s,requirements);return s;};
   const startRuns=runs,libraryMode=mode==='reference-schemes'&&patterns.length>0;
   const construct=(seed,limit)=>mode==='legacy'?searchCity(cat,requirements,plan.count,seed,limit):mode==='reference-schemes'?searchReferenceSchemes(cat,requirements,plan.count,seed,limit,patterns,seed-startRuns<=1?0:seed):mode==='edge-bands'?searchEdgeBands(cat,requirements,plan.count,seed,limit):mode==='shelves'?searchShelves(cat,requirements,plan.count,seed,limit):searchFrontiers(cat,requirements,plan.count,seed,limit);
   // Seed coordinates are untrusted: rehydrate every parameter from the current
   // catalogue and validate against the current terrain/counts/collection rhythm.
   for(const seed of structured(mode)?[]:[...seeds,...found.map(c=>({list:c.list,seed:c.seed,districtAttempts:c.districtAttempts}))]){
    if(!seed||!Array.isArray(seed.list)||seed.list.length>N)continue;
    const list=seed.list.map((b,i)=>b&&typeof b.id==='string'&&cat[b.id]?{...cat[b.id],x:b.x,y:b.y,w:b.w,h:b.h,uid:i+1}:null);
    const seedNumber=Number.isSafeInteger(seed.seed)?seed.seed:1,seedAttempts=Number.isSafeInteger(seed.districtAttempts)?seed.districtAttempts:0;
    let c;
    if(list.some(b=>!b)||validate(list,manualOptions(requirements),cat)){
     // Terrain or requirements changed: adapt the previous city as a pattern instead of discarding it.
     const adapted=searchPattern(cat,requirements,plan.count,seedNumber,Math.min(deadline,Date.now()+8000),{name:'Poprzednia mapa',layout:seed.list.filter(Boolean)});
     if(!adapted)continue;
     c={...adapted,options:requirements,oldCount:plan.count,seed:seedNumber,districtAttempts:seedAttempts,pattern:'continued',adaptedFrom:'previous'};
    }else c={list,options:requirements,stats:measure(list),oldCount:plan.count,seed:seedNumber,districtAttempts:seedAttempts,pattern:'continued'};
    comparisonStart??={...cityMetrics(c),requirementsMet:!validate(c.list,requirements,cat)};
    if(validate(c.list,requirements,cat)||!layoutQuality(c.list,requirements).complete)c=repairSourceBlocks(c,cat,Math.min(deadline,Date.now()+2500));
    if(validate(c.list,requirements,cat))c=rebuildDistricts(c,cat,Math.min(deadline,Date.now()+5000));
    if(validate(c.list,requirements,cat))continue;
    if(!best||betterLayout(c,best,requirements))best=c;
   }
   attemptCursor=best?.districtAttempts||0;if(best)comparisonStart??=cityMetrics(best);
   // New fields on a saved city: grow them with farm packages before anything else touches the map.
   if(best&&Date.now()<deadline&&layoutQuality(best.list,requirements).free>=12){const grown=refineHappiness(best,cat,Math.min(deadline,Date.now()+4000));if(betterLayout(grown,best,requirements))best=grown;}
   function report(force=false){
    const elapsed=performance.now()-started;
    let checkpoint;
    if(best&&(force||elapsed-lastCheckpoint>4000)){
     comparisonStart??=cityMetrics(best);
     const bound=bounds.get(plan.count),q=layoutQuality(best.list,requirements);best={...best,comparisonStart,fragmentReport:{...fragmentReport},districtAttempts:attemptCursor,quality:q,bound,engine:mode,title:plan.title+' · '+names[mode]};
     checkpoint={choices:[...choices,...found,best],cat,tried,benchmarks,frontier:choices.length+found.length+1,warnings,balanced:false,searchVersion:9};lastCheckpoint=elapsed;
    }
    progress(done+Math.min(1,elapsed/budgetMs),total,checkpoint);
   }
   report(true);
   // Library starts need several full adaptations before polishing: give them a longer first phase.
   // An accepted saved city is polished, not outcompeted by fresh constructions in its own slot.
   const seeded=!!best;
   const constructionDeadline=seeded?Date.now():Math.min(deadline,Date.now()+(libraryMode?Math.max(Math.min(8000,budgetMs*.2),budgetMs*.4):Math.min(8000,budgetMs*.2)));
   while(Date.now()<(best?constructionDeadline:deadline)){
    const c=construct(++runs,best?constructionDeadline:deadline);
    tried+=c?.examined||0;if(c&&(!best||betterLayout(c,best,requirements)))best=c;
    if(structured(mode)&&best)break;
    report();await new Promise(resolve=>setTimeout(resolve,0));
   }
   working=best;
   if(structured(mode)){
    // Independently reconstruct entire cities. Retain row geometry during
    // culture/housing polishing; the free engine explores unconstrained moves.
    while(Date.now()<deadline){
     if(best){
      let c=repairLayout(best,cat,Math.min(deadline,Date.now()+1000));
      c=repairSourceBlocks(c,cat,Math.min(deadline,Date.now()+1000));
      c=refineHappiness(c,cat,Math.min(deadline,Date.now()+1000));
      if(!validate(c.list,requirements,cat)&&betterLayout(c,best,requirements))best=c;
     }
     const c=construct(++runs,Math.min(deadline,Date.now()+4000));
     if(c&&(!best||betterLayout(c,best,requirements)))best=c;
     report();await new Promise(resolve=>setTimeout(resolve,0));
    }
   }
   while(!structured(mode)&&best&&Date.now()<deadline){
    if(mode==='polish'){best=polishLayout(best,cat,requirements,++runs,Math.min(deadline,Date.now()+Math.max(2000,budgetMs/8)));tried=Math.max(tried,best.polishRounds||0);report();await new Promise(resolve=>setTimeout(resolve,0));continue;}
    // Periodic fresh starts diversify construction; other cycles improve the
    // incumbent or the current exploratory district. Never discard the best.
    if(++round%5===0){const c=construct(++runs,Math.min(deadline,Date.now()+(libraryMode?6000:2500)));if(c)working=c;}
    else if(round%3===0)working=best;
    working=repairLayout(working||best,cat,Math.min(deadline,Date.now()+1500));
    working=rebuildDistricts({...working,districtAttempts:attemptCursor,fragmentTrials:0,fragmentEvaluated:0,fragmentAccepted:0,bandTrials:0,bandEvaluated:0,bandAccepted:0},cat,Math.min(deadline,Date.now()+5000));
    attemptCursor=working.districtAttempts;fragmentReport.trials+=working.fragmentTrials||0;fragmentReport.evaluated+=working.fragmentEvaluated||0;fragmentReport.accepted+=working.fragmentAccepted||0;fragmentReport.bands+=working.bandTrials||0;fragmentReport.bandsEvaluated+=working.bandEvaluated||0;fragmentReport.bandsAccepted+=working.bandAccepted||0;
    working=repairLayout(working,cat,Math.min(deadline,Date.now()+2000));
    if(!validate(working.list,requirements,cat)&&betterLayout(working,best,requirements))best=working;
    const polished=refineHappiness(best,cat,Math.min(deadline,Date.now()+1000));if(betterLayout(polished,best,requirements))best=polished;
    tried=Math.max(tried,best.examined||0);report();await new Promise(resolve=>setTimeout(resolve,0));
   }
   const elapsedMs=performance.now()-started;
   benchmarks.push({plan:plan.title,engine:mode,name:names[mode],budgetMs,elapsedMs,runs:runs-(Number.isSafeInteger(o.startSeed)?o.startSeed:0),found:!!best,food:best?.stats.food??null,total:best?.stats.equivalent.total??null,free:best?layoutQuality(best.list,o).free:null,quality:best?layoutQuality(best.list,o):null,army:best?.stats.army??null});
   if(best){best={...best,comparisonStart:comparisonStart||cityMetrics(best),fragmentReport:{...fragmentReport},districtAttempts:attemptCursor,quality:layoutQuality(best.list,o),bound:bounds.get(plan.count),engine:mode,title:plan.title+' · '+names[mode]};found.push(best);}
   else warnings.push(names[mode]+': nie znaleziono poprawnej mapy dla „'+plan.title+'” w zadanym czasie.');
   progress(++done,total);
  }
  found.sort((a,b)=>betterLayout(a,b,o)?-1:betterLayout(b,a,o)?1:0);choices.push(...found);
 }
 if(!choices.length)throw Error('Nie znalazłem poprawnego układu w tym przebiegu. '+warnings.join(' '));
 return {choices,cat,tried,benchmarks,frontier:choices.length,warnings,balanced:false,searchVersion:9};
}

// Marek, 16.09.2026: the engine should look for the worst-scoring areas and work there, leaving perfect sectors alone.
// Sector = one 4×4 place. Waste = wasted happiness points + twice the missing points + holes + same-size pairs and edge sources.
function sectorWaste(list,o){
 const g=mask(o.tiles);for(const b of list)paint(g,b,1);const waste=new Array(80).fill(0),key=b=>Math.min(79,Math.max(0,Math.floor((b.y+b.h/2)/4)*10+Math.floor((b.x+b.w/2)/4)));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!g[y*W+x])waste[Math.floor(y/4)*10+Math.floor(x/4)]+=4000;
 for(const b of list){if(!b.happyMax)continue;const h=rawHappiness(b,list);waste[key(b)]+=Math.max(0,h-b.happyMax)+(b.kind==='home'?.1:2)*Math.max(0,b.happyMax-h);}
 const q=layoutQuality(list,o),members=item=>(Array.isArray(item)?item:[item,item?.a,item?.b,item?.source]).filter(b=>b&&Number.isFinite(b.x)&&Number.isFinite(b.w));
 for(const item of q.pairs||[])for(const b of members(item))waste[key(b)]+=3000;
 for(const item of q.edges||[])for(const b of members(item))waste[key(b)]+=1500;
 return waste;
}
// Marek, 16.09.2026: polishing as he sees it — from the best city, 5–10 changes at once (also through
// worse intermediate states), then the ordinary refinement; any city better in total value wins.
// Each worker runs its own chain of rounds; several workers with different seeds are the branches.
function polishLayout(choice,cat,o,seed,deadline=Infinity){
 const rng=random((seed||1)*7919+13),terrain=mask(o.tiles);
 const measure=list=>{const s=evaluate(list,o);s.equivalent=equivalent(s,o);return s;};
 let best=choice.stats?.equivalent?choice:{...choice,stats:measure(choice.list)};let rounds=0,accepted=0;
 const movable=b=>b.kind==='home'||b.kind==='happiness'||b.kind==='farm'||(b.kind==='workshop'&&!b.premium);
 const ordinary=b=>(b.kind==='home'||b.kind==='happiness')&&!b.premium&&b.id!=='fountain'&&b.id!=='collectableMinoanWatchtowerV2';
 const pick=arr=>arr[Math.floor(rng()*arr.length)];
 const refill=list=>{const out=[...list],g=terrain.slice();out.forEach(b=>paint(g,b,1));let uid=Math.max(0,...out.map(b=>b.uid||0))+1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(const id of ['smallHome','averageHome'])if(cat[id]&&fits(g,x,y,cat[id].w,cat[id].h)){const b={...cat[id],x,y,uid:uid++};out.push(b);paint(g,b,1);break;}return fillHoles(out,cat,o);};
 while(Date.now()<deadline){
  rounds++;let list=best.list.map(b=>({...b}));const kicks=5+Math.floor(rng()*6);
  // Most kicks land in the three worst sectors; the fountain kick tests big buildings at the edge of its range.
  const waste=sectorWaste(best.list,o),worst=[...waste.keys()].sort((a,b)=>waste[b]-waste[a]).slice(0,3),inWorst=b=>worst.includes(Math.floor((b.y+b.h/2)/4)*10+Math.floor((b.x+b.w/2)/4));
  const from=arr=>{const w=rng()<.6?arr.filter(inWorst):[];return pick(w.length?w:arr);};
  for(let k=0;k<kicks;k++){
   const move=rng(),fountain=list.find(b=>b.id==='fountain');
   if(move>=.93&&fountain){const a=pick(list.filter(b=>(b.kind==='farm'||b.kind==='workshop')&&!b.premium&&b.w*b.h>=12&&!reaches(fountain,b)));if(!a)continue;const b=pick(list.filter(t=>t!==a&&movable(t)&&t.w===a.w&&t.h===a.h&&t.id!==a.id&&reaches(fountain,t)));if(!b)continue;[a.x,b.x]=[b.x,a.x];[a.y,b.y]=[b.y,a.y];continue;}
   if(move<.35){const pool=list.filter(movable),a=from(pool);if(!a)continue;const b=pick(pool.filter(t=>t!==a&&t.w===a.w&&t.h===a.h&&t.id!==a.id));if(!b)continue;[a.x,b.x]=[b.x,a.x];[a.y,b.y]=[b.y,a.y];}
   else if(move<.6){const a=from(list.filter(b=>b.kind==='happiness'||b.kind==='home'));if(!a)continue;const g=terrain.slice();for(const b of list)if(b!==a)paint(g,b,1);const spots=[];for(let y=0;y<=H-a.h;y++)for(let x=0;x<=W-a.w;x++)if((x!==a.x||y!==a.y)&&fits(g,x,y,a.w,a.h))spots.push([x,y]);const s=pick(spots);if(!s)continue;a.x=s[0];a.y=s[1];}
   else if(move<.8){const a=from(list.filter(movable));if(!a)continue;const [dx,dy]=pick([[1,0],[-1,0],[0,1],[0,-1]]);const moved=slideChain(list,a,dx,dy,terrain);if(moved)list=list.filter(b=>!moved.removed.includes(b)).concat(moved.placed);}
   else if(move<.9){const a=pick(list.filter(b=>movable(b)&&b.w!==b.h));if(!a)continue;const g=terrain.slice();for(const b of list)if(b!==a)paint(g,b,1);if(fits(g,a.x,a.y,a.h,a.w))[a.w,a.h]=[a.h,a.w];}
   else{const a=from(list.filter(ordinary));if(!a)continue;list=list.filter(b=>b!==a);}
  }
  list=refill(list);
  if(o.fullArmy&&evaluate(list,o).armyDeficit>1e-5)list=feedBarracks(list,cat,o,Math.min(deadline,Date.now()+300))||list;
  if(validate(list,o,cat))continue;
  const remaining=deadline-Date.now();
  let c=refineHappiness({...best,list,stats:measure(list)},cat,Math.min(deadline,Date.now()+Math.max(800,Math.min(6000,remaining/6))));
  if(validate(c.list,o,cat))continue;
  if(betterLayout(c,best,o)){best=c;accepted++;}
 }
 return {...best,polishRounds:(choice.polishRounds||0)+rounds,polishAccepted:(choice.polishAccepted||0)+accepted};
}

// Marek, 16.09.2026: the hand editor gets Forge-like moves — Delete removes, D copies, a palette adds era
// buildings. Only homes, ordinary culture and farms are free to add or remove; everything the settings
// count (workshops, premium, barracks, fountain, ticked optional buildings) can only be parked and re-placed.
function freelyEditable(b){return (b.kind==='home'||b.kind==='happiness'||b.kind==='farm')&&!b.premium;}
function editLayout(choice,cat,op){
 const list=choice.list.map(b=>({...b})),parked=(choice.parked||[]).map(b=>({...b}));
 const nextUid=Math.max(0,...list.map(b=>b.uid||0),...parked.map(b=>b.uid||0))+1;let added;
 const finish=()=>{const stats=evaluate(list,choice.options);stats.equivalent=equivalent(stats,normalized(choice.options));return {...choice,list,parked,stats,manual:true,pattern:'manual',added};};
 if(op.type==='add'){const def=cat[op.id];if(!def||!freelyEditable(def))throw Error('Ten budynek dodaje się przez ustawienia, nie w edytorze.');added=nextUid;parked.push({...def,uid:added});return finish();}
 const b=list.find(b=>b.uid===op.uid)||parked.find(b=>b.uid===op.uid);
 if(!b)throw Error('Wybierz budynek.');
 if(op.type==='duplicate'){if(!freelyEditable(b))throw Error('Liczbę takich budynków ustawia się w ustawieniach, nie w edytorze.');added=nextUid;parked.push({...b,uid:added});return finish();}
 if(op.type==='remove'){if(!freelyEditable(b))throw Error('Ten budynek jest wymagany przez ustawienia. Odłóż go na bok albo zmień ustawienia.');const from=list.includes(b)?list:parked;from.splice(from.indexOf(b),1);return finish();}
 if(op.type==='park'){
  if(!list.includes(b))throw Error('Ten budynek jest już odłożony.');
  list.splice(list.indexOf(b),1);parked.push(b);
 }else if(op.type==='rotate'&&parked.includes(b)){
  [b.w,b.h]=[b.h,b.w];
 }else{
  if(!['move','rotate'].includes(op.type))throw Error('Nieznany ruch.');
  const p={...b,x:op.x??b.x,y:op.y??b.y,w:op.type==='rotate'?b.h:b.w,h:op.type==='rotate'?b.w:b.h};
  const terrain=mask(choice.options.tiles);
  if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||!fits(terrain,p.x,p.y,p.w,p.h))throw Error('Budynek wychodzi poza dostępny teren.');
  const hits=list.filter(t=>t!==b&&overlap(t,p));
  if(hits.length){
   const other=hits[0];
   if(op.type!=='move'||!list.includes(b)||hits.length!==1||other.w!==b.w||other.h!==b.h||p.x!==other.x||p.y!==other.y)throw Error('Miejsce jest zajęte. Odłóż przeszkadzający budynek lub zamień obiekty tego samego rozmiaru.');
   other.x=b.x;other.y=b.y;
   if(list.some(t=>t!==b&&t!==other&&overlap(t,other)))throw Error('Zamiana powoduje kolizję.');
  }
  if(list.includes(b))list.splice(list.indexOf(b),1);else parked.splice(parked.indexOf(b),1);
  list.push(p);
 }
 return finish();
}
function manualOptions(o){return {...o,fullArmy:false,requireFuel:false,balanced:false,goodsTarget:0};}
function projectFile(o,choice=null){if(choice?.parked?.length)throw Error('Przed zapisem ustaw wszystkie odłożone budynki.');if(choice&&o.workshopCounts)o={...o,oldCount:choice.oldCount,requireFuel:!!choice.options?.requireFuel};validateOptions(o);return {format:'furia-city',version:1,options:o,manual:!!choice?.manual,search:choice?{seed:choice.seed||1,districtAttempts:choice.districtAttempts||0}:null,layout:choice?choice.list.map(({id,x,y,w,h})=>({id,x,y,w,h})):null};}
function readProject(data,file){
 if(!file||file.format!=='furia-city'||file.version!==1)throw Error('To nie jest obsługiwany zapis miasta Furii.');
 const o=file.options;validateOptions(o);
 if(['fullArmy','subscription','fountain'].some(id=>o[id]!==undefined&&typeof o[id]!=='boolean')||o.fountain&&(!Number.isInteger(o.fountainLevel)||o.fountainLevel<1||o.fountainLevel>100))throw Error('Nieprawidłowy poziom lub opcje zapisu.');
 if((o.balanced!==true&&!o.workshopCounts)||!Array.isArray(o.optional)||!o.premium||!['premiumFarm','premiumHome','premiumCulture'].every(id=>Number.isInteger(o.premium[id])))throw Error('Nieprawidłowe ustawienia zapisu.');
 const cat=prepare(data,o);if(o.optional.some(id=>!['collectableSchoolV2','collectableArchitectsStudioV2','heroAcademy','collectableMinoanWatchtowerV2'].includes(id))||Object.keys(o.premium).some(id=>!cat[id]?.premium))throw Error('Nieznany budynek w zapisie.');
 if(file.layout===null)return {options:o,result:null};
 if(!Array.isArray(file.layout)||file.layout.length>W*H)throw Error('Nieprawidłowa mapa w zapisie.');
 const list=file.layout.map((p,i)=>{if(!p||!Object.hasOwn(cat,p.id))throw Error('Nieznany budynek w zapisie.');return {...cat[p.id],x:p.x,y:p.y,w:p.w,h:p.h,uid:i+1};});
 const error=validate(list,file.manual===true?manualOptions(o):o,cat);if(error)throw Error('Nieprawidłowa mapa: '+error);
 const summary=evaluate(list,o);summary.equivalent=equivalent(summary,normalized(o));const choice={list,options:o,title:'Wczytany układ',stats:summary,oldCount:list.filter(b=>b.oldWorkshop).length,seed:Number.isSafeInteger(file.search?.seed)?file.search.seed:1,districtAttempts:Number.isSafeInteger(file.search?.districtAttempts)?file.search.districtAttempts:0,pattern:file.manual===true?'manual':'saved',manual:file.manual===true};
 return {options:o,result:{choices:[choice],cat,balanced:true,tried:0,frontier:1}};
}
root.HOH_ENGINE={rowRuns,rowCompliant,joinsRowAcross,qualityMemo,searchShelves,eraScale,OWNED_SHARE,crowdsBarracks,smallCulture,ROW_MIN,LOOSE_SHARE,searchReferenceSchemes,searchPattern,patternStarter,placeMissing,swapFarmsForProducers,feedBarracks,sourceReach,reachShortfall,REACH_TARGET,slideChain,fillHoles,preferredFarm,farmPerCell,premiumToBarracks,fuelPerWorkshop,fuelWorkshops,freelyEditable,sectorWaste,PAIR_BAND,polishLayout,OPTIONAL_IDS,betterLayout,alignPattern,patternPlacements,rankChoices,cultureReport,usefulCulture,armyMinimum,farmRebuild,farmQuota,farmCounts,primaryFarm,FARM_REBUILD_BAND,W,H,mandatory,current,eraInfo,currentFor,mandatoryFor,oldFor,fountainProfile,reaches,collectedHours,prepare,mask,fits,rawHappiness,happiness,hourly,evaluate,validate,validateOptions,generate,projectFile,readProject,normalized,equivalent,searchFrontiers,edgeBandStarter,searchEdgeBands,refineHappiness,rebuildDistricts,layoutQuality,repairLayout,packHomes,productionBound,boundGap,fragmentSeed,armyNeed,editLayout,manualOptions,cityMetrics,repairSourceBlocks,fountainCoverage,sourceEdgePositions,relocateAdministration,preservesRows,productionRows};
})(globalThis);



