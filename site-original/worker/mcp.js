const SITE_MCP_PROTOCOL='2026-07-28';
const SITE_MCP_TOOLS=[
 {name:'listar_projetos',description:'Lista os projetos do Instituto Mais Amor e seus identificadores. Projetos em rascunho aparecem somente para a administração.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'listar_atualizacoes',description:'Lista relatos publicados de um projeto. A administração também pode incluir rascunhos.',inputSchema:{type:'object',properties:{projeto_id:{type:'string',description:'Identificador retornado por listar_projetos.'},incluir_rascunhos:{type:'boolean',description:'Somente a administração pode usar esta opção.'}},required:['projeto_id'],additionalProperties:false}},
 {name:'enviar_foto_atualizacao',description:'Envia uma foto para a biblioteca privada do site. Depois, use o caminho retornado em salvar_atualizacao. Uma foto por chamada; JPG, PNG ou WebP de até 5 MB.',inputSchema:{type:'object',properties:{imagem_base64:{type:'string',description:'Conteúdo da imagem em Base64, sem prefixo data:.'},tipo_imagem:{type:'string',enum:['image/jpeg','image/png','image/webp']}},required:['imagem_base64','tipo_imagem'],additionalProperties:false}},
 {name:'salvar_atualizacao',description:'Cria ou atualiza um relato semanal de um projeto. Para editar, informe id e versao de listar_atualizacoes. Publicar com fotos exige confirmar autorização de uso das imagens. Para guardar como rascunho, defina publicada=false.',inputSchema:{type:'object',properties:{id:{type:'string',description:'ID da atualização existente; deixe de fora para criar uma nova.'},versao:{type:'integer',description:'Versão retornada por listar_atualizacoes, obrigatória ao editar.'},projeto_id:{type:'string'},titulo:{type:'string'},resumo:{type:'string'},conteudo:{type:'string'},data_realizacao:{type:'string',description:'Data no formato AAAA-MM-DD.'},publicada:{type:'boolean'},fotos_autorizadas:{type:'boolean',description:'Confirme true somente quando o Instituto tiver autorização para divulgar as imagens.'},fotos:{type:'array',items:{type:'object',properties:{caminho:{type:'string',description:'Caminho retornado por enviar_foto_atualizacao.'},descricao:{type:'string',description:'Texto alternativo da foto.'},legenda:{type:'string'}},required:['caminho','descricao','legenda'],additionalProperties:false},maxItems:8}},required:['projeto_id','titulo','resumo','conteudo','data_realizacao','publicada','fotos_autorizadas','fotos'],additionalProperties:false}}
];

const mcpJson=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const mcpError=(id,code,message)=>mcpJson({jsonrpc:'2.0',id,error:{code,message}});
const mcpText=(value,isError=false)=>({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}],isError});
const isSiteAdmin=req=>!!req.headers.get('oai-authenticated-user-id')&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===ADMIN_EMAIL;

async function handleSiteMcp(req,env){
 if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 let message;
 try{const raw=await req.text();if(raw.length>8*1024*1024)return new Response('Request too large',{status:413});message=JSON.parse(raw);}catch{return mcpError(null,-32700,'Invalid JSON.');}
 if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string')return mcpError(message?.id??null,-32600,'Invalid JSON-RPC request.');
 const hasId=Object.prototype.hasOwnProperty.call(message,'id'),id=hasId?message.id:null;
 if(!hasId){return new Response(null,{status:202,headers:{'Cache-Control':'no-store'}});}
 if(message.method==='server/discover')return mcpJson({jsonrpc:'2.0',id,result:{supportedVersions:[SITE_MCP_PROTOCOL],capabilities:{tools:{}},serverInfo:{name:'instituto-mais-amor',version:'1.0.0'}}});
 if(message.method==='initialize')return mcpJson({jsonrpc:'2.0',id,result:{protocolVersion:SITE_MCP_PROTOCOL,capabilities:{tools:{listChanged:false}},serverInfo:{name:'instituto-mais-amor',version:'1.0.0'}}});
 if(message.method==='ping')return mcpJson({jsonrpc:'2.0',id,result:{}});
 if(message.method==='tools/list')return mcpJson({jsonrpc:'2.0',id,result:{tools:SITE_MCP_TOOLS}});
 if(message.method!=='tools/call')return mcpError(id,-32601,'Method not found.');
 const name=message.params?.name,args=message.params?.arguments||{};
 if(!SITE_MCP_TOOLS.some(tool=>tool.name===name))return mcpError(id,-32602,'Unknown tool.');
 try{return mcpJson({jsonrpc:'2.0',id,result:await runSiteMcpTool(req,env,name,args)});}catch(error){return mcpJson({jsonrpc:'2.0',id,result:mcpText(error instanceof Error?error.message:'Não foi possível concluir a operação.',true)});}
}

async function runSiteMcpTool(req,env,name,args){
 const owner=isSiteAdmin(req);
 if(name==='listar_projetos'){
  const result=await env.DB.prepare('SELECT id,titulo,resumo,situacao,publicada FROM projetos_publicos '+(owner?'':'WHERE publicada=1 ')+'ORDER BY ordem,criado_em,id').all();
  return mcpText({projetos:result.results.map(row=>({...row,publicada:!!row.publicada}))});
 }
 if(name==='listar_atualizacoes'){
  if(typeof args.projeto_id!=='string'||!PROJECT_ID.test(args.projeto_id))throw new Error('Informe um identificador de projeto válido.');
  if(!owner){
   const project=await env.DB.prepare('SELECT id FROM projetos_publicos WHERE id=? AND publicada=1').bind(args.projeto_id).first();
   if(!project)throw new Error('Projeto não encontrado.');
   const rows=await env.DB.prepare('SELECT id,titulo,resumo,conteudo,data_realizacao,atualizado_em FROM acoes WHERE projeto_publico_id=? AND publicada=1 ORDER BY data_realizacao DESC,criado_em DESC LIMIT 20').bind(args.projeto_id).all();
   const items=await Promise.all(rows.results.map(async row=>({...row,fotos:(await env.DB.prepare('SELECT caminho,descricao,legenda,ordem FROM acoes_fotos WHERE acao_id=? ORDER BY ordem,caminho').bind(row.id).all()).results})));
   return mcpText({items,total:items.length});
  }
  const url=new URL('/api/admin/atualizacoes',new URL(req.url).origin);url.searchParams.set('projeto',args.projeto_id);if(!args.incluir_rascunhos)url.searchParams.set('situacao','publicado');
  const response=await callProjectUpdateApi(req,env,'GET',url);return mcpText(await response.json(),!response.ok);
 }
 if(!owner)throw new Error('Esta ferramenta exige a conta administradora do Instituto Mais Amor.');
 if(name==='enviar_foto_atualizacao'){
  if(typeof args.imagem_base64!=='string'||args.imagem_base64.length>7000000||!['image/jpeg','image/png','image/webp'].includes(args.tipo_imagem))throw new Error('Envie uma imagem JPG, PNG ou WebP válida, com até 5 MB, em Base64.');
  const clean=args.imagem_base64.replace(/\s/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean))throw new Error('A imagem Base64 está inválida.');
  const bytes=Uint8Array.from(atob(clean),char=>char.charCodeAt(0));if(bytes.length>5*1024*1024)throw new Error('A foto ultrapassa o limite de 5 MB.');
  const mediaType=projectImageType(bytes);if(!mediaType||mediaType.type!==args.tipo_imagem)throw new Error('O tipo declarado não corresponde ao arquivo da imagem.');
  const url=new URL('/api/admin/atualizacoes/foto',new URL(req.url).origin);
  const inner=new Request(url,{method:'POST',headers:mcpAdminHeaders(req,args.tipo_imagem),body:bytes});
  const response=await handleProjectUpdates(inner,env,url.pathname,url);const data=await response.json();return mcpText(data,!response.ok);
 }
 if(name==='salvar_atualizacao'){
  const payload={...(args.id?{id:args.id,versao:args.versao}:{}),titulo:args.titulo,resumo:args.resumo,conteudo:args.conteudo,data_realizacao:args.data_realizacao,publicada:args.publicada,fotos_autorizadas:args.fotos_autorizadas,projeto_publico_id:args.projeto_id,fotos:args.fotos};
  const url=new URL('/api/admin/atualizacoes',new URL(req.url).origin);const response=await callProjectUpdateApi(req,env,'POST',url,payload);return mcpText(await response.json(),!response.ok);
 }
 throw new Error('Ferramenta indisponível.');
}

function mcpAdminHeaders(req,contentType){return new Headers({'Content-Type':contentType,'oai-authenticated-user-id':req.headers.get('oai-authenticated-user-id')||'','oai-authenticated-user-email':req.headers.get('oai-authenticated-user-email')||''});}
async function callProjectUpdateApi(req,env,method,url,payload){
 const headers=mcpAdminHeaders(req,'application/json');const inner=new Request(url,{method,headers,...(payload?{body:JSON.stringify(payload)}:{})});return handleProjectUpdates(inner,env,url.pathname,url);
}
