import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const shared=`const safeHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...safeHeaders,'Content-Type':'application/json'}});`;
const horizontal=JSON.parse(readFileSync('video-horizontal.json','utf8')),horizontalBytes=readFileSync('dist'+horizontal.arquivo);
const source=shared+'const assets='+JSON.stringify({[horizontal.arquivo]:{data:horizontalBytes.toString('base64')}})+';'+readFileSync('worker/site-media.js','utf8').replace('/*HORIZONTAL_VIDEO*/null',JSON.stringify(horizontal))+'\nexport {handleMediaPublic,handleMediaAdmin};';
const {handleMediaPublic,handleMediaAdmin}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0008_site_media.sql','utf8'));db.exec('CREATE TABLE auditoria(id TEXT PRIMARY KEY,ator TEXT,acao TEXT,registro_id TEXT,criado_em TEXT)');
class Q{constructor(sql){this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return db.prepare(this.sql).get(...this.args)||null;}async run(){return{meta:{changes:db.prepare(this.sql).run(...this.args).changes}};}}
const objects=new Map();let failDB=false;
const env={DB:{prepare:sql=>new Q(sql),async batch(queries){if(failDB)throw Error('simulated failure');db.exec('BEGIN');try{const results=[];for(const q of queries)results.push(await q.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}},BUCKET:{async put(key,body){const bytes=new Uint8Array(await new Response(body).arrayBuffer());objects.set(key,bytes);return{size:bytes.byteLength};},async get(key,options){let bytes=objects.get(key);if(!bytes)return null;if(options?.range)bytes=bytes.slice(options.range.offset,options.range.offset+options.range.length);return{body:new Response(bytes).body};},async delete(key){objects.delete(key);}}};
const base='https://video.test';
const publicCall=(path='/api/midia/chamada',headers={},method='GET')=>handleMediaPublic(new Request(base+path,{headers,method}),env,path.split('?')[0]);
const upload=(body,headers={})=>handleMediaAdmin(new Request(base+'/api/admin/midia/chamada',{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(body.length),'X-File-Name':encodeURIComponent('Vídeo do Instituto.mp4'),'oai-authenticated-user-id':'owner',...headers},body}),env,'/api/admin/midia/chamada');
let descriptor=await (await publicCall()).json();assert.equal(descriptor.configurado,false);assert.equal((await publicCall('/media/chamada.mp4')).status,404);
const clip=Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109]);
assert.equal((await upload(clip,{'Content-Type':'text/html'})).status,415);assert.equal((await upload(clip,{'Content-Length':String(100*1024*1024+1)})).status,413);assert.equal((await upload(clip,{'Content-Length':''})).status,411);assert.equal(objects.size,0);
const saved=await (await upload(clip)).json();assert.equal(saved.ok,true);assert.equal(objects.size,1);descriptor=await (await publicCall()).json();assert.equal(descriptor.configurado,true);assert.equal(descriptor.tamanho,clip.length);assert.equal(descriptor.legendas,null);assert.ok(descriptor.url.startsWith('/media/chamada.mp4?v='));
const full=await publicCall('/media/chamada.mp4');assert.equal(full.status,200);assert.equal(full.headers.get('content-length'),String(clip.length));assert.equal(full.headers.get('accept-ranges'),'bytes');assert.equal(full.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await full.arrayBuffer()),clip);
let partial=await publicCall('/media/chamada.mp4',{Range:'bytes=4-7'});assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 4-7/20');assert.deepEqual(Buffer.from(await partial.arrayBuffer()),clip.subarray(4,8));
partial=await publicCall('/media/chamada.mp4',{Range:'bytes=-4'});assert.equal(partial.status,206);assert.deepEqual(Buffer.from(await partial.arrayBuffer()),clip.subarray(16));
partial=await publicCall('/media/chamada.mp4',{Range:'bytes=10-999'});assert.equal(partial.headers.get('content-range'),'bytes 10-19/20');assert.equal((await partial.arrayBuffer()).byteLength,10);
for(const Range of ['bytes=100-','bytes=0-1,4-5','bytes=-0','bytes=10-5','bad']){const invalid=await publicCall('/media/chamada.mp4',{Range});assert.equal(invalid.status,416);assert.equal(invalid.headers.get('content-range'),'bytes */20');}
const head=await publicCall('/media/chamada.mp4',{},'HEAD');assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
const ifRange=await publicCall('/media/chamada.mp4',{Range:'bytes=1-2','If-Range':'"different"'});assert.equal(ifRange.status,200);
const oldKey=db.prepare('SELECT object_key FROM site_media').get().object_key;failDB=true;await assert.rejects(()=>upload(clip));failDB=false;assert.equal(objects.size,1);assert.ok(objects.has(oldKey));assert.equal(db.prepare('SELECT object_key FROM site_media').get().object_key,oldKey);
const replacement=Buffer.concat([clip,Buffer.from([1,2,3])]);const replaced=await upload(replacement);assert.equal(replaced.status,200);assert.equal(objects.size,1);assert.ok(!objects.has(oldKey));assert.equal((await (await publicCall()).json()).tamanho,replacement.length);
assert.equal(db.prepare('SELECT count(*) AS n FROM auditoria').get().n,2);
console.log('PASS media: fallback state, type/size validation, streamed R2 replacement, full/HEAD/range/suffix/416 responses, If-Range fallback, database failure cleanup and preservation of previous video. Test media remained in memory.');

// The horizontal rendition keeps byte-range playback and never masks a later upload.
db.prepare('UPDATE site_media SET atualizado_em=?').run(horizontal.origem_atualizado_em);
const adapted=await (await publicCall()).json();assert.equal(adapted.adaptado_horizontal,true);assert.ok(adapted.url.startsWith('/media/chamada-horizontal.mp4'));assert.equal(adapted.tamanho,horizontalBytes.length);
const horizontalHead=await publicCall('/media/chamada-horizontal.mp4',{},'HEAD');assert.equal(horizontalHead.status,200);assert.equal(horizontalHead.headers.get('content-length'),String(horizontalBytes.length));assert.equal((await horizontalHead.arrayBuffer()).byteLength,0);
const horizontalRange=await publicCall('/media/chamada-horizontal.mp4',{Range:'bytes=0-31'});assert.equal(horizontalRange.status,206);assert.deepEqual(Buffer.from(await horizontalRange.arrayBuffer()),horizontalBytes.subarray(0,32));
assert.equal((await publicCall('/media/chamada-horizontal.mp4',{Range:'bytes='+horizontalBytes.length+'-'})).status,416);
db.prepare('UPDATE site_media SET atualizado_em=?').run('2099-01-01T12:00:00.000Z');assert.equal((await (await publicCall()).json()).adaptado_horizontal,false);assert.equal((await publicCall('/media/chamada-horizontal.mp4')).status,404);
console.log('PASS horizontal video: exact-upload rendition, MP4 byte ranges and HEAD, invalid ranges, and automatic precedence of later uploads.');
