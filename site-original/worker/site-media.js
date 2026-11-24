// The MP4 is streamed directly into R2. It is never buffered in Worker memory.
const HERO_VIDEO_LIMIT=100*1024*1024;
// The presentation belongs to this exact upload. A later upload takes precedence.
const HERO_VIDEO_HORIZONTAL=/*HORIZONTAL_VIDEO*/null;
const heroHorizontalAsset=row=>HERO_VIDEO_HORIZONTAL&&row?.atualizado_em===HERO_VIDEO_HORIZONTAL.origem_atualizado_em&&typeof assets!=='undefined'?assets[HERO_VIDEO_HORIZONTAL.arquivo]:null;
const heroMediaRow=env=>env.DB.prepare("SELECT id,object_key,nome,mime,tamanho,atualizado_em FROM site_media WHERE id='hero-video'").first();
function heroMediaDescriptor(row){const horizontal=heroHorizontalAsset(row);return row?{configurado:true,url:(horizontal?'/media/chamada-horizontal.mp4':'/media/chamada.mp4')+'?v='+encodeURIComponent(row.atualizado_em),nome:horizontal?'Apresentação do Instituto — horizontal.mp4':row.nome,mime:row.mime,tamanho:horizontal?HERO_VIDEO_HORIZONTAL.tamanho:row.tamanho,atualizado_em:row.atualizado_em,legendas:null,adaptado_horizontal:!!horizontal}:{configurado:false,url:null,limite_bytes:HERO_VIDEO_LIMIT};}
function heroRange(value,total){
 if(!value)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(value.trim());if(!match||(!match[1]&&!match[2]))return false;
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return false;start=Math.max(0,total-suffix);end=total-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):total-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=total||end<start)return false;end=Math.min(end,total-1);}
 return{offset:start,length:end-start+1,end};
}
async function handleMediaPublic(req,env,path){
 if(HERO_VIDEO_HORIZONTAL&&path===HERO_VIDEO_HORIZONTAL.arquivo)return json({error:'Arquivo não encontrado.'},404);
 if(path==='/api/midia/chamada'&&req.method==='GET')return json(heroMediaDescriptor(await heroMediaRow(env)));
 if(['/media/chamada.mp4','/media/chamada-horizontal.mp4'].includes(path)&&['GET','HEAD'].includes(req.method)){
  const row=await heroMediaRow(env);if(!row)return json({error:'Vídeo de apresentação ainda não configurado.'},404);
  if(path==='/media/chamada-horizontal.mp4'){
   const asset=heroHorizontalAsset(row);if(!asset)return json({error:'Esta versão de apresentação não está disponível.'},404);
   const total=HERO_VIDEO_HORIZONTAL.tamanho,etag='"horizontal-'+row.atualizado_em+'"',requested=req.headers.get('If-Range')&&req.headers.get('If-Range')!==etag?null:req.headers.get('Range'),range=heroRange(requested,total);
   const headers={...safeHeaders,'Content-Type':'video/mp4','Accept-Ranges':'bytes','ETag':etag,'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; media-src 'self'; sandbox"};
   if(range===false)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+total}});
   headers['Content-Length']=String(range?range.length:total);if(range)headers['Content-Range']='bytes '+range.offset+'-'+range.end+'/'+total;
   if(req.method==='HEAD')return new Response(null,{status:range?206:200,headers});
   const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));return new Response(range?bytes.subarray(range.offset,range.offset+range.length):bytes,{status:range?206:200,headers});
  }
  if(!env.BUCKET)return json({error:'Armazenamento de vídeo temporariamente indisponível.'},503);
  const etag='"'+row.object_key.split('/').pop()+'"';const requestedRange=req.headers.get('If-Range')&&req.headers.get('If-Range')!==etag?null:req.headers.get('Range');const range=heroRange(requestedRange,row.tamanho);
  const headers={...safeHeaders,'Content-Type':'video/mp4','Accept-Ranges':'bytes','ETag':etag,'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; media-src 'self'; sandbox"};
  if(range===false)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+row.tamanho}});
  const object=await env.BUCKET.get(row.object_key,range?{range:{offset:range.offset,length:range.length}}:undefined);if(!object)return json({error:'Vídeo não encontrado no armazenamento.'},404);
  headers['Content-Length']=String(range?range.length:row.tamanho);if(range)headers['Content-Range']='bytes '+range.offset+'-'+range.end+'/'+row.tamanho;
  if(req.method==='HEAD'){try{await object.body?.cancel?.();}catch{}return new Response(null,{status:range?206:200,headers});}
  return new Response(object.body,{status:range?206:200,headers});
 }
}
async function handleMediaAdmin(req,env,path){
 if(path==='/api/admin/midia/chamada'&&req.method==='GET')return json({...heroMediaDescriptor(await heroMediaRow(env)),limite_bytes:HERO_VIDEO_LIMIT,armazenamento_disponivel:!!env.BUCKET});
 if(path==='/api/admin/midia/chamada'&&req.method==='PUT'){
  if(!env.BUCKET)return json({error:'O armazenamento de vídeo ainda não está disponível.'},503);
  const mime=(req.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();if(mime!=='video/mp4')return json({error:'Escolha um arquivo MP4. Outros formatos precisam ser convertidos antes do envio.'},415);
  const lengthHeader=req.headers.get('Content-Length');const length=Number(lengthHeader);if(!lengthHeader||!Number.isSafeInteger(length)||length<12)return json({error:'Não foi possível confirmar o tamanho do vídeo. Envie um arquivo MP4 pelo seletor do painel.'},411);
  if(length>HERO_VIDEO_LIMIT)return json({error:'O vídeo deve ter no máximo 100 MB. Exporte uma versão otimizada antes de enviar.'},413);
  if(!req.body)return json({error:'Escolha um arquivo de vídeo.'},400);
  let name;try{name=decodeURIComponent(req.headers.get('X-File-Name')||'video-chamada.mp4').replace(/[\u0000-\u001f/\\]/g,'_').trim().slice(0,180);}catch{return json({error:'Nome de arquivo inválido.'},400);}
  if(!name.toLowerCase().endsWith('.mp4'))return json({error:'O nome do arquivo deve terminar em .mp4.'},400);
  const previous=await heroMediaRow(env),key='site-media/hero-'+crypto.randomUUID()+'.mp4',now=new Date().toISOString();let stored;
  try{stored=await env.BUCKET.put(key,req.body,{httpMetadata:{contentType:'video/mp4'}});}catch{return json({error:'Não foi possível concluir o envio. O vídeo anterior continua configurado.'},503);}
  if(typeof stored?.size==='number'&&stored.size!==length){await env.BUCKET.delete(key);return json({error:'O envio foi incompleto. Tente novamente; o vídeo anterior foi preservado.'},400);}
  try{await env.DB.batch([env.DB.prepare("INSERT INTO site_media(id,object_key,nome,mime,tamanho,atualizado_em) VALUES('hero-video',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET object_key=excluded.object_key,nome=excluded.nome,mime=excluded.mime,tamanho=excluded.tamanho,atualizado_em=excluded.atualizado_em").bind(key,name,'video/mp4',length,now),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'publicar_video_chamada','hero-video',now)]);}catch(error){await env.BUCKET.delete(key);throw error;}
  if(previous?.object_key&&previous.object_key!==key){try{await env.BUCKET.delete(previous.object_key);}catch{/* Cleanup failure does not invalidate the published replacement. */}}
  return json({ok:true,...heroMediaDescriptor({nome:name,mime:'video/mp4',tamanho:length,atualizado_em:now})});
 }
}
