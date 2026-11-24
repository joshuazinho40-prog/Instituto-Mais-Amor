# Instituto Mais Amor

Portal institucional com central administrativa, banco D1 e armazenamento de arquivos R2 na hospedagem Sites. A versão atual inclui formulários, indicadores de impacto, fichas completas, ações, anexos e gestão dos projetos apresentados ao público.

## Acessos

- Site: https://instituto-mais-amor-inclusao.joshuazinho40.chatgpt.site/
- Administração: /admin
- Projetos do site: /admin#projetos-site
- Projetos públicos: /projetos.html
- Indicadores públicos: /impacto

O servidor exige a conta ChatGPT autorizada para abrir a administração e consultar ou alterar dados. O acesso direto ocorre quando o navegador já está autenticado. Cadastrar um contato não concede acesso administrativo. Não existe senha compartilhada própria deste site.

## Projetos publicados

Na aba Projetos do site, a equipe pode consultar, incluir, editar e excluir projetos; enviar uma capa JPG, PNG ou WebP de até 5 MB; preencher resumo, descrição, objetivos, público, atividades, local, horários, datas e orientações de participação; escolher situação, ordem e destaque na página inicial.

Rascunho mantém o conteúdo na administração. Publicar ou atualizar modifica a página de Projetos, a página individual, os destaques e os dados públicos de projetos. Salvar um projeto publicado como rascunho o retira do público. Excluir exige confirmação. O editor detecta versões antigas para evitar que uma pessoa sobrescreva uma alteração salva por outra.

Os oito projetos originais são importados uma única vez, preservando nome, objetivos, imagens e situação. Projetos que já tinham divulgação autorizada na central anterior também são importados, com resumo público e sem notas internas. A importação não restaura projetos excluídos. O tipo Projeto na Central de cadastros continua sendo o histórico interno; a edição do conteúdo público acontece em Projetos do site.

## Dados e arquivos

A configuração .openai/hosting.json preserva o identificador do site e declara DB para D1 e BUCKET para R2. O banco guarda cadastros, registros operacionais, resultados, ações, histórico interno, projetos públicos e metadados dos arquivos. As capas e os anexos enviados pela equipe ficam em R2. O estatuto original fica incorporado ao servidor a partir de private/documentos e é servido somente por uma rota administrativa autenticada. O navegador não é a fonte de armazenamento desses registros.

As rotas administrativas verificam identidade e origem no servidor. Consultas usam parâmetros SQL. Capas de rascunhos ficam restritas à administração; imagens de projetos publicados podem ser acessadas pelo público. Nomes, contatos, mensagens e notas dos cadastros não são enviados às APIs públicas de projetos e indicadores.

O módulo próprio de backup e restauração foi removido por solicitação do usuário. Esta versão não oferece essa rotina. Exportações administrativas em CSV são consultas de dados, sem função de restauração.

## Métricas

Cadastros e registros operacionais alimentam os indicadores automaticamente. Alcance registrado soma cadastros do mês e alcance complementar; não representa pessoas únicas. Voluntários registrados soma os cadastros de voluntariado e o complemento informado. Atendimentos e cestas somam ocorrências individuais e valores anteriores, evitando lançar a mesma ocorrência nas duas fontes. Famílias apoiadas e complementos precisam de conferência da equipe.

Ações publicadas contam pelo mês de realização. O histórico interno de projetos concluídos é separado do catálogo público. O dashboard público recebe apenas dados consolidados e relatos autorizados. CSV permanece na administração.

## Manutenção

- dist/: páginas, módulos JavaScript, estilos e mídias.
- worker/index.js: autenticação, rotas e entrega das páginas.
- worker/admin-center.js: central, fichas completas e anexos.
- worker/public-projects.js: catálogo público, editor, capas e páginas dinâmicas.
- worker/metrics.js: cálculo dos indicadores administrativos.
- scripts/templates/public-projects-admin.html: formulário da gestão pública de projetos.
- scripts/prepare-project-pages.mjs: integração idempotente do formulário e das áreas dinâmicas nas páginas existentes.
- scripts/build-worker.mjs: compila os arquivos em dist/server/index.js.
- scripts/test-worker.mjs: testes de integração com SQLite e arquivos em memória.
- drizzle/: migrações de esquema; migrações já aplicadas não devem ser alteradas.

Para verificar e compilar, execute node scripts/build-worker.mjs, node scripts/test-worker.mjs e python scripts/check.py. O gerador antigo scripts/build.py é usado por verificações isoladas e não deve regenerar a versão atual de produção. Também não use enable-admin.py ou finalize-admin.py para reconstruir o painel.

A publicação depende do Worker e dos vínculos D1/R2. Copiar somente os arquivos estáticos para outra hospedagem não mantém formulários, administração ou integração com o banco. As versões publicadas usam o fluxo do plugin Sites, com o código enviado ao repositório antes de salvar e publicar.

## Limites da avaliação

Os testes automatizados cobrem acesso restrito, origem, gravação e edição sem duplicar contagem, privacidade, consultas completas, arquivos, publicação e exclusão de projetos. A verificação estrutural cobre títulos, links, âncoras, IDs e referências de imagens. Não constitui certificação WCAG, teste de invasão ou teste de recuperação de desastre. A ferramenta de navegador não concluiu a conferência visual nesta execução.
