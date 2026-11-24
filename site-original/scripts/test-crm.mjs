import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
// Fixtures and transactions stay in SQLite memory, never production or network.
const db=new DatabaseSync(':memory:');
for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
db.exec('PRAGMA foreign_keys=ON');let failAtStatement=0;
class Q{constructor(sql){this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:db.prepare(this.sql).all(...this.args)};}async run(){if(failAtStatement>0&&--failAtStatement===0)throw Error('Forced in-memory transaction failure');if(/^\s*(?:SELECT|WITH)/i.test(this.sql))return this.all();return {meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes)}};}}
const env={DB:{prepare:sql=>new Q(sql),async batch(statements){db.exec('BEGIN');try{const output=[];for(const statement of statements)output.push(await statement.run());db.exec('COMMIT');return output;}catch(error){db.exec('ROLLBACK');throw error;}}}};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const admin=req=>req.headers.get('oai-authenticated-user-id')==='crm-test-owner';const sameOrigin=req=>req.headers.get('Origin')===new URL(req.url).origin;
const crmWorkerSource=['worker/operations.js','worker/crm.js'].map(path=>readFileSync(path,'utf8')).join('\n');
const {handleCrmAdmin,handleCrmPublic,crmImpactMetrics,crmConfirmedMonths}=new Function('json','admin','sameOrigin',crmWorkerSource+'\nreturn {handleCrmAdmin,handleCrmPublic,crmImpactMetrics,crmConfirmedMonths};')(json,admin,sameOrigin);
const origin='https://crm.test.local',owner={'oai-authenticated-user-id':'crm-test-owner'},now=new Date().toISOString(),month='2020-10';
async function call(path,method='GET',body,headers=owner){const req=new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),url=new URL(req.url);return await handleCrmAdmin(req,env,url.pathname,url)||await handleCrmPublic(req,env,url.pathname)||json({error:'Not found'},404);}
async function get(route,expected=200){const r=await call('/api/admin/crm/'+route),b=await r.json();assert.equal(r.status,expected,JSON.stringify(b));return b;}
async function post(route,body,expected=200){const r=await call('/api/admin/crm/'+route,'POST',body),b=await r.json();assert.equal(r.status,expected,JSON.stringify(b));return b;}
function signup(type,name){const id=crypto.randomUUID();db.prepare('INSERT INTO cadastros(id,tipo,nome,contato,mensagem,privacidade_versao,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?)').run(id,type,name,'private-contact@example.org','MENSAGEM_PRIVADA_CRM','test-only',now,now);return id;}
const sourceA=signup('acolhimento','Solicitante fictícia A'),sourceB=signup('contato','Mesma pessoa em nova solicitação'),sourceOther=signup('pessoa','Outra pessoa fictícia'),sourceUnmapped=signup('acolhimento','Pessoa não conciliada'),wrongType=signup('voluntariado','Voluntário fictício');
const legacyID=crypto.randomUUID();db.prepare('INSERT INTO registros_operacionais(id,cadastro_id,tipo,data_ocorrencia,quantidade,notas,criado_em,atualizado_em,descricao_tipo) VALUES(?,?,?,?,?,?,?,?,?)').run(legacyID,sourceA,'cesta','2020-10-31',77,'Legacy must remain separate',now,now,'Entrega antiga');db.prepare('INSERT INTO impacto_publicacoes(periodo,pessoas,familias,atendimentos,cestas,voluntarios,acoes,parceiros,fonte,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?)').run(month,900,900,900,900,900,0,'[]','Base antiga em memória',now);
for(const route of ['base','casos','resumo','casos/'+crypto.randomUUID()])assert.equal((await call('/api/admin/crm/'+route,'GET',undefined,{})).status,403);
assert.equal((await call('/api/admin/crm/pessoas','POST',{nome:'Nome de teste',ativo:true,contatos:[]},{...owner,Origin:'https://wrong.test'})).status,403);
assert.equal((await call('/api/crm/impacto?periodo=invalid','GET',undefined,{})).status,400);
assert.equal(db.prepare('SELECT count(*) AS total FROM crm_servicos').get().total,0,'Migration must not seed operational data');
const originalFood=await post('servicos',{nome:'Cesta básica',tipo:'cesta',ativo:true});
const firstBase=await get('base');
const catalog=new Map(firstBase.servicos.map(item=>[item.nome,item]));
assert.equal(catalog.get('Cesta básica').id,originalFood.id);
for(const name of ['Fonoaudiologia','Terapia ocupacional','Fisioterapia','Psicologia','Psicopedagogia']){
 assert.equal(catalog.get(name).tipo,'atendimento');
}
assert.ok(catalog.has('Assistência social e fortalecimento de vínculos')&&catalog.has('Roupas de cama e tecidos para casa'));
assert.ok(firstBase.areas_responsaveis.some(area=>area.nome==='Equipe administrativa'));
const initialInbox=await get('base?pendentes=1');assert.equal(initialInbox.cadastros_total,4);assert.equal((await get('resumo?periodo='+month)).aguardando_triagem,initialInbox.cadastros_total,'Summary triage and visible inbox must count the same supported source types');
await post('servicos/iniciais',{confirmado:true});const starterCount=(await get('base')).servicos.length;assert.ok(starterCount>=3);await post('servicos/iniciais',{confirmado:true});assert.equal((await get('base')).servicos.length,starterCount);
const food=(await get('base')).servicos.find(row=>row.tipo==='cesta');const teaching=await post('servicos',{nome:'Atividade educativa fictícia somente no teste',tipo:'atendimento',ativo:true});assert.ok(food&&teaching.id);
await post('servicos',{nome:'Serviço inválido',tipo:'inventado',ativo:true},400);await post('pessoas',{nome:'P',ativo:true,contatos:[]},400);await post('pessoas',{nome:'Pessoa fictícia',ativo:true,contatos:[{tipo:'email',valor:'inválido'}]},400);
const personBody={nome:'Pessoa canônica fictícia',ativo:true,contatos:[{tipo:'email',valor:'CANONICA@example.org'},{tipo:'telefone',valor:'+55 (11) 99999-1111'}]};
const person=await post('pessoas',personBody),otherPerson=await post('pessoas',{nome:'Outra pessoa canônica',ativo:true,contatos:[]});
await post('vinculos',{cadastro_id:sourceA,pessoa_id:person.id});await post('vinculos',{cadastro_id:sourceB,pessoa_id:person.id});await post('vinculos',{cadastro_id:sourceA,pessoa_id:otherPerson.id},409);await post('vinculos',{cadastro_id:sourceOther,pessoa_id:crypto.randomUUID()},404);await post('vinculos',{cadastro_id:sourceOther,pessoa_id:otherPerson.id});
const family=await post('familias',{nome_referencia:'Família de teste',contato:'Contato privado da família',notas:'NOTA_FAMILIA_PRIVADA',membros:[{pessoa_id:person.id,papel:'referencia'},{pessoa_id:otherPerson.id,papel:'membro'}]});await post('familias',{nome_referencia:'Família inválida',contato:'',notas:'',membros:[{pessoa_id:crypto.randomUUID(),papel:'membro'}]},404);
const staffBody={nome:'Professor fictício',funcao:'Professor de oficinas',email:'teacher-private@example.org',disponibilidade:'Nota declarada',ativo:true,servicos_ids:[food.id,teaching.id],disponibilidades:[{dia_semana:1,inicio_minuto:480,fim_minuto:720,capacidade:3,ativo:true}]};
const staff=await post('profissionais',staffBody),ineligible=await post('profissionais',{...staffBody,nome:'Sem especialidade',servicos_ids:[],disponibilidades:[]}),inactive=await post('profissionais',{...staffBody,nome:'Inativo',ativo:false});
await post('profissionais',{...staffBody,disponibilidades:[{dia_semana:8,inicio_minuto:480,fim_minuto:720,capacidade:1,ativo:true}]},400);await post('profissionais',{...staffBody,disponibilidades:[{dia_semana:1,inicio_minuto:720,fim_minuto:480,capacidade:1,ativo:true}]},400);
const unitBody={nome:'Local de apoio fictício',tipo:'parceiro',email:'private-destination@example.org',telefone:'5511999991111',endereco:'Endereço de teste',instrucoes:'INSTRUCOES_DESTINO_PRIVADAS',ativo:true,servicos_ids:[food.id,teaching.id]};const unit=await post('unidades',unitBody),wrongUnit=await post('unidades',{...unitBody,nome:'Destino sem serviço',servicos_ids:[]});await post('unidades',{...unitBody,nome:'Destino inválido',servicos_ids:[crypto.randomUUID()]},404);
const caseBody={cadastro_id:sourceA,pessoa_id:person.id,familia_id:family.id,servico_id:food.id,profissional_id:staff.id,etapa:'recebido',prioridade:'alta',prazo:'2020-10-31',proxima_acao:'Conferir necessidade',notas:'NOTAS_CASO_PRIVADAS'};
await post('casos',{...caseBody,cadastro_id:wrongType},400);await post('casos',{...caseBody,profissional_id:ineligible.id},400);await post('casos',{...caseBody,profissional_id:inactive.id},400);await post('casos',{...caseBody,servico_id:crypto.randomUUID()},404);
const caseA=await post('casos',caseBody),caseB=await post('casos',{...caseBody,cadastro_id:sourceB,servico_id:teaching.id});
let detail=await get('casos/'+caseA.id);assert.equal(detail.item.pessoa_id,person.id);assert.equal(detail.item.servico_id,food.id);assert.ok(detail.sugestoes.profissionais.some(row=>row.id===staff.id));assert.ok(!detail.sugestoes.profissionais.some(row=>row.id===ineligible.id));assert.ok(detail.sugestoes.unidades.some(row=>row.id===unit.id));assert.ok(!detail.sugestoes.unidades.some(row=>row.id===wrongUnit.id));assert.ok(detail.historico.length>0);
const staleVersion=detail.item.atualizado_em;await post('casos',{...caseBody,id:caseA.id,atualizado_em:'2000-01-01T00:00:00.000Z'},409);await post('casos',{...caseBody,id:caseA.id,atualizado_em:staleVersion,etapa:'concluido'},400);await post('casos',{...caseBody,id:caseA.id,atualizado_em:staleVersion,etapa:'encaminhado'},400);await post('casos',{...caseBody,id:caseA.id,atualizado_em:staleVersion,proxima_acao:'Contatar a rede'});
const filtered=await get('casos?servico_id='+food.id+'&prioridade=alta&busca='+encodeURIComponent('Pessoa canônica'));assert.ok(filtered.items.some(row=>row.id===caseA.id));assert.ok(!filtered.items.some(row=>row.id===caseB.id));
await post('encaminhamentos',{apoio_id:caseA.id,unidade_id:wrongUnit.id,status:'aguardando',retorno_previsto:'2020-10-31',notas:''},400);const referralBody={apoio_id:caseA.id,unidade_id:unit.id,profissional_id:staff.id,status:'aguardando',retorno_previsto:'2020-10-31',notas:'ENCAMINHAMENTO_PRIVADO'};const referral=await post('encaminhamentos',referralBody);assert.ok(referral.id);await post('encaminhamentos',referralBody,409);assert.equal((await get('casos/'+caseA.id)).item.etapa,'encaminhado');
assert.equal((await crmImpactMetrics(env,month)).atividades_realizadas,0,'Referral is not completed support');const task=await post('tarefas',{apoio_id:caseA.id,responsavel_id:staff.id,titulo:'Confirmar acolhimento',prazo:'2020-10-31',situacao:'aberta'});assert.ok((await get('casos/'+caseA.id)).tarefas.some(row=>row.id===task.id));const summary=await get('resumo?periodo='+month);assert.ok(summary.tarefas_abertas>=1&&summary.tarefas_atrasadas>=1&&summary.abertos>=2);
const foodDelivery={apoio_id:caseA.id,servico_id:food.id,familia_id:family.id,profissional_id:staff.id,unidade_id:unit.id,data_ocorrencia:'2020-10-31',quantidade:3,status:'realizado',notas:'REALIZACAO_PRIVADA'};
await post('realizacoes',{...foodDelivery,data_ocorrencia:'2999-01-01'},400);await post('realizacoes',{...foodDelivery,data_ocorrencia:'2020-02-30'},400);await post('realizacoes',{...foodDelivery,quantidade:0},400);const delivery=await post('realizacoes',foodDelivery);
let metrics=await crmImpactMetrics(env,month);assert.equal(metrics.pessoas_apoiadas,1);assert.equal(metrics.familias_apoiadas,1);assert.equal(metrics.atividades_realizadas,1);assert.equal(metrics.cestas_entregues,3);await post('servicos',{id:food.id,nome:food.nome,tipo:'outro',unidade_medida:'item',ativo:true},409);
await post('realizacoes',{...foodDelivery,id:delivery.id,quantidade:4,notas:'Correção da quantidade'});metrics=await crmImpactMetrics(env,month);assert.equal(metrics.atividades_realizadas,1);assert.equal(metrics.cestas_entregues,4);
const teachingDelivery={apoio_id:caseB.id,servico_id:teaching.id,familia_id:family.id,profissional_id:staff.id,unidade_id:unit.id,data_ocorrencia:'2020-10-31',quantidade:1,status:'realizado',notas:'Atividade privada'};await post('realizacoes',{...teachingDelivery,quantidade:2},400);const lesson=await post('realizacoes',teachingDelivery);metrics=await crmImpactMetrics(env,month);assert.equal(metrics.pessoas_apoiadas,1,'Same canonical person across two requests counts once');assert.equal(metrics.familias_apoiadas,1,'Do not inflate supported people by family membership');assert.equal(metrics.atividades_realizadas,2);
await post('realizacoes',{...teachingDelivery,id:lesson.id,status:'cancelado',notas:''},400);await post('realizacoes',{...teachingDelivery,id:lesson.id,status:'cancelado',notas:'Cancelamento conferido'});assert.equal((await crmImpactMetrics(env,month)).atividades_realizadas,1);await post('realizacoes',{...teachingDelivery,id:lesson.id,status:'realizado',notas:'Reativação conferida'});assert.equal((await crmImpactMetrics(env,month)).atividades_realizadas,2);
detail=await get('casos/'+caseA.id);await post('casos',{...caseBody,id:caseA.id,atualizado_em:detail.item.atualizado_em,etapa:'concluido'});assert.equal((await get('casos/'+caseA.id)).item.etapa,'concluido');
function agenda(cadastroId,apoioId,timestamp){const id=crypto.randomUUID();db.prepare('INSERT INTO op_agenda(id,apoio_id,cadastro_id,familia_id,profissional_id,data_hora,duracao_minutos,tipo,situacao,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,apoioId,cadastroId,family.id,staff.id,timestamp,60,'Atividade fictícia','realizado',now,now);return id;}
const agendaId=agenda(sourceB,caseB.id,'2020-11-01T01:30:00.000Z');assert.equal((await crmImpactMetrics(env,month)).atividades_realizadas,3,'Brasília month includes Oct31 22:30');const linked=await post('realizacoes',{...teachingDelivery,agenda_id:agendaId});assert.equal((await crmImpactMetrics(env,month)).atividades_realizadas,3,'Agenda and linked CRM fulfillment are one occurrence');await post('realizacoes',{...teachingDelivery,agenda_id:agendaId},409);await post('realizacoes',{...teachingDelivery,agenda_id:agendaId,apoio_id:caseA.id},400);await post('realizacoes',{...teachingDelivery,id:linked.id,agenda_id:agendaId,status:'cancelado',notas:'Cancelado após conferência'});assert.equal((await crmImpactMetrics(env,month)).atividades_realizadas,2,'Cancelled CRM detail must not resurrect linked agenda');await post('realizacoes',{...teachingDelivery,id:linked.id,agenda_id:agendaId,status:'realizado',notas:'Restaurado'});
agenda(sourceUnmapped,null,'2020-10-31T12:00:00.000Z');metrics=await crmImpactMetrics(env,month);assert.equal(metrics.pessoas_apoiadas,1);assert.equal(metrics.cadastros_sem_identidade,1);await post('vinculos',{cadastro_id:sourceUnmapped,pessoa_id:otherPerson.id});metrics=await crmImpactMetrics(env,month);assert.equal(metrics.pessoas_apoiadas,2);assert.equal(metrics.cadastros_sem_identidade,0);await post('vinculos',{cadastro_id:sourceUnmapped,pessoa_id:person.id,confirmar_revisao:true});assert.equal((await crmImpactMetrics(env,month)).pessoas_apoiadas,1);
// Material support measures quantities without counting each item as a person.
const clothes=(await get('base')).servicos.find(row=>row.tipo==='outro'&&/roup/i.test(row.nome));assert.ok(clothes);const materialCase=await post('casos',{...caseBody,cadastro_id:sourceOther,pessoa_id:otherPerson.id,servico_id:clothes.id,profissional_id:'',prazo:'2020-11-15'});await post('realizacoes',{apoio_id:materialCase.id,servico_id:clothes.id,familia_id:family.id,data_ocorrencia:'2020-11-15',quantidade:6,status:'realizado',notas:'Peças de roupa de teste'});const materialMetrics=await crmImpactMetrics(env,'2020-11');assert.equal(materialMetrics.pessoas_apoiadas,1);assert.equal(materialMetrics.atividades_realizadas,1);assert.equal(materialMetrics.cestas_entregues,0);assert.equal(materialMetrics.pecas_entregues,6);assert.equal(materialMetrics.itens_entregues,0);
const utensils=(await get('base')).servicos.find(row=>row.nome==='Utensílios para casa');assert.ok(utensils);const utensilsCase=await post('casos',{...caseBody,cadastro_id:sourceOther,pessoa_id:otherPerson.id,servico_id:utensils.id,profissional_id:'',prazo:'2020-11-15'});const utensilsBody={apoio_id:utensilsCase.id,servico_id:utensils.id,familia_id:family.id,data_ocorrencia:'2020-11-15',quantidade:4,status:'realizado',notas:'Utensílios de teste em memória'};const utensilsDelivery=await post('realizacoes',utensilsBody);const combinedMaterials=await crmImpactMetrics(env,'2020-11');assert.equal(combinedMaterials.pessoas_apoiadas,1,'Pieces and household items do not each become a supported person');assert.equal(combinedMaterials.familias_apoiadas,1);assert.equal(combinedMaterials.atividades_realizadas,2);assert.equal(combinedMaterials.cestas_entregues,0);assert.equal(combinedMaterials.pecas_entregues,6);assert.equal(combinedMaterials.itens_entregues,4);await post('realizacoes',{...utensilsBody,id:utensilsDelivery.id,quantidade:2});assert.equal((await crmImpactMetrics(env,'2020-11')).itens_entregues,2);await post('realizacoes',{...utensilsBody,id:utensilsDelivery.id,status:'cancelado',notas:'Cancelamento dos itens após conferência'});assert.equal((await crmImpactMetrics(env,'2020-11')).itens_entregues,0);assert.equal((await get('casos/'+materialCase.id)).realizacoes[0].unidade_medida,'peca');assert.ok((await get('realizacoes?busca='+encodeURIComponent('Utensílios para casa'))).items.some(row=>row.id===utensilsDelivery.id&&row.unidade_medida==='item'));

const publicResponse=await call('/api/crm/impacto?periodo='+month,'GET',undefined,{});assert.equal(publicResponse.status,200);const publicMetrics=await publicResponse.json();assert.equal(publicMetrics.pessoas_apoiadas,1);const serialized=JSON.stringify(publicMetrics);for(const value of [sourceA,sourceB,person.id,staff.id,unit.id,'Pessoa canônica','private-contact','NOTAS_CASO_PRIVADAS','REALIZACAO_PRIVADA','teacher-private'])assert.ok(!serialized.includes(value),'Public aggregate leaked '+value);assert.ok(JSON.stringify(await crmConfirmedMonths(env)).includes(month));
const beforePerson=db.prepare('SELECT * FROM crm_pessoas WHERE id=?').get(person.id),beforeContacts=db.prepare('SELECT * FROM crm_pessoa_contatos WHERE pessoa_id=? ORDER BY tipo,valor').all(person.id);failAtStatement=2;let failed=false;try{const response=await call('/api/admin/crm/pessoas','POST',{...personBody,id:person.id,nome:'Should roll back',contatos:[]});failed=response.status>=400;}catch(error){assert.match(error.message,/Forced in-memory transaction failure/);failed=true;}finally{failAtStatement=0;}assert.ok(failed);assert.deepEqual(db.prepare('SELECT * FROM crm_pessoas WHERE id=?').get(person.id),beforePerson);assert.deepEqual(db.prepare('SELECT * FROM crm_pessoa_contatos WHERE pessoa_id=? ORDER BY tipo,valor').all(person.id),beforeContacts);
assert.equal(db.prepare('SELECT quantidade FROM registros_operacionais WHERE id=?').get(legacyID).quantidade,77);assert.equal(db.prepare('SELECT cestas FROM impacto_publicacoes WHERE periodo=?').get(month).cestas,900);const base=await get('base');assert.ok(base.pessoas.find(row=>row.id===person.id).contatos.some(row=>row.tipo==='email'));assert.equal(base.familias.find(row=>row.id===family.id).membros.length,2);assert.ok(base.profissionais.find(row=>row.id===staff.id).servicos_ids.includes(food.id));assert.ok(base.limites&&typeof base.parcial==='boolean');assert.ok(db.prepare('SELECT count(*) AS total FROM auditoria').get().total>10);
// Starting a request and creating its reviewed identity are one transaction.
const atomicSource=signup('acolhimento','Fonte atômica de teste'),beforeAtomicPeople=db.prepare('SELECT count(*) AS total FROM crm_pessoas').get().total;failAtStatement=2;let atomicFailed=false;try{const response=await call('/api/admin/crm/casos','POST',{...caseBody,cadastro_id:atomicSource,pessoa_id:'',nova_pessoa_nome:'Pessoa atômica de teste',contatos:[]});atomicFailed=response.status>=400;}catch(error){assert.match(error.message,/Forced in-memory transaction failure/);atomicFailed=true;}finally{failAtStatement=0;}assert.ok(atomicFailed);assert.equal(db.prepare('SELECT count(*) AS total FROM crm_pessoas').get().total,beforeAtomicPeople);assert.equal(db.prepare('SELECT count(*) AS total FROM op_apoios WHERE cadastro_id=?').get(atomicSource).total,0);assert.equal(db.prepare('SELECT count(*) AS total FROM crm_cadastro_pessoas WHERE cadastro_id=?').get(atomicSource).total,0);
// Bounded selectors disclose their pagination and never omit page two silently.
for(let i=0;i<55;i++)signup('acolhimento','Lote paginado em memória '+String(i).padStart(2,'0'));const pageOne=await get('base?busca='+encodeURIComponent('Lote paginado em memória')+'&pagina=1'),pageTwo=await get('base?busca='+encodeURIComponent('Lote paginado em memória')+'&pagina=2');assert.equal(pageOne.cadastros_total,55);assert.equal(pageOne.cadastros.length,50);assert.equal(pageTwo.cadastros.length,5);assert.equal(new Set([...pageOne.cadastros,...pageTwo.cadastros].map(row=>row.id)).size,55);
const queueSource=signup('acolhimento','FilaCRM paginação de casos');for(let i=0;i<35;i++){const id=crypto.randomUUID();db.prepare('INSERT INTO op_apoios(id,cadastro_id,etapa,criado_em,atualizado_em) VALUES(?,?,?,?,?)').run(id,queueSource,'recebido',now,now);db.prepare('INSERT INTO crm_apoio_detalhes(apoio_id,servico_id,prioridade) VALUES(?,?,?)').run(id,food.id,'normal');}const firstCases=await get('casos?busca='+encodeURIComponent('FilaCRM paginação')+'&pagina=1'),secondCases=await get('casos?busca='+encodeURIComponent('FilaCRM paginação')+'&pagina=2');assert.equal(firstCases.total,35);assert.equal(firstCases.items.length,30);assert.equal(secondCases.items.length,5);assert.equal(new Set([...firstCases.items,...secondCases.items].map(row=>row.id)).size,35);
// The complete catalog is ready before any manual setup and supports cases
// with no family or named professional.
const collective=firstBase.areas_responsaveis.find(area=>area.nome==='Fonoaudiologia');
const adminTeam=firstBase.areas_responsaveis.find(area=>area.nome==='Equipe administrativa');
const collectiveBody={nova_pessoa_nome:'Solicitante fictícia de fonoaudiologia',criar_cadastro:true,
 servico_id:catalog.get('Fonoaudiologia').id,profissional_id:collective.id,etapa:'agendado',prioridade:'normal'};
const collectiveCase=await post('casos',collectiveBody);
let collectiveDetail=(await get('casos/'+collectiveCase.id)).item;
assert.equal(collectiveDetail.familia_id,null);
assert.equal(collectiveDetail.profissional_nome,'Fonoaudiologia');
assert.equal(collectiveDetail.responsavel_coletivo,1);
await post('casos',{id:collectiveCase.id,atualizado_em:collectiveDetail.atualizado_em,
 servico_id:catalog.get('Fonoaudiologia').id,profissional_id:adminTeam.id,etapa:'agendado',prioridade:'normal'});
collectiveDetail=(await get('casos/'+collectiveCase.id)).item;
assert.equal(collectiveDetail.profissional_nome,'Equipe administrativa');
assert.ok(!(await get('profissionais')).items.some(row=>row.id===adminTeam.id));
const historic=(await get('casos/'+caseB.id)).item;
await post('casos',{id:caseB.id,atualizado_em:historic.atualizado_em,servico_id:historic.servico_id,
 profissional_id:historic.profissional_id,etapa:'em_analise',prioridade:historic.prioridade});
assert.equal((await get('casos/'+caseB.id)).item.familia_id,family.id);
console.log('PASS: default supports, case without family or named professional, collective reassignment, and preserved historical family links.');
// Intake can be classified before identity reconciliation. Existing mappings
// are reused and the request never infers identity from the submitted name.
const awaitingIdentity=signup('acolhimento','Solicitação recebida ainda não conciliada');
const intakeBody={cadastro_id:awaitingIdentity,servico_id:food.id,etapa:'recebido',prioridade:'normal'};
const intakeCase=await post('casos',intakeBody);
let intakeDetail=(await get('casos/'+intakeCase.id)).item;
assert.equal(intakeDetail.pessoa_id,null);
assert.equal(intakeDetail.pendente_identidade,1);
assert.equal(intakeDetail.cadastro_id,awaitingIdentity);
await post('casos',{...intakeBody,id:intakeCase.id,atualizado_em:intakeDetail.atualizado_em,etapa:'em_analise'});
assert.equal((await get('casos/'+intakeCase.id)).item.etapa,'em_analise');
await post('vinculos',{cadastro_id:awaitingIdentity,pessoa_id:person.id});
intakeDetail=(await get('casos/'+intakeCase.id)).item;
assert.equal(intakeDetail.pessoa_id,person.id);
const matchedIntake=await post('casos',intakeBody);
assert.equal((await get('casos/'+matchedIntake.id)).item.pessoa_id,person.id);
await post('casos',{...intakeBody,cadastro_id:'',criar_cadastro:true},400);
console.log('PASS: save and edit a received request without selecting a person; reconcile it later or reuse an existing link.');
// Concurrent requests deliberately observe the same original rows. Batches remain serialized,
// like D1 transactions, and the clock is frozen so timestamps alone cannot protect a save.
function concurrencyFixture({barrierSQL,linked=false}){
 const memory=new DatabaseSync(':memory:');
 for(const file of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())memory.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
 memory.exec('PRAGMA foreign_keys=ON');
 let reads=0,release;const barrier=new Promise(resolve=>release=resolve);
 class ConcurrentQuery{
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){const row=memory.prepare(this.sql).get(...this.args)||null;if(this.sql===barrierSQL&&reads<2){reads++;if(reads===2)release();else await barrier;}return row;}
  async all(){return{results:memory.prepare(this.sql).all(...this.args)};}
  runSync(){return{meta:{changes:Number(memory.prepare(this.sql).run(...this.args).changes)}};}
 }
 let sequence=Promise.resolve();const testEnv={DB:{prepare:sql=>new ConcurrentQuery(sql),batch(statements){const job=sequence.then(()=>{memory.exec('BEGIN');try{const result=statements.map(statement=>statement.runSync());memory.exec('COMMIT');return result;}catch(error){memory.exec('ROLLBACK');throw error;}});sequence=job.catch(()=>{});return job;}}};
 const original='2026-11-18T12:00:00.000Z',frozen='2026-11-23T12:00:00.000Z',ids={source:crypto.randomUUID(),people:[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()],service:crypto.randomUUID(),support:crypto.randomUUID()};
 memory.prepare("INSERT INTO cadastros(id,tipo,nome,contato,privacidade_versao,criado_em,atualizado_em) VALUES(?,'pessoa','Concorrência em memória','','test',?,?)").run(ids.source,original,original);
 for(const id of ids.people)memory.prepare("INSERT INTO crm_pessoas(id,nome,criado_em,atualizado_em) VALUES(?,'Pessoa fictícia concorrente',?,?)").run(id,original,original);
 if(linked)memory.prepare('INSERT INTO crm_cadastro_pessoas(cadastro_id,pessoa_id,criado_em,atualizado_em) VALUES(?,?,?,?)').run(ids.source,ids.people[0],original,original);
 memory.prepare("INSERT INTO crm_servicos(id,nome,tipo,unidade_medida,criado_em,atualizado_em) VALUES(?,'Cesta de teste concorrente','cesta','cesta',?,?)").run(ids.service,original,original);
 memory.prepare("INSERT INTO op_apoios(id,cadastro_id,etapa,criado_em,atualizado_em) VALUES(?,?,'em_analise',?,?)").run(ids.support,ids.source,original,original);
 memory.prepare("INSERT INTO crm_apoio_detalhes(apoio_id,servico_id,prioridade,versao) VALUES(?,?,'normal','initial-test-version')").run(ids.support,ids.service);
 class FrozenDate extends Date{constructor(...args){super(...(args.length?args:[frozen]));}static now(){return Date.parse(frozen);}}
 const {handleCrmAdmin:handler}=new Function('json','admin','sameOrigin','Date',crmWorkerSource+'\nreturn {handleCrmAdmin};')(json,admin,sameOrigin,FrozenDate);
 async function request(route,body){const req=new Request(origin+'/api/admin/crm/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...owner},body:JSON.stringify(body)});const response=await handler(req,testEnv,new URL(req.url).pathname,new URL(req.url));return{status:response.status,body:await response.json()};}
 return{db:memory,ids,original,request};
}
{
 const fixture=concurrencyFixture({barrierSQL:'SELECT * FROM op_apoios WHERE id=?',linked:true}),{db:memory,ids,original,request}=fixture;
 const body={id:ids.support,atualizado_em:original,cadastro_id:ids.source,pessoa_id:ids.people[0],servico_id:ids.service,etapa:'em_analise',prioridade:'alta',prazo:'',proxima_acao:'Primeira atualização',notas:''};
 const results=await Promise.all([request('casos',body),request('casos',{...body,prioridade:'urgente',proxima_acao:'Segunda atualização'})]);
 assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
 const core=memory.prepare('SELECT proxima_acao FROM op_apoios WHERE id=?').get(ids.support),details=memory.prepare('SELECT prioridade FROM crm_apoio_detalhes WHERE apoio_id=?').get(ids.support);
 assert.ok((core.proxima_acao==='Primeira atualização'&&details.prioridade==='alta')||(core.proxima_acao==='Segunda atualização'&&details.prioridade==='urgente'),'The losing case save must not mutate dependent fields, even in the same millisecond');
 assert.equal(memory.prepare('SELECT count(*) AS total FROM auditoria').get().total,1);assert.equal(memory.prepare('SELECT count(*) AS total FROM crm_movimentos').get().total,1);memory.close();
}
for(const linked of [false,true]){
 const {db:memory,ids,request}=concurrencyFixture({barrierSQL:'SELECT pessoa_id,atualizado_em FROM crm_cadastro_pessoas WHERE cadastro_id=?',linked});
 const results=await Promise.all([request('vinculos',{cadastro_id:ids.source,pessoa_id:ids.people[1],confirmar_revisao:linked}),request('vinculos',{cadastro_id:ids.source,pessoa_id:ids.people[2],confirmar_revisao:linked})]);
 assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
 const winner=results.find(row=>row.status===200),mapping=memory.prepare('SELECT pessoa_id FROM crm_cadastro_pessoas WHERE cadastro_id=?').get(ids.source);
 assert.equal(mapping.pessoa_id,winner.body.pessoa_id,'An identity link must not be overwritten by a competing unreviewed mapping');assert.equal(memory.prepare('SELECT count(*) AS total FROM auditoria').get().total,1);assert.equal(memory.prepare('SELECT count(*) AS total FROM crm_movimentos').get().total,1);memory.close();
}
{
 const {db:memory,ids,request}=concurrencyFixture({barrierSQL:'SELECT pessoa_id FROM crm_cadastro_pessoas WHERE cadastro_id=?'});
 const body={cadastro_id:ids.source,servico_id:ids.service,etapa:'recebido',prioridade:'normal',prazo:'',proxima_acao:'Revisar identidade',notas:''};
 const results=await Promise.all([request('casos',{...body,pessoa_id:ids.people[1]}),request('casos',{...body,pessoa_id:ids.people[2]})]);assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);const winner=results.find(row=>row.status===200);
 assert.equal(memory.prepare('SELECT pessoa_id FROM crm_cadastro_pessoas WHERE cadastro_id=?').get(ids.source).pessoa_id,winner.body.pessoa_id);assert.equal(memory.prepare('SELECT count(*) AS total FROM op_apoios').get().total,2,'The conflicting new case must roll back completely');assert.equal(memory.prepare('SELECT count(*) AS total FROM crm_apoio_detalhes').get().total,2);assert.equal(memory.prepare('SELECT count(*) AS total FROM auditoria').get().total,1);assert.equal(memory.prepare('SELECT count(*) AS total FROM crm_movimentos').get().total,1);memory.close();
}
console.log('PASS CRM concurrency: frozen-clock case versions; first identity links; explicitly reviewed reassignments; conflicting new-case identity rollback. Exactly one winner and no losing audit/history.');

console.log('PASS CRM: explicit identity reconciliation; normalized family/service/professional relationships; authorization and validation; routing by capability; case conflicts; dossier/tasks; canonical people/family counts; basket quantities; corrections/cancellation; linked agenda deduplication; Brasília month boundaries; public privacy; transactional rollback; unchanged legacy/manual totals. All fixtures remained in memory.');
