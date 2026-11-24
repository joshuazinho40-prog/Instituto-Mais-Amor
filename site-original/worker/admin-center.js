// Shared administration center. Existing D1 records remain in their original tables.
const uuidPattern=/^[a-f0-9-]{36}$/;
const adminTypes=['parcerias','voluntariado','acolhimento','contato','pessoa'];
const cleanText=(value,max,min=0)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max;
const validContact=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||/^\+?[\d\s()\-]{10,25}$/.test(value);
const dateValid=value=>value===''||(typeof value==='string'&&/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value);
const recordUnion=`SELECT id,tipo AS categoria,nome AS titulo,situacao,contato AS detalhe,criado_em,atualizado_em,substr(criado_em,1,10) AS data_ref FROM cadastros
 UNION ALL SELECT id,'projeto',titulo,situacao,COALESCE(resumo,''),criado_em,atualizado_em,COALESCE(data_inicio,substr(criado_em,1,10)) FROM projetos_gestao
 UNION ALL SELECT id,'operacao',descricao_tipo,'realizado',CAST(quantidade AS TEXT)||' · '||tipo,criado_em,atualizado_em,data_ocorrencia FROM registros_operacionais
 UNION ALL SELECT id,'acao',titulo,CASE WHEN publicada=1 THEN 'publicado' ELSE 'rascunho' END,resumo,criado_em,atualizado_em,data_realizacao FROM acoes`;
async function auditStatement(env,req,action,id,now){return env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),action,id,now);}
async function publicCenter(req,env,path){
 if(path==='/api/projetos'&&req.method==='GET'){await ensurePublicProjects(env);return json({items:(await env.DB.prepare('SELECT id,titulo,resumo,descricao,objetivos,situacao,data_inicio,data_fim,capa,capa_alt FROM projetos_publicos WHERE publicada=1 ORDER BY ordem,criado_em,id').all()).results.map(r=>({...r,objetivos:JSON.parse(r.objetivos)}))});}
 if(path==='/api/documentos'&&['GET','HEAD'].includes(req.method))return json({error:'Documentação disponível apenas na área administrativa.'},403);
 if(path.startsWith('/api/anexos/')){
  if(!admin(req))return json({error:'Arquivo não encontrado.'},404);
  if(!['GET','HEAD'].includes(req.method))return json({error:'Método não permitido.'},405);
  const id=path.split('/').pop();if(!uuidPattern.test(id))return json({error:'Arquivo não encontrado.'},404);
  const row=await env.DB.prepare('SELECT * FROM anexos WHERE id=?').bind(id).first();
  if(!row)return json({error:'Arquivo não encontrado.'},404);
  if(!env.BUCKET)return json({error:'Armazenamento temporariamente indisponível.'},503);
  const object=await env.BUCKET.get(row.chave);if(!object)return json({error:'Arquivo não encontrado.'},404);
  const download=new URL(req.url).searchParams.get('download')==='1';
  return new Response(req.method==='HEAD'?null:object.body,{headers:{...safeHeaders,'Content-Type':row.mime,'Content-Length':String(row.tamanho),'Content-Disposition':(download?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(row.nome),'X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; sandbox"}});
 }
}
async function adminCenter(req,env,path,url){
 if(path==='/api/admin/central'&&req.method==='GET'){
  const category=(url.searchParams.get('tipo')||'').slice(0,30),search=(url.searchParams.get('busca')||'').slice(0,100),state=(url.searchParams.get('situacao')||'').slice(0,30),page=Math.max(1,Math.min(10000,Math.floor(Number(url.searchParams.get('pagina'))||1)));
  const where=' WHERE (? = \'\' OR categoria=?) AND (? = \'\' OR situacao=?) AND (? = \'\' OR titulo LIKE ? OR detalhe LIKE ?)';const args=[category,category,state,state,search,'%'+search+'%','%'+search+'%'];
  const rows=await env.DB.prepare('SELECT * FROM ('+recordUnion+')'+where+' ORDER BY atualizado_em DESC,id LIMIT 30 OFFSET ?').bind(...args,(page-1)*30).all();
  const total=await env.DB.prepare('SELECT count(*) AS total FROM ('+recordUnion+')'+where).bind(...args).first();
  return json({items:rows.results,total:total.total,pagina:page});
 }
 // Full records are available only after the server's administrative authorization.
 if(path==='/api/admin/cadastros-detalhados'&&req.method==='GET'){
  const category=(url.searchParams.get('tipo')||'').slice(0,30),search=(url.searchParams.get('busca')||'').slice(0,100),state=(url.searchParams.get('situacao')||'').slice(0,30),page=Math.max(1,Math.min(10000,Math.floor(Number(url.searchParams.get('pagina'))||1))),pageSize=50;
  const where=' WHERE (? = \'\' OR categoria=?) AND (? = \'\' OR situacao=?) AND (? = \'\' OR titulo LIKE ? OR detalhe LIKE ?)';const args=[category,category,state,state,search,'%'+search+'%','%'+search+'%'];
  const selected=await env.DB.prepare('SELECT id,categoria FROM ('+recordUnion+')'+where+' ORDER BY atualizado_em DESC,id LIMIT ? OFFSET ?').bind(...args,pageSize,(page-1)*pageSize).all();
  const total=await env.DB.prepare('SELECT count(*) AS total FROM ('+recordUnion+')'+where).bind(...args).first();
  const tables={};for(const row of selected.results){const table=adminTypes.includes(row.categoria)?'cadastros':({projeto:'projetos_gestao',operacao:'registros_operacionais',acao:'acoes'})[row.categoria];if(!tables[table])tables[table]=[];tables[table].push(row.id);}
  const full=new Map();await Promise.all(Object.entries(tables).map(async([table,ids])=>{
   const placeholders=ids.map(()=>'?').join(',');
   const sql=table==='registros_operacionais'?'SELECT r.*,c.nome AS cadastro_nome FROM registros_operacionais r LEFT JOIN cadastros c ON c.id=r.cadastro_id WHERE r.id IN ('+placeholders+')':'SELECT * FROM '+table+' WHERE id IN ('+placeholders+')';
   const rows=await env.DB.prepare(sql).bind(...ids).all();for(const row of rows.results)full.set(table+':'+row.id,row);
  }));
  const items=selected.results.flatMap(row=>{const table=adminTypes.includes(row.categoria)?'cadastros':({projeto:'projetos_gestao',operacao:'registros_operacionais',acao:'acoes'})[row.categoria],record=full.get(table+':'+row.id);return record?[{...record,categoria:row.categoria}]:[];});
  return json({items,total:total.total,pagina:page,por_pagina:pageSize});
 }
 if(path==='/api/admin/registro'&&req.method==='GET'){
  const id=url.searchParams.get('id'),category=url.searchParams.get('tipo');const table=adminTypes.includes(category)?'cadastros':({projeto:'projetos_gestao',operacao:'registros_operacionais',acao:'acoes',anexo:'anexos'})[category];
  if(!table||!uuidPattern.test(id||''))return json({error:'Registro inválido.'},400);
  const row=await env.DB.prepare(table==='registros_operacionais'?'SELECT r.*,c.nome AS cadastro_nome FROM registros_operacionais r LEFT JOIN cadastros c ON c.id=r.cadastro_id WHERE r.id=?':'SELECT * FROM '+table+' WHERE id=?').bind(id).first();if(!row)return json({error:'Registro não encontrado.'},404);
  if(table==='cadastros'&&row.tipo!==category)return json({error:'Tipo de cadastro diferente do informado.'},400);
  if(table==='anexos'){delete row.chave;row.publico=0;}return json({item:row});
 }
 if(path==='/api/admin/atividade'&&req.method==='GET')return json({items:(await env.DB.prepare('SELECT acao,registro_id,criado_em FROM auditoria ORDER BY criado_em DESC LIMIT 8').all()).results,totais:(await env.DB.prepare('SELECT categoria,count(*) AS total FROM ('+recordUnion+') GROUP BY categoria').all()).results});
 if(path==='/api/admin/publicacoes'&&req.method==='GET'){
  const rows=await env.DB.prepare(`SELECT id,'acao' AS categoria,titulo,publicada AS publicado,atualizado_em FROM acoes
   UNION ALL SELECT periodo,'resultado','Resultados de '||periodo,1,atualizado_em FROM impacto_publicacoes
   ORDER BY atualizado_em DESC LIMIT 200`).all();return json({items:rows.results});
 }
 if(path==='/api/admin/entries'&&req.method==='POST'){
  const raw=await req.text();if(raw.length>8000)return json({error:'Dados muito longos.'},413);const b=JSON.parse(raw);
  if(!adminTypes.includes(b.tipo)||!cleanText(b.nome,100,2)||!cleanText(b.contato,150)||!(b.tipo==='pessoa'&&b.contato==='')&&!validContact(b.contato)||!cleanText(b.organizacao,150)||!cleanText(b.mensagem,600)||b.ciente!==true||(b.id&&!uuidPattern.test(b.id))||(b.situacao!==undefined&&!STATES.includes(b.situacao))||(b.notas!==undefined&&!cleanText(b.notas,2000)))return json({error:'Confira nome, contato, tipo e autorização para o registro.'},400);
  const now=new Date().toISOString(),id=b.id||crypto.randomUUID();
  if(b.id){const old=await env.DB.prepare('SELECT id FROM cadastros WHERE id=?').bind(id).first();if(!old)return json({error:'Cadastro não encontrado.'},404);
   await env.DB.batch([env.DB.prepare('UPDATE cadastros SET tipo=?,nome=?,contato=?,organizacao=?,mensagem=?,situacao=?,notas=?,atualizado_em=? WHERE id=?').bind(b.tipo,b.nome.trim(),b.contato.trim(),b.organizacao.trim(),b.mensagem.trim(),b.situacao||'novo',b.notas||'',now,id),await auditStatement(env,req,'atualizar_cadastro',id,now)]);
  }else await env.DB.batch([env.DB.prepare("INSERT INTO cadastros(id,tipo,nome,contato,organizacao,mensagem,situacao,notas,privacidade_versao,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(id,b.tipo,b.nome.trim(),b.contato.trim(),b.organizacao.trim(),b.mensagem.trim(),b.situacao||'novo',b.notas||'','cadastro-administrativo-2026-11',now,now),await auditStatement(env,req,'cadastrar_'+b.tipo,id,now)]);
  return json({ok:true,id},b.id?200:201);
 }
 if(path==='/api/admin/projetos'&&req.method==='GET')return json({items:(await env.DB.prepare('SELECT * FROM projetos_gestao ORDER BY atualizado_em DESC LIMIT 200').all()).results});
 if(path==='/api/admin/projetos'&&req.method==='POST'){
  const raw=await req.text();if(raw.length>8000)return json({error:'Texto muito longo.'},413);const b=JSON.parse(raw);
  const old=b.id?await env.DB.prepare('SELECT id,resumo,publicado FROM projetos_gestao WHERE id=?').bind(b.id).first():null;
  const summary=b.resumo??old?.resumo??'',published=b.publicado??!!old?.publicado;
  if(!cleanText(b.titulo,150,3)||!['planejamento','em_andamento','concluido'].includes(b.situacao)||!cleanText(b.notas,2000)||!dateValid(b.data_inicio)||!dateValid(b.data_fim)||(b.data_inicio&&b.data_fim&&b.data_fim<b.data_inicio)||(b.situacao==='concluido'&&(!b.data_fim||b.data_fim>new Date().toISOString().slice(0,10)))||(b.id&&!uuidPattern.test(b.id))||!cleanText(summary,1000,published?10:0)||typeof published!=='boolean')return json({error:'Confira nome, situação, resumo e datas. Um projeto concluído precisa da data de conclusão.'},400);
  const id=b.id||crypto.randomUUID(),now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO projetos_gestao(id,titulo,situacao,data_inicio,data_fim,notas,criado_em,atualizado_em,resumo,publicado) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET titulo=excluded.titulo,situacao=excluded.situacao,data_inicio=excluded.data_inicio,data_fim=excluded.data_fim,notas=excluded.notas,atualizado_em=excluded.atualizado_em,resumo=excluded.resumo,publicado=excluded.publicado').bind(id,b.titulo.trim(),b.situacao,b.data_inicio||null,b.data_fim||null,b.notas.trim(),now,now,summary.trim(),published?1:0),await auditStatement(env,req,'atualizar_projeto',id,now)]);return json({ok:true,id});
 }
 if(path==='/api/admin/anexos'&&req.method==='GET')return json({items:(await env.DB.prepare('SELECT id,titulo,descricao,nome,mime,tamanho,0 AS publico,criado_em,atualizado_em FROM anexos ORDER BY atualizado_em DESC LIMIT 200').all()).results});
 if(path==='/api/admin/anexos'&&req.method==='POST'){
  if(!env.BUCKET)return json({error:'O armazenamento de arquivos ainda não está disponível.'},503);
  if(Number(req.headers.get('content-length'))>6*1024*1024)return json({error:'O arquivo deve ter no máximo 5 MB.'},413);
  const reader=req.body?.getReader();if(!reader)return json({error:'Escolha um arquivo.'},400);const chunks=[];let length=0;while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>6*1024*1024){await reader.cancel();return json({error:'O arquivo deve ter no máximo 5 MB.'},413);}chunks.push(part.value);}const uploadBytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){uploadBytes.set(chunk,offset);offset+=chunk.byteLength;}const form=await new Response(uploadBytes,{headers:{'Content-Type':req.headers.get('Content-Type')||''}}).formData(),file=form.get('arquivo'),title=form.get('titulo'),description=form.get('descricao')||'',visible=form.get('publico')==='true';
  if(visible)return json({error:'Documentos internos não podem ser publicados. Salve o arquivo como privado.'},400);
  if(!file||typeof file.arrayBuffer!=='function'||file.size===0||file.size>5*1024*1024||!cleanText(title,150,3)||!cleanText(description,600))return json({error:'Escolha um PDF, PNG, JPG ou WebP de até 5 MB e informe o título.'},400);
  const bytes=new Uint8Array(await file.arrayBuffer());let mime,extension;
  if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10){mime='image/png';extension='png';}
  else if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff){mime='image/jpeg';extension='jpg';}
  else if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'){mime='application/pdf';extension='pdf';}
  else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){mime='image/webp';extension='webp';}
  else return json({error:'Formato não permitido. Use PDF, PNG, JPG ou WebP.'},400);
  const id=crypto.randomUUID(),key='anexos/'+id+'.'+extension,now=new Date().toISOString(),name=String(file.name||'arquivo').replace(/[\u0000-\u001f/\\]/g,'_').replace(/\.[^.]*$/,'').slice(0,170)+'.'+extension;
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{await env.DB.batch([env.DB.prepare('INSERT INTO anexos(id,titulo,descricao,nome,mime,tamanho,chave,publico,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,title.trim(),description.trim(),name,mime,bytes.length,key,visible?1:0,now,now),await auditStatement(env,req,visible?'publicar_anexo':'anexar_arquivo',id,now)]);}catch(error){await env.BUCKET.delete(key);throw error;}
  return json({ok:true,id},201);
 }
 if(path==='/api/admin/anexos/atualizar'&&req.method==='POST'){
  const raw=await req.text();if(raw.length>4000)return json({error:'Texto muito longo.'},413);const b=JSON.parse(raw);
  if(b.publico!==false)return json({error:'Documentos internos devem permanecer privados.'},400);
  if(!uuidPattern.test(b.id||'')||!cleanText(b.titulo,150,3)||!cleanText(b.descricao,600))return json({error:'Confira título e descrição.'},400);
  const old=await env.DB.prepare('SELECT id FROM anexos WHERE id=?').bind(b.id).first();if(!old)return json({error:'Arquivo não encontrado.'},404);
  const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('UPDATE anexos SET titulo=?,descricao=?,publico=?,atualizado_em=? WHERE id=?').bind(b.titulo.trim(),b.descricao.trim(),b.publico?1:0,now,b.id),await auditStatement(env,req,b.publico?'publicar_anexo':'guardar_anexo_privado',b.id,now)]);return json({ok:true,id:b.id});
 }
}
