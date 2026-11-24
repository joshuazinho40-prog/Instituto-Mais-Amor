import {readFileSync,writeFileSync} from 'node:fs';
export function prepareCrm(){
 const file='dist/admin.html';let html=readFileSync(file,'utf8');
 const section='<!--CRM_ADMIN_START-->'+readFileSync('scripts/templates/crm-admin.html','utf8')+'<!--CRM_ADMIN_END-->';
 if(html.includes('<!--CRM_ADMIN_START-->'))html=html.replace(/<!--CRM_ADMIN_START-->[\s\S]*?<!--CRM_ADMIN_END-->/,()=>section);
 else html=html.replace('</main>',section+'</main>');
 const guide='<!--CRM_MODEL_GUIDE_START-->'+readFileSync('scripts/templates/crm-model-guide.html','utf8')+'<!--CRM_MODEL_GUIDE_END-->';
 if(html.includes('<!--CRM_MODEL_GUIDE_START-->'))html=html.replace(/<!--CRM_MODEL_GUIDE_START-->[\s\S]*?<!--CRM_MODEL_GUIDE_END-->/,()=>guide);
 else html=html.replace('<section id="ajuda" class="view" hidden aria-label="Como usar">','<section id="ajuda" class="view" hidden aria-label="Como usar">'+guide);
 if(!html.includes('href="crm-admin.css"'))html=html.replace('</head>','<link rel="stylesheet" href="crm-admin.css"></head>');
 const legacyGrid=/<div class="metrics-grid" id="overview-cards" aria-live="polite">[\s\S]*?<\/div>/;
 if(!html.includes('class="crm-history-block"')){
  if(!legacyGrid.test(html))throw Error('A área de indicadores históricos não foi encontrada para integração do CRM.');
  html=html.replace(legacyGrid,grid=>'<details class="crm-history-block"><summary>Consultar indicadores históricos e complementares</summary><p>Estes totais anteriores incluem cadastros e valores informados pela equipe. Eles não são somados automaticamente aos apoios confirmados do CRM.</p>'+grid+'</details>');
 }
 const confirmed=html.match(/<!--CONFIRMED_OVERVIEW_START-->[\s\S]*?<!--CONFIRMED_OVERVIEW_END-->/)?.[0];
 if(confirmed){html=html.replace(confirmed,'');html=html.replace('<details class="crm-history-block">',confirmed+'<details class="crm-history-block">');}
 html=html.replace('>Exportar resumo</button>','>Exportar histórico</button>');
 html=html.replace('Os registros salvos atualizam os totais automaticamente.','O CRM e a agenda alimentam o apoio confirmado. Os indicadores anteriores permanecem disponíveis para conciliação.');
 writeFileSync(file,html);
}
