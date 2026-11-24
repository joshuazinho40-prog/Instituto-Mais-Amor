# Painel reorganizado — novembro de 2026

A entrada do painel é **Início**, com quatro tarefas: organizar projetos, mostrar ações, acompanhar pedidos e organizar atividades. Documentos, configurações, vídeo e consultas anteriores ficam no menu **Administração e consultas**. O guia **Como usar o painel** explica os fluxos sem exigir conhecimentos técnicos; o conteúdo de estudo fica recolhido.

## Publicar uma ação com fotos

1. Abra **Projetos do site** e localize o projeto.
2. Use **Ações e fotos**, depois **Registrar uma ação**.
3. Informe projeto, título e data. Escreva o resumo e o relato.
4. Envie até 8 fotos (JPG, PNG ou WebP; até 5 MB cada). Descreva cada imagem, acrescente legendas se desejar e confira a autorização de uso das fotos.
5. Confira a prévia. **Salvar rascunho** guarda o trabalho. **Publicar no projeto** divulga o relato e a galeria na página do projeto, em ordem da atividade mais recente.

O projeto precisa estar publicado para divulgar uma ação vinculada. Fotos em rascunho são restritas; retirar o projeto ou o relato de publicação oculta as imagens do público. Projetos com relatos vinculados são preservados no histórico. O editor detecta versões antigas para evitar substituir outra edição. Publicar relato conta uma ação; atendimentos e entregas individuais continuam registrados na área de acompanhamento.

## Medidas das mídias

| Uso | Medida recomendada | Arquivo |
| --- | --- | --- |
| Vídeo de abertura | 1920 × 1080 px (16:9); 1280 × 720 também serve | MP4 H.264, áudio AAC; até 100 MB; prefira até 25 MB |
| Capa de projeto | 1600 × 1067 px (3:2) | JPG, PNG ou WebP; até 5 MB |
| Galeria de ações | 1600 × 1200 px ou semelhante | JPG, PNG ou WebP; até 5 MB por imagem |

O vídeo e a galeria preservam o enquadramento. Vídeos verticais aparecem inteiros, com fundo desfocado nas laterais. A seção cinematográfica foi retirada do site e do processo de construção.

---

# Central de gestão do Instituto Mais Amor

Acesse `/admin` com a conta já autorizada. O site público mantém o acesso existente e a administração continua protegida no servidor.

## Organização

- **Visão geral:** todos os indicadores mensais, histórico de projetos concluídos, totais da base por tipo e últimas alterações.
- **Central de cadastros:** busca, tipo, situação e paginação para pessoas, projetos, acolhimentos, voluntários, parcerias, contatos, atendimentos/entregas e ações.
- **Projetos do site:** catálogo público com capa, descrição, objetivos, edição, exclusão e rascunhos.
- **Publicações:** relatos de ações e resultados mensais destinados ao público.
- **Documentos internos:** estatuto, atas, relatórios e anexos institucionais, com consulta e download restritos à administração.
- **Como usar:** orientação curta sobre registro, edição, publicação, contagem e privacidade.

O botão **Novo registro** abre sempre o mesmo editor. Escolha o tipo, preencha e salve. **Editar** carrega o registro original e atualiza o mesmo identificador. Contatos existentes e anotações foram mantidos nas tabelas originais.

## Dados e sincronização

O banco D1 existente continua em `DB`. A migração adicional `0006_central_admin.sql` acrescenta o resumo e a opção de divulgação de projetos e cria os metadados de anexos; não remove nem redefine dados existentes. Arquivos ficam no armazenamento R2 `BUCKET`, não no navegador ou em campos de texto do banco.

Pessoas e solicitações alimentam os totais de cadastros. Registros de atendimentos e cestas alimentam os indicadores pela data da ocorrência. Ações publicadas entram no mês da realização. Os totais anteriores/complementares da publicação mensal são preservados, evitando substituir o histórico individual. Alcance registrado é a soma de cadastros e alcance complementar; não representa pessoas únicas ou atendimentos comprovados. Famílias e totais complementares continuam dependendo de conferência humana.

O painel atualiza os números após salvar. O dashboard público consulta as mesmas fontes e se atualiza ao abrir, ao voltar para a janela e a cada 60 segundos enquanto visível. A aba **Projetos do site** controla o catálogo público com capa, resumo e descrição completa. O tipo **Projeto (histórico interno)** na central mantém o acompanhamento interno. Notas internas nunca são incluídas na API pública.

## Arquivos

Abra **Documentos internos** em `/admin#documentos-internos`. A biblioteca reúne o estatuto original e os arquivos enviados pela equipe. Use a busca para localizar um documento; **Consultar** abre em outra aba e **Baixar** salva uma cópia no dispositivo. Nos anexos enviados pela equipe, **Editar** corrige o título e a descrição. O arquivo original do estatuto foi preservado, incluindo os campos a completar no modelo de ata.

Use **Adicionar documento interno** para enviar PDF, PNG, JPG ou WebP até 5 MB. O servidor verifica limite, assinatura do formato, autorização e origem. Informe no título ou na descrição a data e a versão; para guardar uma revisão, adicione um novo arquivo. Não há opção de tornar esses documentos públicos. Os downloads exigem a conta administradora autorizada, mesmo nos anexos que uma versão anterior marcou como públicos. Visitantes e outras contas não recebem o conteúdo nem a listagem de documentos.

O estatuto é incorporado no código do servidor a partir de `private/documentos/`, fora dos arquivos estáticos públicos. Os anexos enviados pela administração continuam no R2, com metadados no D1. As rotas antigas de transparência encaminham para a área administrativa; os endereços estáticos antigos do PDF deixam de servir o arquivo. Missão, finalidades, gratuidade e indicadores de impacto continuam públicos. Esta mudança não altera o modelo dos cadastros nem cria permissões de professor ou de acolhimento: essas funções permanecem na proposta em discussão.

A central não é prontuário clínico. Não cadastre diagnósticos, laudos, dados de saúde ou documentos pessoais. Os formulários públicos mantêm os tipos e as proteções anteriores; o tipo interno **Pessoa** não foi exposto ao cadastro anônimo.

## Código e verificação

- Interface: `dist/admin.html`, `dist/admin.css`, `dist/admin-center.js`.
- Endpoints da central: `worker/admin-center.js`, integrados a `worker/index.js`.
- Atualização pública: `dist/public-center.js` e `dist/impacto.js`.
- Banco: tabelas existentes e migração adicional em `drizzle/`.
- Build: `node scripts/build-worker.mjs`.
- Testes: `node scripts/test-worker.mjs` e `python3 scripts/check.py`, após o build.

Os testes usam SQLite e arquivos em memória. Nenhum cadastro fictício é inserido no banco de produção. Cobrem autorização, edição sem duplicar contagem, busca central, publicação de projetos sem notas privadas, validação de arquivos, consulta e download restritos, bloqueio dos endereços antigos e preservação do PDF original.

Os antigos módulos administrativos permanecem no histórico do projeto. A página atual usa `admin-center.js`, seu módulo de fichas completas e `projetos-site-admin.js`. Não execute os antigos scripts de transformação `enable-admin.py` ou `finalize-admin.py` para gerar este painel.

## Editar os projetos apresentados ao público

Abra **Projetos do site** no menu ou acesse `/admin#projetos-site`. A lista reúne publicados e rascunhos, com busca e filtro. Clique em **Editar** para modificar um projeto existente ou em **Incluir novo projeto** para começar outro. Preencha nome, resumo e descrição; objetivos, público, atividades, local, horários, datas e como participar completam a ficha pública.

Envie uma capa JPG, PNG ou WebP de até 5 MB ou escolha uma imagem da biblioteca. Descreva a imagem para acessibilidade e informe crédito ou legenda quando necessário. **Conferir prévia** mostra o conteúdo preenchido antes de salvar. **Publicar projeto no site** torna a ficha pública; **Salvar como rascunho** a mantém apenas no painel. Em um projeto já publicado, o botão de rascunho explica que ele será retirado do site. **Excluir** apaga o projeto após confirmação.

Os menores números em Ordem aparecem primeiro. A página inicial mostra até três projetos publicados marcados como destaque. Alterações são lidas do banco, sem editar código ou republicar o site a cada projeto. Cada projeto mantém uma página própria; ao excluir ou retirar a publicação, esse endereço deixa de mostrar o conteúdo público.

Os oito projetos originais e os projetos já autorizados na versão anterior são importados uma única vez, sem notas internas. Excluir o último projeto não refaz essa importação. A migração adicional `0007_projetos_publicos.sql` acrescenta o catálogo e os metadados das capas, preservando as migrações e tabelas existentes. A interface também avisa quando outra pessoa já salvou uma versão mais recente do projeto.

## Consultar fichas sem editar

Na **Central de cadastros**, clicar no nome, no restante da linha ou em **Visualizar** abre uma ficha de leitura. Ela apresenta todos os campos armazenados, incluindo mensagens, observações, situação, vínculo quando houver, protocolo e datas. O botão **Editar este cadastro** é uma ação separada; abrir e fechar a ficha não salva nem altera dados.

A aba **Todos os dados** reúne as fichas completas dos oito tipos da central. Sem filtros, consulta toda a base; com filtros, mostra todos os registros correspondentes. O carregamento é feito em lotes de 50 para não sobrecarregar a consulta e continua automaticamente além da primeira página. A interface informa o progresso. É possível interromper e atualizar a lista. Se a conexão falhar ou a base mudar durante a leitura, o painel informa que a lista ficou parcial, sem apresentá-la como completa.

A consulta usa `/api/admin/cadastros-detalhados`, com a mesma autorização administrativa das demais rotas. Não há exportação automática nem armazenamento dos cadastros no navegador. Dados pessoais e notas internas permanecem fora das APIs públicas. A inclusão desta funcionalidade não exige migração do banco.


## Evolução operacional — vídeo, apoio e estudo de ADS

O menu agora agrupa gestão, conteúdo e administração. **Acompanhamento** inclui triagem de pedidos e voluntários, equipe/professores, famílias e agenda. Cadastros recebidos continuam na base original: a equipe escolhe Iniciar acompanhamento para registrar etapas, responsável e próximos passos. Esse início não aprova automaticamente o pedido ou o voluntário.

A nova agenda vincula cadastro, família, projeto e profissional. Somente atividades marcadas como realizadas alimentam o quadro **Execução confirmada**. A confirmação de participação do voluntário é preservada para o histórico. Corrigir a mesma ocorrência atualiza os totais, e cancelar ou reverter a realização retira a ocorrência desse quadro. Ele permanece separado dos totais anteriores para evitar somar duas vezes dados ainda não conciliados. O indicador de cadastros com apoio realizado conta identificadores distintos; duplicidades cadastrais precisam ser revistas antes de afirmar pessoas únicas. Os meses de execução seguem o horário institucional de Brasília, inclusive em atividades realizadas no fim do mês. O histórico pode ser corrigido ou cancelado mesmo após a desativação do profissional ou do voluntário originalmente vinculado, sem permitir novos vínculos inativos.

O cadastro da equipe é operacional e não concede conta de acesso. O painel segue restrito à administração atual. Acessos individuais por função e automações externas são próximas etapas, não foram apresentados como prontos.

Em **Vídeo de chamada**, selecione MP4 até 100 MB, confira a prévia e autorize a publicação. O envio vai diretamente do navegador ao R2, sem incluir o arquivo no código do Worker. D1 guarda a referência atual. O endpoint público suporta Range para avançar no vídeo, enquanto uploads são autenticados e conferem a origem. Falhas preservam o vídeo anterior.

O anexo de vídeo enviado na conversa ultrapassou o limite de transferência de 32 MiB do executor. Seus bytes não foram abertos nem substituídos automaticamente. O seletor administrativo permite ao usuário publicar esse mesmo arquivo diretamente do computador, respeitado o limite do servidor. Até lá, a chamada anterior é mantida.

Em **Configurações e integrações**, os contatos oficiais podem ser publicados sem editar código. WhatsApp e e-mail são canais de contato; não são disparos automáticos. As credenciais de futuros serviços devem ficar nas configurações seguras da hospedagem, nunca no frontend. A área **Como usar → Seu laboratório de ADS** explica a arquitetura e o caminho dos dados.

Novos módulos: worker/site-media.js, worker/operations.js, worker/settings.js. Migrações adicionais 0008, 0009 e 0010; migrações anteriores foram preservadas. Nenhum dado fictício é inserido em produção. O comando npm test executa as verificações em memória.

## CRM do Instituto — controle de necessidades e apoio realizado

O painel abre em **CRM do Instituto**, que reúne a entrada de pedidos, as identidades de pessoas, as famílias, os tipos de apoio, a rede de profissionais e destinos, os encaminhamentos, as tarefas e a confirmação das realizações. **Agenda e voluntariado** mantém inscrições e atividades anteriores. Os registros existentes foram preservados; a equipe faz a classificação e a conciliação explicitamente.

Uma pessoa pode ter vários cadastros de origem. Os vínculos com a identidade canônica são conferidos por quem administra: não há união automática por nome, telefone ou e-mail. A mesma família pode compartilhar um telefone. O cadastro da pessoa não exige diagnósticos, documentos pessoais ou dados clínicos.

Para uma solicitação de cesta básica: identifique a pessoa, vincule a família quando confirmado, escolha o serviço do tipo cesta, defina prioridade e próximo passo, encaminhe para uma unidade cadastrada e registre a entrega com data e quantidade. O encaminhamento organiza o retorno e não envia mensagens automaticamente. Somente a realização confirmada entra no apoio realizado. Corrigir ou cancelar a mesma realização recalcula os totais; não é necessário criar outra entrega.

Os indicadores consolidados do CRM reúnem realizações e atividades realizadas da agenda. Quando uma realização informa o vínculo com uma atividade da agenda, o evento é contado uma vez. Cestas usam quantidades de entregas confirmadas no CRM. Pessoas e famílias são contadas por identificador distinto no período. Cadastros com apoio e sem identidade conciliada aparecem como pendência, sem serem apresentados como pessoas únicas. Os totais históricos complementares ficam separados até conferência.

A rede mostra serviços vinculados a profissionais e unidades. Disponibilidade semanal e capacidade são informações declaradas pela equipe e não confirmam vaga. O cadastro de professor organiza sua atuação e não concede acesso ao painel. Os acessos continuam com a autorização existente; notificações externas e logins individuais não são criados por este módulo.

A migração adicional `0011_crm.sql` acrescenta relações, chaves, índices e restrições, sem apagar as tabelas anteriores. O módulo `worker/crm.js` aplica autorização, validação e transações; `dist/crm-admin.js` controla a interface. `scripts/test-crm.mjs` testa os fluxos em SQLite em memória. Nenhum exemplo do guia é gravado em produção. A modelagem detalhada, as dependências funcionais e os limites de aplicação das formas normais estão em `MODELAGEM-DADOS.md`; uma versão resumida aparece em **Como usar e modelagem**.

Os apoios informados pela direção nesta etapa são cesta básica, acolhimento com roupas e utensílios para casa. O preparo inicial do catálogo usa esses três serviços e uma unidade interna do Instituto, apenas após a ação explícita no painel. Nenhum parceiro externo é cadastrado como existente. O bazar beneficente é registrado como ação institucional na área de publicações; vendas e visitantes não viram pessoas apoiadas automaticamente. Cestas, peças e itens usam unidades de medida próprias, e a quantidade de itens não é usada como quantidade de pessoas.

## Excluir um relato de projeto

Em **Projetos do site → Ações e fotos**, cada relato possui **Excluir relato**. A mesma opção aparece no rodapé de **Editar relato**, em todas as etapas. A exclusão pede confirmação, remove o relato e os vínculos da galeria e atualiza a listagem e os indicadores. Ela é definitiva. Para apenas retirar uma publicação do público e manter o texto no painel, use **Salvar rascunho**. Para retirar uma foto específica, use **Remover foto** na etapa Fotos e revisão e salve o relato.

A exclusão exige acesso administrativo, mesma origem e a versão atual do registro. O registro de auditoria identifica a exclusão. Imagens compartilhadas com outras publicações continuam disponíveis para essas publicações.
