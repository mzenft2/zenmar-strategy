'use strict';
const $=id=>document.getElementById(id),form=$('settings'),E=HOH_ENGINE;
const I18N=globalThis.ZENMAR_I18N;
const fmt=n=>new Intl.NumberFormat(I18N.locale,{maximumFractionDigits:0}).format(Math.floor(n));
const fountainLabel=s=>`${s.fountainBuildings||0} budynków: ${s.fountainHomes||0} domów, ${s.fountainProducers||0} farm i warsztatów, ${s.fountainBarracks||0} koszar`;
const compact=n=>new Intl.NumberFormat(I18N.locale,{notation:n>=1e6?'compact':'standard',maximumFractionDigits:n>=1e6?2:0}).format(n>=1e6?n:Math.floor(n));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const projectKey='furia-hoh-project-v1';const key='furia-hoh-v1';let tiles=Array(80).fill(true),result=null,worker=null,chosen=0,activeOptions=null,dirty=false,workerUrl=null;
let beforeSearch=null,searchStartedAt=0,timerId=0;
function tickTimer(){const left=Math.max(0,Math.round((searchStartedAt+(activeOptions?.searchSeconds||60)*1000-Date.now())/1000));$('timerClock').textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');}
const numeric=['interval','night','goodsTarget','sparkCap','goodsPerBatch','sparksPerBatch','fountainLevel','fountainPoints','fountainRange','towerLevel','foodPerGood','foodPerSpark','goldPerBatch','goldSparksPerBatch','goldCap','searchStarts','searchSeconds'];
const premiumIds=['premiumFarm','premiumHome','premiumCulture'];
function options(){const fd=new FormData(form),o={referenceSchemes:true,balanced:false,goalVersion:4,searchBudgetVersion:1,fuelVersion:3,engineMode:'portfolio',era:fd.get('era'),fountainMode:'catalog',tiles:[...tiles],optional:fd.getAll('optional').concat(Number(fd.get('towerLevel'))>0?['collectableMinoanWatchtowerV2']:[]),premium:Object.fromEntries(premiumIds.map(id=>[id,Number(fd.get(id))])),fullArmy:fd.has('fullArmy'),subscription:fd.has('subscription'),fountain:Number(fd.get('fountainLevel'))>0};for(const id of numeric)o[id]=Number(fd.get(id));o.fuelSuggested=form.elements.fuelSuggested.checked;o.oldCount=Number(form.elements.fuelCount.value)||0;o.fuelGoods=Math.min(100000,Math.round(o.oldCount*E.fuelPerWorkshop(o)));o.workshopCounts=Object.fromEntries(E.currentFor(o).map(id=>[id,Number(fd.get(id+'Count'))]));o.compareSparks=fd.has('compareSparks');o.armyMin=Object.fromEntries(barracksFor(o).map(id=>{const v=fd.get(id+'Min');return [id,v===null||v===''?100:Number(v)];}));o.ownedFarms={ruralFarm:Number(fd.get('ruralFarmOwned'))||0,domesticFarm:Number(fd.get('domesticFarmOwned'))||0};return o;}
const barracksFor=o=>E.mandatoryFor(o).filter(id=>id.endsWith('Barracks'));
function restoreArmyFarms(o){for(const id of barracksFor(o)){const el=form.elements[id+'Min'];if(el)el.value=o.armyMin?.[id]??(id==='siegeBarracks'?o.siegeMin??100:100);}for(const id of ['ruralFarm','domesticFarm'])form.elements[id+'Owned'].value=o.ownedFarms?.[id]||0;}

for(const era of HOH_DATA.eras){const el=document.createElement('option');el.value=era.id;el.textContent=era.name;$('era').append(el);}
$('era').value='early-gothic';
// Marek, 16.09.2026: "to powinno być obliczeniowe" — the era gives the old workshop and the furnace limit gives
// the most workshops worth having; the slider runs from 0 to that count and the ticked box keeps it on the suggestion.
// Saves: fuelVersion 3 carries oldCount + fuelSuggested; 8.40–8.48 saves carry fuelGoods; older ones get the suggestion.
function fuelRhythm(){return {era:$('era').value,interval:Number(form.elements.interval.value)||3,night:Number(form.elements.night.value)||0,subscription:form.elements.subscription.checked};}
function fuelFields(){
 const era=E.eraInfo({era:$('era').value}),old=era.oldWorkshop&&era.buildings.find(b=>b.id===era.oldWorkshop),has=id=>era.buildings.some(b=>b.id===id);
 const slider=form.elements.fuelCount,box=form.elements.fuelSuggested,rhythm=fuelRhythm(),per=old?E.fuelPerWorkshop(rhythm):0,cap=Number(form.elements.sparkCap.value)||0,best=old?E.fuelWorkshops(rhythm,cap):0;
 slider.max=String(best);$('fuelTick').value=String(best);
 if(!old){slider.value='0';box.checked=true;form.elements.compareSparks.checked=false;}else if(box.checked)slider.value=String(best);
 const count=Number(slider.value)||0;
 for(const el of [slider,box,form.elements.compareSparks])el.disabled=!!worker||!old;
 $('fuelCountOut').textContent=String(count);
 $('fuelSummary').textContent=old?count+' × '+old.name+' = '+fmt(Math.round(count*per))+' towarów dziennie. '+(count>=best?'Maksimum iskier.':'Poniżej limitu pieca.'):'';
 $('fuelEraHint').textContent=!has('furnace')?'Piec nie jest jeszcze dostępny w tej epoce.':!old?'Możesz uwzględnić wymianę złota. Nie ma jeszcze starszej grupy warsztatów do wariantu produkcji na iskry.':old.name+' przy Twoim rytmie: '+fmt(Math.round(per))+' towarów dziennie.'+(cap>0?' Maksimum iskier: '+best+' × '+old.name+'.':'');
}
function restoreFuel(o){eraFields();const rhythm=fuelRhythm(),best=E.fuelWorkshops(rhythm,Number(form.elements.sparkCap.value)||0);let count=best,suggested=true;if(o.fuelVersion===3){if(Number.isInteger(o.oldCount))count=o.oldCount;suggested=o.fuelSuggested!==false;}else if(o.fuelVersion===2&&Number.isFinite(o.fuelGoods)){count=E.fuelWorkshops(rhythm,o.fuelGoods);suggested=count===best;}form.elements.fuelSuggested.checked=suggested;form.elements.fuelCount.value=String(Math.min(best,Math.max(0,count)));fuelFields();}
function eraFields(){
 const era=E.eraInfo({era:$('era').value}),has=id=>era.buildings.some(b=>b.id===id);
 if($('workshopFields').dataset.era!==era.id){
  const previous=Object.fromEntries([...$('workshopFields').querySelectorAll('input')].map(el=>[el.name,el.value]));
  $('workshopFields').innerHTML=era.current.map(id=>'<label class="number-label">'+escape(era.buildings.find(b=>b.id===id).name)+'<input name="'+id+'Count" type="number" min="0" max="20" value="'+(previous[id+'Count']??2)+'"></label>').join('')||'<p class="hint">W tej epoce nie ma jeszcze warsztatów na towary.</p>';
  $('workshopFields').dataset.era=era.id;
 }
 if($('armyFields').dataset.era!==era.id){
  const previous=Object.fromEntries([...$('armyFields').querySelectorAll('input')].map(el=>[el.name,el.value]));
  $('armyFields').innerHTML=era.mandatory.filter(id=>id.endsWith('Barracks')).map(id=>'<label class="number-label">'+escape(era.buildings.find(b=>b.id===id).name)+'<input name="'+id+'Min" type="number" min="0" max="100" step="1" value="'+(previous[id+'Min']??100)+'"> %</label>').join('');
  $('armyFields').dataset.era=era.id;
 }
 $('requiredBuildings').textContent='Zawsze: '+era.mandatory.map(id=>era.buildings.find(b=>b.id===id).name).join(', ')+'.';
 for(const el of form.querySelectorAll('[name=optional]')){el.disabled=!!worker||!has(el.value);if(!has(el.value))el.checked=false;el.parentElement.title=has(el.value)?'':'Dostępny w późniejszej epoce';}
 $('towerLevel').disabled=!!worker||!has('collectableMinoanWatchtowerV2');
 for(const id of ['sparkCap','goldCap']){const el=form.elements[id];if(!has('furnace')){if(!el.dataset.beforeEra)el.dataset.beforeEra=el.value;el.value=0;}else if(el.dataset.beforeEra){el.value=el.dataset.beforeEra;delete el.dataset.beforeEra;}el.disabled=!!worker||!has('furnace');}
 fuelFields();
 // Marek, 20.09.2026: the furnace limit and the exchange rates follow the era. His early-gothic numbers (7000 goods a day,
 // 181 food per good, 84000 coins per batch) are scaled by the era's furnace, farm and home output; a value the player
 // typed stays put, an untouched one follows the era.
 {const next=era.id,prev=form.dataset.rateEra;if(prev!==next){const before=prev?eraDefaults(prev):null,after=eraDefaults(next);for(const [id,v] of Object.entries(after)){const el=form.elements[id];if(!el||id==='sparkCap'&&!has('furnace'))continue;const cur=Number(el.value);if(!before||el.dataset.auto!=='0'&&(cur===before[id]||el.dataset.auto==='1')){el.value=String(v);el.dataset.auto='1';}}form.dataset.rateEra=next;}}
 $('eraHint').textContent=era.name+' · najwyższe poziomy budynków tej epoki. Limit pieca i kursy są przeliczone dla tej epoki; możesz je zmienić poniżej.';
}
function eraDefaults(eraId){const s=E.eraScale({era:eraId});return {sparkCap:Math.round(7000*s.furnace/100)*100,foodPerGood:Math.round(181*s.farm*100)/100,foodPerSpark:Math.round(181*70/95*s.farm*100)/100,goldPerBatch:Math.max(1,Math.round(84000*s.home/100)*100)};}
for(const id of ['sparkCap','foodPerGood','foodPerSpark','goldPerBatch'])form.elements[id]?.addEventListener('input',()=>{form.elements[id].dataset.auto='0';});
eraFields();
const towerLevels=HOH_DATA.buildings.find(b=>b.id==='collectableMinoanWatchtowerV2').levels;
for(const p of towerLevels){const option=document.createElement('option');option.value=p.level;option.textContent='Poziom '+p.level;$('towerLevel').append(option);}
{const none=document.createElement('option');none.value='0';none.textContent='Nie mam wieży';$('towerLevel').append(none);}
// Marek, 16.09.2026: everyone owns the tower and the fountain, so the form asks only for the level; "Nie mam" stays for the rare player without one.
function towerFields(){const select=$('towerLevel'),available=E.eraInfo({era:$('era').value}).buildings.some(b=>b.id==='collectableMinoanWatchtowerV2'),p=towerLevels.find(p=>p.level===Number(select.value));$('towerStats').textContent=!available?'Dostępna w późniejszej epoce.':p?fmt(p.points)+' szczęścia · zasięg '+p.range+' kratki · '+p.workers+' pracowników':select.value==='0'?'Miasto bez wieży.':'Wybierz poziom. Punkty szczęścia, zasięg i pracownicy zostaną pobrani z katalogu.';}
function fountainFields(){eraFields();towerFields();const era=E.eraInfo({era:$('era').value}),select=$('fountainLevel');if(select.dataset.era!==era.id){const level=select.value;select.innerHTML='<option value="">Wybierz poziom</option>'+era.fountainLevels.map(p=>'<option value="'+p.level+'">Poziom '+p.level+'</option>').join('')+'<option value="0">Nie mam fontanny</option>';select.value=level;select.dataset.era=era.id;}const on=Number(select.value)>0;select.disabled=!!worker;const p=on?era.fountainLevels.find(p=>p.level===Number(select.value)):null;for(const name of ['fountainPoints','fountainRange']){form.elements[name].value=p?.[name==='fountainPoints'?'points':'range']??'';form.elements[name].disabled=!on||!!worker;}$('fountainStats').textContent=p?fmt(p.points)+' szczęścia · zasięg '+p.range+' kratek · '+era.name:select.value==='0'?'Miasto bez fontanny.':'Wybierz poziom fontanny.';}
fountainFields();
try{const saved=JSON.parse(localStorage.getItem(key));if(saved){E.validateOptions({...saved,towerLevel:saved.towerLevel||1});tiles=saved.tiles;$('era').value=saved.era||'early-gothic';fountainFields();for(const id of numeric)if(Number.isFinite(saved[id]))form.elements[id].value=saved[id];form.elements.fountainLevel.value=saved.fountain?String(saved.fountainLevel||''):'0';form.elements.towerLevel.value=saved.optional?.includes('collectableMinoanWatchtowerV2')?String(saved.towerLevel||''):'0';for(const id of premiumIds)form.elements[id].value=saved.premium[id]||0;for(const id of ['fullArmy','subscription'])form.elements[id].checked=!!saved[id];for(const input of form.querySelectorAll('[name=optional]'))input.checked=saved.optional.includes(input.value);for(const id of E.currentFor(saved))form.elements[id+'Count'].value=saved.workshopCounts?.[id]??Math.ceil((saved.goodsTarget||2800)/1440);form.elements.compareSparks.checked=saved.compareSparks!==false;restoreArmyFarms(saved);if(saved.goalVersion!==4)form.elements.fullArmy.checked=true;restoreFuel(saved);}}catch{/* An invalid saved configuration never replaces validated defaults. */}
try{if(!JSON.parse(localStorage.getItem(key)||'null')?.searchBudgetVersion)form.elements.searchSeconds.value='600';}catch{}
fountainFields();
for(const [button,n] of [['twoEach',2],['threeEach',3]])$(button).onclick=()=>{for(const id of E.currentFor({era:$('era').value}))form.elements[id+'Count'].value=n;markDirty();};
function save(){if(globalThis.HOH_EDITOR?.active)return;try{const o={...(worker||result&&!dirty?activeOptions:options()),goalVersion:4};localStorage.setItem(key,JSON.stringify(o));localStorage.setItem(projectKey,JSON.stringify(E.projectFile(o,result&&!dirty?result.choices[chosen]:null)));}catch{$('status').textContent='Przeglądarka nie pozwala zapisać ustawień. Kreator nadal działa.';}}
function markDirty(){dirty=true;globalThis.HOH_EDITOR?.render();if(result){$('stale').hidden=false;$('download').hidden=true;}$('error').hidden=true;save();}
function renderLand(){const fragment=document.createDocumentFragment();tiles.forEach((on,i)=>{const button=document.createElement('button'),name=String.fromCharCode(65+Math.floor(i/10))+(i%10+1);button.type='button';button.textContent=name;button.setAttribute('aria-label','Miejsce '+name+', '+(on?'dostępne':'zablokowane'));button.setAttribute('aria-pressed',String(on));button.disabled=!!worker;button.onclick=()=>{tiles[i]=!tiles[i];renderLand();markDirty();$('land').children[i].focus();};fragment.append(button);});$('land').replaceChildren(fragment);const count=tiles.filter(Boolean).length;$('landCount').textContent=`${count} / 80 miejsc · ${count*16} kratek`;}
renderLand();
$('allLand').onclick=()=>{tiles.fill(true);renderLand();markDirty();};$('noLand').onclick=()=>{tiles.fill(false);renderLand();markDirty();};
form.addEventListener('input',()=>{fountainFields();markDirty();});
// Moving the slider means choosing your own number: the suggestion box unticks itself (element listener runs first).
form.elements.fuelCount.addEventListener('input',()=>{form.elements.fuelSuggested.checked=false;});
form.addEventListener('change',()=>{fountainFields();markDirty();});
$('editLand').onclick=()=>{$('land').hidden=false;$('map').hidden=true;$('mapTitle').textContent='Zaznacz dostępne miejsca';$('mapSubtitle').textContent='Zielone są dostępne. Szare pozostaną poza miastem.';$('land').scrollIntoView({block:'center',behavior:'smooth'});};
function busy(on){queueMicrotask(fuelFields);$('editBuildings').hidden=on||!result||dirty;for(const id of ['saveProject','loadProject','refreshProject'])$(id).disabled=on;for(const input of form.querySelectorAll('input,button,select'))input.disabled=on;$('allLand').disabled=on;$('noLand').disabled=on;$('cancel').disabled=false;$('cancel').hidden=!on;$('progress').hidden=!on;$('timer').hidden=!on||!worker;clearInterval(timerId);if(on&&worker){tickTimer();timerId=setInterval(tickTimer,1000);}if(!on)fountainFields();renderLand();}
function restoreSearchResult(){
 if(!result&&beforeSearch?.result){result=beforeSearch.result;activeOptions=beforeSearch.activeOptions;dirty=beforeSearch.dirty;chosen=beforeSearch.chosen;}
 if(result){showChoice(chosen);$('stale').hidden=!dirty;save();}
}
$('cancel').onclick=()=>{worker?.terminate();worker=null;if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null;}busy(false);restoreSearchResult();$('status').textContent=result?'Zatrzymano. Zachowano ostatni zapisany wynik. Szukaj dalej uruchomi kolejne próby od zapisanej mapy.':'Zatrzymano przed znalezieniem poprawnego miasta.';};
form.onsubmit=event=>{
 event.preventDefault();if(worker)return;if(!form.reportValidity())return;const o=options();try{E.validateOptions(o);}catch(err){showError(err.message);return;}
 const seedLayouts=[...(result?.choices||[]),...(result?.candidates||[])].map(c=>({list:c.list.map(({id,x,y,w,h})=>({id,x,y,w,h})),seed:c.seed,districtAttempts:c.districtAttempts}));
 beforeSearch={result,activeOptions,dirty,chosen};save();activeOptions=o;$('error').hidden=true;$('stale').hidden=true;result=null;
 for(const id of ['results','variants','download','editLand','map','legend'])$(id).hidden=true;$('land').hidden=false;$('inspector').textContent='Sprawdzam teren i porównuję rozmieszczenia…';$('progress').value=0;dirty=false;
 workerUrl=globalThis.HOH_WORKER_SOURCE?URL.createObjectURL(new Blob([globalThis.HOH_WORKER_SOURCE],{type:'text/javascript'})):null;worker=HOH_SEARCH_POOL(workerUrl||'worker.js');searchStartedAt=Date.now();busy(true);$('status').textContent='Szukam lepszego wyniku. Możesz zatrzymać i zachować znalezione miasto.';
 worker.onmessage=({data})=>{
  if(data.type==='progress'){
   if(data.checkpoint){result=presentedResult(data.checkpoint);chosen=result.choices.map((c,i)=>({i,c})).sort((a,b)=>E.rankChoices(a.c,b.c))[0].i;showChoice(chosen);save();$('projectStatus').textContent='Najlepszy znaleziony wynik zapisany podczas obliczeń.';}
   $('progress').max=data.total;$('progress').value=data.done;$('status').textContent='Szukam dalej: '+Math.round(data.done/data.total*100)+'%. Wynik jest zapisywany w trakcie pracy.';return;
  }
  worker.terminate();worker=null;if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null;}busy(false);
  if(data.type==='error'){restoreSearchResult();showError(data.message+(result?' Ostatni zapisany wynik został zachowany.':''));return;}
  result=presentedResult(data.result);chosen=0;showChoice(0);save();$('projectStatus').textContent='Wynik zapisany. Szukaj dalej rozpocznie kolejne próby od tej mapy.';
  const ready=result.choices.filter(c=>E.layoutQuality(c.list,c.options).complete).length;$('status').textContent=ready?`Zakończono bieżący czas szukania. ${ready} układów spełnia zasady rozmieszczenia. To nie jest dowód optimum.`:'Czas szukania minął. Zachowano układy robocze; warunki rozmieszczenia nie są jeszcze wszystkie spełnione.';
 };
 worker.onerror=()=>{worker.terminate();worker=null;if(workerUrl){URL.revokeObjectURL(workerUrl);workerUrl=null;}busy(false);restoreSearchResult();showError('Obliczenia przerwał błąd przeglądarki. '+(result?'Ostatni zapisany wynik jest zachowany.':''));};worker.postMessage({...o,seedLayouts,patterns:libraryPatterns(),startSeed:Math.floor(Math.random()*1000000)});
};
function showError(message){$('error').textContent=message;$('error').hidden=false;$('status').textContent=result?'Szukanie przerwane. Poprzedni wynik jest zachowany.':'Nie udało się znaleźć poprawnego układu.';$('inspector').textContent='Możesz zwiększyć dokładność szukania albo zmienić ustawienia. Wymagania nie zostały automatycznie obniżone.';}
function presentedResult(data){
 const candidates=data.candidates||data.choices,seen=new Set();
 const ranked=[...data.choices].sort(E.rankChoices);
 const choices=ranked.filter(c=>{
  const geometry=c.list.map(b=>[b.id,b.x,b.y,b.w,b.h].join(',')).sort().join(';');
  if(seen.has(geometry))return false;seen.add(geometry);return true;
 }).slice(0,5).map((c,i)=>({...c,title:`Układ ${i+1} · ${c.options?.requireFuel?'Z produkcją do pieca':'Twój cel'}`}));
 return {...data,candidates,choices,warnings:data.warnings?.length?['Nie wszystkie próby znalazły poprawny układ. Pokazujemy najlepsze dostępne wyniki.']:[]};
}
function alignmentLabel(a){if(!a)return '';const parts=[];if(a.symmetry)parts.push(['','wzorzec odbity w poziomie','wzorzec odbity w pionie','wzorzec obrócony o 180°','wzorzec odbity po przekątnej','wzorzec obrócony o 90°','wzorzec obrócony o 90°','wzorzec odbity po przekątnej'][a.symmetry]);if(a.shift&&(a.shift.x||a.shift.y))parts.push('wzorzec przesunięty o '+[a.shift.x?Math.abs(a.shift.x)+(a.shift.x>0?' w prawo':' w lewo'):'',a.shift.y?Math.abs(a.shift.y)+(a.shift.y>0?' w dół':' w górę'):''].filter(Boolean).join(' i '));if(a.fit<.995)parts.push(Math.round(a.fit*100)+'% wzorca w terenie');return parts.length?' ('+parts.join(', ')+')':'';}
function renderVariants(){
 $('variants').innerHTML=result.choices.map((c,i)=>'<button type="button" class="variant" aria-pressed="'+(i===chosen)+'" data-choice="'+i+'"><strong>'+escape(c.title||'Wczytany układ')+'</strong><span>'+compact(c.stats.equivalent.total)+' w przeliczeniu na jedzenie</span><small>'+c.list.filter(b=>b.kind==='farm').length+' farm · '+c.oldCount+' starych warsztatów'+(c.oldCount?' · '+fmt(c.stats.oldGoods||0)+' towarów do pieca dziennie':'')+'</small>'+(({inRows,producers,rows})=>'<small>W rzędach: '+inRows+' / '+producers+' farm i warsztatów · najdłuższy rząd '+(rows.runs[0]?.length||0)+'</small>')(E.layoutQuality(c.list,c.options))+'<small>Fontanna: '+fountainLabel(c.stats)+'</small></button>').join('');
 for(const b of $('variants').querySelectorAll('button'))b.disabled=!!worker;
 for(const b of $('variants').querySelectorAll('button'))b.onclick=()=>{showChoice(Number(b.dataset.choice));save();};$('variants').hidden=result.choices.length<2;
}
const svgColors={farm:'oklch(.91 .1 125)',home:'oklch(.91 .05 240)',workshop:'oklch(.94 .09 90)',barracks:'oklch(.91 .07 55)',happiness:'oklch(.90 .05 305)',special:'oklch(.89 .01 270)'};
const short={ruralFarm:'Wiejska',domesticFarm:'Domowa',premiumFarm:'Lux farma',smallHome:'Dom',averageHome:'Śr. dom',premiumHome:'Lux dom',cityHall:'Ratusz',furnace:'Piec',infantryBarracks:'Piechota',rangedBarracks:'Strzelcy',cavalryBarracks:'Kawaleria',heavyInfantryBarracks:'Ciężka p.',siegeBarracks:'Oblężnicze',heroAcademy:'Akademia',collectableSchoolV2:'Szkoła',collectableArchitectsStudioV2:'Liceum',collectableMinoanWatchtowerV2:'Wieża',fountain:'Fontanna'};
const mapTextContext=document.createElement('canvas').getContext('2d');
function fitMapLabel(label,width,size){
 mapTextContext.font=size+'px "Segoe UI", sans-serif';
 if(mapTextContext.measureText(label).width<=width)return label;
 const glyphs=Array.from(label);
 while(glyphs.length&&mapTextContext.measureText(glyphs.join('')+'…').width>width)glyphs.pop();
 return glyphs.join('')+'…';
}
function mapSvg(c){const S=22,stats=new Map(c.stats.details.map(x=>[x.id,x]));let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${E.W*S} ${E.H*S}" role="img" aria-label="Wygenerowany układ miasta"><title>Zenmar Strategy — układ miasta, ${escape(E.eraInfo(c.options).name)}</title><desc>${fmt(c.stats.food)} jedzenia i ${fmt(c.stats.sparks)} iskier na dobę. ${fmt(c.stats.used)} zajętych kratek. Produkcja ograniczona do 200 procent.</desc><rect width="880" height="704" fill="white"/>`;
for(let i=0;i<80;i++){const x=i%10*4*S,y=Math.floor(i/10)*4*S;svg+=`<rect x="${x}" y="${y}" width="${4*S}" height="${4*S}" fill="${activeOptions.tiles[i]?'oklch(.985 0 0)':'oklch(.88 0 0)'}" stroke="oklch(.7 0 0)" stroke-width=".6"/>`;}
const quality=E.layoutQuality(c.list,c.options),paired=new Set(quality.pairs.flat()),edged=new Set(quality.edges);
for(const b of c.list){const d=stats.get(b.uid),x=b.x*S,y=b.y*S,w=b.w*S,h=b.h*S,name=I18N.text(short[b.id]||b.name);const label=b.points&&b.kind==='happiness'?'◇':name;const text=fitMapLabel(label,w-8,b.w===1?10:11);
svg+=`<g class="building" data-uid="${b.uid}" tabindex="0" role="button" aria-label="${escape(b.name)}, poziom ${b.level}, ${b.w} na ${b.h} kratek${b.happyMax?', szczęście '+Math.round(d.fraction*100)+' procent':''}"><title>${escape(b.name)} · poz. ${b.level}\n${b.w} × ${b.h} · wiersz ${b.y+1}, kolumna ${b.x+1}${b.happyMax?'\nSzczęście otrzymane: '+fmt(d.raw)+' / '+fmt(b.happyMax)+' do 200% · nadmiar: '+fmt(d.excess):''}${paired.has(b.uid)?'\nSilnik: styka się z kulturą tego samego rodzaju (liczy się jako para).':''}${edged.has(b.uid)?'\nSilnik: źródło przy granicy terenu.':''}</title><rect x="${x+.5}" y="${y+.5}" width="${w-1}" height="${h-1}" rx="1" fill="${svgColors[b.kind]||svgColors.special}" stroke="${paired.has(b.uid)?'#b3261e':edged.has(b.uid)?'#b26a00':'oklch(.55 .02 130)'}" stroke-width="${paired.has(b.uid)||edged.has(b.uid)?2:.55}"${paired.has(b.uid)?' stroke-dasharray="4 2"':''}/><text x="${x+4}" y="${y+13}" font-family="Segoe UI, sans-serif" font-size="${b.w===1?10:11}" fill="oklch(.22 .01 130)">${escape(text)}</text>${h>=40?`<text x="${x+4}" y="${y+h-7}" font-family="Segoe UI, sans-serif" font-size="10" fill="oklch(.32 .01 130)">${b.level}${b.premium?' ◆':''}</text>`:''}${b.happyMax?(()=>{const bw=Math.max(11,w-8),bx=x+w-4-bw,over=d.excess/b.happyMax,layers=[[d.fraction,'oklch(.66 .15 305)'],[Math.min(1,over),'oklch(.36 .13 305)'],[Math.min(1,Math.max(0,over-1)),'#111']];return layers.map(([f,c],i)=>i&&f<=0?'':`<rect x="${bx}" y="${y+h-4-3*i}" width="${bw}" height="2" fill="white"/><rect x="${bx}" y="${y+h-4-3*i}" width="${bw*f}" height="2" fill="${c}"/>`).join('');})():''}</g>`;
}return I18N.svg(svg+'</svg>');}
function showChoice(i){chosen=i;const c=result.choices[i],s=c.stats;renderVariants();$('land').hidden=true;$('map').hidden=false;$('map').innerHTML=mapSvg(c);$('editLand').hidden=false;$('download').hidden=dirty;$('legend').hidden=false;$('results').hidden=false;$('mapTitle').textContent=E.layoutQuality(c.list,c.options).complete?'Układ spełniający zasady rozmieszczenia':'Układ roboczy — wymaga dalszego poprawienia';$('mapSubtitle').textContent=(c.schemeOrigin?.name?`Punkt startu: ${c.schemeOrigin.name}${alignmentLabel(c.schemeOrigin.alignment)}${c.schemeOrigin.placement?` · ułożenie ${c.schemeOrigin.placement.index+1}/${c.schemeOrigin.placement.of}`:''} · zachowanych budynków wzorca: ${c.schemeOrigin.kept}/${c.schemeOrigin.total}${c.schemeOrigin.swapped?` · farm zamienionych na warsztaty: ${c.schemeOrigin.swapped}`:''}${c.schemeOrigin.released?` · farm uwolnionych do przebudowy: ${c.schemeOrigin.released}`:''}. `:'')+'Kliknij budynek, aby zobaczyć jego szczegóły.';$('boardNote').textContent=`${activeOptions.tiles.filter(Boolean).length*16-s.used} wolnych kratek`;
const cityMetrics=E.cityMetrics(c),cultureTiles=cityMetrics.culture,specialCultureTiles=cityMetrics.specialCulture,landTiles=c.options.tiles.filter(Boolean).length*16;
HOH_CITY_SUMMARY.render(c);
 // Marek, 16.09.2026: the descriptive paragraphs are gone; only engine warnings remain here.
 $('comparison').textContent=(result.warnings||[]).join(' ');$('comparison').hidden=!$('comparison').textContent;
 $('layoutOrigin').textContent=c.manual?(s.armyDeficit>1e-5?'Koszary nie osiągają wymaganego szczęścia. ':'')+(c.options.requireFuel&&s.oldGoods+.01<c.options.sparkCap?'Zbiór starych towarów jest poniżej celu pieca. ':''):'';
 const before=c.comparisonStart,after=cityMetrics,changeRows=[['Łączna wartość w jedzeniu','total'],['Jedzenie / dobę','food'],['Towary przed przepaleniem / dobę','goods'],['Iskry z towarów / dobę','sparks'],['Złoto / dobę','gold'],['Iskry ze złota / dobę','goldSparks'],['Iskry łącznie / dobę','totalSparks'],['Kratki kultury','culture'],['Kratki fontanny i wieży','specialCulture'],['Farmy','farms'],['Domy','homes'],['Pracownicy potrzebni','needed'],['Pracownicy dostępni','available'],['Wolne kratki','free']];
 $('searchChange').innerHTML=before?'<h2>Efekt tego szukania</h2><p class="hint">Ten sam teren, parametry budynków i rytm zbiorów.'+(before.requirementsMet===false?' Układ początkowy nie spełniał wszystkich wymagań produkcji lub szczęścia koszar.':'')+'</p><table><thead><tr><th>Wskaźnik</th><th>Przed</th><th>Teraz</th><th>Zmiana</th></tr></thead><tbody>'+changeRows.map(([label,key])=>'<tr><td>'+label+'</td><td>'+fmt(before[key])+'</td><td>'+fmt(after[key])+'</td><td>'+(Math.round(after[key]-before[key])>0?'+':'')+fmt(after[key]-before[key])+'</td></tr>').join('')+'</tbody></table>':'';
 const owned=c.options.ownedFarms;if(owned&&(owned.ruralFarm||owned.domesticFarm))$('layoutOrigin').textContent+=' Farmy w układzie: '+cityMetrics.ruralFarms+' wiejskich (masz '+owned.ruralFarm+'), '+cityMetrics.domesticFarms+' domowych (masz '+owned.domesticFarm+') · do przebudowy: '+cityMetrics.farmRebuild+'.';$('layoutOrigin').hidden=!$('layoutOrigin').textContent.trim();
 const rows=[['Jedzenie',c=>c.stats.food,c=>c.stats.equivalent.food],...E.currentFor(activeOptions).map(id=>[result.cat[id].name,c=>c.stats.byType[id]||0,c=>(c.stats.byType[id]||0)*activeOptions.foodPerGood]),['Pozostałe stare towary',c=>c.stats.oldGoods-c.stats.equivalent.spent,c=>(c.stats.oldGoods-c.stats.equivalent.spent)*activeOptions.foodPerGood],['Iskry z towarów',c=>c.stats.sparks,c=>c.stats.equivalent.sparks],['Iskry ze złota (po wymianie)',c=>c.stats.equivalent.goldSparks,c=>c.stats.equivalent.gold]];
 $('valueTable').innerHTML='<table><caption>Zbiór dobowy przy Twoim rytmie. Suma obejmuje iskry z towarów i złota, według podanych limitów wymiany.</caption><thead><tr><th>Składnik</th>'+result.choices.map(c=>'<th colspan="2">'+escape(c.title||'Zapisany układ')+'</th>').join('')+'</tr><tr><th></th>'+result.choices.map(()=>'<th>Ilość</th><th>Wartość w jedzeniu</th>').join('')+'</tr></thead><tbody>'+rows.map(([label,amount,val])=>'<tr><td>'+label+'</td>'+result.choices.map(c=>'<td>'+fmt(amount(c))+'</td><td>'+fmt(val(c))+'</td>').join('')+'</tr>').join('')+'<tr><td>Łączna wartość</td>'+result.choices.map(c=>'<td></td><td>'+fmt(c.stats.equivalent.total)+'</td>').join('')+'</tr></tbody></table>';
 const counts=new Map();for(const b of c.list){const k=b.id;if(!counts.has(k))counts.set(k,{b,n:0});counts.get(k).n++;}$('buildingList').innerHTML=[...counts.values()].sort((a,b)=>a.b.name.localeCompare(b.b.name,I18N.locale)).map(({b,n})=>`<tr><td>${escape(b.name)}${b.premium?' ◆':''}${b.oldWorkshop?' · na iskry':''}</td><td>${b.level}</td><td>${n}</td><td>${n*b.w*b.h}</td></tr>`).join('');
const fountain=c.list.find(b=>b.id==='fountain');
$('inspector').textContent=(fountain?`Fontanna obejmuje ${fountainLabel(s)}. `:'')+`${s.buildings} budynków · nadmiar szczęścia: ${fmt(s.excess)} pkt · ${s.full} z ${s.happyCount} budynków ma pełne szczęście. Kliknij dowolny obiekt na mapie.`;
for(const g of $('map').querySelectorAll('[data-uid]')){const inspect=()=>{globalThis.HOH_EDITOR?.select(Number(g.dataset.uid));$('map').querySelector('.range-overlay')?.remove();const b=c.list.find(b=>b.uid===Number(g.dataset.uid)),d=s.details.find(d=>d.id===b.uid);$('inspector').innerHTML=`<strong>${escape(b.name)} · poziom ${b.level}</strong><br>Kolumna ${b.x+1}, wiersz ${b.y+1} · ${b.w} × ${b.h} kratek · ${b.workers?b.workers+' pracowników zapewnia':b.needs+' pracowników potrzebuje'}${!b.happyMax&&!b.points?' · Nie korzysta ze szczęścia.':''}${b.points?' · '+fmt(b.points)+' szczęścia, zasięg '+b.range+(()=>{const r=E.sourceReach(c.list).find(r=>r.uid===b.uid);return r?' · odbiorców w zasięgu: '+r.recipients+(r.target?', cel: '+r.target:'')+', z niedoborem: '+r.hungry:'';})():''}${b.happyMax?' · produkcja '+Math.round((b.kind==='barracks'?1+d.fraction:(b.rewards[0]?E.hourly(b,d.happy,b.rewards[0].resource)/E.hourly(b,0,b.rewards[0].resource):1+d.fraction))*100)+'% · otrzymane szczęście '+fmt(d.raw)+' pkt · do 200% potrzeba '+fmt(b.happyMax)+' pkt'+(d.excess?' · nadmiar '+fmt(d.excess)+' pkt (bez dalszego bonusu)':''):''}${d.food?' · '+fmt(d.food)+' jedzenia / dobę':''}${d.goods?' · '+fmt(d.goods)+' towarów / dobę':''}${(()=>{const q=E.layoutQuality(c.list,c.options);return (q.pairs.some(p=>p.includes(b.uid))?' · Silnik: styka się z kulturą tego samego rodzaju (liczy się jako para).':'')+(q.edges.includes(b.uid)?' · Silnik: źródło przy granicy terenu.':'');})()}`;if(b.points){const x=Math.max(0,b.x-b.range),y=Math.max(0,b.y-b.range),right=Math.min(E.W,b.x+b.w+b.range),bottom=Math.min(E.H,b.y+b.h+b.range);$('map').querySelector('svg').insertAdjacentHTML('beforeend',`<rect class="range-overlay" x="${x*22}" y="${y*22}" width="${(right-x)*22}" height="${(bottom-y)*22}" fill="none" stroke="#663399" stroke-width="2" stroke-dasharray="6 3" pointer-events="none"/>`);}};g.onclick=inspect;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect();}};}globalThis.HOH_EDITOR?.render();}
$('download').onclick=()=>{if(!result||dirty)return;if(globalThis.HOH_EDITOR?.active){$('editStatus').textContent='Zastosuj zmiany przed zapisem mapy SVG.';return;}const blob=new Blob([mapSvg(result.choices[chosen])],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zenmar-miasto-'+(activeOptions.era||'early-gothic')+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};



function applyProject(loaded){
 const o=E.normalized({...loaded.options,engineMode:'portfolio'});o.searchSeconds??=60;if(loaded.result){const items=loaded.result.choices[0].list;o.oldCount=items.filter(b=>b.oldWorkshop).length;o.workshopCounts=Object.fromEntries(E.currentFor(o).map(id=>[id,items.filter(b=>b.id===id).length]));}$('era').value=o.era||'early-gothic';fountainFields();for(const id of E.currentFor(o))form.elements[id+'Count'].value=o.workshopCounts[id];form.elements.compareSparks.checked=o.compareSparks;tiles=[...o.tiles];for(const id of numeric)form.elements[id].value=o[id]??'';form.elements.fountainLevel.value=o.fountain?String(o.fountainLevel||''):'0';form.elements.towerLevel.value=o.optional?.includes('collectableMinoanWatchtowerV2')?String(o.towerLevel||''):'0';for(const id of premiumIds)form.elements[id].value=o.premium[id];for(const id of ['fullArmy','subscription'])form.elements[id].checked=!!o[id];for(const el of form.querySelectorAll('[name=optional]'))el.checked=o.optional.includes(el.value);
 fountainFields();restoreFuel(o);restoreArmyFarms(o);renderLand();result=loaded.result?presentedResult(loaded.result):null;activeOptions=o;dirty=false;chosen=0;$('error').hidden=true;$('stale').hidden=true;
 if(result)showChoice(0);else{for(const id of ['map','results','variants','download','editLand','legend'])$(id).hidden=true;$('land').hidden=false;$('mapTitle').textContent='Zaznacz dostępne miejsca';$('inspector').textContent='Wczytano ustawienia. Kliknij Szukaj dalej, aby ułożyć miasto.';}
}
function downloadFile(contents,name,type){const url=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('saveProject').onclick=()=>{if(!form.reportValidity())return;try{const file=E.projectFile(result&&!dirty?activeOptions:options(),result&&!dirty?result.choices[chosen]:null);downloadFile(JSON.stringify(file,null,2),'furia-miasto.json','application/json');save();$('projectStatus').textContent=file.layout?'Pobrano projekt: ustawienia i mapa.':'Pobrano ustawienia. Przelicz wynik, aby zapisać również aktualną mapę.';}catch(e){$('projectStatus').textContent=e.message;}};
$('loadProject').onclick=()=>$('projectInput').click();
$('projectInput').onchange=async()=>{const file=$('projectInput').files[0];if(!file)return;try{if(file.size>2e6)throw Error('Plik jest zbyt duży (maksymalnie 2 MB).');const loaded=E.readProject(HOH_DATA.buildings,JSON.parse(await file.text()));applyProject(loaded);save();$('projectStatus').textContent=loaded.result?'Wczytano ustawienia i mapę.':'Wczytano ustawienia.';}catch(e){$('projectStatus').textContent='Nie wczytano projektu: '+e.message;}finally{$('projectInput').value='';}};
// Library of player layouts: built-in entries from patterns.js plus files added on this device.
// Marek, 16.09.2026: the library is built in; layouts are added by upgrading the tool, not in the browser.
function libraryPatterns(){return (globalThis.HOH_PATTERNS||[]).map(({id,name,source,era,tiles,layout})=>({id,name,source,era,tiles,layout}));}
$('refreshProject').onclick=()=>{if(form.reportValidity()){$('projectStatus').textContent='Przeliczam miasto…';form.requestSubmit();}};
try{const file=JSON.parse(localStorage.getItem(projectKey));if(file){applyProject(E.readProject(HOH_DATA.buildings,file));$('projectStatus').textContent=result?'Przywrócono ostatnią mapę i ustawienia.':'Przywrócono ustawienia.';}}catch{$('projectStatus').textContent='Ostatniej mapy nie udało się przywrócić. Ustawienia są dostępne; przelicz wynik ponownie.';}

if(activeOptions&&activeOptions.goalVersion!==4){form.elements.fullArmy.checked=true;markDirty();$('projectStatus').textContent='Wersja 8: następne obliczenie wymaga pełnego szczęścia koszar. Kliknij Szukaj dalej.';}

if(activeOptions&&!activeOptions.searchBudgetVersion){form.elements.searchSeconds.value='600';activeOptions.searchSeconds=600;activeOptions.searchBudgetVersion=1;save();}

window.addEventListener('zenmar-language',()=>{
  fountainFields();renderLand();
  if(result)showChoice(chosen);
  I18N.translate(document.documentElement);
});
