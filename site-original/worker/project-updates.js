// Project news uses the existing action records, so a report is counted once.
const updateDate = () => new Date(Date.now()-10800000).toISOString().slice(0,10);
const updateId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
async function updatePhotos(env,id){return (await env.DB.prepare('SELECT caminho,descricao,legenda,ordem FROM acoes_fotos WHERE acao_id=? ORDER BY ordem,caminho').bind(id).all()).results;}
async function updateRow(env,row){return {...row,publicada:!!row.publicada,fotos_autorizadas:!!row.fotos_autorizadas,fotos:await updatePhotos(env,row.id)};}
async function handleProjectUpdates(req,env,path,url){
 if(!path.startsWith('/api/admin/atualizacoes'))return null;
 try{
  if(path==='/api/admin/atualizacoes/foto'&&req.method==='POST')return projectAdminApi(req,env,'/api/admin/projetos-site/capa');
  if(path==='/api/admin/atualizacoes/excluir'){
   if(req.method!=='POST')return json({error:'Método não permitido.'},405);
   const b=JSON.parse(new TextDecoder().decode(await boundedProjectBody(req,2000)));
   if(!b||typeof b.id!=='string'||!updateId.test(b.id)||b.confirmacao!==b.id||!Number.isSafeInteger(b.versao)||b.versao<1)return json({error:'Confirme o relato selecionado para excluir.'},400);
   const old=await env.DB.prepare('SELECT id,data_realizacao FROM acoes WHERE id=?').bind(b.id).first();
   if(!old)return json({error:'Este relato não foi encontrado. Atualize a lista de ações.'},404);
   const auditId=crypto.randomUUID(),now=new Date().toISOString();
   // All removals share the same version guard inside one transaction. A stale
   // editor cannot remove a newer report or its photos, nor leave a false audit.
   const result=await env.DB.batch([
    env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM acoes WHERE id=? AND versao=?)').bind(auditId,req.headers.get('oai-authenticated-user-id'),'excluir_acao',b.id,now,b.id,b.versao),
    env.DB.prepare('DELETE FROM acoes_fotos WHERE acao_id=? AND EXISTS(SELECT 1 FROM auditoria WHERE id=?)').bind(b.id,auditId),
    env.DB.prepare('DELETE FROM acoes WHERE id=? AND versao=? AND EXISTS(SELECT 1 FROM auditoria WHERE id=?)').bind(b.id,b.versao,auditId)
   ]);
   if(!result[2].meta.changes)return json({error:'Este relato foi alterado em outra edição. Feche e reabra o relato antes de excluir.'},409);
   return json({ok:true,id:b.id,periodo:old.data_realizacao.slice(0,7)});
  }
  if(path!=='/api/admin/atualizacoes')return json({error:'Recurso não encontrado.'},404);
  if(req.method==='GET'){
   const id=url.searchParams.get('id');
   if(id){if(!updateId.test(id))return json({error:'Ação não encontrada.'},404);const row=await env.DB.prepare('SELECT a.*,p.titulo AS projeto_titulo,p.publicada AS projeto_publicado FROM acoes a LEFT JOIN projetos_publicos p ON p.id=a.projeto_publico_id WHERE a.id=?').bind(id).first();return row?json({item:await updateRow(env,row)}):json({error:'Ação não encontrada.'},404);}
   const project=url.searchParams.get('projeto')||'',state=url.searchParams.get('situacao')||'',q=(url.searchParams.get('busca')||'').slice(0,150),page=Math.max(1,Math.min(10000,parseInt(url.searchParams.get('pagina'),10)||1));
   if(project&&!PROJECT_ID.test(project)||!['','publicado','rascunho'].includes(state))return json({error:'Filtro inválido.'},400);
   const where=" WHERE (?='' OR a.projeto_publico_id=?) AND (?='' OR a.publicada=?) AND (?='' OR a.titulo LIKE ?)",args=[project,project,state,state==='publicado'?1:0,q,'%'+q+'%'];
   const result=await env.DB.prepare('SELECT a.*,p.titulo AS projeto_titulo,p.publicada AS projeto_publicado FROM acoes a LEFT JOIN projetos_publicos p ON p.id=a.projeto_publico_id'+where+' ORDER BY a.data_realizacao DESC,a.criado_em DESC,a.id DESC LIMIT 20 OFFSET ?').bind(...args,(page-1)*20).all();
   const count=await env.DB.prepare('SELECT count(*) AS total FROM acoes a'+where).bind(...args).first();
   return json({items:await Promise.all(result.results.map(row=>updateRow(env,row))),total:count.total,pagina:page,por_pagina:20});
  }
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  const b=JSON.parse(new TextDecoder().decode(await boundedProjectBody(req,50000)));
  const validText=(value,max,min=0)=>typeof value==='string'&&value.length<=max&&value.trim().length>=min;
  if(!validText(b.titulo,150,3)||!validText(b.resumo,500,b.publicada?10:0)||!validText(b.conteudo,10000)||typeof b.publicada!=='boolean'||typeof b.fotos_autorizadas!=='boolean'||!Array.isArray(b.fotos)||b.fotos.length>8)return json({error:'Confira o título, o resumo (mínimo de 10 caracteres para publicar) e o limite de 8 fotos.'},400);
  if(typeof b.data_realizacao!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(b.data_realizacao)||!Number.isFinite(Date.parse(b.data_realizacao))||new Date(b.data_realizacao).toISOString().slice(0,10)!==b.data_realizacao||b.data_realizacao>updateDate())return json({error:'Informe uma data válida, igual ou anterior a hoje.'},400);
  if(b.id!==undefined&&(!updateId.test(b.id)||!Number.isSafeInteger(b.versao)))return json({error:'Reabra a ação para carregar sua versão atual.'},400);
  if(b.projeto_publico_id!==null&&b.projeto_publico_id!==undefined&&typeof b.projeto_publico_id!=='string')return json({error:'Escolha um projeto válido.'},400);
  const project=b.projeto_publico_id||null;
  if(b.publicada&&b.fotos.length&&!project)return json({error:'Escolha um projeto para publicar uma galeria de fotos.'},400);
  if(project){if(typeof project!=='string'||!PROJECT_ID.test(project))return json({error:'Escolha um projeto válido.'},400);const p=await env.DB.prepare('SELECT id,publicada FROM projetos_publicos WHERE id=?').bind(project).first();if(!p)return json({error:'O projeto não foi encontrado.'},400);if(b.publicada&&!p.publicada)return json({error:'Publique primeiro o projeto. Você pode guardar esta ação como rascunho.'},409);}
  const seen=new Set();
  for(const photo of b.fotos){
   if(!photo||!PROJECT_MEDIA.test(photo.caminho)||seen.has(photo.caminho)||!validText(photo.descricao,200,b.publicada?3:0)||!validText(photo.legenda,300)||!await env.DB.prepare('SELECT caminho FROM projetos_capas WHERE caminho=?').bind(photo.caminho).first())return json({error:'Confira as fotos e descreva cada imagem para acessibilidade antes de publicar.'},400);
   seen.add(photo.caminho);
  }
  if(b.publicada&&b.fotos.length&&!b.fotos_autorizadas)return json({error:'Confirme a autorização de uso das imagens antes de publicar as fotos.'},400);
  const id=b.id||crypto.randomUUID(),now=new Date().toISOString(),auditId=crypto.randomUUID();
  const auditValues=[auditId,req.headers.get('oai-authenticated-user-id'),b.publicada?'publicar_acao':'salvar_rascunho',id,now];
  const values=[b.titulo.trim(),b.resumo.trim(),b.conteudo.trim(),b.data_realizacao,b.publicada?1:0,project,b.fotos_autorizadas?1:0,now];
  const statements=[];
  if(b.id){
   if(!await env.DB.prepare('SELECT id FROM acoes WHERE id=?').bind(id).first())return json({error:'Ação não encontrada.'},404);
   statements.push(env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM acoes WHERE id=? AND versao=?)').bind(...auditValues,id,b.versao));
   statements.push(env.DB.prepare('UPDATE acoes SET titulo=?,resumo=?,conteudo=?,data_realizacao=?,publicada=?,projeto_publico_id=?,fotos_autorizadas=?,atualizado_em=?,versao=versao+1 WHERE id=? AND versao=?').bind(...values,id,b.versao));
  }else{
   statements.push(env.DB.prepare('INSERT INTO acoes(id,titulo,resumo,conteudo,data_realizacao,publicada,projeto_publico_id,fotos_autorizadas,atualizado_em,criado_em) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,...values,now));
   statements.push(env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(...auditValues));
  }
  // A per-request audit ID guards every gallery mutation in the same transaction.
  // A stale editor cannot remove or replace photos written by another editor.
  statements.push(env.DB.prepare('DELETE FROM acoes_fotos WHERE acao_id=? AND EXISTS(SELECT 1 FROM auditoria WHERE id=?)').bind(id,auditId));
  b.fotos.forEach((photo,order)=>statements.push(env.DB.prepare('INSERT INTO acoes_fotos(acao_id,caminho,descricao,legenda,ordem) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM auditoria WHERE id=?)').bind(id,photo.caminho,photo.descricao.trim(),photo.legenda.trim(),order,auditId)));
  const result=await env.DB.batch(statements);
  if(b.id&&!result[1].meta.changes)return json({error:'Esta ação foi alterada em outra edição. Feche e reabra a ação antes de salvar.'},409);
  const row=await env.DB.prepare('SELECT * FROM acoes WHERE id=?').bind(id).first();
  return json({ok:true,item:await updateRow(env,row),url:project?projectHref(project)+'#acoes-do-projeto':'/impacto.html'},b.id?200:201);
 }catch(error){if(error instanceof RangeError)return json({error:error.message},413);if(error instanceof SyntaxError)return json({error:'Dados inválidos. Confira o formulário.'},400);throw error;}
}
async function projectUpdatesHtml(env,project,preview,url){
 let page=Math.max(1,Math.min(10000,parseInt(url.searchParams.get('pagina'),10)||1));
 const where='projeto_publico_id=?'+(preview?'':' AND publicada=1'),count=await env.DB.prepare('SELECT count(*) AS total FROM acoes WHERE '+where).bind(project.id).first();
 const selectedId=url.searchParams.get('acao');
 if(selectedId&&updateId.test(selectedId)){const chosen=await env.DB.prepare('SELECT data_realizacao,criado_em,id FROM acoes WHERE '+where+' AND id=?').bind(project.id,selectedId).first();if(chosen){const before=await env.DB.prepare('SELECT count(*) AS total FROM acoes WHERE '+where+' AND (data_realizacao>? OR (data_realizacao=? AND criado_em>?) OR (data_realizacao=? AND criado_em=? AND id>?))').bind(project.id,chosen.data_realizacao,chosen.data_realizacao,chosen.criado_em,chosen.data_realizacao,chosen.criado_em,chosen.id).first();page=Math.floor(before.total/10)+1;}}
 const rows=(await env.DB.prepare('SELECT id,titulo,resumo,conteudo,data_realizacao,publicada FROM acoes WHERE '+where+' ORDER BY data_realizacao DESC,criado_em DESC,id DESC LIMIT 10 OFFSET ?').bind(project.id,(page-1)*10).all()).results;
 const E=projectEscape;
 const articles=await Promise.all(rows.map(async row=>{
  const photos=await updatePhotos(env,row.id);
  return '<article class="project-update" id="acao-'+row.id+'"><div class="project-update-heading"><time datetime="'+row.data_realizacao+'">'+row.data_realizacao.split('-').reverse().join('/')+'</time>'+(preview?'<span class="status">'+(row.publicada?'Publicada':'Rascunho · somente na prévia')+'</span>':'')+'<h3>'+E(row.titulo)+'</h3></div>'+projectParagraphs(row.resumo)+projectParagraphs(row.conteudo)+(photos.length?'<div class="project-update-gallery">'+photos.map(photo=>'<figure><a href="'+E(photo.caminho)+'" target="_blank" rel="noopener" aria-label="Ampliar foto: '+E(photo.descricao)+'"><img src="'+E(photo.caminho)+'" alt="'+E(photo.descricao)+'" loading="lazy" width="1200" height="800"></a>'+(photo.legenda?'<figcaption>'+E(photo.legenda)+'</figcaption>':'')+'</figure>').join('')+'</div>':'')+'</article>';
 }));
 const pages=Math.ceil(count.total/10),href=number=>projectHref(project.id)+'?pagina='+number+(preview?'&preview=1':'')+'#acoes-do-projeto';
 const pagination=pages>1?'<nav class="project-updates-pages" aria-label="Páginas de ações do projeto">'+(page>1?'<a class="button light" href="'+href(page-1)+'">Ações mais recentes</a>':'')+'<span>Página '+page+' de '+pages+'</span>'+(page<pages?'<a class="button light" href="'+href(page+1)+'">Ações anteriores</a>':'')+'</nav>':'';
 return '<section class="section project-updates-section" id="acoes-do-projeto" aria-labelledby="project-updates-title"><div class="wrap"><div class="eyebrow">O PROJETO EM AÇÃO</div><h2 id="project-updates-title">Ações e novidades</h2><p>Registros das atividades e dos caminhos que estamos construindo juntos.</p><div class="project-updates-list">'+(articles.join('')||'<p class="empty">As próximas ações deste projeto serão compartilhadas aqui.</p>')+'</div>'+pagination+'</div></section>';
}
