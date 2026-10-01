import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const allowed=new Set(['index.html','app.js','editor.js','search-pool.js','engine.js','worker.js','data.js','style.css','translations.js','i18n.js','support.js','README.md','SOURCES.md','LICENSE','NOTICE.md','OPTIMIZATION.md']);
allowed.add('city-summary.js');allowed.add('patterns.js');allowed.add('city-summary.css');
http.createServer(async(req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}try{const data=await readFile(path.join(root,name));res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'})[name.split('.').pop()]||'text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('HoH: http://127.0.0.1:4173'));
