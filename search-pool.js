/* Independent local workers share results only with the display, never with
 * another fresh constructor. The caller retains the ordinary Worker API. */
(function(root){
'use strict';
function searchPool(url,createWorker=source=>new Worker(source),cores=navigator.hardwareConcurrency||2){
 let stopped=false,active=0,next=0,finished=0,jobs=[],latest=new Map(),failures=[],started=0;
 const pool={onmessage:null,onerror:null,terminate(){stopped=true;for(const j of jobs)j.worker?.terminate();},postMessage(input){
  const E=root.HOH_ENGINE,names={edge:'Od brzegu: domy, kultura i farmy',horizontal:'Rzędy poziome od zera',vertical:'Rzędy pionowe od zera',shelves:'Plan półek: rzędy i kanały z liczb',fresh:'Swobodny start od zera',continued:'Poprawianie zapisanej mapy',polish:'Szlifowanie najlepszego układu'};
  const concepts=[['fresh',input.referenceSchemes?'reference-schemes':'frontiers'],['edge','edge-bands'],['horizontal','rows-horizontal'],['vertical','rows-vertical'],['shelves','shelves']];
  const polish=!!input.seedLayouts?.length;
  if(polish)concepts.push(['continued','frontiers']);
  if(input.referenceSchemes)names.fresh='Schematy graczy i ich ulepszanie';
  // 8.54: every concept gets its own thread when the device has the cores (Marek's 20 threads ran 4 and every
 // concept got half the time); a small device still shares its cores minus one between the concepts.
 // Marek, 16.09.2026: polishing runs beside the fresh search for the whole time the player agreed to,
  // in its own slot; the remaining concepts share the other slots as before. No second button.
  const total=(input.searchSeconds||60)*1000,slots=Math.min(concepts.length+(polish?1:0),Math.max(1,cores-1)),shared=polish&&slots>1?slots-1:slots;
  const budget=total/Math.ceil(concepts.length/shared);
  jobs=concepts.map(([id,mode],i)=>({id,mode,name:names[id],fraction:0,worker:null,input:{...input,engineMode:mode,workerBudgetMs:budget,startSeed:(input.startSeed||0)+i*1009,seedLayouts:id==='continued'?input.seedLayouts:[]}}));
  if(polish)jobs.unshift({id:'polish',mode:'polish',name:names.polish,fraction:0,worker:null,input:{...input,engineMode:'polish',workerBudgetMs:slots>1?total:budget,startSeed:(input.startSeed||0)+7919,seedLayouts:input.seedLayouts}});
  started=Date.now();
  // Recalculate the user's valid incumbent immediately, so early checkpoints
  // and cancellation cannot replace it with a worse newly constructed city.
  const {seedLayouts:seedData,startSeed,workerBudgetMs,...settings}=input;
  const cat=E.prepare(root.HOH_DATA.buildings,settings),incumbents=[];
  for(const seed of input.seedLayouts||[]){
   if(!Array.isArray(seed.list))continue;
   const list=seed.list.map((b,i)=>cat[b.id]?{...cat[b.id],x:b.x,y:b.y,w:b.w,h:b.h,uid:i+1}:null);
   if(list.some(b=>!b))continue;
   const options=E.normalized({...settings,enforceLayout:true});
   if(E.validate(list,options,cat))continue;
   const stats=E.evaluate(list,options);stats.equivalent=E.equivalent(stats,options);
   incumbents.push({list,stats,options,oldCount:options.oldCount,seed:seed.seed||1,engine:'incumbent',title:'Zapisana mapa · przeliczona dla tych ustawień',quality:E.layoutQuality(list,options)});
  }
  if(incumbents.length)latest.set('incumbent',{choices:incumbents,cat,tried:0,benchmarks:[],warnings:[]});
  function combined(){
   const values=[...latest.values()],choices=values.flatMap(r=>r.choices||[]);
   choices.sort(E.rankChoices);
   return {choices,cat,tried:values.reduce((n,r)=>n+(r.tried||0),0),benchmarks:jobs.flatMap(j=>latest.get(j.id)?.benchmarks?.length?latest.get(j.id).benchmarks:[{plan:'Oba warianty według ustawień',name:j.name,engine:j.id,found:false,pending:!j.finished,elapsedMs:j.finished?j.elapsedMs:Date.now()-(j.started||Date.now()),error:j.error}]),warnings:[...new Set(values.flatMap(r=>r.warnings||[]).concat(failures))],balanced:false,frontier:choices.length,searchVersion:10,parallel:{workers:slots,concepts:jobs.length,elapsedMs:Date.now()-started}};
  }
  function emit(final=false){if(stopped)return;const result=combined();pool.onmessage?.({data:final?(result.choices.length?{type:'result',result}:{type:'error',message:failures.join(' ')||'Żadna koncepcja nie znalazła poprawnego miasta.'}):{type:'progress',done:jobs.reduce((n,j)=>n+j.fraction,0),total:jobs.length,checkpoint:result.choices.length?result:undefined,concepts:jobs.map(j=>({name:j.name,done:j.finished,progress:Math.round(j.fraction*100)}))}});}
  function launch(){
   while(!stopped&&active<slots&&next<jobs.length){
    const job=jobs[next++];active++;job.started=Date.now();
    let ended=false;
    function end(error){if(ended||stopped)return;ended=true;job.worker?.terminate();job.finished=true;job.fraction=1;job.elapsedMs=Date.now()-job.started;if(error){job.error=error;failures.push(job.name+': '+error);}active--;finished++;if(finished===jobs.length)emit(true);else{emit();launch();}}
    try{
     job.worker=createWorker(url);
     job.worker.onmessage=({data})=>{if(stopped||ended)return;
      if(data.checkpoint||data.result){const r=data.checkpoint||data.result;latest.set(job.id,{...r,choices:r.choices.map(c=>({...c,engine:job.id,title:(c.title||'').split(' · ')[0]+' · '+job.name})),benchmarks:(r.benchmarks||[]).map(b=>({...b,engine:job.id,name:job.name}))});}
      if(data.type==='result')end();else if(data.type==='error')end(data.message);else{job.fraction=Math.min(1,data.done/Math.max(1,data.total));emit();}
     };
     job.worker.onerror=()=>end('Błąd procesu obliczeń. Pozostałe koncepcje działają dalej.');
     job.worker.postMessage(job.input);
    }catch(error){end(error.message);}
   }
  }
  emit();launch();
 }};return pool;
}
root.HOH_SEARCH_POOL=searchPool;
})(globalThis);
