import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../dist/server/index.js';
// Local QA only. Loopback, disposable database and storage; never deployed.
const db=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
class Query{constructor(sql){this.sql=sql;this.values=[];}bind(...values){this.values=values;return this;}async first(){return db.prepare(this.sql).get(...this.values)||null;}async all(){return {results:db.prepare(this.sql).all(...this.values)};}async run(){return {meta:{changes:Number(db.prepare(this.sql).run(...this.values).changes)}};}}
const files=new Map();
const previewPortArg=process.argv.indexOf('--port');
const previewPort=Number(previewPortArg>=0?process.argv[previewPortArg+1]:process.env.PORT||8765);
const env={DB:{prepare:s=>new Query(s),async batch(qs){db.exec('BEGIN');try{const results=[];for(const q of qs)results.push(await q.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async put(key,bytes,metadata){files.set(key,{body:bytes,...metadata});},async get(key){return files.get(key)||null;},async head(key){return files.get(key)||null;},async delete(key){files.delete(key);}}};
http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview');headers.set('oai-authenticated-user-email',(process.env.MAIS_AMOR_ADMIN_EMAIL||'admin@example.test').trim().toLowerCase());
 try{const response=await worker.fetch(new Request('http://127.0.0.1:'+previewPort+req.url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error');}
}).listen(previewPort,'127.0.0.1',()=>console.log('Local preview http://127.0.0.1:'+previewPort+' · disposable database and images · local administrator simulation'));
