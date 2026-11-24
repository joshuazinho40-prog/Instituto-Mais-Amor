import assets from './assets.js';
import './metrics.js';
import './site-media.js';
import './operations.js';
import './crm.js';
import './settings.js';
import './public-projects.js';
import './project-updates.js';
import './admin-center.js';
import './private-documents.js';
import './mcp.js';
const ADMIN_EMAIL='admin@example.test';
const TYPES=['parcerias','voluntariado','acolhimento','contato'];
const STATES=['novo','em_contato','concluido','arquivado'];
const safeHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...safeHeaders,'Content-Type':'application/json; charset=utf-8'}});
const admin=req=>!!req.headers.get('oai-authenticated-user-id')&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===ADMIN_EMAIL;
function sameOrigin(req){return req.headers.get('Origin')===new URL(req.url).origin;}
async function handle(req,env){
 try{
 const url=new URL(req.url),p=url.pathname;
 if(p==='/mcp')return handleSiteMcp(req,env);
 if(['/transparencia','/transparencia/','/transparencia.html'].includes(p))return new Response(null,{status:302,headers:{...safeHeaders,Location:url.origin+'/admin#documentos-internos','X-Robots-Tag':'noindex, nofollow'}});
 if(p.startsWith('/documentos/'))return json({error:'Documento não encontrado.'},404);
 const projectMedia=await projectMediaResponse(req,env,p);if(projectMedia)return projectMedia;
 const mediaResponse=await handleMediaPublic(req,env,p);if(mediaResponse)return mediaResponse;
 const crmPublic=await handleCrmPublic(req,env,p);if(crmPublic)return crmPublic;
 const operationalPublic=await handleOperationsPublic(req,env,p);if(operationalPublic)return operationalPublic;
 const settingsPublic=await handleSettingsPublic(req,env,p);if(settingsPublic)return settingsPublic;
 const centerPublic=await publicCenter(req,env,p);if(centerPublic)return centerPublic;
 if(p==='/api/impacto'&&req.method==='GET'){
  const rows=await env.DB.prepare('SELECT periodo,pessoas,familias,atendimentos,cestas,voluntarios,acoes,parceiros,fonte,atualizado_em FROM impacto_publicacoes ORDER BY periodo DESC LIMIT 120').all();
  const registrations=await env.DB.prepare("SELECT substr(criado_em,1,7) AS periodo,count(*) AS total FROM cadastros GROUP BY substr(criado_em,1,7) ORDER BY periodo DESC LIMIT 120").all();
  const volunteerRegistrations=await env.DB.prepare("SELECT substr(criado_em,1,7) AS periodo,count(*) AS total FROM cadastros WHERE tipo='voluntariado' GROUP BY periodo").all();
  const activities=await env.DB.prepare("SELECT substr(data_realizacao,1,7) AS periodo,count(*) AS total FROM acoes WHERE publicada=1 GROUP BY substr(data_realizacao,1,7) ORDER BY periodo DESC LIMIT 120").all();
  const operationTotals=await env.DB.prepare("SELECT substr(data_ocorrencia,1,7) AS periodo,tipo,SUM(quantidade) AS total FROM registros_operacionais GROUP BY periodo,tipo ORDER BY periodo DESC LIMIT 240").all();const operationMonths=operationTotals;
  const confirmedMonths=await env.DB.prepare("SELECT strftime('%Y-%m',data_hora,'-3 hours') AS periodo FROM op_agenda WHERE situacao='realizado' GROUP BY periodo ORDER BY periodo DESC LIMIT 120").all();
  const crmMonths=await crmConfirmedMonths(env);
  const periods=[...new Set([opsMonth(),...crmMonths,...confirmedMonths.results.map(r=>r.periodo),...rows.results.map(r=>r.periodo),...registrations.results.map(r=>r.periodo),...activities.results.map(r=>r.periodo),...operationMonths.results.map(r=>r.periodo)])].sort().reverse().slice(0,120);
  const published=[];for(const period of periods){const row=rows.results.find(r=>r.periodo===period),registrationsTotal=registrations.results.find(r=>r.periodo===period)?.total||0;published.push({...row,periodo:period,pessoas:registrationsTotal+(row?.pessoas||0),voluntarios:(row?.voluntarios||0)+(volunteerRegistrations.results.find(r=>r.periodo===period)?.total||0),atendimentos:(row?.atendimentos||0)+(operationTotals.results.find(r=>r.periodo===period&&r.tipo==='atendimento')?.total||0),cestas:(row?.cestas||0)+(operationTotals.results.find(r=>r.periodo===period&&r.tipo==='cesta')?.total||0),base:row?{pessoas:row.pessoas,atendimentos:row.atendimentos,cestas:row.cestas,voluntarios:row.voluntarios}:null,publicada:!!row,parceiros:row?JSON.parse(row.parceiros):[]});}
  await ensurePublicProjects(env);const projects=(await env.DB.prepare('SELECT situacao,count(*) AS total FROM projetos_publicos WHERE publicada=1 GROUP BY situacao').all()).results;return json({periodos:published,cadastros:registrations.results,acoes:activities.results,projetos:projects});
 }
 if(p==='/api/acoes'&&req.method==='GET')return json({items:(await env.DB.prepare('SELECT id,titulo,resumo,conteudo,data_realizacao FROM acoes WHERE publicada=1 AND (projeto_publico_id IS NULL OR EXISTS(SELECT 1 FROM projetos_publicos p WHERE p.id=acoes.projeto_publico_id AND p.publicada=1)) ORDER BY data_realizacao DESC,criado_em DESC LIMIT 100').all()).results});
 if(p.startsWith('/api/admin')){
  if(!admin(req))return json({error:'Acesso restrito ao administrador.'},403);
  if(!['GET','HEAD'].includes(req.method)&&!sameOrigin(req))return json({error:'Origem não permitida.'},403);
  const mediaAdmin=await handleMediaAdmin(req,env,p);if(mediaAdmin)return mediaAdmin;
  const crmAdmin=await handleCrmAdmin(req,env,p,url);if(crmAdmin)return crmAdmin;
  const operationalAdmin=await handleOperationsAdmin(req,env,p,url);if(operationalAdmin)return operationalAdmin;
  const settingsAdmin=await handleSettingsAdmin(req,env,p);if(settingsAdmin)return settingsAdmin;
  const documentResponse=await privateDocumentResponse(req,env,p,url);if(documentResponse)return documentResponse;
  const projectApi=await projectAdminApi(req,env,p);if(projectApi)return projectApi;
  const projectUpdates=await handleProjectUpdates(req,env,p,url);if(projectUpdates)return projectUpdates;
  const centerAdmin=await adminCenter(req,env,p,url);if(centerAdmin)return centerAdmin;
  if(p==='/api/admin/entries'&&req.method==='POST'){
   const raw=await req.text();if(raw.length>5000)return json({error:'Dados muito longos.'},413);const b=JSON.parse(raw);
   if(!TYPES.includes(b.tipo)||typeof b.nome!=='string'||b.nome.trim().length<2||b.nome.length>100||typeof b.contato!=='string'||b.contato.length>150||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contato)||/^\+?[\d\s()\-]{10,25}$/.test(b.contato))||typeof b.organizacao!=='string'||b.organizacao.length>150||typeof b.mensagem!=='string'||b.mensagem.length>600||b.ciente!==true)return json({error:'Confira os campos e confirme a autorização do contato.'},400);
   const id=crypto.randomUUID(),now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO cadastros(id,tipo,nome,contato,organizacao,mensagem,situacao,notas,privacidade_versao,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,\'novo\',\'\',?,?,?)').bind(id,b.tipo,b.nome.trim(),b.contato.trim(),b.organizacao.trim(),b.mensagem.trim(),'cadastro-administrativo-2026-11',now,now),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'cadastrar_contato',id,now)]);return json({ok:true,id},201);
  }
  if(p==='/api/admin/operacoes'&&req.method==='GET')return json({items:(await env.DB.prepare('SELECT r.*,c.nome AS cadastro_nome FROM registros_operacionais r LEFT JOIN cadastros c ON c.id=r.cadastro_id ORDER BY r.data_ocorrencia DESC,r.criado_em DESC LIMIT 200').all()).results});
  if(p==='/api/admin/operacoes/excluir'&&req.method==='POST'){
   const b=await req.json();if(typeof b.id!=='string'||b.confirmacao!==b.id)return json({error:'Confirme o registro que deseja excluir.'},400);
   const old=await env.DB.prepare('SELECT id,data_ocorrencia FROM registros_operacionais WHERE id=?').bind(b.id).first();if(!old)return json({error:'Registro não encontrado.'},404);
   await env.DB.batch([env.DB.prepare('DELETE FROM registros_operacionais WHERE id=?').bind(b.id),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'excluir_registro_operacional',b.id,new Date().toISOString())]);return json({ok:true,periodo:old.data_ocorrencia.slice(0,7)});
  }
  if(p==='/api/admin/operacoes'&&req.method==='POST'){
   const raw=await req.text();if(raw.length>5000)return json({error:'Dados muito longos.'},413);const b=JSON.parse(raw);
   if(!['atendimento','cesta','outro'].includes(b.tipo)||!Number.isSafeInteger(b.quantidade)||b.quantidade<1||b.quantidade>100000||typeof b.notas!=='string'||b.notas.length>600||!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(b.data_ocorrencia)||!Number.isFinite(Date.parse(b.data_ocorrencia))||new Date(b.data_ocorrencia).toISOString().slice(0,10)!==b.data_ocorrencia||b.data_ocorrencia>new Date().toISOString().slice(0,10)||(b.id&&!/^[a-f0-9-]{36}$/.test(b.id)))return json({error:'Confira data, tipo, quantidade e observações.'},400);
   if(b.cadastro_id&&!await env.DB.prepare('SELECT id FROM cadastros WHERE id=?').bind(b.cadastro_id).first())return json({error:'Cadastro relacionado não encontrado.'},400);
   const description=b.descricao_tipo===undefined?(b.tipo==='cesta'?'Entrega de cestas básicas':b.tipo==='atendimento'?'Atendimento realizado':'Outra atividade'):b.descricao_tipo;if(typeof description!=='string'||description.trim().length<2||description.length>120)return json({error:'Informe o tipo do registro com até 120 caracteres.'},400);
   const id=b.id||crypto.randomUUID(),now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO registros_operacionais(id,cadastro_id,tipo,data_ocorrencia,quantidade,notas,criado_em,atualizado_em,descricao_tipo) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cadastro_id=excluded.cadastro_id,tipo=excluded.tipo,data_ocorrencia=excluded.data_ocorrencia,quantidade=excluded.quantidade,notas=excluded.notas,atualizado_em=excluded.atualizado_em,descricao_tipo=excluded.descricao_tipo').bind(id,b.cadastro_id||null,b.tipo,b.data_ocorrencia,b.quantidade,b.notas.trim(),now,now,description.trim()),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'registrar_'+b.tipo,id,now)]);return json({ok:true,id});
  }
  if(p==='/api/admin/overview'&&req.method==='GET'){
   const period=url.searchParams.get('periodo')||new Date().toISOString().slice(0,7);if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))return json({error:'Período inválido.'},400);
   const publication=await env.DB.prepare('SELECT * FROM impacto_publicacoes WHERE periodo=?').bind(period).first();
   const metrics=await periodMetrics(env,period,publication);
   const actions=await env.DB.prepare('SELECT publicada,count(*) AS total FROM acoes WHERE substr(data_realizacao,1,7)=? GROUP BY publicada').bind(period).all();
   const projects=await env.DB.prepare('SELECT * FROM projetos_gestao ORDER BY atualizado_em DESC LIMIT 200').all();
   const history=await env.DB.prepare('SELECT SUM(atendimentos) AS atendimentos,SUM(cestas) AS cestas,count(*) AS meses FROM impacto_publicacoes').first();const opsHistory=await env.DB.prepare('SELECT tipo,SUM(quantidade) AS total FROM registros_operacionais GROUP BY tipo').all();history.atendimentos=(history.atendimentos||0)+(opsHistory.results.find(r=>r.tipo==='atendimento')?.total||0);history.cestas=(history.cestas||0)+(opsHistory.results.find(r=>r.tipo==='cesta')?.total||0);
   return json({periodo:period,publicacao:publication?{...publication,parceiros:JSON.parse(publication.parceiros)}:null,...metrics,acoes:actions.results,projetos:projects.results,historico:history});
  }
  if(p==='/api/admin/projetos'&&req.method==='POST'){
   const raw=await req.text();if(raw.length>5000)return json({error:'Texto muito longo.'},413);const b=JSON.parse(raw);
   const validDate=v=>v===''||(typeof v==='string'&&/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
   if(typeof b.titulo!=='string'||b.titulo.trim().length<3||b.titulo.length>150||!['planejamento','em_andamento','concluido'].includes(b.situacao)||typeof b.notas!=='string'||b.notas.length>2000||!validDate(b.data_inicio)||!validDate(b.data_fim)||(b.data_inicio&&b.data_fim&&b.data_fim<b.data_inicio)||(b.situacao==='concluido'&&(!b.data_fim||b.data_fim>new Date().toISOString().slice(0,10)))||(b.id&&!/^[a-f0-9-]{36}$/.test(b.id)))return json({error:'Confira nome, situação e datas. Projetos concluídos precisam de data de conclusão.'},400);
   const id=b.id||crypto.randomUUID(),now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO projetos_gestao(id,titulo,situacao,data_inicio,data_fim,notas,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET titulo=excluded.titulo,situacao=excluded.situacao,data_inicio=excluded.data_inicio,data_fim=excluded.data_fim,notas=excluded.notas,atualizado_em=excluded.atualizado_em').bind(id,b.titulo.trim(),b.situacao,b.data_inicio||null,b.data_fim||null,b.notas.trim(),now,now),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'atualizar_projeto',id,now)]);return json({ok:true,id});
  }
  if(p==='/api/admin/acoes'&&req.method==='GET')return json({items:(await env.DB.prepare('SELECT * FROM acoes ORDER BY data_realizacao DESC LIMIT 200').all()).results});
  if(p==='/api/admin/acoes'&&req.method==='POST'){
   const text=await req.text();if(text.length>20000)return json({error:'Texto muito longo.'},413);const b=JSON.parse(text);
   if(b.id&&await env.DB.prepare('SELECT id FROM acoes WHERE id=? AND (projeto_publico_id IS NOT NULL OR EXISTS(SELECT 1 FROM acoes_fotos WHERE acao_id=acoes.id))').bind(b.id).first())return json({error:'Edite este relato em Ações e novidades para preservar o projeto, as fotos e a versão atual.'},409);
   if(typeof b.titulo!=='string'||b.titulo.trim().length<3||b.titulo.length>150||typeof b.resumo!=='string'||b.resumo.trim().length<10||b.resumo.length>500||typeof b.conteudo!=='string'||b.conteudo.length>10000||!/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(b.data_realizacao)||!Number.isFinite(Date.parse(b.data_realizacao))||new Date(b.data_realizacao).toISOString().slice(0,10)!==b.data_realizacao||b.data_realizacao>new Date().toISOString().slice(0,10)||typeof b.publicada!=='boolean'||(b.id&&!/^[a-f0-9-]{36}$/.test(b.id)))return json({error:'Confira título, resumo, data e conteúdo.'},400);
   const id=b.id||crypto.randomUUID(),now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO acoes(id,titulo,resumo,conteudo,data_realizacao,publicada,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET titulo=excluded.titulo,resumo=excluded.resumo,conteudo=excluded.conteudo,data_realizacao=excluded.data_realizacao,publicada=excluded.publicada,atualizado_em=excluded.atualizado_em,versao=acoes.versao+1').bind(id,b.titulo.trim(),b.resumo.trim(),b.conteudo.trim(),b.data_realizacao,b.publicada?1:0,now,now),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),b.publicada?'publicar_acao':'salvar_rascunho',id,now)]);return json({ok:true,id});
  }
  if(p==='/api/admin/impacto'&&req.method==='POST'){
   const raw=await req.text();if(raw.length>15000)return json({error:'Publicação muito longa.'},413);const b=JSON.parse(raw);
   const keys=['pessoas','familias','atendimentos','cestas','voluntarios','acoes'];
   if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(b.periodo)||b.periodo>new Date().toISOString().slice(0,7)||keys.some(k=>!Number.isSafeInteger(b[k])||b[k]<0||b[k]>100000000)||b.confirmado!==true||typeof b.fonte!=='string'||b.fonte.trim().length<3||b.fonte.length>300||!Array.isArray(b.parceiros)||b.parceiros.length>50||b.parceiros.some(v=>typeof v!=='string'||v.length>150||!v.trim()))return json({error:'Confira o período, os números, a fonte e a confirmação.'},400);
   const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO impacto_publicacoes(periodo,pessoas,familias,atendimentos,cestas,voluntarios,acoes,parceiros,fonte,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(periodo) DO UPDATE SET pessoas=excluded.pessoas,familias=excluded.familias,atendimentos=excluded.atendimentos,cestas=excluded.cestas,voluntarios=excluded.voluntarios,acoes=excluded.acoes,parceiros=excluded.parceiros,fonte=excluded.fonte,atualizado_em=excluded.atualizado_em').bind(b.periodo,...keys.map(k=>b[k]),JSON.stringify(b.parceiros.map(v=>v.trim())),b.fonte.trim(),now),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'publicar_impacto',b.periodo,now)]);return json({ok:true});
  }
  if(p==='/api/admin/impacto/remover'&&req.method==='POST'){
   const b=await req.json();if(typeof b.periodo!=='string')return json({error:'Período inválido.'},400);await env.DB.batch([env.DB.prepare('DELETE FROM impacto_publicacoes WHERE periodo=?').bind(b.periodo),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'retirar_publicacao',b.periodo,new Date().toISOString())]);return json({ok:true});
  }
  if(p==='/api/admin/entries'&&req.method==='GET'){
   const type=url.searchParams.get('tipo')||'',state=url.searchParams.get('situacao')||'',search=(url.searchParams.get('busca')||'').slice(0,100),page=Math.max(1,Math.min(10000,Number(url.searchParams.get('pagina'))||1));
   const where='WHERE (? = \'\' OR tipo = ?) AND (? = \'\' OR situacao = ?) AND (? = \'\' OR nome LIKE ? OR contato LIKE ? OR organizacao LIKE ?)';
   const args=[type,type,state,state,search,...Array(3).fill('%'+search+'%')];
   const rows=await env.DB.prepare('SELECT * FROM cadastros '+where+' ORDER BY criado_em DESC LIMIT 50 OFFSET ?').bind(...args,(page-1)*50).all();
   const count=await env.DB.prepare('SELECT count(*) AS total FROM cadastros '+where).bind(...args).first();
   return json({items:rows.results,total:count.total,pagina:page});
  }
  if(p==='/api/admin/stats'&&req.method==='GET')return json((await env.DB.prepare('SELECT tipo,situacao,count(*) AS total FROM cadastros GROUP BY tipo,situacao').all()).results);
  if(p==='/api/admin/delete'&&req.method==='POST'){
   const b=await req.json();if(typeof b.id!=='string'||b.confirmacao!==b.id)return json({error:'Confirme o protocolo para excluir.'},400);
   const linked=await env.DB.prepare('SELECT (SELECT count(*) FROM op_apoios WHERE cadastro_id=?) + (SELECT count(*) FROM op_voluntarios WHERE cadastro_id=?) + (SELECT count(*) FROM op_agenda WHERE cadastro_id=?) + (SELECT count(*) FROM crm_cadastro_pessoas WHERE cadastro_id=?) AS total').bind(b.id,b.id,b.id,b.id).first();if(linked.total)return json({error:'Este cadastro possui identidade no CRM, acompanhamentos ou atividades vinculadas. Arquive-o para preservar o histórico.'},409);
   await env.DB.batch([env.DB.prepare('DELETE FROM cadastros WHERE id=?').bind(b.id),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'excluir',b.id,new Date().toISOString())]);return json({ok:true});
  }
  if(p==='/api/admin/update'&&req.method==='POST'){
   const b=await req.json();if(!STATES.includes(b.situacao)||typeof b.id!=='string'||typeof b.notas!=='string'||b.notas.length>2000)return json({error:'Dados inválidos.'},400);
   const result=await env.DB.batch([env.DB.prepare('UPDATE cadastros SET situacao=?,notas=?,atualizado_em=? WHERE id=?').bind(b.situacao,b.notas,new Date().toISOString(),b.id),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'atualizar',b.id,new Date().toISOString())]);
   return json({ok:result[0].meta.changes>0});
  }
  return json({error:'Recurso não encontrado.'},404);
 }
 if(p==='/api/cadastros'&&req.method==='POST'){
  if(!sameOrigin(req))return json({error:'Origem não permitida.'},403);
  if(Number(req.headers.get('content-length'))>10000)return json({error:'Mensagem muito longa.'},413);
  const raw=await req.text();if(raw.length>10000)return json({error:'Mensagem muito longa.'},413);const b=JSON.parse(raw);
  if(b.website)return json({error:'Não foi possível enviar.'},400);
  if(!TYPES.includes(b.tipo)||typeof b.nome!=='string'||b.nome.trim().length<2||b.nome.length>100||typeof b.contato!=='string'||b.contato.length>150||!b.ciente)return json({error:'Confira nome, contato e ciência de privacidade.'},400);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contato)&&!/^\+?[\d\s()\-]{10,25}$/.test(b.contato))return json({error:'Informe um telefone com DDD ou e-mail válido.'},400);
  for(const [k,max] of [['organizacao',150],['mensagem',600]])if(b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>max))return json({error:'Confira o tamanho dos campos.'},400);
  const minute=Math.floor(Date.now()/600000),ip=req.headers.get('CF-Connecting-IP')||'unknown';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':'+minute));const key=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const hit=await env.DB.prepare('INSERT INTO limites(chave,quantidade,expira_em) VALUES(?,1,?) ON CONFLICT(chave) DO UPDATE SET quantidade=quantidade+1 RETURNING quantidade').bind(key,Date.now()+1200000).first();
  if(hit.quantidade>5)return json({error:'Aguarde alguns minutos antes de enviar novamente.'},429);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await env.DB.batch([env.DB.prepare('INSERT INTO cadastros(id,tipo,nome,contato,organizacao,mensagem,situacao,notas,privacidade_versao,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,\'novo\',\'\',?,?,?)').bind(id,b.tipo,b.nome.trim(),b.contato.trim(),(b.organizacao||'').trim(),(b.mensagem||'').trim(),'2026-11-08',now,now),env.DB.prepare('DELETE FROM limites WHERE expira_em < ?').bind(Date.now())]);
  return json({ok:true,protocolo:id},201);
 }
 if(p==='/admin'||p==='/admin/'){
  if(!req.headers.get('oai-authenticated-user-id'))return Response.redirect(url.origin+'/signin-with-chatgpt?return_to=%2Fadmin',302);
  if(!admin(req))return new Response('Área restrita ao administrador do Instituto.',{status:403,headers:safeHeaders});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json({error:'Método não permitido.'},405);
 const projectPage=await publicProjectPage(req,env,url);if(projectPage)return projectPage;
 let path=p==='/'?'/index.html':p==='/admin/'?'/admin.html':p==='/admin'?'/admin.html':p;
 if(!path.split('/').pop().includes('.'))path+='.html';
 if(path==='/admin.html'&&!admin(req))return json({error:'Acesso restrito.'},403);
 const asset=assets[path];if(!asset)return new Response('Página não encontrada',{status:404,headers:safeHeaders});
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 return new Response(req.method==='HEAD'?null:bytes,{headers:{...safeHeaders,'Content-Type':asset.type,'Content-Security-Policy':projectCsp,'X-Robots-Tag':path.startsWith('/admin')?'noindex, nofollow':'all'}});
 }catch(e){if(e instanceof SyntaxError)return json({error:'Dados inválidos. Confira o formulário.'},400);return json({error:'Não foi possível concluir. Tente novamente.'},500);}
}
export default {fetch:handle};
