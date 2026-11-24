from pathlib import Path
import json
r=Path(__file__).resolve().parent.parent
p=r/'scripts/build.py';s=p.read_text(encoding='utf-8')
a=s.index('def form(kind):');b=s.index("page('parcerias.html'",a)
s=s[:a]+'''def form(kind):
 kind='parcerias' if kind=='parceria' else kind
 return '<div class="split"><div><div class="eyebrow">Manifestação de interesse</div><h2>Vamos construir essa rede juntos.</h2><p>Deixe seu contato para a equipe do Instituto conhecer seu interesse e organizar o retorno.</p>'+notice('Não inclua laudos, documentos ou informações de saúde. O envio não garante vaga, atendimento ou parceria.')+link('Como usamos seus dados','privacidade.html')+'</div><form data-interest="'+kind+'"><fieldset><legend>Seu primeiro contato</legend><label for="nome">Nome</label><input id="nome" name="nome" autocomplete="name" minlength="2" maxlength="100" required><label for="retorno">Telefone com DDD ou e-mail</label><input id="retorno" name="contato" maxlength="150" required><label for="organizacao">Organização ou área de interesse opcional</label><input id="organizacao" name="organizacao" maxlength="150"><label for="mensagem">Mensagem opcional</label><textarea id="mensagem" name="mensagem" maxlength="600" placeholder="Compartilhe somente o necessário para o primeiro contato."></textarea><div hidden aria-hidden="true"><label>Site<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="check"><input name="ciente" type="checkbox" required><span>Autorizo o uso destes dados para receber retorno sobre esta solicitação. Li a <a href="privacidade.html">Política de Privacidade</a>.</span></label><button class="button" type="submit">Enviar interesse</button></fieldset><p role="status" class="form-result" tabindex="-1"></p><small>A confirmação do envio significa apenas que a solicitação foi registrada.</small></form></div>'
''' + s[b:]
# Supplement existing generated pages with real contact forms.
pos=s.index("origin=config.get('siteUrl'")
s=s[:pos]+'''for slug,kind in [('acolhimento.html','acolhimento'),('contato.html','contato')]:
 p=dist/slug; text=p.read_text(); text=text.replace('</main>',section(form(kind),'soft')+'</main>');p.write_text(text)
''' +s[pos:]
s=s.replace('O canal oficial de acolhimento aguarda configuração. Não há envio de solicitações nesta versão, nem promessa de atendimento imediato, vagas ou prazo de resposta.','Utilize o formulário abaixo para registrar seu primeiro contato. Não há promessa de atendimento imediato, vagas ou prazo de resposta.')
s=s.replace('Esta versão não recebe mensagens. Não há canal de acolhimento ou formulário de envio ativo.','Você pode registrar sua mensagem no formulário abaixo e guardar o protocolo de envio.')
s=s.replace('Quando o canal estiver disponível, compartilhe apenas o necessário para o primeiro contato.','Compartilhe apenas o necessário para o primeiro contato.')
start=s.index('privacy=[');end=s.index("page('acessibilidade.html'",start)
s=s[:start]+'''privacy=[('Quem utiliza os dados','O Instituto Mais Amor utiliza os dados enviados para organizar manifestações de interesse e responder a contatos. O acesso aos registros é restrito à administração do projeto.'),('O que coletamos e para quê','Nome, telefone ou e-mail, organização ou área de interesse opcional e mensagem opcional. Usamos essas informações para analisar e retornar sua solicitação de parceria, voluntariado, acolhimento ou contato. A autorização específica é solicitada antes do envio, sem adesão automática a publicidade.'),('Armazenamento e acesso','Os registros são guardados no banco de dados da hospedagem Sites e acessados por painel administrativo com autenticação. A hospedagem pode tratar informações técnicas conforme suas condições. Não vendemos os dados nem exibimos cadastros publicamente.'),('Cuidados ao preencher','Este canal é para primeiro contato de pessoas adultas. Não envie documentos, diagnósticos, laudos, dados de crianças ou informações de saúde. Não é um serviço de urgência e não garante vagas ou atendimento.'),('Prazos e direitos','A administração deve revisar os registros periodicamente e excluir dados quando deixarem de ser necessários. Você pode pedir acesso, correção, revogação da autorização ou exclusão pelo próprio formulário de contato, identificando a solicitação pelo protocolo. A equipe verificará sua identidade proporcionalmente antes de responder.'),('Fornecedores e atualização','A infraestrutura de hospedagem e banco de dados é fornecida pela plataforma Sites. Informações institucionais e canais externos serão complementados após confirmação pela direção. Esta política deve acompanhar alterações no tratamento de dados.')]
page('privacidade.html','Política de Privacidade','Uso de dados para primeiro contato e manifestações de interesse. Atualizada em 8 de novembro de 2026.',section('<div class="article">'+''.join('<h2 style="font-size:24px;margin-top:35px">'+t+'</h2><p>'+d+'</p>' for t,d in privacy)+'</div>'))
''' +s[end:]
p.write_text(s,encoding='utf-8')
p=r/'dist/app.js';s=p.read_text(encoding='utf-8');s=s.replace("document.querySelectorAll('form[data-interest]').forEach(form => form.addEventListener('submit', e => e.preventDefault()));",'''document.querySelectorAll('form[data-interest]').forEach(form => form.addEventListener('submit', async e => {
 e.preventDefault();if(!form.reportValidity())return;const button=form.querySelector('button[type=submit]'),result=form.querySelector('.form-result');button.disabled=true;result.textContent='Enviando…';
 try{const f=new FormData(form);const response=await fetch('/api/cadastros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:form.dataset.interest,nome:f.get('nome'),contato:f.get('contato'),organizacao:f.get('organizacao'),mensagem:f.get('mensagem'),website:f.get('website'),ciente:f.get('ciente')==='on'})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível enviar.');form.reset();result.textContent='Solicitação registrada. Guarde seu protocolo: '+data.protocolo;}
 catch(error){result.textContent=error.message||'Falha de conexão. Tente novamente.';}finally{button.disabled=false;result.focus();}
}));''')
s=s.replace("Esta versão não recebe nem armazena solicitações; os formulários permanecem desativados.","Os formulários registram as solicitações para consulta pela equipe administrativa.")
p.write_text(s,encoding='utf-8')
m={'project_id':'appgprj_6aedf46d381081919fa001194da091f0','d1':'DB','r2':None};(r/'.openai/hosting.json').write_text(json.dumps(m,indent=2),encoding='utf-8')
(r/'drizzle/meta').mkdir(parents=True,exist_ok=True)
(r/'drizzle/0000_cadastros.sql').write_text('''CREATE TABLE cadastros (id TEXT PRIMARY KEY NOT NULL,tipo TEXT NOT NULL,nome TEXT NOT NULL,contato TEXT NOT NULL,organizacao TEXT NOT NULL DEFAULT '',mensagem TEXT NOT NULL DEFAULT '',situacao TEXT NOT NULL DEFAULT 'novo',notas TEXT NOT NULL DEFAULT '',privacidade_versao TEXT NOT NULL,criado_em TEXT NOT NULL,atualizado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX cadastros_tipo_situacao ON cadastros(tipo,situacao,criado_em);
--> statement-breakpoint
CREATE TABLE auditoria (id TEXT PRIMARY KEY NOT NULL,ator TEXT NOT NULL,acao TEXT NOT NULL,registro_id TEXT NOT NULL,criado_em TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE limites (chave TEXT PRIMARY KEY NOT NULL,quantidade INTEGER NOT NULL,expira_em INTEGER NOT NULL);
''',encoding='utf-8')
(r/'drizzle/meta/_journal.json').write_text(json.dumps({'version':'7','dialect':'sqlite','entries':[{'idx':0,'version':'6','when':1794140000000,'tag':'0000_cadastros','breakpoints':True}]}),encoding='utf-8')
print('Forms, privacy notice and schema prepared')
