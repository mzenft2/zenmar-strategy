(function(root){
'use strict';
const labels=["Twoje miasto","Produkcja","Surowiec / warsztat","Magazyn","1 h","24 h nominalnie","Zbiór / dobę","Magazyn to łączna pojemność przy obecnym szczęściu i abonamencie. Zbiór uwzględnia Twój rytm odbiorów; 24 h nominalnie zakłada brak przestojów.","Szczęście","Punkty źródeł","Wykorzystane u odbiorców","Do pełnego szczęścia","Brakujące punkty","Nadmiar bez bonusu","Wykorzystanie źródeł","Jedno źródło zasila wiele budynków, więc wykorzystane punkty mogą przekraczać sumę punktów źródeł. Piec i inne budynki bez potrzeb szczęścia nie są odbiorcami.","Powierzchnia","Dostępny teren","Domy","Farmy","Kultura","Warsztaty","Koszary","Funkcyjne","Wolne kratki","Pracownicy","Potrzebni","Dostępni","Wolni","Iskry z wymiany / dobę","Z towarów","Ze złota","Razem","Wymiana według Twoich limitów i pełnych paczek. Towary i złoto powyżej pokazano przed przepaleniem.","Złoto","Jedzenie","Fontanna i wieża są w kategorii funkcyjne. Kratki wszystkich źródeł szczęścia","Brak produkcji zasobów w tym układzie.","Odłożone budynki pominięto w podsumowaniu.","Budynki","Zbiór wykorzystuje","potencjału dobowego","Kultura zwykła","Epoka","Wykorzystanie z nadmiarem","Szczęście w budynkach bez potrzeb","Ratusz, piec, fontanna i wieża nie potrzebują szczęścia. Mała wartość to nic, duża to znak, że źródło stoi w złym miejscu.","Współczynnik jak w planerze miast: wszystkie punkty trafiające do odbiorców podzielone przez punkty źródeł. Dobre plany zaczynają się około 7,5."];
function calculate(choice){
 const E=root.HOH_ENGINE,o=choice.options,list=choice.list,stats=E.evaluate(list,o),eq=E.equivalent(stats,o),details=new Map(stats.details.map(d=>[d.id,d])),production=new Map(),groups=new Map();
 const area={home:0,farm:0,happiness:0,workshop:0,barracks:0,special:0};
 let sourcePoints=0,required=0,sourceTiles=0;
 for(const b of list){
  const tiles=b.w*b.h;area[b.kind in area?b.kind:'special']+=tiles;
  if(b.points>0){sourcePoints+=b.points;sourceTiles+=tiles;}required+=b.happyMax||0;
  const key=b.id+'|'+b.level;if(!groups.has(key))groups.set(key,{id:b.id,name:b.name,level:b.level,count:0,area:0});const g=groups.get(key);g.count++;g.area+=tiles;
  for(const reward of b.rewards||[]){
   if(!(b.hours>0))continue;
   // Workshop goods stay separate even when an era uses the same resource type.
   const key=reward.resource==='coins'||reward.resource==='food'?reward.resource:b.id;
   if(!production.has(key))production.set(key,{id:key,name:b.name,resource:reward.resource,storage:0,hourly:0,nominal:0,collected:0});
   const p=production.get(key),rate=E.hourly(b,details.get(b.uid).happy,reward.resource),duration=b.hours*(o.subscription?2:1);
   p.storage+=rate*duration;p.hourly+=rate;p.nominal+=rate*24;p.collected+=rate*E.collectedHours(duration,o.interval,o.night);
  }
 }
 return {era:E.eraInfo(o).name,production:[...production.values()].sort((a,b)=>({coins:0,food:1}[a.id]??2)-({coins:0,food:1}[b.id]??2)),area,land:o.tiles.filter(Boolean).length*16,used:stats.used,free:o.tiles.filter(Boolean).length*16-stats.used,sourceTiles,sourcePoints,required,consumed:stats.consumed,missing:Math.max(0,required-stats.consumed),excess:stats.excess,utilization:sourcePoints?stats.consumed/sourcePoints:null,needed:stats.needed,available:stats.available,spare:stats.spare,army:stats.army,goodsSparks:stats.sparks,goldSparks:eq.goldSparks,totalSparks:stats.sparks+eq.goldSparks,buildings:[...groups.values()],parked:choice.parked?.length||0,food:stats.food,food24:stats.food24,culture:E.cultureReport(list)};
}
const resources=["Iskry (piec)","PD bohaterów","Punkty mistrzostwa"];
let last=null;
function render(choice,target=document.getElementById('citySummary')){
 if(!target)return;last={choice,target};const r=calculate(choice),I=root.ZENMAR_I18N,lang=I?.language||'pl',t=i=>esc(I?.text(labels[i])||labels[i]),fmt=n=>Number(n).toLocaleString(I?.locale||'pl-PL',{maximumFractionDigits:0}),dec=n=>Number(n).toLocaleString(I?.locale||'pl-PL',{maximumFractionDigits:2}),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),name=s=>esc(I?.text(s)||s);
 const resourceName=p=>p.id==='coins'?t(34):p.id==='food'?t(35):p.resource==='embers'?name(resources[0]):p.resource==='hero_xp'?name(resources[1]):p.resource==='mastery_points'?name(resources[2]):name(p.name);
 const pair=(label,value,cls='')=>`<div class="${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
 target.setAttribute('translate','no');target.className='city-summary';
 target.innerHTML=`<div class="city-summary-heading"><div><p>${t(43)}: ${name(r.era)}</p><h2>${t(0)}</h2></div><span>${t(39)}: ${fmt(choice.list.length)}</span></div>
 ${r.parked?`<p class="city-summary-warning">${t(38)} (${r.parked})</p>`:''}
 <div class="city-summary-columns"><section class="city-production"><h3>${t(1)}</h3><div class="table-wrap"><table><thead><tr>${[2,3,4,5,6].map(i=>`<th scope="col">${t(i)}</th>`).join('')}</tr></thead><tbody>${r.production.map(p=>`<tr data-resource="${esc(p.id)}"><th scope="row">${resourceName(p)}</th><td>${fmt(p.storage)}</td><td>${fmt(p.hourly)}</td><td>${fmt(p.nominal)}</td><td><strong>${fmt(p.collected)}</strong></td></tr>`).join('')||`<tr><td colspan="5">${t(37)}</td></tr>`}</tbody></table></div><p class="hint">${t(7)}</p>${r.food24?`<p>${t(40)} <strong>${dec(r.food/r.food24*100)}%</strong> ${t(41)} (${t(35).toLocaleLowerCase(lang)}).</p>`:''}
 <h3>${t(29)}</h3><dl class="city-sparks">${pair(t(30),fmt(r.goodsSparks))}${pair(t(31),fmt(r.goldSparks))}${pair(t(32),fmt(r.totalSparks))}</dl><p class="hint">${t(33)}</p></section>
 <section class="city-happiness"><h3>${t(8)}</h3><dl class="city-facts">${[[9,r.sourcePoints],[10,r.consumed],[11,r.required],[12,r.missing],[13,r.excess]].map(([i,v])=>pair(t(i),fmt(v),i===12&&v?'city-deficit':'')).join('')}${pair(t(14),r.utilization===null?'—':dec(r.utilization)+'×')}${pair(t(44),r.culture.ratio===null?'—':dec(r.culture.ratio)+'×','city-culture-ratio')}${pair(t(45),fmt(r.culture.wastedTotal),r.culture.wastedTotal>0?'city-deficit':'')}${pair(t(22),dec(r.army*100)+'%')}</dl><p class="hint">${t(47)}</p><p class="hint">${t(46)}${r.culture.wasted.length?' '+r.culture.wasted.map(g=>name(g.name)+' '+fmt(g.points)).join(', ')+'.':''}</p><p class="hint">${t(15)}</p><h3>${t(25)}</h3><dl class="city-sparks">${pair(t(26),fmt(r.needed))}${pair(t(27),fmt(r.available))}${pair(t(28),fmt(r.spare),r.spare<0?'city-deficit':'')}</dl></section></div>
 <section class="city-area"><h3>${t(16)}</h3><dl>${[[17,r.land,'land'],[18,r.area.home,'home'],[19,r.area.farm,'farm'],[20,r.area.happiness,'happiness'],[21,r.area.workshop,'workshop'],[22,r.area.barracks,'barracks'],[23,r.area.special,'special'],[24,r.free,'free']].map(([i,v,key])=>pair(t(i),fmt(v),'area-'+key)).join('')}</dl><p class="hint">${t(36)}: <strong>${fmt(r.sourceTiles)}</strong>.</p></section>`;
}
root.HOH_CITY_SUMMARY={calculate,render,labels};
root.addEventListener?.('zenmar-language',()=>{if(last&&last.target.isConnected)render(last.choice,last.target);});
})(globalThis);
