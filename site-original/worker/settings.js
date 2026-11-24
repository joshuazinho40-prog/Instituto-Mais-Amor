const publicSettingKeys=['email','whatsapp','instagram','address','hours'];
async function readPublicSettings(env){const row=await env.DB.prepare('SELECT dados,atualizado_em FROM configuracao_site WHERE id=?').bind('contatos').first();return row?{...JSON.parse(row.dados),atualizado_em:row.atualizado_em}:{email:'',whatsapp:'',instagram:'',address:'',hours:'',atualizado_em:null};}
async function handleSettingsPublic(req,env,path){if(path==='/api/configuracao-publica'&&req.method==='GET')return json(await readPublicSettings(env));}
async function handleSettingsAdmin(req,env,path){
 if(path==='/api/admin/integracoes'&&req.method==='GET')return json({contatos:await readPublicSettings(env),banco:'conectado',arquivos:env.BUCKET?'configurado':'indisponivel',notificacoes:'nao_configuradas'});
 if(path==='/api/admin/integracoes'&&req.method==='POST'){
  const raw=await req.text();if(raw.length>4000)return json({error:'Configuração muito longa.'},413);const b=JSON.parse(raw),clean={};
  for(const key of publicSettingKeys){if(typeof b[key]!=='string'||b[key].length>300)return json({error:'Confira os campos de contato.'},400);clean[key]=b[key].trim();}
  if(clean.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email))return json({error:'Informe um e-mail válido.'},400);
  clean.whatsapp=clean.whatsapp.replace(/[\s()+-]/g,'');if(clean.whatsapp&&!/^\d{10,15}$/.test(clean.whatsapp))return json({error:'Informe o WhatsApp com país e DDD, somente números.'},400);
  if(clean.instagram&&!/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/.test(clean.instagram))return json({error:'Informe o link HTTPS oficial do Instagram.'},400);
  const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO configuracao_site(id,dados,atualizado_em) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET dados=excluded.dados,atualizado_em=excluded.atualizado_em').bind('contatos',JSON.stringify(clean),now),env.DB.prepare('INSERT INTO auditoria(id,ator,acao,registro_id,criado_em) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),req.headers.get('oai-authenticated-user-id'),'atualizar_canais_oficiais','contatos',now)]);return json({ok:true});
 }
}
