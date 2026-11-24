# Avaliação do Instituto Mais Amor

Revisão de código e funcionamento realizada em 10 de novembro de 2026. Considera o site público, a central administrativa atual, o banco D1 e os arquivos R2. A gestão de projetos foi integrada à versão mais recente da central, preservando fichas completas, cadastros, anexos e resultados.

## Resultado da revisão

O projeto tem estrutura de aplicação com banco e controle de acesso no servidor. Os formulários e o painel não dependem de salvar dados no computador do visitante. Os testes locais passaram para os principais fluxos de cadastro, consulta, atualização, publicação e exclusão. A revisão visual pelo navegador não foi concluída porque a ferramenta de navegação encerrou por tempo limite.

| Área | O que foi avaliado | Resultado |
|---|---|---|
| Projetos públicos | Inclusão, edição, exclusão, capa, descrição, objetivos, situação e destaque | Implementado e verificado por testes de integração |
| Projetos existentes | Oito propostas originais e projetos antes autorizados para divulgação | Importação única, com preservação de conteúdo público e sem notas internas |
| Publicação | Lista, página individual, página inicial e indicadores públicos de projetos | Consultam o catálogo no banco |
| Rascunhos | Ficha, prévia e imagem enviada | Conteúdo restrito à administração |
| Atualizações simultâneas | Duas edições da mesma versão | A segunda edição antiga recebe aviso; não sobrescreve a versão salva |
| Administração | Identidade e origem das alterações | Verificadas no servidor |
| Cadastros | Criação pública e administrativa, edição e consulta completa | Preservados; edição usa o mesmo identificador |
| Fichas completas | Campos privados, filtros, paginação de 50 e página seguinte | Testes passaram; consulta pública negada |
| Métricas | Cadastros, alcance complementar, voluntariado, atendimentos e cestas | Soma automática preservando valores complementares e históricos |
| Ações e documentos | Ações publicáveis; estatuto e anexos exclusivamente internos | Consulta e downloads autenticados; visitantes e outras contas bloqueados |
| Arquivos de capa | Autorização, origem, assinatura, formato e limite | JPG, PNG e WebP, até 5 MB; formatos e tamanhos recusados testados |
| Privacidade pública | Notas, contatos e dados administrativos | Excluídos das respostas públicas avaliadas |
| Estrutura HTML | Links, âncoras, IDs, títulos e imagens | Verificação estrutural passou em 25 páginas |
| SEO de projetos | HTML gerado no servidor, título, descrição, metadados e sitemap | Atualizados com os projetos publicados |

## Problemas corrigidos

1. Os projetos da página eram fixos, enquanto o histórico da central era outro controle. A aba **Projetos do site** agora edita o catálogo real, com uma indicação clara da diferença para o histórico interno.
2. A versão hospedada tinha mudanças mais recentes de central e anexos. As alterações foram conciliadas; a migração existente `0006_central_admin` foi mantida e a nova estrutura foi acrescentada em `0007_projetos_publicos`.
3. A página de projetos podia mostrar propostas fixas e, abaixo, outra listagem de projetos divulgados. O catálogo passou a ter uma única listagem, com filtros e páginas individuais ligados ao banco.
4. Excluir todos os projetos poderia provocar uma nova carga automática do catálogo se a importação dependesse apenas de uma tabela vazia. Um marcador permanente de importação impede que projetos apagados reapareçam.
5. O sitemap incluía a administração. A resposta pública agora remove a administração e acompanha apenas as páginas de projetos que continuam publicadas. As rotas administrativas também mantêm autenticação e sinalização de não indexação.
6. O arquivo de conteúdo original podia continuar sendo baixado como um catálogo estático antigo. Ele permanece como fonte da importação no código e deixou de ser distribuído pelo Worker público.
7. A documentação principal ainda falava de formulários desativados, site sem banco e publicação por cópia de HTML. Ela foi substituída pelas instruções do sistema atual.
8. Gravação e exclusão dos projetos incluem auditoria na mesma transação. Erros de JSON recebem resposta de dados inválidos.
9. O estatuto e os documentos foram transferidos para **Documentos internos**, com consulta e download autorizados no servidor. Os links públicos, o catálogo de documentos e a exposição dos anexos antigos foram retirados. O PDF original foi verificado byte a byte. Não houve migração dos cadastros nesta mudança.

## Como a equipe usa os projetos

Entre em `/admin` e abra **Projetos do site**. Consulte a lista ou use **Incluir novo projeto**. O nome é suficiente para guardar um rascunho. Para publicar, preencha também resumo, descrição, capa e descrição acessível da imagem. Complete os objetivos e as informações de participação conforme a realidade do projeto.

**Conferir prévia** mostra o conteúdo ainda não salvo. **Publicar projeto no site** ou **Salvar alterações no site** aplica o conteúdo ao público. **Salvar como rascunho** guarda ou retira o projeto da publicação. **Excluir** remove o projeto após confirmação. As posições seguem a Ordem; a página inicial mostra até três projetos publicados marcados como destaque.

O catálogo é salvo no banco e pode ser administrado de outro computador autorizado. A capa é enviada para o armazenamento de arquivos. Não é necessário editar código nem publicar uma nova versão do sistema para cada mudança de projeto.

## Pontos que a organização precisa manter

- Acesso: a configuração atual autoriza uma conta administradora. Pessoas futuras precisam receber autorização própria; conhecer o link ou cadastrar um contato não concede acesso. Compartilhar senha não é o mecanismo previsto.
- Contagem: alcance registrado soma cadastros e alcance complementar. Essa soma pode repetir uma pessoa; ela não deve ser apresentada como pessoas únicas. Voluntários registrados não comprova, por si só, participação efetiva em uma atividade. Famílias e complementos dependem de conferência da equipe.
- Conteúdo: a situação inicial das propostas continua em planejamento. A instituição deve confirmar atividades, datas, disponibilidade, imagens autorizadas e parcerias antes de publicá-las.
- Dados: o painel não é prontuário. Não registre laudos, diagnósticos, documentos pessoais ou dados sensíveis nos campos de texto ou em anexos institucionais.
- Recuperação: o módulo próprio de backup e restauração permanece removido conforme a solicitação mais recente. O CSV administrativo não oferece restauração do sistema. Esta revisão não realizou teste de recuperação de desastre.

## Limites das verificações

Os cadastros e arquivos fictícios dos testes ficaram em memória, sem inclusão no banco de produção. Os testes verificam comportamento dos endpoints e dados renderizados; não substituem uma revisão visual com pessoas da equipe em celular e computador. Não foram realizados teste de carga, teste de invasão, certificação de acessibilidade, auditoria jurídica ou validação dos números e documentos reais da instituição. Esses resultados não devem ser tratados como certificações.

A rotina mensal de cadastros usa os carimbos de criação armazenados pelo sistema. Casos na virada do mês e a definição de período operacional devem fazer parte da homologação da equipe, juntamente com a conferência dos complementos, para evitar divergências de interpretação.
