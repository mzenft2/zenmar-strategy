'use strict';
globalThis.HOH_EDITOR=(()=>{
 let editing=false,selected=null,original=null,history=[],future=[],drag=null,suppressTrayClick=false;
 const choice=()=>result?.choices[chosen];
 function message(text){$('editStatus').textContent=text;}
 function lock(){
  form.inert=editing;
  for(const id of ['saveProject','loadProject','refreshProject','editLand'])$(id).disabled=editing||!!worker;
  for(const b of $('variants').querySelectorAll('button'))b.disabled=editing||!!worker;
 }
 function select(uid){selected=uid;$('map').querySelector('.placement-preview')?.remove();renderSelection();}
 function renderSelection(){
  const c=choice(),b=c?.list.find(b=>b.uid===selected)||c?.parked?.find(b=>b.uid===selected);
  for(const button of $('parkedBuildings').querySelectorAll('[data-uid]'))button.setAttribute('aria-pressed',String(Number(button.dataset.uid)===selected));
  for(const g of $('map').querySelectorAll('[data-uid]'))g.classList.toggle('selected-building',Number(g.dataset.uid)===selected);
  $('editSelected').textContent=b?b.name+' · '+b.w+' × '+b.h:'Wybierz budynek na mapie lub z odłożonych.';
  if(b){$('editX').value=b.x+1;$('editY').value=b.y+1;}
  for(const id of ['moveBuilding','rotateBuilding','parkBuilding'])$(id).disabled=!b;
  if(b){$('parkBuilding').disabled=!!c.parked?.includes(b);$('rotateBuilding').disabled=b.w===b.h;}
 }
 function render(){
  $('editBuildings').hidden=!result||!!worker||editing;$('editBuildings').disabled=dirty;$('editBuildings').title=dirty?'Ustawienia zmieniły się od tego wyniku: najpierw „Szukaj dalej”.':'';
  $('editor').hidden=!editing;$('map').classList.toggle('editing',editing);lock();
  if(!editing)return;
  const c=choice(),s=c.stats;
  $('undoEdit').disabled=!history.length;$('redoEdit').disabled=!future.length;
  $('applyEdit').disabled=!!c.parked?.length;
  $('parkedBuildings').replaceChildren();
  for(const b of c.parked||[]){const button=document.createElement('button');button.type='button';button.textContent=b.name+' · '+b.w+' × '+b.h;button.dataset.uid=b.uid;button.onclick=e=>{if(suppressTrayClick&&e.detail){suppressTrayClick=false;return;}select(b.uid);message('Kliknij wolną kratkę mapy, aby ustawić lewy górny róg budynku. Możesz też przeciągnąć go z tego miejsca. Esc przerywa ustawianie; kliknięcie innego budynku wybiera go.');};$('parkedBuildings').append(button);}
  if(!c.parked?.length)$('parkedBuildings').textContent='Przeciągnij tutaj budynek albo wybierz go i kliknij Odłóż na bok.';
  const delta=s.equivalent.total-original.stats.equivalent.total;
  $('editDelta').textContent='Zmiana wartości / dobę: '+(delta>=0?'+':'−')+fmt(Math.abs(delta))+' w jedzeniu · nadmiar szczęścia: '+fmt(s.excess)+' pkt';
  const warnings=[];
  if(c.parked?.length)warnings.push('Odłożone: '+c.parked.length+'. Nie produkują i nie dają szczęścia ani pracowników. Ustaw je przed zastosowaniem zmian.');
  if(s.spare<0)warnings.push('Brakuje '+(-s.spare)+' pracowników.');
  if(s.armyDeficit>1e-5)warnings.push('Koszary nie osiągają wymaganego szczęścia.');
  if(c.options.requireFuel&&s.oldGoods+.01<c.options.sparkCap)warnings.push('Zbiór starych towarów nie wystarcza na pełny limit pieca.');
  $('editWarnings').textContent=warnings.join(' ');
  // Palette of era buildings the player may add by hand; everything else comes from the settings.
  $('buildingPalette').replaceChildren(...['ruralFarm','domesticFarm','smallHome','averageHome','littleCulture','compactCulture','moderateCulture'].filter(id=>result.cat[id]).map(id=>{const b=result.cat[id],button=document.createElement('button');button.type='button';button.textContent='+ '+b.name+' '+b.w+'×'+b.h;button.onclick=()=>move({type:'add',id});return button;}));
  renderSelection();
 }
 function repaint(){showChoice(chosen);render();$('map').querySelector(`[data-uid="${selected}"]`)?.onclick?.();}
 function move(op){
  if(!editing)return;
  try{const current=choice(),next=E.editLayout(current,result.cat,op);history.push(current);future=[];result.choices[chosen]=next;if(op.type==='park'||op.type==='remove')selected=null;if(next.added)selected=next.added;repaint();message(op.type==='park'?'Budynek odłożony na bok: jest wymagany przez ustawienia, więc nie znika. Ustaw go ponownie przed zastosowaniem zmian.':op.type==='remove'?'Budynek usunięty. Ctrl+Z przywraca.':op.type==='add'||op.type==='duplicate'?'Nowy budynek czeka w odłożonych. Kliknij wolne miejsce na mapie albo przeciągnij go tam.':'Przeliczono produkcję, szczęście i pracowników.');}
  catch(e){message(e.message);}
 }
 function removeOrPark(){const c=choice(),b=c?.list.find(b=>b.uid===selected)||c?.parked?.find(b=>b.uid===selected);if(!b)return;move({type:E.freelyEditable(b)?'remove':'park',uid:selected});}
 function end(apply){
  if(apply){const c=choice();if(c.parked?.length){message('Ustaw wszystkie odłożone budynki.');return;}const error=E.validate(c.list,E.manualOptions(c.options),result.cat);if(error){message(error);return;}}
  else result.choices[chosen]=original;
  editing=false;history=[];future=[];selected=null;repaint();save();
  $('projectStatus').textContent=apply?'Zapisano ręczne ustawienie miasta na tym urządzeniu.':'Przywrócono układ sprzed edycji.';
 }
 $('editBuildings').onclick=()=>{if(!choice()||dirty||worker)return;original=choice();history=[];future=[];selected=null;editing=true;render();message('Przeciągnij budynek lub wybierz go i podaj kolumnę oraz wiersz.');};
 $('applyEdit').onclick=()=>end(true);$('cancelEdit').onclick=()=>end(false);
 $('undoEdit').onclick=()=>{if(history.length){future.push(choice());result.choices[chosen]=history.pop();selected=null;repaint();message('Cofnięto ruch.');}};
 $('redoEdit').onclick=()=>{if(future.length){history.push(choice());result.choices[chosen]=future.pop();selected=null;repaint();message('Ponowiono ruch.');}};
 $('moveBuilding').onclick=()=>move({type:'move',uid:selected,x:Number($('editX').value)-1,y:Number($('editY').value)-1});
 $('rotateBuilding').onclick=()=>move({type:'rotate',uid:selected});
 $('parkBuilding').onclick=()=>move({type:'park',uid:selected});
 function coordinates(e){const svg=$('map').querySelector('svg');return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
 function preview(e){
  const svg=$('map').querySelector('svg');svg?.querySelector('.placement-preview')?.remove();
  const b=choice()?.parked?.find(b=>b.uid===selected);if(!editing||!b||!svg)return;
  const p=coordinates(e),x=Math.floor(p.x/22),y=Math.floor(p.y/22),g=E.mask(choice().options.tiles);
  for(const t of choice().list)for(let yy=t.y;yy<t.y+t.h;yy++)for(let xx=t.x;xx<t.x+t.w;xx++)g[yy*E.W+xx]=1;
  const valid=E.fits(g,x,y,b.w,b.h);
  svg.insertAdjacentHTML('beforeend',`<rect class="placement-preview" x="${x*22}" y="${y*22}" width="${b.w*22}" height="${b.h*22}" fill="${valid?'#347b35':'#ad3434'}" opacity=".4" pointer-events="none"/>`);
 }
 function onMap(e){const r=$('map').querySelector('svg').getBoundingClientRect();return e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom;}
 $('map').addEventListener('pointerdown',e=>{
  if(!editing||e.button!==0)return;
  const g=e.target.closest('[data-uid]'),parked=choice().parked?.find(b=>b.uid===selected);
  if(parked&&!g){const p=coordinates(e);move({type:'move',uid:selected,x:Math.floor(p.x/22),y:Math.floor(p.y/22)});e.preventDefault();return;}
  if(!g){select(null);return;}
  select(Number(g.dataset.uid));g.onclick?.();const b=choice().list.find(b=>b.uid===selected),p=coordinates(e);
  drag={uid:selected,g,start:p,x:b.x,y:b.y,moved:false,pointer:e.pointerId};$('map').setPointerCapture(e.pointerId);e.preventDefault();
 });
 $('parkedBuildings').addEventListener('pointerdown',e=>{
  if(!editing||e.button!==0)return;const button=e.target.closest('[data-uid]');if(!button)return;
  suppressTrayClick=false;select(Number(button.dataset.uid));drag={uid:selected,parked:true,start:coordinates(e),pointer:e.pointerId,moved:false};button.setPointerCapture(e.pointerId);
 });
 document.addEventListener('pointermove',e=>{
  if(editing&&onMap(e))preview(e);else $('map').querySelector('.placement-preview')?.remove();
  if(!drag)return;const p=coordinates(e),dx=Math.round((p.x-drag.start.x)/22),dy=Math.round((p.y-drag.start.y)/22);
  drag.dx=dx;drag.dy=dy;drag.moved=drag.moved||dx!==0||dy!==0;
  $('parkingTray').classList.toggle('drop-ready',!drag.parked&&!onMap(e));
  if(drag.g){drag.g.setAttribute('transform',`translate(${dx*22} ${dy*22})`);drag.g.style.opacity='.65';}
 });
 const drop=e=>{
  if(!drag)return;const d=drag;drag=null;if(d.parked&&(d.moved||e.type!=='pointerup'))suppressTrayClick=true;d.g?.removeAttribute('transform');if(d.g)d.g.style.opacity='';$('parkingTray').classList.remove('drop-ready');
  if($('map').hasPointerCapture(d.pointer))$('map').releasePointerCapture(d.pointer);
  if(e.type!=='pointerup'){select(null);return;}if(!d.moved)return;
  if(!onMap(e)){if(!d.parked)move({type:'park',uid:d.uid});else{select(null);message('Budynek pozostaje w odłożonych.');}return;}
  const p=coordinates(e);move({type:'move',uid:d.uid,x:d.parked?Math.floor(p.x/22):d.x+(d.dx||0),y:d.parked?Math.floor(p.y/22):d.y+(d.dy||0)});
 };
 document.addEventListener('pointerup',drop);document.addEventListener('pointercancel',drop);
 // Keyboard, Forge style: arrows move, R or a double click rotates, D copies, Delete removes (or parks a required building), Ctrl+Z / Ctrl+Y undo and redo.
 document.addEventListener('keydown',e=>{
  if(!editing)return;
  if(e.key==='Escape'){e.preventDefault();drop({type:'pointercancel'});select(null);message('Przerwano ustawianie. Odłożone budynki pozostają na boku.');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?$('redoEdit'):$('undoEdit')).click();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();$('redoEdit').click();return;}
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.matches?.('input,select,textarea'))return;
  const g=e.target.closest?.('[data-uid]');if(g)select(Number(g.dataset.uid));
  if(selected==null)return;
  const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},focusSelected=()=>$('map').querySelector(`[data-uid="${selected}"]`)?.focus();
  if(dirs[e.key]){const b=choice().list.find(b=>b.uid===selected);if(!b)return;e.preventDefault();const [dx,dy]=dirs[e.key];move({type:'move',uid:selected,x:b.x+dx,y:b.y+dy});focusSelected();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();removeOrPark();}
  else if(e.key.toLowerCase()==='r'){e.preventDefault();move({type:'rotate',uid:selected});focusSelected();}
  else if(e.key.toLowerCase()==='d'){e.preventDefault();move({type:'duplicate',uid:selected});}
 });
 $('map').addEventListener('dblclick',e=>{if(!editing)return;const g=e.target.closest('[data-uid]');if(!g)return;select(Number(g.dataset.uid));move({type:'rotate',uid:selected});});
 window.addEventListener('beforeunload',e=>{if(editing&&history.length){e.preventDefault();e.returnValue='';}});
 render();return {render,select,get active(){return editing;}};
})();
