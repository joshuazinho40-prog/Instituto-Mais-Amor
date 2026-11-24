import {readFileSync,writeFileSync} from 'node:fs';
export function prepareHeroVideoCard(){
 const path='dist/index.html',start='<!--HERO_VIDEO_CARD_START-->',end='<!--HERO_VIDEO_CARD_END-->';
 const component=start+readFileSync('scripts/templates/hero-video-card.html','utf8')+end;
 let html=readFileSync(path,'utf8');
 if(html.includes(start))html=html.replace(/<!--HERO_VIDEO_CARD_START-->[\s\S]*?<!--HERO_VIDEO_CARD_END-->/,()=>component);
 else{
  const opening=html.indexOf('<div class="campaign-visual">');if(opening<0)throw Error('A apresentação do vídeo não foi encontrada.');
  const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=opening;let depth=0,match,closing;
  while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0){closing=tags.lastIndex;break;}}
  if(!closing)throw Error('A apresentação do vídeo está incompleta.');
  html=html.slice(0,opening)+component+html.slice(closing);
 }
 html=html.replace(/<link rel="stylesheet" href="video-card.css">/g,'').replace('</head>','<link rel="stylesheet" href="video-card.css"></head>');
 writeFileSync(path,html);
}
