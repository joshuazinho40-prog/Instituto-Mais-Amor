// This module is called only inside the server's existing administrator boundary.
// The build embeds these files separately from the public static asset map.
const privateDocuments=/*PRIVATE_DOCUMENTS*/{};
async function privateDocumentCatalog(env){
 const uploaded=await env.DB.prepare('SELECT id,titulo,descricao,nome,mime,tamanho,criado_em,atualizado_em FROM anexos ORDER BY atualizado_em DESC LIMIT 200').all();
 return {items:[...Object.entries(privateDocuments).map(([id,document])=>({id,...document.metadata,origem:'institucional',consulta:'/api/admin/documentos/'+id,download:'/api/admin/documentos/'+id+'?download=1'})),...uploaded.results.map(row=>({...row,origem:'anexo',publico:0,consulta:'/api/anexos/'+row.id,download:'/api/anexos/'+row.id+'?download=1'}))]};
}
async function privateDocumentResponse(req,env,path,url){
 if(path==='/api/admin/documentos'&&req.method==='GET')return json(await privateDocumentCatalog(env));
 if(!path.startsWith('/api/admin/documentos/'))return;
 if(!['GET','HEAD'].includes(req.method))return json({error:'Método não permitido.'},405);
 const id=path.slice('/api/admin/documentos/'.length),document=Object.hasOwn(privateDocuments,id)?privateDocuments[id]:null;
 if(!document)return json({error:'Documento não encontrado.'},404);
 const bytes=Uint8Array.from(atob(document.data),c=>c.charCodeAt(0));
 return new Response(req.method==='HEAD'?null:bytes,{headers:{...safeHeaders,'Content-Type':document.metadata.mime,'Content-Length':String(bytes.length),'Content-Disposition':(url.searchParams.get('download')==='1'?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(document.metadata.nome),'X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; sandbox"}});
}
