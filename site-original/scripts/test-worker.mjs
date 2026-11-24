import {DatabaseSync} from 'node:sqlite';import {existsSync,readFileSync,readdirSync} from 'node:fs';import assert from 'node:assert/strict';import worker from '../dist/server/index.js';
const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
class Q{constructor(sql){this.sql=sql;this.args=[];}bind(...v){this.args=v;return this;}async first(){return db.prepare(this.sql).get(...this.args)||null;}async all(){return{results:db.prepare(this.sql).all(...this.args)};}async run(){if(this.sql.trim().startsWith('SELECT'))return this.all();return{meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes)}};}}
const env={DB:{prepare:s=>new Q(s),async batch(qs){db.exec('BEGIN');try{const out=[];for(const q of qs)out.push(await q.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}}};
const origin='https://test.local',owner={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'admin@example.test'},today=new Date().toISOString().slice(0,10),period=today.slice(0,7);
const legacyPublicId='11111111-1111-4111-8111-111111111111';db.prepare('INSERT INTO projetos_gestao(id,titulo,situacao,notas,criado_em,atualizado_em,resumo,publicado) VALUES(?,?,?,?,?,?,?,1)').run(legacyPublicId,'Projeto já divulgado antes da atualização','em_andamento','SEGREDO_INTERNO_LEGADO',new Date().toISOString(),new Date().toISOString(),'Resumo público preservado na importação.');
const call=(p,method='GET',body,headers={})=>worker.fetch(new Request(origin+p,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);const data=async r=>r.json();
for(const p of ['/api/admin/overview','/api/admin/entries','/api/admin/operacoes'])assert.equal((await call(p)).status,403);assert.equal((await call('/admin')).status,302);
const contact={tipo:'acolhimento',nome:'Teste em memória',contato:'teste@example.org',organizacao:'',mensagem:'',ciente:true};assert.equal((await call('/api/cadastros','POST',contact,{Origin:'https://other.local'})).status,403);assert.equal((await call('/api/cadastros','POST',contact)).status,201);
assert.equal((await call('/api/admin/entries','POST',contact)).status,403);const manual=await data(await call('/api/admin/entries','POST',{...contact,nome:'Contato administrativo',contato:'outro@example.org'},owner));assert.ok(manual.id);
const publication={periodo:period,pessoas:1,familias:1,atendimentos:22,cestas:22,voluntarios:2,acoes:0,fonte:'Relatório fictício',parceiros:[],confirmado:true};assert.equal((await call('/api/admin/impacto','POST',publication,owner)).status,200);
let summary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(summary.cadastros,2);assert.equal(summary.pessoas,3);assert.equal(summary.publicacao.pessoas,1);assert.equal(summary.tipos.find(r=>r.tipo==='acolhimento').total,2);
const op={tipo:'atendimento',data_ocorrencia:today,quantidade:2,notas:'Teste',cadastro_id:manual.id};assert.equal((await call('/api/admin/operacoes','POST',op)).status,403);assert.equal((await call('/api/admin/operacoes','POST',{...op,quantidade:-1},owner)).status,400);const saved=await data(await call('/api/admin/operacoes','POST',op,owner));assert.ok(saved.id);assert.equal((await call('/api/admin/operacoes','POST',{...op,tipo:'cesta',quantidade:3},owner)).status,200);
summary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(summary.atendimentos,24);assert.equal(summary.cestas,25);
assert.equal((await call('/api/admin/operacoes','POST',{...op,id:saved.id,quantidade:4},owner)).status,200);summary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(summary.atendimentos,26);assert.equal((await data(await call('/api/admin/operacoes','GET',undefined,owner))).items.length,2);
const pub=(await data(await call('/api/impacto'))).periodos.find(r=>r.periodo===period);assert.equal(pub.pessoas,3);assert.equal(pub.base.pessoas,1);assert.equal(pub.atendimentos,26);assert.equal(pub.cestas,25);assert.equal(pub.cadastro_nome,undefined);
assert.equal((await call('/api/admin/impacto','POST',{...publication,pessoas:2},owner)).status,200);summary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(summary.pessoas,4);assert.equal(summary.atendimentos,26);
const action={titulo:'Ação de teste',resumo:'Ação fictícia em memória',conteudo:'Teste',data_realizacao:today,publicada:false};let a=await data(await call('/api/admin/acoes','POST',action,owner));assert.equal((await data(await call('/api/acoes'))).items.length,0);assert.equal((await call('/api/admin/acoes','POST',{...action,id:a.id,publicada:true},owner)).status,200);assert.equal((await data(await call('/api/acoes'))).items.length,1);
const project={titulo:'Projeto fictício',situacao:'concluido',data_inicio:today,data_fim:today,notas:'Teste'};assert.equal((await call('/api/admin/projetos','POST',project,owner)).status,200);assert.equal((await call('/api/admin/backups','GET',undefined,owner)).status,404);
assert.ok(!readFileSync('dist/impacto.html','utf8').includes('impact-download'));assert.ok(!readFileSync('dist/admin.html','utf8').includes('copias-seguranca'));assert.ok(readFileSync('dist/admin.html','utf8').includes('registro-form'));
console.log('PASS: manual and public registrations, monthly type breakdown, combined reach, automatic service and basket totals, idempotent record editing, legacy base separation, public privacy, restricted access, actions and projects; public CSV and backup module removed. Test data stayed in memory.');
const volunteer={...contact,tipo:'voluntariado',nome:'Voluntário de teste',contato:'voluntario@example.org'};assert.equal((await call('/api/admin/entries','POST',volunteer,owner)).status,201);summary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(summary.voluntarios,3);const vp=(await data(await call('/api/impacto'))).periodos.find(r=>r.periodo===period);assert.equal(vp.voluntarios,3);assert.equal(vp.base.voluntarios,2);
const free=await data(await call('/api/admin/operacoes','POST',{...op,tipo:'outro',descricao_tipo:'Roda de conversa comunitária',cadastro_id:'',quantidade:1},owner));assert.ok(free.id);let ops=(await data(await call('/api/admin/operacoes','GET',undefined,owner))).items;assert.equal(ops.find(r=>r.id===free.id).descricao_tipo,'Roda de conversa comunitária');summary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(summary.atendimentos,26);
assert.equal((await call('/api/admin/operacoes/excluir','POST',{id:saved.id,confirmacao:saved.id})).status,403);assert.equal((await call('/api/admin/operacoes/excluir','POST',{id:saved.id,confirmacao:'não'},owner)).status,400);assert.equal((await call('/api/admin/operacoes/excluir','POST',{id:saved.id,confirmacao:saved.id},owner)).status,200);summary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(summary.atendimentos,22);assert.equal(summary.cestas,25);assert.equal((await call('/api/admin/operacoes/excluir','POST',{id:saved.id,confirmacao:saved.id},owner)).status,404);
console.log('PASS: volunteer registration updates both dashboards without overwriting the manual base; arbitrary descriptions preserve category counts; deletion requires authorization and confirmation and recalculates totals.');
// Central administration: preserve old behavior and add unified editing/publication.
for(const route of ['/api/admin/central','/api/admin/registro?tipo=pessoa&id='+crypto.randomUUID(),'/api/admin/atividade','/api/admin/publicacoes','/api/admin/anexos'])assert.equal((await call(route)).status,403);
assert.equal((await call('/api/cadastros','POST',{...contact,tipo:'pessoa'})).status,400);
const beforePeople=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));
const personBody={tipo:'pessoa',nome:'Pessoa de teste em memória',contato:'',organizacao:'',mensagem:'',ciente:true,situacao:'novo',notas:'Anotação privada de teste'};
const person=await data(await call('/api/admin/entries','POST',personBody,owner));assert.ok(person.id);
let personSummary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(personSummary.cadastros,beforePeople.cadastros+1);
assert.equal((await call('/api/admin/entries','POST',{...personBody,id:person.id,nome:'Nome corrigido em memória',situacao:'em_contato'},owner)).status,200);
personSummary=await data(await call('/api/admin/overview?periodo='+period,'GET',undefined,owner));assert.equal(personSummary.cadastros,beforePeople.cadastros+1);
const central=await data(await call('/api/admin/central?tipo=pessoa&busca=Nome%20corrigido','GET',undefined,owner));assert.equal(central.total,1);assert.equal(central.items[0].id,person.id);
const attack=await data(await call('/api/admin/central?busca='+encodeURIComponent("' OR 1=1 --"),'GET',undefined,owner));assert.equal(attack.total,0);
const stored=await data(await call('/api/admin/registro?tipo=pessoa&id='+person.id,'GET',undefined,owner));assert.equal(stored.item.notas,personBody.notas);
assert.ok(!JSON.stringify(await data(await call('/api/impacto'))).includes(personBody.notas));
const publicProject={titulo:'Projeto público de teste',situacao:'em_andamento',data_inicio:today,data_fim:'',notas:'NOTAS_INTERNAS_NAO_PUBLICAR',resumo:'Resumo autorizado de um projeto fictício em memória.',publicado:false};
const cp=await data(await call('/api/admin/projetos','POST',publicProject,owner));assert.ok(cp.id);assert.ok(!(await data(await call('/api/projetos'))).items.some(p=>p.id===cp.id));
assert.equal((await call('/api/admin/projetos','POST',{...publicProject,id:cp.id,publicado:true},owner)).status,200);
let visibleProjects=(await data(await call('/api/projetos'))).items;assert.ok(visibleProjects.length>=8);assert.ok(!visibleProjects.some(p=>p.id===cp.id));assert.ok(visibleProjects.every(p=>p.notas===undefined));assert.ok(!JSON.stringify(visibleProjects).includes(publicProject.notas));
assert.equal((await call('/api/admin/projetos','POST',{...publicProject,id:cp.id,publicado:false},owner)).status,200);assert.ok(!(await data(await call('/api/projetos'))).items.some(p=>p.id===cp.id));
const objects=new Map();env.BUCKET={async put(key,bytes,options){objects.set(key,{body:bytes,httpMetadata:options?.httpMetadata});},async get(key){return objects.get(key)||null;},async delete(key){objects.delete(key);}};
const upload=async(file,headers=owner)=>{const f=new FormData();f.set('arquivo',file);f.set('titulo','Anexo de teste em memória');f.set('descricao','Documento fictício para verificação');return worker.fetch(new Request(origin+'/api/admin/anexos',{method:'POST',headers:{Origin:origin,...headers},body:f}),env);};
const pngBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC8sAAAAASUVORK5CYII=','base64');
assert.equal((await upload(new File([pngBytes],'teste.png',{type:'image/png'}),{})).status,403);
assert.equal((await upload(new File(['<script>alert(1)</script>'],'oculto.png',{type:'image/png'}))).status,400);
const uploaded=await data(await upload(new File([pngBytes],'teste.html',{type:'image/png'})));assert.ok(uploaded.id);
// Document security: full institutional documents are now private, including legacy public attachments.
const otherUser={'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.org'};
assert.equal((await call('/api/documentos')).status,403);assert.equal((await call('/api/anexos/'+uploaded.id)).status,404);
const download=await call('/api/anexos/'+uploaded.id+'?download=1','GET',undefined,owner);assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'image/png');assert.ok(download.headers.get('content-disposition').startsWith('attachment;'));assert.ok(download.headers.get('content-disposition').includes('.png'));assert.deepEqual(new Uint8Array(await download.arrayBuffer()),new Uint8Array(pngBytes));
assert.equal((await call('/api/admin/anexos/atualizar','POST',{id:uploaded.id,titulo:'Tentativa de publicar documento',descricao:'Não deve ser publicado',publico:true},owner)).status,400);
const rejectedUpload=new FormData();rejectedUpload.set('arquivo',new File([pngBytes],'publico.png',{type:'image/png'}));rejectedUpload.set('titulo','Documento não publicável');rejectedUpload.set('publico','true');const objectsBefore=objects.size;assert.equal((await worker.fetch(new Request(origin+'/api/admin/anexos',{method:'POST',headers:{Origin:origin,...owner},body:rejectedUpload}),env)).status,400);assert.equal(objects.size,objectsBefore);
// Simulate a row saved by an earlier version with public visibility; the old flag grants no access.
db.prepare('UPDATE anexos SET publico=1 WHERE id=?').run(uploaded.id);
for(const method of ['GET','HEAD'])for(const headers of [{},otherUser])assert.equal((await call('/api/anexos/'+uploaded.id,method,undefined,headers)).status,404);
const attachmentHead=await worker.fetch(new Request(origin+'/api/anexos/'+uploaded.id,{method:'HEAD',headers:owner}),env);assert.equal(attachmentHead.status,200);assert.equal(await attachmentHead.text(),'');assert.equal(attachmentHead.headers.get('cache-control'),'no-store');
assert.equal((await call('/api/anexos/'+uploaded.id,'GET',undefined,owner)).headers.get('content-disposition').split(';')[0],'inline');
const privateListing=await data(await call('/api/admin/anexos','GET',undefined,owner));assert.equal(privateListing.items.find(row=>row.id===uploaded.id).publico,0);assert.ok(!JSON.stringify(privateListing).includes('"chave"'));
const fileRecord=(await data(await call('/api/admin/registro?tipo=anexo&id='+uploaded.id,'GET',undefined,owner))).item;assert.equal(fileRecord.publico,0);assert.equal(fileRecord.chave,undefined);
assert.equal((await call('/api/admin/anexos/atualizar','POST',{id:uploaded.id,titulo:'Documento interno corrigido',descricao:'Versão da equipe',publico:false},owner)).status,200);
const documentRoute='/api/admin/documentos/estatuto-social',statutePath='private/documentos/estatuto-social-instituto-mais-amor.pdf',originalStatute=existsSync(statutePath)?readFileSync(statutePath):null;
for(const route of ['/api/admin/documentos',documentRoute,documentRoute+'?download=1'])for(const headers of [{},otherUser])assert.equal((await call(route,'GET',undefined,headers)).status,403);
for(const method of ['GET','HEAD']){
 for(const headers of [{},otherUser])assert.equal((await call(documentRoute,method,undefined,headers)).status,403);
 const response=await worker.fetch(new Request(origin+documentRoute,{method,headers:owner}),env);assert.equal(response.status,originalStatute?200:404);if(!originalStatute)continue;assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.ok(response.headers.get('content-disposition').startsWith('inline;'));assert.equal(response.headers.get('content-length'),String(originalStatute.length));assert.deepEqual(Buffer.from(await response.arrayBuffer()),method==='HEAD'?Buffer.alloc(0):originalStatute);
}
const statuteDownload=await call(documentRoute+'?download=1','GET',undefined,owner);assert.equal(statuteDownload.status,originalStatute?200:404);if(originalStatute){assert.ok(statuteDownload.headers.get('content-disposition').startsWith('attachment;'));assert.deepEqual(Buffer.from(await statuteDownload.arrayBuffer()),originalStatute);}
for(const route of ['/documentos/estatuto-social-instituto-mais-amor.pdf','/private/documentos/estatuto-social-instituto-mais-amor.pdf','/server/index.js'])for(const method of ['GET','HEAD'])assert.equal((await call(route,method)).status,404);
assert.equal((await call('/api/admin/documentos/inexistente','GET',undefined,owner)).status,404);
const internalCatalog=await data(await call('/api/admin/documentos','GET',undefined,owner));assert.equal(internalCatalog.items.some(row=>row.id==='estatuto-social'),!!originalStatute);if(originalStatute)assert.ok(internalCatalog.items.some(row=>row.id==='estatuto-social'&&row.origem==='institucional'&&row.tamanho===originalStatute.length));assert.ok(internalCatalog.items.some(row=>row.id===uploaded.id&&row.origem==='anexo'));assert.ok(internalCatalog.items.every(row=>row.chave===undefined&&row.data===undefined));
for(const route of ['/transparencia','/transparencia/','/transparencia.html']){const response=await call(route);assert.equal(response.status,302);assert.equal(response.headers.get('location'),origin+'/admin#documentos-internos');assert.equal(await response.text(),'');}
for(const file of readdirSync('dist').filter(file=>file.endsWith('.html')&&!['admin.html','transparencia.html'].includes(file))){const html=readFileSync('dist/'+file,'utf8');assert.ok(!/href="(?:\/)?transparencia(?:\.html)?(?:#|"|\/)/.test(html),file);assert.ok(!html.includes('documentos/estatuto-social'),file);assert.ok(!html.includes('Tesouraria'),file);}
const protectedAdminPage=await call('/admin','GET',undefined,owner);assert.equal(protectedAdminPage.status,200);assert.ok((await protectedAdminPage.text()).includes('id="documentos-internos"'));assert.equal((await call('/admin','GET',undefined,otherUser)).status,403);
assert.equal((await call('/impacto')).status,200);assert.equal((await call('/api/impacto')).status,200);const publicSitemap=await(await call('/sitemap.xml')).text();assert.ok(!publicSitemap.includes('/transparencia'));assert.ok(!publicSitemap.includes('/admin'));assert.ok(publicSitemap.includes('/impacto.html'));
const pubCenter=await data(await call('/api/admin/publicacoes','GET',undefined,owner));assert.ok(!pubCenter.items.some(r=>r.categoria==='anexo'));assert.ok(pubCenter.items.some(r=>r.categoria==='resultado'&&r.id===period));
console.log('PASS: institutional PDF checked byte for byte when supplied; authenticated catalog, inline consultation and download; anonymous/other-user GET and HEAD denied; legacy public attachments protected; public-document upload rejected; old static URLs blocked; transparency removed from public navigation and sitemap; impact remains public.');
const log=await data(await call('/api/admin/atividade','GET',undefined,owner));assert.ok(log.totais.some(r=>r.categoria==='pessoa'&&r.total===1));assert.ok(log.items.length>0);
assert.ok(readFileSync('dist/admin.html','utf8').includes('id="cadastros"'));assert.ok(readFileSync('dist/admin.html','utf8').includes('id="publicacoes"'));assert.ok(!readFileSync('dist/admin.html','utf8').includes('manual-contact-form'));
console.log('PASS: unified record search/editing, person registration without duplicate counts, protected private details, canonical public project catalog separated from private project history, file signature validation, authenticated private downloads, private-only institutional files, publication center and live database totals. All test records and files remained in memory.');
// Full read-only record view: keep private fields behind the existing admin boundary.
assert.equal((await call('/api/admin/cadastros-detalhados')).status,403);
assert.equal((await call('/api/admin/cadastros-detalhados','GET',undefined,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.org'})).status,403);
const detailPeople=await data(await call('/api/admin/cadastros-detalhados?tipo=pessoa&busca=Nome%20corrigido','GET',undefined,owner));
assert.equal(detailPeople.total,1);assert.equal(detailPeople.pagina,1);assert.equal(detailPeople.por_pagina,50);
const detailPerson=detailPeople.items[0];assert.equal(detailPerson.id,person.id);assert.equal(detailPerson.categoria,'pessoa');assert.equal(detailPerson.nome,'Nome corrigido em memória');assert.equal(detailPerson.contato,'');assert.equal(detailPerson.notas,personBody.notas);assert.equal(detailPerson.mensagem,'');assert.ok(detailPerson.privacidade_versao);assert.ok(detailPerson.criado_em);assert.ok(detailPerson.atualizado_em);
const detailProject=(await data(await call('/api/admin/cadastros-detalhados?tipo=projeto','GET',undefined,owner))).items.find(row=>row.id===cp.id);assert.equal(detailProject.resumo,publicProject.resumo);assert.equal(detailProject.notas,publicProject.notas);assert.equal(detailProject.categoria,'projeto');assert.equal(detailProject.publicado,0);
const detailOperation=(await data(await call('/api/admin/cadastros-detalhados?tipo=operacao','GET',undefined,owner))).items.find(row=>row.id===free.id);assert.equal(detailOperation.categoria,'operacao');assert.equal(detailOperation.descricao_tipo,'Roda de conversa comunitária');assert.equal(detailOperation.quantidade,1);assert.equal(detailOperation.notas,op.notas);assert.ok(Object.hasOwn(detailOperation,'cadastro_nome'));
const detailAction=(await data(await call('/api/admin/cadastros-detalhados?tipo=acao','GET',undefined,owner))).items.find(row=>row.id===a.id);assert.equal(detailAction.categoria,'acao');assert.equal(detailAction.conteudo,action.conteudo);assert.equal(detailAction.publicada,1);
const detailInjection=await data(await call('/api/admin/cadastros-detalhados?busca='+encodeURIComponent("' OR 1=1 --"),'GET',undefined,owner));assert.equal(detailInjection.total,0);
// 51 in-memory records exercise the fixed 50-item bound and a complete second page.
for(let i=0;i<51;i++){const response=await call('/api/admin/entries','POST',{...contact,tipo:'contato',nome:'LOTE_TESTE_DETALHES_'+String(i).padStart(2,'0'),contato:'lote-'+i+'@example.org',organizacao:'Organização em memória',mensagem:'Mensagem completa\nSegunda linha',notas:'Notas completas do cadastro '+i,situacao:i===0?'arquivado':'novo'},owner);assert.equal(response.status,201);}
const detailQuery='/api/admin/cadastros-detalhados?tipo=contato&busca=LOTE_TESTE_DETALHES_';
const detailPage1=await data(await call(detailQuery+'&pagina=1','GET',undefined,owner)),detailPage2=await data(await call(detailQuery+'&pagina=2','GET',undefined,owner));
assert.equal(detailPage1.items.length,50);assert.equal(detailPage2.items.length,1);assert.equal(detailPage1.total,51);assert.equal(detailPage2.total,51);assert.equal(detailPage2.pagina,2);assert.equal(detailPage2.por_pagina,50);assert.equal(new Set([...detailPage1.items,...detailPage2.items].map(row=>row.id)).size,51);assert.ok(detailPage1.items.every(row=>row.categoria==='contato'&&row.mensagem==='Mensagem completa\nSegunda linha'&&row.notas.startsWith('Notas completas')));
const detailArchived=await data(await call(detailQuery+'&situacao=arquivado','GET',undefined,owner));assert.equal(detailArchived.total,1);assert.equal(detailArchived.items[0].situacao,'arquivado');
const detailBeyond=await data(await call(detailQuery+'&pagina=3','GET',undefined,owner));assert.equal(detailBeyond.total,51);assert.deepEqual(detailBeyond.items,[]);
assert.ok(!JSON.stringify(await data(await call('/api/impacto'))).includes(personBody.notas));assert.ok(!JSON.stringify(await data(await call('/api/projetos'))).includes(publicProject.notas));assert.equal((await call('/api/cadastros-detalhados')).status,404);
console.log('PASS: complete read-only administrative records, private-field access checks, all central record categories, filters and injection resistance, fixed 50-item pagination and full second-page retrieval; public APIs remain unchanged. Test records stayed in memory.');

{
for(const endpoint of ['/api/admin/projetos-site','/api/admin/projetos-site/capa','/api/admin/projetos-site/excluir']){
 assert.equal((await call(endpoint,'POST',{})).status,403);
 assert.equal((await call(endpoint,'POST',{}, {...owner,Origin:'https://other.local'})).status,403);
}
let catalog=await data(await call('/api/admin/projetos-site','GET',undefined,owner));
assert.equal(catalog.items.length,9);assert.equal(catalog.items[0].titulo,'Mais Amor Perto De Você');assert.ok(catalog.items.slice(0,8).every(p=>p.publicada&&p.situacao==='planejamento'));assert.equal(catalog.items.find(p=>p.id===legacyPublicId).situacao,'atividade');assert.ok(!JSON.stringify(catalog.items).includes('SEGREDO_INTERNO_LEGADO'));
assert.equal((await data(await call('/api/admin/projetos-site','GET',undefined,owner))).items.length,9);
let html=await (await call('/projetos')).text();assert.equal((html.match(/class="card project-card"/g)||[]).length,9);assert.ok(html.includes('9 projetos publicados'));
assert.ok(!(await (await call('/sitemap.xml')).text()).includes('/admin.html'));
assert.equal((await call('/content.json')).status,404);
assert.equal((await call('/projeto-1')).status,200);assert.equal((await call('/projeto-1.html','HEAD')).status,200);
const fresh={titulo:'Projeto de teste privado',resumo:'Resumo fictício para verificar o sistema.',descricao:'Descrição fictícia.\n\nSegundo parágrafo.',objetivos:['Objetivo de teste'],publico_alvo:'Famílias',atividades:'Oficina de teste',local:'Local de teste',horarios:'Sob consulta',como_participar:'Contate a equipe.',data_inicio:'',data_fim:'',situacao:'planejamento',capa:'/assets/familia-inclusiva.jpg',capa_alt:'Imagem de teste',capa_credito:'Imagem ilustrativa.',publicada:false,destaque:true,ordem:0};
let draft=await data(await call('/api/admin/projetos-site','POST',fresh,owner));assert.ok(draft.item.id);assert.equal(draft.item.versao,1);
assert.equal((await call(draft.url)).status,404);assert.equal((await call(draft.url+'?preview=1')).status,404);
let preview=await call(draft.url+'?preview=1','GET',undefined,owner);assert.equal(preview.status,200);assert.equal(preview.headers.get('X-Robots-Tag'),'noindex, nofollow');assert.ok((await preview.text()).includes('Projeto de teste privado'));
assert.ok(!(await (await call('/projetos.html')).text()).includes('Projeto de teste privado'));
assert.ok(!(await (await call('/sitemap.xml')).text()).includes(draft.item.id));
assert.equal((await call('/api/admin/projetos-site','POST',{...fresh,publicada:true,capa:'https://untrusted.example/capa.jpg'},owner)).status,400);
assert.equal((await call('/api/admin/projetos-site','POST',{...fresh,publicada:true,capa:''},owner)).status,400);
assert.equal((await call('/api/admin/projetos-site','POST',{...fresh,data_inicio:'2026-02-30'},owner)).status,400);
assert.equal((await call('/api/admin/projetos-site','POST',{...fresh,objetivos:Array(21).fill('Objetivo')},owner)).status,400);
let published=await data(await call('/api/admin/projetos-site','POST',{...fresh,id:draft.item.id,versao:draft.item.versao,publicada:true,titulo:'Projeto & <script>alert(1)</script> $&'},owner));assert.equal(published.item.versao,2);
html=await (await call('/projetos')).text();assert.ok(html.includes('Projeto &amp; &lt;script&gt;alert(1)&lt;/script&gt; $&'));assert.ok(!html.includes('<script>alert(1)</script>'));
assert.ok((await (await call('/')).text()).includes(published.item.id));
const detail=await (await call(published.url)).text();assert.ok(detail.includes('Descrição fictícia.'));assert.ok(detail.includes('Segundo parágrafo.'));assert.ok(detail.includes('Oficina de teste'));assert.ok(detail.includes('rel="canonical"'));assert.ok(detail.includes('<meta property="og:title" content="Projeto &amp; &lt;script&gt;'));
assert.ok((await (await call('/sitemap.xml')).text()).includes(published.item.id));
assert.equal((await call('/api/admin/projetos-site','POST',{...fresh,id:draft.item.id,versao:1},owner)).status,409);
assert.equal((await call('/api/admin/projetos-site/excluir','POST',{id:draft.item.id,versao:2,confirmacao:'errada'},owner)).status,400);
assert.equal((await call('/api/admin/projetos-site/excluir','POST',{id:draft.item.id,versao:1,confirmacao:draft.item.id},owner)).status,409);
const bucket=new Map();env.BUCKET={async put(key,value,options){bucket.set(key,{body:value,...options});},async get(key){return bucket.get(key)||null;},async head(key){return bucket.get(key)||null;},async delete(key){bucket.delete(key);}};
const imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1kAAAAASUVORK5CYII=','base64');
const upload=(bytes,type='image/png',headers=owner)=>worker.fetch(new Request(origin+'/api/admin/projetos-site/capa',{method:'POST',headers:{...headers,Origin:origin,'Content-Type':type},body:bytes}),env);
assert.equal((await upload(imageBytes,'image/png',{})).status,403);assert.equal((await upload(Buffer.from('<svg>fake</svg>'),'image/svg+xml')).status,400);assert.equal((await upload(imageBytes,'image/jpeg')).status,400);assert.equal((await upload(new Uint8Array(5*1024*1024+1))).status,413);
const image=await data(await upload(imageBytes));assert.ok(image.capa.startsWith('/midia/projetos/'));assert.equal(bucket.size,1);assert.equal((await call(image.capa)).status,404);assert.equal((await call(image.capa,'GET',undefined,owner)).status,200);
published=await data(await call('/api/admin/projetos-site','POST',{...published.item,capa:image.capa},owner));let media=await call(image.capa);assert.equal(media.status,200);assert.equal(media.headers.get('Content-Type'),'image/png');assert.equal((await media.arrayBuffer()).byteLength,imageBytes.length);
published=await data(await call('/api/admin/projetos-site','POST',{...published.item,publicada:false},owner));assert.equal((await call(image.capa)).status,404);assert.equal((await call(published.url)).status,404);assert.ok(!(await (await call('/')).text()).includes(published.item.id));
assert.equal((await call('/api/admin/projetos-site/excluir','POST',{id:published.item.id,versao:published.item.versao,confirmacao:published.item.id},owner)).status,200);assert.equal((await call(published.url+'?preview=1','GET',undefined,owner)).status,404);
catalog=await data(await call('/api/admin/projetos-site','GET',undefined,owner));for(const p of catalog.items)assert.equal((await call('/api/admin/projetos-site/excluir','POST',{id:p.id,versao:p.versao,confirmacao:p.id},owner)).status,200);
assert.equal((await data(await call('/api/admin/projetos-site','GET',undefined,owner))).items.length,0);assert.equal((await data(await call('/api/admin/projetos-site','GET',undefined,owner))).items.length,0);assert.ok((await (await call('/projetos.html')).text()).includes('0 projetos publicados'));assert.equal((await call('/projeto-1.html')).status,404);
assert.ok(readFileSync('dist/admin.html','utf8').includes('projetos-site-admin.js'));assert.ok(readFileSync('dist/admin.html','utf8').includes('public-project-cover-file'));
console.log('PASS: eight original projects imported once; restricted CRUD and uploads; draft privacy; safe HTML and metadata; database-driven home, catalog, detail and sitemap; image type/size validation and access; edit conflict detection; deletion remains effective even after deleting the entire catalog.');

}
{
assert.equal((await call('/api/admin/integracoes')).status,403);
const settings={email:'institucional@example.org',whatsapp:'+55 (11) 99999-1111',instagram:'https://www.instagram.com/instituto_teste/',address:'',hours:''};
assert.equal((await call('/api/admin/integracoes','POST',settings)).status,403);
assert.equal((await call('/api/admin/integracoes','POST',{...settings,instagram:'javascript:alert(1)'},owner)).status,400);
assert.equal((await call('/api/admin/integracoes','POST',settings,owner)).status,200);
const contacts=await data(await call('/api/configuracao-publica'));assert.equal(contacts.whatsapp,'5511999991111');assert.equal(contacts.email,settings.email);assert.ok(contacts.atualizado_em);
const integrationStatus=await data(await call('/api/admin/integracoes','GET',undefined,owner));assert.equal(integrationStatus.banco,'conectado');assert.equal(integrationStatus.notificacoes,'nao_configuradas');
assert.equal((await call('/api/admin/midia/chamada')).status,403);
assert.equal((await call('/api/admin/midia/chamada','PUT',{},owner)).status,415);
for(const path of ['/api/admin/operacao-equipe','/api/admin/operacao-familias','/api/admin/operacao-apoios','/api/admin/operacao-voluntarios','/api/admin/operacao-agenda'])assert.equal((await call(path)).status,403);
const confirmed=await data(await call('/api/impacto-confirmado?periodo='+period));assert.equal(confirmed.atividades_realizadas,0);assert.equal(confirmed.pessoas_atendidas,0);assert.equal(confirmed.cadastro_nome,undefined);
assert.ok(readFileSync('dist/admin.html','utf8').includes('id="video-chamada"'));assert.ok(readFileSync('dist/admin.html','utf8').includes('id="acompanhamento"'));assert.ok(readFileSync('dist/admin.html','utf8').includes('id="integracoes"'));
console.log('PASS: integrated media/operations authorization, confirmed metrics separation, real public contact settings and truthful integration status. All tests stayed in memory.');
}
{
const guardedContact=await data(await call('/api/admin/entries','POST',{tipo:'pessoa',nome:'Pessoa vinculada em memória',contato:'',organizacao:'',mensagem:'',ciente:true},owner));
const referenceProject=crypto.randomUUID(),stamp=new Date().toISOString();db.prepare('INSERT INTO projetos_publicos(id,titulo,criado_em,atualizado_em) VALUES(?,?,?,?)').run(referenceProject,'Projeto vinculado em memória',stamp,stamp);
const support=await data(await call('/api/admin/operacao-apoios','POST',{cadastro_id:guardedContact.id,projeto_publico_id:referenceProject,etapa:'recebido',proxima_acao:'Conferir cadastro',notas:''},owner));assert.ok(support.id);
assert.equal((await call('/api/admin/delete','POST',{id:guardedContact.id,confirmacao:guardedContact.id},owner)).status,409);
assert.equal((await call('/api/admin/projetos-site/excluir','POST',{id:referenceProject,versao:1,confirmacao:referenceProject},owner)).status,409);
assert.ok(db.prepare('SELECT id FROM cadastros WHERE id=?').get(guardedContact.id));assert.ok(db.prepare('SELECT id FROM projetos_publicos WHERE id=?').get(referenceProject));
const staff=await data(await call('/api/admin/operacao-equipe','POST',{nome:'Equipe teste',funcao:'Professor',email:'equipe@example.org',disponibilidade:'',ativo:true},owner));
const historical='2025-10-10T12:00:00.000Z';const session=await data(await call('/api/admin/operacao-agenda','POST',{cadastro_id:guardedContact.id,profissional_id:staff.id,data_hora:historical,duracao_minutos:60,tipo:'Oficina de teste',situacao:'realizado',voluntarios_ids:[],notas:''},owner));assert.ok(session.id);
assert.ok((await data(await call('/api/impacto'))).periodos.some(row=>row.periodo==='2025-10'));
const header=(await call('/admin','GET',undefined,owner)).headers.get('Content-Security-Policy');assert.ok(header.includes("media-src 'self' blob:"));
console.log('PASS: linked records cannot be hard-deleted; historic confirmed activity months reach public selector; admin local media preview is permitted by CSP. Fixtures stayed in memory.');
}

// Institutional month, rather than UTC, must reach the public month selector.
{
const existingAgenda=(await data(await call('/api/admin/operacao-agenda','GET',undefined,owner))).items;
const previousAgenda=existingAgenda[0];assert.ok(previousAgenda);
await data(await call('/api/admin/operacao-agenda','POST',{...previousAgenda,data_hora:'2020-10-31T23:30:00-03:00',voluntarios_ids:[]},owner));
const monthRows=(await data(await call('/api/impacto'))).periodos;
assert.ok(monthRows.some(row=>row.periodo==='2020-10'));
assert.equal(monthRows.some(row=>row.periodo==='2020-11'),false);
assert.equal((await data(await call('/api/impacto-confirmado?periodo=2020-10'))).atividades_realizadas,1);
console.log('PASS: confirmed activity at the Brasília month boundary is included in the correct public month.');
}
// CRM integration preserves authenticated access and protects reconciled source records.
{
for(const resource of ['base','casos','resumo','pessoas','familias','profissionais','unidades','realizacoes','tarefas']){
 const path='/api/admin/crm/'+resource;
 assert.equal((await call(path)).status,403);
 assert.equal((await call(path,'GET',undefined,{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.org'})).status,403);
}
assert.equal((await call('/api/admin/crm/pessoas','POST',{nome:'Identidade bloqueada',ativo:true,contatos:[]},{...owner,Origin:'https://other.local'})).status,403);
const originOnly=await data(await call('/api/admin/entries','POST',{tipo:'pessoa',nome:'Origem conciliada fictícia',contato:'',organizacao:'',mensagem:'',situacao:'novo',notas:'',ciente:true},owner));assert.ok(originOnly.id);
const identity=await data(await call('/api/admin/crm/pessoas','POST',{nome:'Identidade canônica fictícia',ativo:true,contatos:[]},owner));assert.ok(identity.id);
assert.equal((await call('/api/admin/crm/vinculos','POST',{cadastro_id:originOnly.id,pessoa_id:identity.id},owner)).status,200);
assert.equal((await call('/api/admin/delete','POST',{id:originOnly.id,confirmacao:originOnly.id},owner)).status,409);
const crmImpact=await data(await call('/api/crm/impacto?periodo=2020-10'));
for(const key of ['pessoas_apoiadas','familias_apoiadas','atividades_realizadas','cestas_entregues','pecas_entregues','itens_entregues','cadastros_sem_identidade'])assert.ok(Number.isSafeInteger(crmImpact[key]));
assert.ok(!JSON.stringify(crmImpact).includes(identity.id));assert.ok(!JSON.stringify(crmImpact).includes('Identidade canônica'));
assert.equal((await call('/api/crm/impacto?periodo=invalido')).status,400);
assert.ok(readFileSync('dist/admin.html','utf8').includes('id="crm"'));
console.log('PASS: CRM is integrated behind owner/origin checks; canonical-linked signups cannot be hard-deleted; public impact exposes only validated aggregate metrics. Fixtures stayed in memory.');
}
