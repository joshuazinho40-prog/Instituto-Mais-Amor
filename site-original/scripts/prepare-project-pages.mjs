import {readFileSync,writeFileSync} from 'node:fs';
// Augment tracked pages without regenerating unrelated design or dashboard work.
export function prepareProjectPages(){
 const fragment=readFileSync('scripts/templates/public-projects-admin.html','utf8').replace('class="admin-panel public-project-management" id="projetos-site"','class="view panel public-project-management" id="projetos-site" hidden').replaceAll('class="button light"','class="button secondary"').replaceAll('class="button"','class="button primary"');
 let admin=readFileSync('dist/admin.html','utf8');
 const start='<!--PUBLIC_PROJECT_MANAGER_START-->',end='<!--PUBLIC_PROJECT_MANAGER_END-->';
 if(admin.includes(start))admin=admin.replace(/<!--PUBLIC_PROJECT_MANAGER_START-->[\s\S]*?<!--PUBLIC_PROJECT_MANAGER_END-->/,()=>start+fragment+end);
 else admin=admin.replace('<section id="ajuda"',()=>start+fragment+end+'<section id="ajuda"');
 if(!admin.includes('data-view="projetos-site"'))admin=admin.replace('<a href="#publicacoes" data-view="publicacoes">','<a href="#projetos-site" data-view="projetos-site"><span aria-hidden="true">◇</span>Projetos do site</a><a href="#publicacoes" data-view="publicacoes">');
 if(!admin.includes('href="projetos-admin.css"'))admin=admin.replace('</head>','<link rel="stylesheet" href="projetos-admin.css"></head>');
 if(!admin.includes('Gerenciar os projetos do site</h2>'))admin=admin.replace('<div class="help-grid">','<div class="help-grid"><article class="panel"><span class="step-number">◇</span><h2>Gerenciar os projetos do site</h2><p>Abra <a href="#projetos-site"><strong>Projetos do site</strong></a> para editar os projetos publicados, incluir um novo, enviar a imagem de capa e conferir a prévia. Publicar exibe o conteúdo ao público; rascunho o mantém só no painel. Excluir remove o projeto após confirmação. O tipo Projeto na central mantém o histórico interno.</p></article>');
 if(!admin.includes('<!--PUBLIC_PROJECT_MANAGER_START-->'))throw Error('Não foi possível inserir o editor na central administrativa.');
 admin=admin.replace('<a class="button light" href="#projetos-gestao">Gerenciar projetos</a>','<a class="button light" href="#projetos-site">Projetos do site</a><a class="button light" href="#projetos-gestao">Histórico interno</a>');
 admin=admin.replace('<h2>Gestão e histórico de projetos</h2>','<h2>Histórico interno de projetos</h2>');
 if(!admin.includes('src="projetos-site-admin.js"'))admin=admin.replace('</body>','<script type="module" src="projetos-site-admin.js"></script></body>');
 if(!admin.includes('Gerenciar os projetos publicados no site</summary>'))admin=admin.replace('<summary>4 · Manter o histórico dos projetos</summary>','<summary>4 · Gerenciar os projetos publicados no site</summary><p>Abra Projetos do site para consultar os projetos publicados e os rascunhos. Use Incluir novo projeto, preencha os dados e envie uma capa ou escolha uma imagem da biblioteca. Confira a prévia e publique. Editar permite corrigir qualquer campo; salvar como rascunho retira o projeto do público. Excluir apaga o projeto após confirmação. A ordem define a posição na lista; até três destaques aparecem na página inicial.</p><a href="#projetos-site">Abrir projetos do site ↗</a></details><details><summary>Manter o histórico interno dos projetos</summary>');
 writeFileSync('dist/admin.html',admin);
 for(const page of ['index','projetos']){
  let html=readFileSync('dist/'+page+'.html','utf8');
  if(!html.includes('<!--PUBLIC_PROJECTS_START-->'))html=html.replace(/<div class="grid">(?=<article class="card project-card")[\s\S]*?<\/article><\/div>/,match=>'<!--PUBLIC_PROJECTS_START-->'+match+'<!--PUBLIC_PROJECTS_END-->');
  if(!html.includes('<!--PUBLIC_PROJECTS_START-->'))throw Error('Área de projetos não encontrada em '+page);
  if(page==='index')html=html.replace('Propostas institucionais em planejamento. Novas etapas e atividades serão comunicadas após confirmação.','Conheça a situação de cada projeto e consulte a equipe sobre as formas de participação.');
  if(page==='projetos'&&!html.includes('data-filter="concluido"'))html=html.replace('Em atividade</button></div>','Em atividade</button><button type="button" data-filter="concluido" aria-pressed="false">Concluídos</button><button type="button" data-filter="pausado" aria-pressed="false">Pausados</button></div>');
  if(!html.includes('href="projetos.css"'))html=html.replace('</head>','<link rel="stylesheet" href="projetos.css"></head>');
  writeFileSync('dist/'+page+'.html',html);
 }
 let detail=readFileSync('dist/projeto-1.html','utf8');
 if(!detail.includes('href="projetos.css"'))writeFileSync('dist/projeto-1.html',detail.replace('</head>','<link rel="stylesheet" href="projetos.css"></head>'));
}
