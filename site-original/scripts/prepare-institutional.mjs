import {readFileSync,writeFileSync} from 'node:fs';
const AI_NOTE='Imagem ilustrativa fornecida pelo Instituto e gerada com inteligência artificial. Não representa uma atividade real.';
const article5='No cumprimento de suas finalidades, todas as atividades, atendimentos e terapias serão prestados de forma gratuita, contínua e sem qualquer distinção quanto à raça, cor, sexo, religião, condição social ou convicções políticas e filosóficas.';
const oldParagraph='Todas as atividades, atendimentos e terapias são prestados de forma gratuita, contínua e sem qualquer distinção de nacionalidade, raça, cor, sexo, crença ou orientação política.';
const items=[
 ['solidariedade-mochilas','Solidariedade que acolhe','Apoio material e vínculos de cuidado fazem parte da proposta de solidariedade.','Ilustração de uma voluntária entregando uma mochila a uma criança, acompanhada por sua mãe.'],
 ['apoio-inclusivo','Cada pessoa tem seu lugar','A acessibilidade e a participação orientam os caminhos de inclusão.','Ilustração de uma criança em cadeira de rodas participando de uma atividade com uma equipe de apoio.'],
 ['solidariedade-abraco','O cuidado começa no encontro','Escuta, respeito e apoio às famílias aproximam pessoas e comunidade.','Ilustração de uma mulher e uma criança se abraçando em um encontro comunitário.'],
 ['amizade-inclusiva','Conviver, brincar e pertencer','Experiências compartilhadas representam possibilidades de convivência para todas as pessoas.','Ilustração de três crianças brincando juntas em um parque, incluindo uma menina em cadeira de rodas.']
];
const gallery='<section class="section soft" id="galeria-institucional"><div class="wrap"><div class="eyebrow">NOSSO PROPÓSITO EM IMAGENS</div><h2>Muitas formas de cuidar.<br>Muitas histórias para acolher.</h2><p>Uma representação dos valores de inclusão, solidariedade e apoio às famílias que orientam o Instituto.</p><div class="institutional-gallery">'+items.map(([slug,title,desc,alt])=>'<figure><img src="assets/galeria/'+slug+'.webp" alt="'+alt+'" width="1600" height="893" loading="lazy" decoding="async"><figcaption><h3>'+title+'</h3><p>'+desc+'</p></figcaption></figure>').join('')+'</div><p class="institutional-gallery-note">As imagens desta galeria foram fornecidas pelo Instituto e geradas com inteligência artificial. São ilustrações da proposta institucional, sem representar beneficiários, instalações ou ações comprovadas. <a class="text-link" href="midia.html#imagens-fornecidas">Conhecer o contexto das imagens ↗</a></p></div></section>';
const organization='<section class="section" id="organizacao-institucional"><div class="wrap"><div class="eyebrow">NOSSO COMPROMISSO</div><h2>Um propósito social.<br>Um compromisso com as pessoas.</h2><div class="institutional-place"><p>Com sua proposta sediada no Gama, Distrito Federal, o Instituto Mais Amor conecta saúde, educação, assistência social e defesa de direitos. Acolhimento, inclusão e apoio às famílias orientam esse caminho, com compromisso com a gratuidade.</p></div><a class="text-link" href="finalidades.html">Conheça nossas finalidades e a gratuidade ↗</a></div></section>';
export function prepareInstitutional(){
 for(const name of ['index','instituto','transparencia','finalidades','midia']){
  const path='dist/'+name+'.html';let html=readFileSync(path,'utf8');
  if(!html.includes('href="institucional.css"'))html=html.replace('</head>','<link rel="stylesheet" href="institucional.css"></head>');
  if(name==='index'){
   let hasPhotoContext=false;html=html.replace(/<div class="wrap program-photo-context">[\s\S]*?<\/p><\/div>/g,match=>{if(hasPhotoContext)return '';hasPhotoContext=true;return match;});
   html=html.replace(/(<div class="editorial-photo"><img )src="[^"]*" alt="[^"]*"/,()=>'<div class="editorial-photo"><img src="assets/galeria/acolhimento-familias.webp" alt="Ilustração de uma profissional acolhendo uma mulher e uma criança em um ambiente de cuidado"');
   if(!html.includes('class="institutional-photo-note"'))html=html.replace('<div class="about-copy">','<div class="about-copy"><p class="institutional-photo-note">'+AI_NOTE+'</p>');
   html=html.replace(/<div class="program-grid">[\s\S]*?<\/article><\/div>/,m=>m.replaceAll('assets/aprender-juntos.jpg','assets/galeria/brincar-aprender.webp').replaceAll('assets/educacao-diversa.jpg','assets/galeria/oficina-criativa.webp').replaceAll('assets/familia-inclusiva.jpg','assets/galeria/vinculos-familiares.webp'));
   if(!hasPhotoContext)html=html.replace('<section class="section projects-section">','<div class="wrap program-photo-context"><p>As cenas de atividades e acolhimento são ilustrações geradas com inteligência artificial, fornecidas pelo Instituto. <a href="midia.html#imagens-fornecidas">Contexto das imagens ↗</a></p></div><section class="section projects-section">');
   html=html.replace(/(<div class="inclusion-image"><img )src="[^"]*" alt="[^"]*"/,()=>'<div class="inclusion-image"><img src="assets/galeria/convivencia-parque.webp" alt="Ilustração de crianças brincando em um parque, incluindo uma criança com fones e uma menina em cadeira de rodas"');
  }
  if(name==='instituto'){
   html=html.replace(/<section class="section" id="organizacao-institucional">[\s\S]*?<\/section>/,()=>organization);
   if(!html.includes('id="organizacao-institucional"'))html=html.replace('</main>',organization+'</main>');
   if(!html.includes('id="galeria-institucional"'))html=html.replace('</main>',gallery+'</main>');
  }

  if(name==='finalidades'){
   html=html.replace('Artigo 4º — conteúdo integral das finalidades institucionais fornecidas para este portal.','Artigos 4º e 5º — finalidades e compromisso com a gratuidade, conforme o estatuto fornecido.').replace('Parágrafo único','Artigo 5º — Gratuidade').replace(oldParagraph,article5);
   html=html.replace(/<section class="section soft" id="fonte-estatuto">[\s\S]*?<\/section>/,'');
  }
  if(name==='midia'&&!html.includes('id="imagens-fornecidas"'))html=html.replace('</main>','<section class="section soft" id="imagens-fornecidas"><div class="wrap"><h2>Imagens fornecidas pelo Instituto</h2><p>Esta atualização reúne nove imagens geradas com inteligência artificial (Gemini) e fornecidas para a comunicação do projeto. Elas ilustram acolhimento, atividades educativas, convivência e solidariedade.</p><p>As cenas não documentam pessoas atendidas, profissionais, instalações ou ações realizadas pelo Instituto. A identidade, a condição de saúde e os resultados de uma pessoa não são inferidos pelas imagens. Os textos e marcas presentes nas cenas pertencem à composição ilustrativa.</p><a class="text-link" href="instituto.html#galeria-institucional">Conhecer a galeria institucional ↗</a></div></section></main>');
  writeFileSync(path,html);
 }
}
