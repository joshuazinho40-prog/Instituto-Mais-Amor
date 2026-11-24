import { config as localConfig } from './config.js';
const config={...localConfig};
try{const response=await fetch('/api/configuracao-publica',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(response.ok){const settings=await response.json();if(settings.atualizado_em)for(const key of ['email','whatsapp','instagram','address','hours'])if(typeof settings[key]==='string')config[key]=settings[key];}}catch{}
const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Abrir menu'); }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; nav.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {closeMenu();menu.focus();} });
nav.addEventListener('click', e => {if(e.target.closest('a'))closeMenu();});
window.matchMedia('(min-width:901px)').addEventListener('change', e => {if(e.matches)closeMenu();});
document.querySelectorAll('img[data-fallback]').forEach(img => {const fallback = () => {img.onerror = null;img.src = img.dataset.fallback;img.alt = 'Ilustração de pessoas reunidas, simbolizando acolhimento e pertencimento';const caption=img.closest('.hero-art')?.querySelector('.image-caption');if(caption)caption.textContent='Ilustração conceitual. Espaço preparado para fotografia autorizada.';}; img.addEventListener('error', fallback, {once:true}); if(img.complete && img.naturalWidth===0)fallback();});
const labels={todos:'Todos',planejamento:'Em planejamento',desenvolvimento:'Em desenvolvimento',atividade:'Em atividade',concluido:'Concluídos',pausado:'Pausados'};
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b===button))); let count=0;document.querySelectorAll('[data-status]').forEach(card => {const show=button.dataset.filter==='todos'||card.dataset.status===button.dataset.filter;card.hidden=!show;if(show)count++;});document.querySelector('#filter-empty').hidden=count>0;document.querySelector('#filter-result').textContent=count+' proposta'+(count===1?'':'s')+' • '+labels[button.dataset.filter]; }));
const care={saude:['Saúde','Atendimento multidisciplinar, desenvolvimento e reabilitação.'],educacao:['Educação','Aprendizagem, formação, orientação e conhecimento.'],assistencia:['Assistência social','Acolhimento, fortalecimento familiar, inclusão e cidadania.']};
document.querySelectorAll('[data-care]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('[data-care]').forEach(b => b.setAttribute('aria-pressed', String(b===button)));const content=document.querySelector('#care-description');content.querySelector('h3').textContent=care[button.dataset.care][0];content.querySelector('p').textContent=care[button.dataset.care][1]; }));
// No collection is enabled until an institutional backend and privacy process are approved.
document.querySelectorAll('form[data-interest]').forEach(form => form.addEventListener('submit', async e => {
 e.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('button[type=submit]'),result=form.querySelector('.form-result');button.disabled=true;result.textContent='Enviando…';
 try{const f=new FormData(form);const response=await fetch('/api/cadastros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:form.dataset.interest,nome:f.get('nome'),contato:f.get('contato'),organizacao:f.get('organizacao'),mensagem:f.get('mensagem'),website:f.get('website'),ciente:f.get('ciente')==='on'})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível enviar.');form.reset();result.textContent='Solicitação registrada. Guarde seu protocolo: '+data.protocolo;}
 catch(error){result.textContent=error.message||'Falha de conexão. Tente novamente.';}finally{button.disabled=false;result.focus();}
}));
const official = document.querySelector('#official-contacts');
const hasWhatsapp = typeof config.whatsapp === 'string' && /^\d{10,15}$/.test(config.whatsapp);
const hasEmail = typeof config.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email);
const hasInstagram = typeof config.instagram === 'string' && /^https:\/\/(www\.)?instagram\.com\//.test(config.instagram);
function addContact(label,url){const a=document.createElement('a');a.className='button light';a.textContent=label;a.href=url;const box=official||document.body;if(!official){a.style.cssText='position:fixed;bottom:22px;left:22px;z-index:8'}box.append(a);}
if(hasWhatsapp) addContact('Conversar pelo WhatsApp','https://wa.me/'+config.whatsapp+'?text='+encodeURIComponent('Olá! Gostaria de conhecer o Instituto Mais Amor e receber informações sobre acolhimento e suas iniciativas.'));
if(official){
 if(hasEmail)addContact('E-mail institucional','mailto:'+config.email);
 if(hasInstagram)addContact('Instagram',config.instagram);
 for(const key of ['address','hours'])if(config[key]){const p=document.createElement('p');p.textContent=config[key];official.append(p);}
 if(hasEmail||hasWhatsapp||hasInstagram){official.querySelector('.empty')?.remove();const notice=official.querySelector('.notice span');if(notice)notice.textContent='Utilize os canais oficiais acima ou o formulário de contato. As solicitações são registradas para retorno da equipe; atendimentos dependem de avaliação e disponibilidade.';}
}

document.querySelectorAll('.inclusion-topic').forEach(button=>button.addEventListener('click',()=>{
 const open=button.getAttribute('aria-expanded')!=='true';
 document.querySelectorAll('.inclusion-topic').forEach(other=>{other.setAttribute('aria-expanded','false');other.querySelector('span').textContent=' +';document.getElementById(other.getAttribute('aria-controls')).hidden=true;});
 if(open){button.setAttribute('aria-expanded','true');button.querySelector('span').textContent=' −';document.getElementById(button.getAttribute('aria-controls')).hidden=false;}
}));
