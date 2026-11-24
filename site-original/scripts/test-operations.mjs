import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));db.exec('PRAGMA foreign_keys=ON');
class Q{constructor(sql){this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:db.prepare(this.sql).all(...this.args)};}async run(){if(this.sql.trim().startsWith('SELECT'))return this.all();return {meta:{changes:Number(db.prepare(this.sql).run(...this.args).changes)}};}}
const env={DB:{prepare:sql=>new Q(sql),async batch(statements){db.exec('BEGIN');try{const output=[];for(const statement of statements)output.push(await statement.run());db.exec('COMMIT');return output;}catch(error){db.exec('ROLLBACK');throw error;}}}};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const admin=req=>req.headers.get('oai-authenticated-user-id')==='test-owner';
const sameOrigin=req=>req.headers.get('Origin')===new URL(req.url).origin;
const {handleOperationsAdmin,handleOperationsPublic,confirmedMetrics,opsMonth}=new Function('json','admin','sameOrigin',readFileSync('worker/operations.js','utf8')+'\nreturn {handleOperationsAdmin,handleOperationsPublic,confirmedMetrics,opsMonth};')(json,admin,sameOrigin);
const origin='https://test.local',owner={'oai-authenticated-user-id':'test-owner'},now=new Date().toISOString(),past=new Date(Date.now()-3600000).toISOString(),month=opsMonth(past);
const call=async(path,method='GET',body,headers=owner)=>{const req=new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),url=new URL(req.url);return await handleOperationsAdmin(req,env,url.pathname,url)||await handleOperationsPublic(req,env,url.pathname)||json({error:'Not found'},404);};
const read=async response=>response.json();
const post=async(route,body,expected=200)=>{const response=await call('/api/admin/operacao-'+route,'POST',body),value=await read(response);assert.equal(response.status,expected,JSON.stringify(value));return value;};
function signup(type,name){const id=crypto.randomUUID();db.prepare('INSERT INTO cadastros(id,tipo,nome,contato,privacidade_versao,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?)').run(id,type,name,'test@example.org','test',now,now);return id;}
const person=signup('pessoa','Pessoa fictícia em memória'),otherPerson=signup('pessoa','Outra pessoa fictícia'),supportSignup=signup('acolhimento','Pedido fictício'),volunteerSignup=signup('voluntariado','Voluntário fictício');
const internalProject=crypto.randomUUID(),otherProject=crypto.randomUUID(),publicProject='projeto-publico-teste';for(const id of [internalProject,otherProject])db.prepare('INSERT INTO projetos_gestao(id,titulo,situacao,criado_em,atualizado_em) VALUES(?,?,?,?,?)').run(id,'Projeto fictício','em_andamento',now,now);db.prepare('INSERT INTO projetos_publicos(id,titulo,criado_em,atualizado_em) VALUES(?,?,?,?)').run(publicProject,'Projeto público fictício',now,now);
for(const route of ['equipe','familias','apoios','voluntarios','agenda','resumo','pendencias'])assert.equal((await call('/api/admin/operacao-'+route,'GET',undefined,{})).status,403);
assert.equal((await call('/api/admin/operacao-equipe','POST',{nome:'Tentativa',funcao:'Teste',ativo:true},{Origin:'https://other.local',...owner})).status,403);
// A project activity can be scheduled by area even with an empty staff roster.
assert.deepEqual((await read(await call('/api/admin/operacao-equipe'))).items,[]);
const catalog=(await read(await call('/api/admin/operacao-agenda'))).areas_responsaveis;
const social=catalog.find(area=>area.nome==='Equipe de ação social');
const adminTeam=catalog.find(area=>area.nome==='Equipe administrativa');
assert.ok(social && adminTeam);
const areaBody={cadastro_id:person,projeto_publico_id:publicProject,data_hora:past,duracao_minutos:60,
 tipo:'Ação comunitária fictícia',situacao:'agendado',voluntarios_ids:[]};
await post('agenda',areaBody,400);
const areaSession=await post('agenda',{...areaBody,profissional_id:social.id});
await post('agenda',{...areaBody,id:areaSession.id,profissional_id:adminTeam.id});
const savedArea=(await read(await call('/api/admin/operacao-agenda'))).items.find(item=>item.id===areaSession.id);
assert.equal(savedArea.profissional_nome,adminTeam.nome);
assert.equal(savedArea.projeto_publico_id,publicProject);
assert.deepEqual((await read(await call('/api/admin/operacao-equipe'))).items,[]);
assert.equal((await read(await call('/api/admin/operacao-resumo'))).profissionais.total,0);
await post('apoios',{cadastro_id:person,etapa:'agendado',profissional_id:social.id},400);
await post('equipe',{id:social.id,nome:'Nome de teste',funcao:'Função de teste',ativo:true},400);

const pendingBefore=await read(await call('/api/admin/operacao-pendencias'));assert.ok(pendingBefore.apoios.some(row=>row.cadastro_id===supportSignup));assert.ok(pendingBefore.voluntarios.some(row=>row.cadastro_id===volunteerSignup));
await post('equipe',{nome:'Professor fictício',funcao:'Professor',email:'inválido',ativo:true},400);
const staffBody={nome:'Professor fictício',funcao:'Professor',email:'teacher@example.org',disponibilidade:'Segundas pela manhã',ativo:true};const staff=await post('equipe',staffBody),inactive=await post('equipe',{...staffBody,nome:'Profissional inativo',ativo:false});
const family=await post('familias',{nome_referencia:'Família fictícia',contato:'family@example.org',notas:'Somente dados de teste em memória'});
const refs={cadastro_id:person,familia_id:family.id,projeto_id:internalProject,projeto_publico_id:publicProject,profissional_id:staff.id};
const requestBody={...refs,etapa:'encaminhado',proxima_acao:'Aguardar confirmação de atividade',notas:'OBSERVACAO_PRIVADA_DE_TESTE'};
const support=await post('apoios',requestBody);
await post('apoios',{...requestBody,profissional_id:inactive.id},400);
await post('apoios',{...requestBody,cadastro_id:crypto.randomUUID()},400);
await post('apoios',{...requestBody,cadastro_id:volunteerSignup},400);
const pendingSupport=await post('apoios',{cadastro_id:supportSignup,etapa:'recebido',proxima_acao:'Entrar em contato',notas:''});assert.ok(pendingSupport.id);
const volunteerBody={cadastro_id:volunteerSignup,projeto_id:internalProject,projeto_publico_id:publicProject,profissional_id:staff.id,etapa:'aprovado',disponibilidade:'Manhã',notas:'Anotação interna'};const volunteer=await post('voluntarios',volunteerBody);
await post('voluntarios',volunteerBody,409);
await post('voluntarios',{...volunteerBody,cadastro_id:person},400);
await post('voluntarios',{...volunteerBody,id:volunteer.id,projeto_id:'',projeto_publico_id:'',etapa:'ativo'},400);
const pendingAfter=await read(await call('/api/admin/operacao-pendencias'));assert.ok(!pendingAfter.apoios.some(row=>row.cadastro_id===supportSignup));assert.ok(!pendingAfter.voluntarios.some(row=>row.cadastro_id===volunteerSignup));
const sessionBody={...refs,apoio_id:support.id,data_hora:past,duracao_minutos:50,tipo:'Atividade educativa fictícia',situacao:'agendado',voluntarios_ids:[volunteer.id],notas:'NOTAS_DA_ATIVIDADE_NAO_PUBLICAR'};
await post('agenda',{...sessionBody,data_hora:'2026-02-30T10:00:00Z'},400);
await post('agenda',{...sessionBody,situacao:'realizado',data_hora:new Date(Date.now()+86400000).toISOString()},400);
await post('agenda',{...sessionBody,profissional_id:inactive.id},400);
await post('agenda',{...sessionBody,cadastro_id:otherPerson},400);
await post('agenda',{...sessionBody,projeto_id:otherProject},400);
await post('agenda',{...sessionBody,voluntarios_ids:[crypto.randomUUID()]},400);
const session=await post('agenda',sessionBody);assert.deepEqual(await confirmedMetrics(env,month),{pessoas_atendidas:0,familias_atendidas:0,atividades_realizadas:0,voluntarios_ativos:0});
await post('agenda',{...sessionBody,id:session.id,situacao:'realizado'});let metrics=await confirmedMetrics(env,month);assert.deepEqual(metrics,{pessoas_atendidas:1,familias_atendidas:1,atividades_realizadas:1,voluntarios_ativos:1});
await post('agenda',{...sessionBody,id:session.id,situacao:'realizado',notas:'Correção das notas'});assert.deepEqual(await confirmedMetrics(env,month),metrics);assert.equal(db.prepare('SELECT count(*) AS total FROM op_agenda').get().total,2);
const second=await post('agenda',{...sessionBody,situacao:'realizado'});assert.deepEqual(await confirmedMetrics(env,month),{...metrics,atividades_realizadas:2});
await post('agenda',{...sessionBody,id:second.id,situacao:'cancelado'});assert.deepEqual(await confirmedMetrics(env,month),metrics);
await post('voluntarios',{...volunteerBody,id:volunteer.id,etapa:'inativo'});assert.deepEqual(await confirmedMetrics(env,month),metrics,'Historical approved participation must remain after later inactivation');
await post('agenda',{...sessionBody,situacao:'realizado'},400);await post('agenda',{...sessionBody,id:session.id,situacao:'realizado',notas:'Histórico corrigido'});assert.deepEqual(await confirmedMetrics(env,month),metrics);
const publicMetrics=await read(await call('/api/impacto-confirmado?periodo='+month,'GET',undefined,{}));assert.equal(publicMetrics.pessoas_atendidas,1);assert.equal(publicMetrics.atividades_realizadas,1);const serialized=JSON.stringify(publicMetrics);for(const value of [person,staff.id,family.id,'OBSERVACAO_PRIVADA_DE_TESTE','NOTAS_DA_ATIVIDADE_NAO_PUBLICAR','Pessoa fictícia'])assert.ok(!serialized.includes(value));
assert.equal((await call('/api/impacto-confirmado?periodo=invalid','GET',undefined,{})).status,400);
const agendaList=await read(await call('/api/admin/operacao-agenda'));const loaded=agendaList.items.find(row=>row.id===session.id);assert.equal(loaded.cadastro_nome,'Pessoa fictícia em memória');assert.equal(loaded.profissional_nome,staffBody.nome);assert.deepEqual(loaded.voluntarios_ids,[volunteer.id]);assert.equal(loaded.familia_nome,'Família fictícia');
await post('agenda',{...sessionBody,id:session.id,situacao:'agendado',voluntarios_ids:[]});assert.deepEqual(await confirmedMetrics(env,month),{pessoas_atendidas:0,familias_atendidas:0,atividades_realizadas:0,voluntarios_ativos:0});
assert.equal(db.prepare('SELECT count(*) AS total FROM registros_operacionais').get().total,0);assert.equal(db.prepare('SELECT count(*) AS total FROM impacto_publicacoes').get().total,0);
const summary=await read(await call('/api/admin/operacao-resumo?periodo='+month));assert.equal(summary.familias,1);assert.equal(summary.profissionais.ativos,1);assert.equal(summary.confirmados.atividades_realizadas,0);assert.ok(summary.apoios.some(row=>row.etapa==='recebido'));
const audit=db.prepare('SELECT count(*) AS total FROM auditoria').get();assert.ok(audit.total>10);

// Month-end evening sessions belong to the institute's Brasília calendar month,
// even though the database stores normalized UTC timestamps.
assert.equal(opsMonth('2020-10-31T23:30:00-03:00'),'2020-10');
assert.equal(opsMonth('2020-11-01T00:30:00-03:00'),'2020-11');
await post('agenda',{...sessionBody,data_hora:'2020-10-31T23:30:00-03:00',situacao:'realizado',voluntarios_ids:[]});
await post('agenda',{...sessionBody,data_hora:'2020-11-01T00:30:00-03:00',situacao:'realizado',voluntarios_ids:[]});
assert.equal((await confirmedMetrics(env,'2020-10')).atividades_realizadas,1);
assert.equal((await confirmedMetrics(env,'2020-11')).atividades_realizadas,1);

// Later inactivation must not prevent corrections and cancellation of an existing
// activity, while new assignments still require eligible staff and volunteers.
await post('voluntarios',{...volunteerBody,id:volunteer.id,etapa:'aprovado'});
await post('agenda',{...sessionBody,id:session.id,situacao:'realizado'});
await post('voluntarios',{...volunteerBody,id:volunteer.id,etapa:'inativo'});
await post('equipe',{...staffBody,id:staff.id,ativo:false});
await post('agenda',{...sessionBody,situacao:'realizado'},400);
await post('agenda',{...sessionBody,id:session.id,profissional_id:inactive.id,situacao:'realizado'},400);
await post('agenda',{...sessionBody,id:session.id,situacao:'realizado',notas:'Correção histórica após inativação'});
const laterSignup=signup('voluntariado','Novo participante não aprovado');
const laterVolunteer=await post('voluntarios',{...volunteerBody,cadastro_id:laterSignup,profissional_id:'',etapa:'inativo'});
await post('agenda',{...sessionBody,id:session.id,situacao:'realizado',voluntarios_ids:[volunteer.id,laterVolunteer.id]},400);
await post('agenda',{...sessionBody,id:session.id,situacao:'cancelado'});
assert.equal((await confirmedMetrics(env,month)).atividades_realizadas,0);
assert.equal((await confirmedMetrics(env,month)).voluntarios_ativos,0);
await post('agenda',{...sessionBody,id:session.id,situacao:'agendado'});
assert.equal((await confirmedMetrics(env,month)).atividades_realizadas,0);

await post('agenda',{...areaBody,id:areaSession.id,apoio_id:support.id,profissional_id:social.id});
assert.equal(db.prepare('SELECT profissional_id FROM op_apoios WHERE id=?').get(support.id).profissional_id,staff.id);

console.log('PASS: agenda can save and edit responsibility by area with an empty roster and preserves the owner of a linked case.');
console.log('PASS: operational routing, team/family/support/volunteer links, active-professional and project validation, approved volunteer participation, session updates without duplicate metrics, reversal/cancellation, preserved historical approval, private data protection, unchanged legacy totals, Brasília month boundaries, and historical corrections after inactivation. All records stayed in memory.');
