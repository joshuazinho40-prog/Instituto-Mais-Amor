import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
// Keep old public addresses as a minimal, non-indexed doorway to the protected area.
export const restrictedDocumentsStub='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Documentos internos | Instituto Mais Amor</title><link rel="stylesheet" href="admin.css"></head><body><main><h1>Documentos internos</h1><p>A consulta aos documentos institucionais está na área administrativa.</p><a class="button primary" href="/admin#documentos-internos">Acessar área administrativa</a></main></body></html>';
export function preparePrivateDocuments(){
 for(const file of readdirSync('dist').filter(name=>name.endsWith('.html')&&name!=='admin.html')){
  let html=readFileSync('dist/'+file,'utf8');
  if(file==='transparencia.html')html=restrictedDocumentsStub;
  else html=html.replace(/<a\b[^>]*href="(?:\/)?transparencia(?:\.html)?(?:#[^"]*)?"[^>]*>[\s\S]*?<\/a>/g,'');
  writeFileSync('dist/'+file,html);
 }
 let admin=readFileSync('dist/admin.html','utf8');
 const fragment=readFileSync('scripts/templates/private-documents-admin.html','utf8'),start='<!--PRIVATE_DOCUMENTS_START-->',end='<!--PRIVATE_DOCUMENTS_END-->';
 if(admin.includes(start))admin=admin.replace(/<!--PRIVATE_DOCUMENTS_START-->[\s\S]*?<!--PRIVATE_DOCUMENTS_END-->/,()=>start+fragment+end);
 else admin=admin.replace('<section id="ajuda"',()=>start+fragment+end+'<section id="ajuda"');
 if(!admin.includes('data-view="documentos-internos"'))admin=admin.replace('<a href="#ajuda"',()=>'<a href="#documentos-internos" data-view="documentos-internos"><span aria-hidden="true">▣</span>Documentos internos</a><a href="#ajuda"');
 writeFileSync('dist/admin.html',admin);
 let sitemap=readFileSync('dist/sitemap.xml','utf8').replace(/<url>\s*<loc>[^<]*\/(?:transparencia|admin)(?:\.html)?<\/loc>[\s\S]*?<\/url>/g,'');writeFileSync('dist/sitemap.xml',sitemap);
 const robotsPath='dist/robots.txt';let robots=readFileSync(robotsPath,'utf8');for(const entry of ['/admin','/api/admin/','/api/anexos/','/documentos/','/transparencia'])if(!robots.includes('Disallow: '+entry))robots+='Disallow: '+entry+'\n';writeFileSync(robotsPath,robots);
}
