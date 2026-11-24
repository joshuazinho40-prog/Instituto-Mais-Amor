const main=document.querySelector('main');
const page=location.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';
const kind=page==='/impacto'?'impacto':null;
function node(tag,text,className){const item=document.createElement(tag);if(text!==undefined)item.textContent=text;if(className)item.className=className;return item;}
if(main&&kind){
 const section=node('section',undefined,'section public-center-section'),wrap=node('div',undefined,'wrap');section.id='public-projects';
 wrap.append(node('div','INFORMAÇÕES ATUALIZADAS','eyebrow'),node('h2','Projetos divulgados pelo Instituto'),node('p','Informações confirmadas para divulgação pela equipe. Alterações salvas no painel aparecem nesta consulta.'));
 const status=node('p','Carregando…');status.setAttribute('role','status');const list=node('div',undefined,'grid');wrap.append(status,list);section.append(wrap);main.append(section);
 async function load(){try{const response=await fetch('/api/projetos',{cache:'no-store'});if(!response.ok)throw Error();const rows=(await response.json()).items;list.replaceChildren();status.textContent=rows.length?rows.length+' projeto(s) divulgado(s).':'Os projetos confirmados para divulgação aparecerão aqui.';
 const states={planejamento:'Em planejamento',desenvolvimento:'Em desenvolvimento',atividade:'Em atividade',concluido:'Concluídos',pausado:'Pausados'};for(const[key,title]of Object.entries(states)){const card=node('article',undefined,'card');card.append(node('h3',title),node('strong',String(rows.filter(r=>r.situacao===key).length)));list.append(card);}
 }catch{status.textContent='Não foi possível consultar as informações agora. Tente novamente mais tarde.';}}
 load();window.addEventListener('focus',load);setInterval(()=>{if(!document.hidden)load();},60000);
}
