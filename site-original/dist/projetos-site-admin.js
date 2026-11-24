const form=document.querySelector('#public-project-form'),editor=document.querySelector('#public-project-editor'),list=document.querySelector('#public-project-list'),message=document.querySelector('#public-project-list-message'),feedback=document.querySelector('#public-project-feedback');
const labels={planejamento:'Em planejamento',desenvolvimento:'Em desenvolvimento',atividade:'Em atividade',concluido:'Concluído',pausado:'Pausado'};
let projects=[],busy=false,uploading=false,dirty=false;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const field=name=>form.elements.namedItem(name);
async function request(path,options){const r=await fetch(path,options),d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível concluir a operação.');return d;}
const post=(path,body)=>request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function setBusy(value){busy=value;for(const b of form.querySelectorAll('button'))b.disabled=value||uploading;document.querySelector('#public-project-cover-file').disabled=value||uploading;document.querySelector('#public-project-cover-library').disabled=value||uploading;}
function current(){return projects.find(p=>p.id===field('id').value);}
function canLeave(){return !dirty||window.confirm('Há alterações ainda não salvas. Deseja descartá-las?');}
function showCover(path){const image=document.querySelector('#public-project-cover-preview');image.hidden=!path;if(path)image.src=path;else image.removeAttribute('src');image.alt=field('capa_alt').value||'Prévia da capa escolhida';document.querySelector('#public-project-cover-caption').textContent=path?'Esta é a capa selecionada.':'A capa escolhida aparecerá aqui.';}
function openProject(p){
 if(busy||uploading||!canLeave())return;
 form.reset();feedback.textContent='';document.querySelector('#public-project-cover-feedback').textContent='';document.querySelector('#public-project-preview').hidden=true;
 for(const name of ['id','versao','titulo','resumo','descricao','publico_alvo','atividades','local','horarios','como_participar','data_inicio','data_fim','situacao','capa','capa_alt','capa_credito','ordem'])if(p)field(name).value=p[name]??'';
 if(p){field('objetivos').value=p.objetivos.join('\n');field('destaque').checked=p.destaque;}
 else{field('id').value='';field('versao').value='';field('capa').value='';field('ordem').value=String(Math.min(9999,Math.max(0,...projects.map(p=>p.ordem))+10));}
 document.querySelector('#public-project-cover-library').value=[...document.querySelector('#public-project-cover-library').options].some(option=>option.value===field('capa').value)?field('capa').value:'';
 showCover(field('capa').value);document.querySelector('#public-project-editor-title').textContent=p?'Editar projeto: '+p.titulo:'Incluir novo projeto';
 document.querySelector('#public-project-publish').textContent=p?.publicada?'Salvar alterações no site':'Publicar projeto no site';document.querySelector('#public-project-draft').textContent=p?.publicada?'Retirar do site e salvar rascunho':'Salvar como rascunho';document.querySelector('#public-project-delete').hidden=!p;
 document.querySelector('#public-project-current-state').textContent=p?(p.publicada?'Publicado no site. Salvar alterações atualiza a página pública.':'Rascunho. Este projeto só aparece na administração.'):'Novo projeto. Nada será exibido ao público até você publicar.';
 dirty=false;editor.open=true;editor.scrollIntoView({behavior:'smooth',block:'start'});field('titulo').focus({preventScroll:true});
}
function renderList(){
 const q=document.querySelector('#public-project-search').value.trim().toLocaleLowerCase('pt-BR'),filter=document.querySelector('#public-project-filter').value;
 const visible=projects.filter(p=>(filter==='todos'||p.publicada===(filter==='publicados'))&&(!q||p.titulo.toLocaleLowerCase('pt-BR').includes(q)));
 message.textContent=projects.filter(p=>p.publicada).length+' publicado(s) · '+projects.filter(p=>!p.publicada).length+' rascunho(s) · '+visible.length+' exibido(s).';list.replaceChildren();
 for(const p of visible){
  const card=el('article',undefined,'public-project-item');
  if(p.capa){const img=el('img');img.src=p.capa;img.alt=p.capa_alt;img.loading='lazy';img.width=360;img.height=240;card.append(img);}else card.append(el('div','Sem capa','public-project-no-cover'));
  const body=el('div',undefined,'public-project-item-body');body.append(el('span',p.publicada?'Publicado no site':'Rascunho','project-publication-badge'),el('h3',p.titulo),el('p',labels[p.situacao]+' · Ordem '+p.ordem+(p.destaque?' · Destaque na página inicial':'')),el('small','Última alteração: '+new Date(p.atualizado_em).toLocaleString('pt-BR')));
  const actions=el('div',undefined,'actions'),edit=el('button','Editar','button secondary');edit.type='button';edit.onclick=()=>openProject(p);
  const view=el('a',p.publicada?'Ver no site ↗':'Ver rascunho ↗','text-link');view.href='/projeto-'+p.id+'.html'+(p.publicada?'':'?preview=1');view.target='_blank';view.rel='noopener';
  const remove=el('button','Excluir','project-delete-link');remove.type='button';remove.setAttribute('aria-label','Excluir projeto '+p.titulo);remove.onclick=()=>deleteProject(p);
  const updates=el('button','Ações e fotos','button secondary');updates.type='button';updates.onclick=()=>window.dispatchEvent(new CustomEvent('project-updates-open',{detail:{projectId:p.id}}));actions.append(edit,updates,view,remove);body.append(actions);card.append(body);list.append(card);
 }
 if(!visible.length)list.append(el('p',projects.length?'Nenhum projeto corresponde à busca.':'Nenhum projeto cadastrado. Clique em Incluir novo projeto para começar.','empty'));
}
async function loadProjects(){message.textContent='Carregando projetos…';try{const d=await request('/api/admin/projetos-site');projects=d.items;renderList();}catch(e){message.textContent=e.message;}}
function collect(){const data=Object.fromEntries(new FormData(form));delete data.versao;data.ordem=Number(field('ordem').value);data.versao=Number(field('versao').value);data.destaque=field('destaque').checked;data.objetivos=field('objetivos').value.split('\n').map(v=>v.trim()).filter(Boolean);if(!data.id){delete data.id;delete data.versao;}return data;}
form.addEventListener('input',()=>{dirty=true;});
form.onsubmit=async e=>{
 e.preventDefault();if(busy||uploading||!form.reportValidity())return;
 const data=collect();data.publicada=e.submitter?.value==='publicar';
 if(data.publicada&&(data.resumo.trim().length<10||data.descricao.trim().length<10||!data.capa||!data.capa_alt.trim())){feedback.textContent='Para publicar, preencha resumo e descrição com pelo menos 10 caracteres, escolha uma capa e descreva a imagem para acessibilidade.';feedback.focus();return;}
 if(data.objetivos.length>20||data.objetivos.some(v=>v.length>300)){feedback.textContent='Informe até 20 objetivos, com no máximo 300 caracteres por linha.';feedback.focus();return;}
 if(current()?.publicada&&!data.publicada&&!window.confirm('Salvar como rascunho retira este projeto da página de Projetos e da página inicial. Continuar?'))return;
 setBusy(true);feedback.textContent='Salvando projeto…';try{const result=await post('/api/admin/projetos-site',data);dirty=false;window.dispatchEvent(new Event('public-projects-updated'));await loadProjects();setBusy(false);openProject(result.item);feedback.textContent=data.publicada?'Projeto publicado. A página de Projetos e os destaques já usam as informações salvas.':'Rascunho salvo. O projeto está guardado apenas na administração.';const link=el('a',data.publicada?' Abrir projeto publicado ↗':' Abrir prévia do rascunho ↗');link.href=result.url+(data.publicada?'':'?preview=1');link.target='_blank';link.rel='noopener';feedback.append(link);feedback.focus();}catch(error){feedback.textContent=error.message;feedback.focus();}finally{setBusy(false);}
};
async function deleteProject(p){
 if(!p||busy||uploading)return;if(!window.confirm('Excluir definitivamente o projeto “'+p.titulo+'”? Ele será removido da página de Projetos, dos destaques e do painel. Para apenas ocultar, use rascunho.'))return;
 if(field('id').value===p.id&&dirty&&!window.confirm('A edição deste projeto tem alterações não salvas. Excluir mesmo assim?'))return;
 setBusy(true);try{await post('/api/admin/projetos-site/excluir',{id:p.id,versao:p.versao,confirmacao:p.id});window.dispatchEvent(new Event('public-projects-updated'));if(field('id').value===p.id){dirty=false;form.reset();field('id').value='';editor.open=false;}await loadProjects();message.textContent='Projeto excluído. '+message.textContent;}catch(e){message.textContent=e.message;}finally{setBusy(false);}
}
document.querySelector('#public-project-new').onclick=()=>openProject(null);document.querySelector('#public-project-refresh').onclick=loadProjects;document.querySelector('#public-project-search').oninput=renderList;document.querySelector('#public-project-filter').onchange=renderList;
document.querySelector('#public-project-cancel').onclick=()=>{if(canLeave()){dirty=false;editor.open=false;}};
document.querySelector('#public-project-delete').onclick=()=>deleteProject(current());
document.querySelector('#public-project-cover-library').onchange=e=>{if(!e.target.value)return;field('capa').value=e.target.value;document.querySelector('#public-project-cover-file').value='';showCover(e.target.value);dirty=true;document.querySelector('#public-project-cover-feedback').textContent='Imagem da biblioteca selecionada. Salve o projeto para aplicar.';};
document.querySelector('#public-project-cover-file').onchange=async e=>{
 const file=e.target.files[0],status=document.querySelector('#public-project-cover-feedback');if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){status.textContent='Escolha JPG, PNG ou WebP com até 5 MB.';e.target.value='';return;}
 uploading=true;setBusy(false);status.textContent='Enviando a capa…';
 try{const d=await request('/api/admin/projetos-site/capa',{method:'POST',headers:{'Content-Type':file.type},body:file});field('capa').value=d.capa;document.querySelector('#public-project-cover-library').value='';showCover(d.capa);dirty=true;status.textContent='Capa enviada. Preencha a descrição da imagem e salve o projeto para aplicar.';}catch(error){status.textContent=error.message;e.target.value='';}finally{uploading=false;setBusy(false);}
};
field('capa_alt').addEventListener('input',()=>{document.querySelector('#public-project-cover-preview').alt=field('capa_alt').value||'Prévia da capa escolhida';});
document.querySelector('#public-project-preview-button').onclick=()=>{
 const d=collect(),preview=document.querySelector('#public-project-preview'),img=document.querySelector('#public-project-preview-image');
 document.querySelector('#public-project-preview-title').textContent=d.titulo||'Nome do projeto';document.querySelector('#public-project-preview-summary').textContent=d.resumo;img.hidden=!d.capa;if(d.capa)img.src=d.capa;img.alt=d.capa_alt;
 const body=document.querySelector('#public-project-preview-body');body.replaceChildren();const add=(title,text)=>{if(!text)return;body.append(el('h4',title),el('p',text));};add('Sobre o projeto',d.descricao);if(d.objetivos.length){body.append(el('h4','Objetivos'));const ul=el('ul');for(const v of d.objetivos)ul.append(el('li',v));body.append(ul);}add('Público do projeto',d.publico_alvo);add('Atividades e formas de apoio',d.atividades);add('Local',d.local);add('Dias e horários',d.horarios);add('Como participar',d.como_participar);preview.hidden=false;preview.scrollIntoView({behavior:'smooth',block:'start'});
};
window.addEventListener('beforeunload',e=>{if(dirty||uploading){e.preventDefault();e.returnValue='';}});
loadProjects();
