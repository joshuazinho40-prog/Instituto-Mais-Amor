// The builder embeds the original catalog. Import is atomic and happens only once,
// outside schema migrations; deleting the last project never restores old entries.
const ORIGINAL_PROJECTS = /*PUBLIC_PROJECT_SEEDS*/[];
const PROJECT_STATES = {planejamento:'Em planejamento',desenvolvimento:'Em desenvolvimento',atividade:'Em atividade',concluido:'Concluído',pausado:'Pausado'};
const PROJECT_DEFAULT_COVERS = ['/assets/familia-inclusiva.jpg','/assets/educacao-diversa.jpg','/assets/aprender-juntos.jpg',...['solidariedade-mochilas','apoio-inclusivo','solidariedade-abraco','convivencia-parque','oficina-criativa','brincar-aprender','vinculos-familiares','acolhimento-familias','amizade-inclusiva'].map(name=>'/assets/galeria/'+name+'.webp')];
const PROJECT_ID = /^(?:[1-9]\d{0,8}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
const PROJECT_MEDIA = /^\/midia\/projetos\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/;
const projectEscape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const projectHref = id => '/projeto-'+id+'.html';
const projectRow = row => ({...row,objetivos:JSON.parse(row.objetivos),publicada:!!row.publicada,destaque:!!row.destaque});
const projectAudit = (env,req,action,id,version) => {
 const values=[crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),action,id,new Date().toISOString()];
 return Number.isSafeInteger(version)?env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM projetos_publicos WHERE id=? AND versao=?)').bind(...values,id,version):env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(...values);
};

async function ensurePublicProjects(env) {
 if(await env.DB.prepare("SELECT valor FROM site_configuracoes WHERE chave='projetos_importados_v1'").first())return;
 const now=new Date().toISOString();
 const inserts=ORIGINAL_PROJECTS.map(p=>env.DB.prepare("INSERT OR IGNORE INTO projetos_publicos(id,titulo,resumo,descricao,objetivos,situacao,capa,capa_alt,capa_credito,publicada,destaque,ordem,criado_em,atualizado_em) SELECT ?,?,?,?,?,?,?,?,?,1,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM site_configuracoes WHERE chave='projetos_importados_v1')").bind(p.id,p.titulo,p.resumo,p.descricao,JSON.stringify(p.objetivos),p.situacao,p.capa,p.capa_alt,'Imagem ilustrativa. Não representa uma atividade realizada pelo Instituto.',p.destaque?1:0,p.ordem,now,now));
 // Preserve projects already authorized for publication by the previous central.
 // Private notes are deliberately excluded from the public catalog.
 inserts.push(env.DB.prepare("INSERT OR IGNORE INTO projetos_publicos(id,titulo,resumo,descricao,objetivos,situacao,capa,capa_alt,capa_credito,publicada,destaque,ordem,data_inicio,data_fim,criado_em,atualizado_em) SELECT id,titulo,resumo,resumo,'[]',CASE situacao WHEN 'em_andamento' THEN 'atividade' ELSE situacao END,?,'Imagem ilustrativa do projeto '||titulo,'Imagem ilustrativa. Não representa uma atividade realizada pelo Instituto.',1,0,1000,data_inicio,data_fim,criado_em,atualizado_em FROM projetos_gestao WHERE publicado=1 AND NOT EXISTS (SELECT 1 FROM site_configuracoes WHERE chave='projetos_importados_v1')").bind(PROJECT_DEFAULT_COVERS[0]));
 inserts.push(env.DB.prepare("INSERT OR IGNORE INTO site_configuracoes(chave,valor) VALUES('projetos_importados_v1',?)").bind(now));
 await env.DB.batch(inserts);
}

async function boundedProjectBody(req,max) {
 if(Number(req.headers.get('Content-Length'))>max)throw new RangeError('Arquivo ou texto acima do limite permitido.');
 if(!req.body)return new Uint8Array();
 const reader=req.body.getReader(),chunks=[];let total=0;
 while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new RangeError('Arquivo ou texto acima do limite permitido.');}chunks.push(value);}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return bytes;
}

function projectImageType(bytes) {
 if(bytes.length<32)return null;
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9)return {type:'image/jpeg',ext:'jpg'};
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&String.fromCharCode(...bytes.slice(12,16))==='IHDR'){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=v.getUint32(16),h=v.getUint32(20);
  if(w>0&&h>0&&w<=20000&&h<=20000)return {type:'image/png',ext:'png'};
 }
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(String.fromCharCode(...bytes.slice(12,16))))return {type:'image/webp',ext:'webp'};
 return null;
}

async function projectAdminApi(req,env,path) {
 if(!path.startsWith('/api/admin/projetos-site'))return null;
 // Caller has already enforced the server-verified administrator and same origin.
 try{
 if(path==='/api/admin/projetos-site/capa'&&req.method==='POST'){
  if(!env.BUCKET)return json({error:'O armazenamento de imagens está indisponível. Tente novamente.'},503);
  const bytes=await boundedProjectBody(req,5*1024*1024),format=projectImageType(bytes);
  if(!format||req.headers.get('Content-Type')?.split(';')[0]!==format.type)return json({error:'Envie uma imagem JPG, PNG ou WebP válida, com até 5 MB.'},400);
  const id=crypto.randomUUID(),key='project-covers/'+id+'.'+format.ext,cover='/midia/projetos/'+id+'.'+format.ext,now=new Date().toISOString();
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:format.type}});
  try{await env.DB.batch([env.DB.prepare('INSERT INTO projetos_capas(caminho,chave,tipo,tamanho,criado_em) VALUES(?,?,?,?,?)').bind(cover,key,format.type,bytes.length,now),projectAudit(env,req,'enviar_capa_projeto',cover)]);}catch(e){await env.BUCKET.delete(key);throw e;}
  return json({ok:true,capa:cover},201);
 }
 await ensurePublicProjects(env);
 if(path==='/api/admin/projetos-site'&&req.method==='GET'){
  const result=await env.DB.prepare('SELECT * FROM projetos_publicos ORDER BY ordem,criado_em,id').all();
  return json({items:result.results.map(projectRow),capas:PROJECT_DEFAULT_COVERS});
 }
 if(path==='/api/admin/projetos-site/excluir'&&req.method==='POST'){
  const b=JSON.parse(new TextDecoder().decode(await boundedProjectBody(req,2000)));
  if(typeof b.id!=='string'||!PROJECT_ID.test(b.id)||b.confirmacao!==b.id||!Number.isSafeInteger(b.versao))return json({error:'Confirme o projeto selecionado para excluir.'},400);
  const old=await env.DB.prepare('SELECT id,versao FROM projetos_publicos WHERE id=?').bind(b.id).first();
  if(!old)return json({error:'Projeto não encontrado.'},404);
  const linked=await env.DB.prepare('SELECT (SELECT count(*) FROM op_apoios WHERE projeto_publico_id=?) + (SELECT count(*) FROM op_voluntarios WHERE projeto_publico_id=?) + (SELECT count(*) FROM op_agenda WHERE projeto_publico_id=?) + (SELECT count(*) FROM acoes WHERE projeto_publico_id=?) AS total').bind(b.id,b.id,b.id,b.id).first();if(linked.total)return json({error:'Este projeto possui ações, acompanhamentos ou atividades vinculadas. Salve como rascunho para retirá-lo do site sem apagar o histórico.'},409);
  const result=await env.DB.batch([projectAudit(env,req,'excluir_projeto_publico',b.id,b.versao),env.DB.prepare('DELETE FROM projetos_publicos WHERE id=? AND versao=?').bind(b.id,b.versao)]);
  if(!result[1].meta.changes)return json({error:'Este projeto foi alterado por outra pessoa. Atualize a lista antes de excluir.'},409);
  return json({ok:true});
 }
 if(path==='/api/admin/projetos-site'&&req.method==='POST'){
  const b=JSON.parse(new TextDecoder().decode(await boundedProjectBody(req,40000)));
  const fields={titulo:150,resumo:500,descricao:12000,publico_alvo:1000,atividades:4000,local:200,horarios:500,como_participar:2000,capa:200,capa_alt:200,capa_credito:300};
  if(Object.entries(fields).some(([k,max])=>typeof b[k]!=='string'||b[k].length>max)||b.titulo.trim().length<3||!Object.hasOwn(PROJECT_STATES,b.situacao)||typeof b.publicada!=='boolean'||typeof b.destaque!=='boolean'||!Number.isSafeInteger(b.ordem)||b.ordem<0||b.ordem>9999||!Array.isArray(b.objetivos)||b.objetivos.length>20||b.objetivos.some(v=>typeof v!=='string'||!v.trim()||v.length>300))return json({error:'Confira os campos, os limites de texto e os objetivos (até 20, um por linha).'},400);
  const dateOk=v=>v==null||v===''||(typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  if(!dateOk(b.data_inicio)||!dateOk(b.data_fim)||(b.data_inicio&&b.data_fim&&b.data_fim<b.data_inicio))return json({error:'Confira as datas: o término deve ser igual ou posterior ao início.'},400);
  if(b.publicada&&(b.resumo.trim().length<10||b.descricao.trim().length<10||!b.capa||!b.capa_alt.trim()))return json({error:'Para publicar, preencha resumo e descrição (mínimo de 10 caracteres), escolha a capa e descreva a imagem.'},400);
  if(b.capa&&!PROJECT_DEFAULT_COVERS.includes(b.capa)&&(!PROJECT_MEDIA.test(b.capa)||!await env.DB.prepare('SELECT caminho FROM projetos_capas WHERE caminho=?').bind(b.capa).first()))return json({error:'Escolha uma imagem da biblioteca ou envie uma nova capa.'},400);
  const values=Object.fromEntries(Object.keys(fields).map(k=>[k,b[k].trim()]));
  if(b.id!==undefined&&(typeof b.id!=='string'||!PROJECT_ID.test(b.id)))return json({error:'Identificador de projeto inválido.'},400);
  const now=new Date().toISOString(),id=b.id||crypto.randomUUID();
  if(b.id){
   if(typeof b.id!=='string'||!PROJECT_ID.test(b.id)||!Number.isSafeInteger(b.versao))return json({error:'Selecione novamente o projeto que deseja editar.'},400);
   if(!await env.DB.prepare('SELECT id FROM projetos_publicos WHERE id=?').bind(id).first())return json({error:'Projeto não encontrado.'},404);
   const sqlFields=[...Object.keys(fields),'objetivos','situacao','data_inicio','data_fim','publicada','destaque','ordem','atualizado_em'];
   const update=env.DB.prepare('UPDATE projetos_publicos SET '+sqlFields.map(k=>k+'=?').join(',')+',versao=versao+1 WHERE id=? AND versao=?').bind(...Object.values(values),JSON.stringify(b.objetivos.map(v=>v.trim())),b.situacao,b.data_inicio||null,b.data_fim||null,b.publicada?1:0,b.destaque?1:0,b.ordem,now,id,b.versao);
   const result=await env.DB.batch([projectAudit(env,req,b.publicada?'publicar_projeto':'salvar_rascunho_projeto',id,b.versao),update]);
   if(!result[1].meta.changes)return json({error:'Outra pessoa salvou alterações neste projeto. Reabra-o na lista para carregar a versão atual.'},409);
  }else{
   const sqlFields=['id',...Object.keys(fields),'objetivos','situacao','data_inicio','data_fim','publicada','destaque','ordem','criado_em','atualizado_em'];
   await env.DB.batch([env.DB.prepare('INSERT INTO projetos_publicos('+sqlFields.join(',')+') VALUES('+sqlFields.map(()=>'?').join(',')+')').bind(id,...Object.values(values),JSON.stringify(b.objetivos.map(v=>v.trim())),b.situacao,b.data_inicio||null,b.data_fim||null,b.publicada?1:0,b.destaque?1:0,b.ordem,now,now),projectAudit(env,req,b.publicada?'publicar_projeto':'salvar_rascunho_projeto',id)]);
  }
  const item=await env.DB.prepare('SELECT * FROM projetos_publicos WHERE id=?').bind(id).first();return json({ok:true,item:projectRow(item),url:projectHref(id)},b.id?200:201);
 }
 return json({error:'Recurso não encontrado.'},404);
 }catch(e){if(e instanceof RangeError)return json({error:e.message},413);if(e instanceof SyntaxError)return json({error:'Dados inválidos. Confira o formulário.'},400);throw e;}
}

async function projectMediaResponse(req,env,path) {
 if(!path.startsWith('/midia/projetos/'))return null;
 if(!PROJECT_MEDIA.test(path)||!['GET','HEAD'].includes(req.method))return new Response('Imagem não encontrada',{status:404,headers:safeHeaders});
 const media=await env.DB.prepare('SELECT * FROM projetos_capas WHERE caminho=?').bind(path).first();
 if(!media||(!admin(req)&&!await env.DB.prepare('SELECT id FROM projetos_publicos WHERE capa=? AND publicada=1 UNION ALL SELECT a.id FROM acoes a JOIN acoes_fotos f ON f.acao_id=a.id JOIN projetos_publicos p ON p.id=a.projeto_publico_id WHERE f.caminho=? AND a.publicada=1 AND a.fotos_autorizadas=1 AND p.publicada=1 UNION ALL SELECT a.id FROM acoes a JOIN acoes_fotos f ON f.acao_id=a.id WHERE f.caminho=? AND a.publicada=1 AND a.fotos_autorizadas=1 AND a.projeto_publico_id IS NULL LIMIT 1').bind(path,path,path).first()))return new Response('Imagem não encontrada',{status:404,headers:safeHeaders});
 if(!env.BUCKET)return new Response('Imagem indisponível',{status:503,headers:safeHeaders});
 const image=req.method==='HEAD'?await env.BUCKET.head(media.chave):await env.BUCKET.get(media.chave);
 if(!image)return new Response('Imagem não encontrada',{status:404,headers:safeHeaders});
 return new Response(req.method==='HEAD'?null:image.body,{headers:{...safeHeaders,'Content-Type':media.tipo,'Content-Length':String(media.tamanho),'Content-Security-Policy':"default-src 'none'"}});
}

function projectCards(items) {
 if(!items.length)return '<div class="empty">Novos projetos serão divulgados por aqui. Conheça nossas frentes de atuação e acompanhe as novidades do Instituto.</div>';
 return '<div class="grid">'+items.map((p,i)=>'<article class="card project-card" data-status="'+p.situacao+'"><div class="project-art project-photo"><img src="'+projectEscape(p.capa)+'" alt="'+projectEscape(p.capa_alt)+'" width="1200" height="800" loading="lazy"><span class="project-index">'+String(i+1).padStart(2,'0')+'</span></div><div class="project-body"><span class="status" data-state="'+p.situacao+'">'+PROJECT_STATES[p.situacao]+'</span><h3>'+projectEscape(p.titulo)+'</h3><p>'+projectEscape(p.resumo)+'</p><a class="text-link" href="'+projectHref(p.id)+'">Conheça o projeto <span aria-hidden="true">↗</span></a></div></article>').join('')+'</div>';
}
const projectParagraphs = value => String(value||'').split(/\n\s*\n/).filter(v=>v.trim()).map(v=>'<p>'+projectEscape(v).replace(/\n/g,'<br>')+'</p>').join('');
const projectAssetText = path => new TextDecoder().decode(Uint8Array.from(atob(assets[path].data),c=>c.charCodeAt(0)));
const projectCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
function projectHtml(req,html,status=200,preview=false){return new Response(req.method==='HEAD'?null:html,{status,headers:{...safeHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':projectCsp,'X-Robots-Tag':preview||status!==200?'noindex, nofollow':'all'}});}
function projectDetail(p,preview) {
 const E=projectEscape,fmt=d=>d?d.split('-').reverse().join('/'):'',fields=[['Público do projeto',p.publico_alvo],['Local',p.local],['Dias e horários',p.horarios],['Início',fmt(p.data_inicio)],['Término',fmt(p.data_fim)]];
 return (preview?'<div class="project-preview-banner" role="status">Prévia administrativa · '+(p.publicada?'Projeto publicado':'Rascunho, visível somente à administração')+'</div>':'')+'<div class="page-intro"><div class="wrap"><div class="breadcrumb"><a href="/">Início</a> / <a href="/projetos.html">Projetos</a></div><div class="eyebrow">PROJETOS DO INSTITUTO</div><h1>'+E(p.titulo)+'</h1><p>'+E(p.resumo)+'</p><span class="status" data-state="'+p.situacao+'">'+PROJECT_STATES[p.situacao]+'</span></div></div><section class="section"><div class="wrap project-detail-grid"><article class="project-detail-copy"><h2>Sobre o projeto</h2>'+projectParagraphs(p.descricao)+(p.objetivos.length?'<h2>Objetivos</h2><ul class="list">'+p.objetivos.map(v=>'<li>'+E(v)+'</li>').join('')+'</ul>':'')+(p.atividades?'<h2>Atividades e formas de apoio</h2>'+projectParagraphs(p.atividades):'')+(p.como_participar?'<h2>Como participar</h2>'+projectParagraphs(p.como_participar):'')+'<div class="notice"><span>Consulte a equipe para confirmar atividades, disponibilidade e critérios de participação.</span></div><div class="actions"><a class="button" href="/acolhimento.html#solicitar-acolhimento">Quero saber como participar ↗</a><a class="button light" href="/projetos.html">Ver outros projetos ↗</a></div></article><aside class="project-detail-aside">'+(p.capa?'<figure><img src="'+E(p.capa)+'" alt="'+E(p.capa_alt)+'" width="1200" height="800">'+(p.capa_credito?'<figcaption>'+E(p.capa_credito)+'</figcaption>':'')+'</figure>':'')+(fields.some(([,v])=>v)?'<div class="project-facts"><h2>Informações do projeto</h2><dl>'+fields.filter(([,v])=>v).map(([k,v])=>'<dt>'+E(k)+'</dt><dd>'+E(v).replace(/\n/g,'<br>')+'</dd>').join('')+'</dl></div>':'')+'</aside></div></section>';
}

async function publicProjectPage(req,env,url) {
 const path=url.pathname,detail=/^\/projeto-([^/]+?)(?:\.html)?\/?$/.exec(path);
 const isHome=['/','/index.html','/index'].includes(path),isList=['/projetos','/projetos.html','/projetos/'].includes(path),isSitemap=path==='/sitemap.xml';
 if(!isHome&&!isList&&!detail&&!isSitemap)return null;
 if(!['GET','HEAD'].includes(req.method))return json({error:'Método não permitido.'},405);
 await ensurePublicProjects(env);
 if(detail){
  const id=detail[1],preview=url.searchParams.get('preview')==='1'&&admin(req);
  const row=PROJECT_ID.test(id)?await env.DB.prepare('SELECT * FROM projetos_publicos WHERE id=?'+(preview?'':' AND publicada=1')).bind(id).first():null;
  let html=projectAssetText('/projeto-1.html');
  if(!row){html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>Projeto não disponível | Instituto Mais Amor</title>').replace(/<main\b[^>]*>[\s\S]*?<\/main>/,'<main id="conteudo" tabindex="-1"><section class="section"><div class="wrap"><h1>Projeto não disponível</h1><p>Este projeto não está publicado. Explore os projetos disponíveis do Instituto.</p><a class="button" href="/projetos.html">Conhecer os projetos ↗</a></div></section></main>');return projectHtml(req,html,404);}
  const p=projectRow(row),updates=await projectUpdatesHtml(env,p,preview,url);html=html.replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+projectEscape(p.titulo)+' | Instituto Mais Amor</title>').replace(/<meta name="description" content="[^"]*">/,()=>'<meta name="description" content="'+projectEscape(p.resumo)+'">').replace(/<meta property="og:title" content="[^"]*">/,()=>'<meta property="og:title" content="'+projectEscape(p.titulo)+' | Instituto Mais Amor">').replace(/<meta property="og:description" content="[^"]*">/,()=>'<meta property="og:description" content="'+projectEscape(p.resumo)+'">').replace(/<main\b[^>]*>[\s\S]*?<\/main>/,()=>'<main id="conteudo" tabindex="-1">'+projectDetail(p,preview)+updates+'</main>');
  html=html.replace('</head>',()=>'<link rel="canonical" href="'+projectEscape(url.origin+projectHref(p.id))+'">'+(p.capa?'<meta property="og:image" content="'+projectEscape(url.origin+p.capa)+'">':'')+'</head>');return projectHtml(req,html,200,preview);
 }
 const rows=(await env.DB.prepare('SELECT * FROM projetos_publicos WHERE publicada=1 ORDER BY ordem,criado_em,id').all()).results.map(projectRow);
 if(isSitemap){let xml=projectAssetText('/sitemap.xml').replace(/<url>\s*<loc>[^<]*\/(?:projeto-[^<]*|(?:admin|transparencia)(?:\.html)?)<\/loc>[\s\S]*?<\/url>/g,'');xml=xml.replace('</urlset>',rows.map(p=>'<url><loc>'+projectEscape(url.origin+projectHref(p.id))+'</loc><lastmod>'+p.atualizado_em.slice(0,10)+'</lastmod></url>').join('')+'</urlset>');return new Response(req.method==='HEAD'?null:xml,{headers:{...safeHeaders,'Content-Type':'application/xml; charset=utf-8'}});}
 let html=projectAssetText(isHome?'/index.html':'/projetos.html');
 const items=isHome?rows.filter(p=>p.destaque).slice(0,3):rows;
 html=html.replace(/<!--PUBLIC_PROJECTS_START-->[\s\S]*?<!--PUBLIC_PROJECTS_END-->/,()=>projectCards(items));
 if(isList){html=html.replace(/(<p id="filter-result"[^>]*>)[\s\S]*?(<\/p>)/,()=>'<p id="filter-result" role="status">'+rows.length+' projeto'+(rows.length===1?'':'s')+' publicado'+(rows.length===1?'':'s')+'</p>');}
 return projectHtml(req,html);
}
