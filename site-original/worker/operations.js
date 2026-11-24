// Operational foundation: events are stored separately from legacy/manual impact totals.
// These team records are operational metadata; they do not grant account access.
const opsSupportStages=['recebido','em_acolhimento','em_analise','encaminhado','agendado','concluido','lista_espera','arquivado'];
const opsVolunteerStages=['interessado','em_avaliacao','aprovado','vinculado','ativo','inativo'];
// The agenda can assign an area even when no individual has been named.
const opsResponsibleAreas = [
 [1, 'Fonoaudiologia'],
 [2, 'Terapia ocupacional'],
 [3, 'Fisioterapia'],
 [4, 'Psicologia'],
 [5, 'Psicopedagogia'],
 [6, 'Educação e oficinas'],
 [7, 'Equipe administrativa'],
 [8, 'Equipe de ação social']
].map(([code, nome]) => ({id: 'ec5e780b-4d9c-449a-9abf-' + String(code).padStart(12, '0'), nome}));

// Collective assignments use stable references that are excluded from the staff roster.
function opsResponsibleArea(id){
 return opsResponsibleAreas.find(area=>area.id===id);
}
function opsInsertResponsibleArea(env,area,now){
 return env.DB.prepare(
  "INSERT INTO op_profissionais(id,nome,funcao,ativo,somente_agenda,criado_em,atualizado_em) VALUES (?,?,'Área ou equipe',0,1,?,?) ON CONFLICT(id) DO NOTHING"
 ).bind(area.id,area.nome,now,now);
}

const opsSessionStates=['agendado','realizado','cancelado','falta'];
const opsEligibleVolunteerStages=['aprovado','vinculado','ativo'];
const opsUUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
class OpsInputError extends Error {constructor(message,status=400){super(message);this.status=status;}}
function opsAssert(condition,message,status=400){if(!condition)throw new OpsInputError(message,status);}
function opsString(value,max,min=0){return typeof value==='string'&&value.trim().length>=min&&value.length<=max;}
function opsOptional(value){return value===undefined||value===null||value===''?null:value;}
function opsSafeID(value,label,required=false){const id=opsOptional(value);opsAssert(!required||id,'Informe '+label+'.');opsAssert(id===null||(typeof id==='string'&&opsUUID.test(id)),'Confira '+label+'.');return id;}
function opsText(value,max,label,min=0){const text=value===undefined?'':value;opsAssert(opsString(text,max,min),'Confira '+label+'.');return text.trim();}
// The institute reports dates in Brasília time (UTC-03), including month boundaries.
function opsMonth(value=new Date()){return new Date(new Date(value).getTime()-3*60*60*1000).toISOString().slice(0,7);}
function opsPeriod(value){opsAssert(typeof value==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(value),'Período inválido.');return value;}
async function opsBody(req){const raw=await req.text();opsAssert(raw.length<=14000,'Dados muito longos.',413);let body;try{body=JSON.parse(raw);}catch{throw new OpsInputError('Envie dados válidos.');}opsAssert(body&&typeof body==='object'&&!Array.isArray(body),'Envie um registro válido.');return body;}
async function opsRow(env,table,id,label){if(!id)return null;const row=await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(id).first();opsAssert(row,label+' não encontrado.',400);return row;}
async function opsExisting(env,table,id){if(!id)return null;const row=await env.DB.prepare('SELECT * FROM '+table+' WHERE id=?').bind(id).first();opsAssert(row,'O registro que você tentou alterar não foi encontrado.',404);return row;}
function opsAudit(env,req,action,id,now){return env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),action,id,now);}
async function opsSave(env,req,table,id,values,action,{before=[],after=[]}={}){const now=new Date().toISOString(),columns=['id',...Object.keys(values),'criado_em','atualizado_em'];const marks=columns.map(()=>'?').join(',');const updates=[...Object.keys(values),'atualizado_em'].map(key=>key+'=excluded.'+key).join(',');await env.DB.batch([...before,env.DB.prepare('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+marks+') ON CONFLICT(id) DO UPDATE SET '+updates).bind(id,...Object.values(values),now,now),...after,opsAudit(env,req,action,id,now)]);return json({ok:true,id});}
async function opsReferences(env,b,{requireProfessional=false,beneficiary=false,existingProfessional=null}={}){
 const result={cadastro_id:opsSafeID(b.cadastro_id,'o cadastro relacionado',beneficiary),familia_id:opsSafeID(b.familia_id,'a família relacionada'),projeto_id:opsSafeID(b.projeto_id,'o projeto interno'),profissional_id:opsSafeID(b.profissional_id,'o profissional responsável',requireProfessional),projeto_publico_id:opsOptional(b.projeto_publico_id)};
 if(result.cadastro_id){const person=await opsRow(env,'cadastros',result.cadastro_id,'Cadastro');opsAssert(['pessoa','acolhimento','contato'].includes(person.tipo),'Escolha uma pessoa, um acolhimento ou um contato para receber o apoio.');}
 await opsRow(env,'op_familias',result.familia_id,'Família');await opsRow(env,'projetos_gestao',result.projeto_id,'Projeto interno');
 if(result.projeto_publico_id){opsAssert(opsString(result.projeto_publico_id,80,1),'Confira o projeto do site.');await opsRow(env,'projetos_publicos',result.projeto_publico_id,'Projeto do site');}
 if(result.profissional_id){const staff=await opsRow(env,'op_profissionais',result.profissional_id,'Profissional');opsAssert(!staff.somente_agenda,'Escolha um profissional cadastrado.');opsAssert(staff.ativo===1||result.profissional_id===existingProfessional,'O profissional selecionado está inativo. Escolha uma pessoa ativa da equipe.');}
 return result;
}
async function confirmedMetrics(env,period){
 const people=await env.DB.prepare("SELECT count(DISTINCT cadastro_id) AS pessoas_atendidas,count(DISTINCT familia_id) AS familias_atendidas,count(*) AS atividades_realizadas FROM op_agenda WHERE situacao='realizado' AND strftime('%Y-%m',data_hora,'-3 hours')=?").bind(period).first();
 const volunteers=await env.DB.prepare("SELECT count(DISTINCT v.cadastro_id) AS voluntarios_ativos FROM op_agenda_voluntarios p JOIN op_agenda a ON a.id=p.agenda_id JOIN op_voluntarios v ON v.id=p.voluntario_id WHERE a.situacao='realizado' AND p.aprovado_na_sessao=1 AND strftime('%Y-%m',a.data_hora,'-3 hours')=?").bind(period).first();
 return{pessoas_atendidas:people?.pessoas_atendidas||0,familias_atendidas:people?.familias_atendidas||0,atividades_realizadas:people?.atividades_realizadas||0,voluntarios_ativos:volunteers?.voluntarios_ativos||0};
}
async function handleOperationsPublic(req,env,path){
 if(path!=='/api/impacto-confirmado'||req.method!=='GET')return;
 try{const period=opsPeriod(new URL(req.url).searchParams.get('periodo')||opsMonth());return json({periodo:period,...await confirmedMetrics(env,period),criterio:'Somente atividades marcadas como realizadas. Cadastros e famílias são distintos dentro do mês; duplicidades cadastrais precisam ser conciliadas e inscrições não comprovam atendimento. Estes números não incluem bases manuais ou registros operacionais antigos.'});}catch(error){if(error instanceof OpsInputError)return json({error:error.message},error.status);throw error;}
}
async function handleOperationsAdmin(req,env,path,url){
 const route=path.replace('/api/admin/operacao-','');if(!['equipe','familias','apoios','voluntarios','agenda','resumo','pendencias'].includes(route)||!path.startsWith('/api/admin/operacao-'))return;
 if(!admin(req))return json({error:'Acesso restrito à administração.'},403);if(req.method!=='GET'&&!sameOrigin(req))return json({error:'Origem não permitida.'},403);
 try{
  if(req.method==='GET'){
   if(route==='equipe')return json({items:(await env.DB.prepare('SELECT * FROM op_profissionais WHERE somente_agenda=0 ORDER BY ativo DESC,nome LIMIT 500').all()).results});
   if(route==='familias')return json({items:(await env.DB.prepare('SELECT * FROM op_familias ORDER BY atualizado_em DESC LIMIT 500').all()).results});
   if(route==='apoios')return json({items:(await env.DB.prepare('SELECT a.*,c.nome AS cadastro_nome,f.nome_referencia AS familia_nome,p.titulo AS projeto_titulo,pp.titulo AS projeto_publico_titulo,e.nome AS profissional_nome FROM op_apoios a JOIN cadastros c ON c.id=a.cadastro_id LEFT JOIN op_familias f ON f.id=a.familia_id LEFT JOIN projetos_gestao p ON p.id=a.projeto_id LEFT JOIN projetos_publicos pp ON pp.id=a.projeto_publico_id LEFT JOIN op_profissionais e ON e.id=a.profissional_id ORDER BY a.atualizado_em DESC LIMIT 500').all()).results});
   if(route==='voluntarios')return json({items:(await env.DB.prepare('SELECT v.*,c.nome AS cadastro_nome,p.titulo AS projeto_titulo,pp.titulo AS projeto_publico_titulo,e.nome AS profissional_nome FROM op_voluntarios v JOIN cadastros c ON c.id=v.cadastro_id LEFT JOIN projetos_gestao p ON p.id=v.projeto_id LEFT JOIN projetos_publicos pp ON pp.id=v.projeto_publico_id LEFT JOIN op_profissionais e ON e.id=v.profissional_id ORDER BY v.atualizado_em DESC LIMIT 500').all()).results});
   if(route==='agenda'){
    const rows=(await env.DB.prepare('SELECT a.*,c.nome AS cadastro_nome,f.nome_referencia AS familia_nome,p.titulo AS projeto_titulo,pp.titulo AS projeto_publico_titulo,e.nome AS profissional_nome FROM op_agenda a JOIN cadastros c ON c.id=a.cadastro_id LEFT JOIN op_familias f ON f.id=a.familia_id LEFT JOIN projetos_gestao p ON p.id=a.projeto_id LEFT JOIN projetos_publicos pp ON pp.id=a.projeto_publico_id JOIN op_profissionais e ON e.id=a.profissional_id ORDER BY a.data_hora DESC LIMIT 500').all()).results;
    const links=(await env.DB.prepare('SELECT agenda_id,voluntario_id FROM op_agenda_voluntarios').all()).results;return json({areas_responsaveis:opsResponsibleAreas,items:rows.map(row=>({...row,voluntarios_ids:links.filter(link=>link.agenda_id===row.id).map(link=>link.voluntario_id)}))});
   }
   if(route==='pendencias'){
    const apoios=(await env.DB.prepare("SELECT c.id AS cadastro_id,c.nome,c.contato,c.criado_em FROM cadastros c WHERE c.tipo='acolhimento' AND c.situacao<>'arquivado' AND NOT EXISTS(SELECT 1 FROM op_apoios a WHERE a.cadastro_id=c.id) ORDER BY c.criado_em DESC LIMIT 500").all()).results;
    const voluntarios=(await env.DB.prepare("SELECT c.id AS cadastro_id,c.nome,c.contato,c.criado_em FROM cadastros c WHERE c.tipo='voluntariado' AND c.situacao<>'arquivado' AND NOT EXISTS(SELECT 1 FROM op_voluntarios v WHERE v.cadastro_id=c.id) ORDER BY c.criado_em DESC LIMIT 500").all()).results;return json({apoios,voluntarios});
   }
   if(route==='resumo'){
    const period=opsPeriod(url.searchParams.get('periodo')||opsMonth());const supports=(await env.DB.prepare('SELECT etapa,count(*) AS total FROM op_apoios GROUP BY etapa').all()).results;const volunteers=(await env.DB.prepare('SELECT etapa,count(*) AS total FROM op_voluntarios GROUP BY etapa').all()).results;const sessions=(await env.DB.prepare('SELECT situacao,count(*) AS total FROM op_agenda GROUP BY situacao').all()).results;return json({periodo:period,apoios:supports,voluntarios:volunteers,agenda:sessions,profissionais:await env.DB.prepare('SELECT count(*) AS total,COALESCE(SUM(ativo),0) AS ativos FROM op_profissionais WHERE somente_agenda=0').first(),familias:(await env.DB.prepare('SELECT count(*) AS total FROM op_familias').first()).total,confirmados:await confirmedMetrics(env,period)});
   }
  }
  if(req.method!=='POST')return json({error:'Método não permitido.'},405);
  if(['resumo','pendencias'].includes(route))return json({error:'Método não permitido.'},405);
  const b=await opsBody(req),id=opsSafeID(b.id,'o identificador')||crypto.randomUUID();
  if(route==='equipe'){
   const currentStaff=await opsExisting(env,'op_profissionais',b.id);opsAssert(!currentStaff?.somente_agenda,'As áreas da agenda não são cadastros de profissionais.');const values={nome:opsText(b.nome,120,'o nome',2),funcao:opsText(b.funcao,120,'a função',2),email:opsText(b.email,150,'o e-mail'),disponibilidade:opsText(b.disponibilidade,600,'a disponibilidade'),ativo:b.ativo};opsAssert(typeof values.ativo==='boolean','Informe se o profissional está ativo.');opsAssert(!values.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email),'Informe um e-mail válido.');values.ativo=values.ativo?1:0;return await opsSave(env,req,'op_profissionais',id,values,'salvar_profissional');
  }
  if(route==='familias'){
   await opsExisting(env,'op_familias',b.id);const values={nome_referencia:opsText(b.nome_referencia,120,'o nome de referência',2),contato:opsText(b.contato,150,'o contato'),notas:opsText(b.notas,600,'as anotações')};return await opsSave(env,req,'op_familias',id,values,'salvar_familia');
  }
  if(route==='apoios'){
   await opsExisting(env,'op_apoios',b.id);opsAssert(opsSupportStages.includes(b.etapa),'Escolha uma etapa válida para o apoio.');const refs=await opsReferences(env,b,{beneficiary:true,requireProfessional:b.etapa==='agendado'});const values={...refs,etapa:b.etapa,proxima_acao:opsText(b.proxima_acao,300,'a próxima ação'),notas:opsText(b.notas,600,'as anotações')};return await opsSave(env,req,'op_apoios',id,values,'salvar_acompanhamento_apoio');
  }
  if(route==='voluntarios'){
   await opsExisting(env,'op_voluntarios',b.id);opsAssert(opsVolunteerStages.includes(b.etapa),'Escolha uma etapa válida para o voluntariado.');const cadastro=opsSafeID(b.cadastro_id,'a inscrição de voluntariado',true),signup=await opsRow(env,'cadastros',cadastro,'Cadastro');opsAssert(signup.tipo==='voluntariado','Escolha uma inscrição de voluntariado.');const duplicate=await env.DB.prepare('SELECT id FROM op_voluntarios WHERE cadastro_id=? AND id<>?').bind(cadastro,id).first();opsAssert(!duplicate,'Esta inscrição já possui acompanhamento. Abra o registro existente para alterar.',409);
   const refs=await opsReferences(env,{...b,cadastro_id:null,familia_id:null});opsAssert(!['vinculado','ativo'].includes(b.etapa)||refs.projeto_id||refs.projeto_publico_id,'Vincule o voluntário a um projeto antes de marcar como vinculado ou ativo.');const values={cadastro_id:cadastro,projeto_id:refs.projeto_id,projeto_publico_id:refs.projeto_publico_id,profissional_id:refs.profissional_id,etapa:b.etapa,disponibilidade:opsText(b.disponibilidade,600,'a disponibilidade'),notas:opsText(b.notas,600,'as anotações')};return await opsSave(env,req,'op_voluntarios',id,values,'salvar_acompanhamento_voluntario');
  }
  if(route==='agenda'){
   const old=await opsExisting(env,'op_agenda',b.id);
   const area=opsResponsibleArea(b.profissional_id);
   const refs=await opsReferences(env,area?{...b,profissional_id:null}:b,{
    beneficiary:true,requireProfessional:!area,existingProfessional:old?.profissional_id
   });
   if(area)refs.profissional_id=area.id;
   const supportID=opsSafeID(b.apoio_id,'a solicitação relacionada');const support=await opsRow(env,'op_apoios',supportID,'Solicitação');
   if(support){opsAssert(support.cadastro_id===refs.cadastro_id,'A pessoa selecionada não corresponde à solicitação de apoio.');for(const key of ['familia_id','projeto_id','projeto_publico_id',...(area||opsResponsibleArea(support.profissional_id)?[]:['profissional_id'])]){if(support[key]&&refs[key])opsAssert(support[key]===refs[key],'O vínculo '+key.replaceAll('_',' ')+' difere da solicitação. Corrija o vínculo antes de agendar.');if(!refs[key]&&support[key])refs[key]=support[key];}opsAssert(support.etapa!=='arquivado','Reabra a solicitação de apoio antes de vincular uma atividade.');}
   opsAssert(typeof b.data_hora==='string'&&/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(b.data_hora)&&Number.isFinite(Date.parse(b.data_hora)),'Informe uma data e horário válidos com fuso horário.');const datePart=b.data_hora.slice(0,10);opsAssert(new Date(datePart+'T00:00:00Z').toISOString().slice(0,10)===datePart,'Informe uma data de calendário válida.');const when=new Date(b.data_hora).toISOString();opsAssert(opsSessionStates.includes(b.situacao),'Escolha uma situação válida para a atividade.');opsAssert(b.situacao!=='realizado'||Date.parse(when)<=Date.now(),'Uma atividade futura não pode ser marcada como realizada.');opsAssert(Number.isSafeInteger(b.duracao_minutos)&&b.duracao_minutos>=1&&b.duracao_minutos<=480,'A duração precisa ser de 1 a 480 minutos.');
   opsAssert(Array.isArray(b.voluntarios_ids)&&b.voluntarios_ids.length<=30&&b.voluntarios_ids.every(v=>typeof v==='string'&&opsUUID.test(v)),'Confira os voluntários participantes.');const volunteerIDs=[...new Set(b.voluntarios_ids)];const oldLinks=old?(await env.DB.prepare('SELECT voluntario_id FROM op_agenda_voluntarios WHERE agenda_id=?').bind(id).all()).results.map(row=>row.voluntario_id):[];
   for(const vid of volunteerIDs){const volunteer=await opsRow(env,'op_voluntarios',vid,'Acompanhamento de voluntariado');opsAssert(opsEligibleVolunteerStages.includes(volunteer.etapa)||(!!old&&oldLinks.includes(vid)),'A participação exige um voluntário aprovado, vinculado ou ativo.');for(const key of ['projeto_id','projeto_publico_id'])if(volunteer[key]&&refs[key])opsAssert(volunteer[key]===refs[key],'Um dos voluntários está vinculado a outro projeto.');}
   // Correcting the same session replaces its participants; it never creates a second occurrence.
   // Materialize the chosen area in the same transaction as the activity.
   // Keep this reference out of professional rosters, assignments, and counts.
   const before=area?[opsInsertResponsibleArea(env,area,new Date().toISOString())]:[];
   const after=[env.DB.prepare('DELETE FROM op_agenda_voluntarios WHERE agenda_id=?').bind(id),...volunteerIDs.map(vid=>env.DB.prepare('INSERT INTO op_agenda_voluntarios(agenda_id,voluntario_id,aprovado_na_sessao) VALUES(?,?,1)').bind(id,vid))];const values={apoio_id:supportID,...refs,data_hora:when,duracao_minutos:b.duracao_minutos,tipo:opsText(b.tipo,120,'o tipo de atividade',2),situacao:b.situacao,notas:opsText(b.notas,600,'as anotações')};return await opsSave(env,req,'op_agenda',id,values,'salvar_atividade_agendada',{before,after});
  }
 }catch(error){if(error instanceof OpsInputError)return json({error:error.message},error.status);throw error;}
}
