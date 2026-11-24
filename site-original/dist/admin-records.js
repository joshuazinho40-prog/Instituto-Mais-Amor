// Read-only record views. No mutation, export, or browser persistence is performed here.
export function initRecordViews({api,el,categories,stateNames,personTypes,openEditor,isVisible}){
 const $=selector=>document.querySelector(selector),details=$('#record-details-dialog');
 const fieldNames={nome:'Nome',titulo:'Título',tipo:'Tipo de cadastro',contato:'Telefone ou e-mail',organizacao:'Organização ou área de interesse',mensagem:'Mensagem ou motivo do contato',situacao:'Situação',notas:'Anotações internas',resumo:'Resumo',conteudo:'Relato completo',data_inicio:'Data de início',data_fim:'Data de conclusão',data_realizacao:'Data de realização',data_ocorrencia:'Data da ocorrência',quantidade:'Quantidade',descricao_tipo:'Descrição da atividade',cadastro_nome:'Pessoa ou contato vinculado',cadastro_id:'Protocolo do cadastro vinculado',publicado:'Visibilidade',publicada:'Visibilidade',publico:'Visibilidade',privacidade_versao:'Autorização registrada — versão',criado_em:'Data de criação',atualizado_em:'Última atualização',id:'Protocolo'};
 const ordering=['nome','titulo','tipo','situacao','contato','organizacao','mensagem','descricao_tipo','quantidade','data_ocorrencia','cadastro_nome','cadastro_id','data_inicio','data_fim','data_realizacao','resumo','conteudo','notas','publicado','publicada','publico','privacidade_versao','criado_em','atualizado_em','id'];
 const operationNames={atendimento:'Atendimento realizado',cesta:'Entrega de cestas',outro:'Outra atividade'};
 let detailVersion=0,detailOrigin,selected,loaded=false,loading=false,controller,loadVersion=0;
 function displayValue(key,value,category){
  if(value===null||value===undefined||value==='')return 'Não informado';
  if(['publicado','publicada','publico'].includes(key))return value?'Publicado no site':'Somente na administração';
  if(key==='situacao')return stateNames[value]||String(value);
  if(key==='tipo')return category==='operacao'?(operationNames[value]||value):(categories[value]||value);
  if(key==='criado_em'||key==='atualizado_em'){const date=new Date(value);return Number.isNaN(date.valueOf())?String(value):date.toLocaleString('pt-BR');}
  if(/^data_/.test(key)&&typeof value==='string'){const date=new Date(value+'T12:00:00');return Number.isNaN(date.valueOf())?value:date.toLocaleDateString('pt-BR');}
  return typeof value==='object'?JSON.stringify(value):String(value);
 }
 function recordFields(record,category){
  const list=el('dl',undefined,'record-information');
  const keys=[...ordering.filter(key=>Object.hasOwn(record,key)),...Object.keys(record).filter(key=>key!=='categoria'&&!ordering.includes(key))];
  for(const key of keys){const pair=el('div',undefined,'record-information-field');if(['mensagem','notas','resumo','conteudo','id','cadastro_id'].includes(key))pair.classList.add('full-width');pair.append(el('dt',fieldNames[key]||key.replaceAll('_',' ')),el('dd',displayValue(key,record[key],category)));list.append(pair);}
  return list;
 }
 function heading(record,category,withView=false){const header=el('div',undefined,'record-sheet-heading'),text=el('div');text.append(el('span',categories[category]||category,'eyebrow'),el('h3',record.nome||record.titulo||record.descricao_tipo||'Registro'));header.append(text);if(withView){const view=el('button','Abrir ficha','button secondary');view.type='button';view.setAttribute('aria-haspopup','dialog');view.onclick=()=>show(category,record.id);header.append(view);}return header;}
 async function show(category,id){
  detailOrigin=document.activeElement;selected=null;const version=++detailVersion;
  $('#record-details-title').textContent='Ficha completa';$('#record-details-content').replaceChildren();$('#record-details-status').textContent='Consultando os dados do cadastro…';$('#record-details-edit').disabled=true;details.setAttribute('aria-busy','true');if(!details.open)details.showModal();
  try{const data=await api('/api/admin/registro?tipo='+encodeURIComponent(category)+'&id='+encodeURIComponent(id));if(version!==detailVersion||!details.open)return;selected={category,id};$('#record-details-title').textContent=data.item.nome||data.item.titulo||data.item.descricao_tipo||'Ficha completa';$('#record-details-status').textContent='Visualização completa · '+(categories[category]||category)+' · Nenhuma informação é alterada nesta consulta.';$('#record-details-content').append(recordFields(data.item,category));$('#record-details-edit').disabled=false;}
  catch(error){if(version===detailVersion&&details.open)$('#record-details-status').textContent=error.message;}
  finally{if(version===detailVersion)details.setAttribute('aria-busy','false');}
 }
 function close(){details.close();}
 $('#record-details-close').onclick=close;$('#record-details-dismiss').onclick=close;
 details.addEventListener('close',()=>{detailVersion++;details.setAttribute('aria-busy','false');if(!$('#record-dialog').open)detailOrigin?.focus();});
 $('#record-details-edit').onclick=()=>{if(!selected)return;const {category,id}=selected;close();detailOrigin?.focus();openEditor(category,id);};
 for(const[key,title]of Object.entries(categories))$('#full-category-filter').add(new Option(title,key));
 for(const[key,title]of Object.entries(stateNames))$('#full-state-filter').add(new Option(title,key));
 async function load(){
  controller?.abort();const ownController=new AbortController();controller=ownController;const version=++loadVersion;loading=true;loaded=false;
  const root=$('#full-data-records'),status=$('#full-data-status');root.replaceChildren();$('#full-data-empty').hidden=true;$('#full-data-cancel').hidden=false;root.setAttribute('aria-busy','true');status.textContent='Consultando todos os cadastros…';
  let count=0,total=0,page=1;const seen=new Set();const query=new URLSearchParams(new FormData($('#full-data-filters')));
  try{
   while(true){
    query.set('pagina',page);const response=await fetch('/api/admin/cadastros-detalhados?'+query,{cache:'no-store',signal:ownController.signal});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível consultar os cadastros.');if(version!==loadVersion)return;
    if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||!Number.isSafeInteger(data.por_pagina)||data.por_pagina<1)throw Error('A consulta não retornou os dados esperados.');
    total=data.total;const fragment=document.createDocumentFragment();let added=0;
    for(const record of data.items){const key=record.categoria+':'+record.id;if(seen.has(key))continue;seen.add(key);added++;count++;const card=el('article',undefined,'record-sheet');card.append(heading(record,record.categoria,true),recordFields(record,record.categoria));fragment.append(card);}
    root.append(fragment);status.textContent=count+' de '+total+' ficha(s) carregada(s)…';
    if(page*data.por_pagina>=total){if(count<total)throw Error('A base foi alterada durante a consulta. Atualize a lista para conferir todas as fichas.');break;}
    if(!added)throw Error('Não foi possível concluir a lista. Atualize para consultar as fichas restantes.');page++;
   }
   loaded=true;status.textContent=total?count+' ficha(s) completa(s) · Todos os cadastros desta seleção estão abaixo.':'Nenhum cadastro encontrado para esta seleção.';$('#full-data-empty').hidden=count>0;
  }catch(error){if(version!==loadVersion)return;status.textContent=error.name==='AbortError'?'Carregamento interrompido. '+count+' de '+total+' ficha(s) exibida(s). Use Atualizar lista para consultar todas.':error.message+(count?' '+count+' ficha(s) foram carregadas.':'');}
  finally{if(version===loadVersion){loading=false;controller=null;$('#full-data-cancel').hidden=true;root.setAttribute('aria-busy','false');}}
 }
 $('#full-data-filters').onsubmit=event=>{event.preventDefault();load();};$('#full-data-refresh').onclick=load;$('#full-data-cancel').onclick=()=>controller?.abort();$('#full-data-clear').onclick=()=>{$('#full-data-filters').reset();load();};
 return{show,load,ensureLoaded(){if(!loaded&&!loading)load();},invalidate(){loaded=false;if(isVisible())load();}};
}
