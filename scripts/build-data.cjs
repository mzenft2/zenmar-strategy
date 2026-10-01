const fs=require('fs'),crypto=require('crypto');

const names={smallHome:'Mały dom',averageHome:'Średni dom',premiumHome:'Luksusowy dom',ruralFarm:'Gospodarstwo wiejskie',domesticFarm:'Gospodarstwo domowe',premiumFarm:'Luksusowe gospodarstwo',cityHall:'Ratusz',furnace:'Piec',heroAcademy:'Akademia bohaterów',infantryBarracks:'Koszary piechoty',rangedBarracks:'Koszary strzeleckie',cavalryBarracks:'Koszary kawalerii',heavyInfantryBarracks:'Koszary ciężkiej piechoty',siegeBarracks:'Koszary oblężnicze',littleCultureSite:'Małe miejsce szczęścia',compactCultureSite:'Kompaktowe miejsce szczęścia',moderateCultureSite:'Średnie miejsce szczęścia',largeCultureSite:'Duże miejsce szczęścia',premiumCultureSite:'Luksusowe miejsce szczęścia',artisan:'Rzemieślnik',stoneMason:'Kamieniarz',tailor:'Krawiec',scribe:'Skryba',carpenter:'Cieśla',spiceMerchant:'Handlarz przypraw',jeweler:'Jubiler',glassblower:'Dmuchacz szkła',alchemist:'Alchemik',collectableSchoolV2:'Szkoła',collectableArchitectsStudioV2:'Liceum uczonych',collectableMinoanWatchtowerV2:'Wieża minojska'};
Object.assign(names,{compactCulture:'Kompaktowe miejsce szczęścia',moderateCulture:'Średnie miejsce szczęścia',littleCulture:'Małe miejsce szczęścia',largeCulture:'Duże miejsce szczęścia',premiumCulture:'Luksusowe miejsce szczęścia',collectableAmphitheatre:'Amfiteatr'});

const source=require('./read-fog.cjs')();
const labels=[['StoneAge','stone-age','Epoka kamienia'],['BronzeAge','bronze-age','Epoka brązu'],['MinoanEra','minoan','Epoka minojska'],['ClassicGreece','classic-greece','Klasyczna Grecja'],['EarlyRome','early-rome','Wczesny Rzym'],['RomanEmpire','roman-empire','Imperium Rzymskie'],['ByzantineEra','byzantine','Epoka bizantyjska'],['AgeOfTheFranks','franks','Epoka Franków'],['FeudalAge','feudal','Epoka feudalna'],['IberianEra','iberian','Epoka iberyjska'],['KingdomOfSicily','sicily','Królestwo Sycylii'],['HighMiddleAges','high-middle-ages','Rozkwit średniowiecza'],['EarlyGothicEra','early-gothic','Wczesna epoka gotycka'],['LateGothicEra','late-gothic','Późna epoka gotycka']];
const rank=Object.fromEntries(source.ages.map(a=>['age.'+a.sourceAge,a.index]));
const all=source.buildings.map(({_culture,_workers,...b})=>({...b,name:names[b.id]||b.name}));
const eras=labels.map(([sourceAge,id,name])=>{
 const max=rank['age.'+sourceAge],selected=new Map();
 for(const b of all){if(!rank[b.age]||rank[b.age]>max)continue;const prev=selected.get(b.id);if(!prev||rank[b.age]>rank[prev.age]||rank[b.age]===rank[prev.age]&&b.level>prev.level)selected.set(b.id,b);}
 const current=[...selected.values()].filter(b=>b.kind==='workshop'&&b.age==='age.'+sourceAge).map(b=>b.id).sort();
 // Preserve the familiar Gothic form order and save format.
 if(current.includes('jeweler'))current.splice(0,current.length,'jeweler','glassblower','alchemist');
 const buildings=[...selected.values()].map(b=>({...b,oldWorkshop:b.kind==='workshop'&&!current.includes(b.id)}));
 const tower=buildings.find(b=>b.id==='collectableMinoanWatchtowerV2');if(tower)tower.levels=all.filter(b=>b.id===tower.id).sort((a,b)=>a.level-b.level).map(({level,points,range,workers,sourceId})=>({level,points,range,workers,sourceId}));
 const mandatory=['cityHall','furnace','infantryBarracks','rangedBarracks','cavalryBarracks','heavyInfantryBarracks','siegeBarracks'].filter(id=>selected.has(id));
 const oldWorkshop=buildings.find(b=>b.id==='stoneMason'&&b.oldWorkshop)?.id||null;
 return {id,name,sourceAge,index:max,current,mandatory,oldWorkshop,buildings,fountainLevels:source.fountain.levelsByAge[sourceAge]};
});
const out={schema:2,era:'Wczesna epoka gotycka',retrieved:'2026-09-15',source:'https://forgeofgames.com/api/hoh/coreData',sourceVersion:source.version,rawSha256:source.sha256,fountainSourceId:source.fountain.sourceId,eras,buildings:eras.find(e=>e.id==='early-gothic').buildings};
fs.writeFileSync('data.js','globalThis.HOH_DATA = '+JSON.stringify(out,null,2)+';\n');
console.log(eras.map(e=>e.name+': '+e.buildings.length+' typów, fontanna '+e.fountainLevels.length+' poziomów').join('\n'));
