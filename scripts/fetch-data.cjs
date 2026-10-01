// Public Forge of Games catalogue. Schema: Ingweland/forge-of-games, Models.Hoh.
const fs=require('fs');
(async()=>{const url='https://forgeofgames.com/api/hoh/coreData';const response=await fetch(url);if(!response.ok)throw Error('Catalogue HTTP '+response.status);const body=await response.json();if(!body.version||!body.data)throw Error('Incomplete catalogue');fs.mkdirSync('research',{recursive:true});fs.writeFileSync('research/fog-coreData.json',JSON.stringify(body));console.log('Downloaded catalogue '+body.version);})().catch(e=>{console.error(e.message);process.exitCode=1;});
