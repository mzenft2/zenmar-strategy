importScripts('data.js','engine.js');
onmessage=async({data})=>{try{const result=await HOH_ENGINE.generate(HOH_DATA.buildings,data,(done,total,checkpoint)=>postMessage({type:'progress',done,total,checkpoint}));postMessage({type:'result',result});}catch(error){postMessage({type:'error',message:error.message});}};
