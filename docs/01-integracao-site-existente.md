# Decisão 01 — Evoluir o site existente, não criar outro

**Status:** decisão de produto aprovada pelo solicitante; implementação pendente.
**Site existente:** https://instituto-mais-amor-inclusao.joshuazinho40.chatgpt.site/
**Repositório GitHub:** joshuazinho40-prog/Instituto-Mais-Amor

## Princípio de integração
As alterações serão feitas **sobre o projeto original** quando o acesso de edição/código for confirmado. Não trocar logo, navegação, paleta, imagens e conteúdo por um template genérico. Não publicar um HTML independente como se fosse o site oficial.

## Estado conhecido
- Site publicado no ChatGPT Sites.
- Conector do Instituto permite consultar projetos/relatos, mas **não expõe edição do código completo, páginas ou banco de dados** por esta integração.
- Catálogo consultado: Mãe, Você Não Está Sozinha; Infância Sem Barreiras; Rede Mais Amor; Corrente do Bem. Todos constam como `planejamento`.
- "Rede Mais Amor" apresenta resumo incompleto, a ser corrigido quando houver acesso adequado.
- Repositório inicialmente continha somente o README, **sem código-fonte do site publicado**.
- A existência de links/admin e páginas não comprova que envios, formulários e permissões estejam testados.

## Modificações incrementais propostas
1. Reutilizar o header, logo, homepage, projetos e demais páginas existentes.
2. Na homepage, tornar o botão "Preciso de acolhimento" visível e ligar ao fluxo verdadeiro.
3. Na página de acolhimento, receber apenas nome, contato, região e preferência de retorno, quando existir processamento seguro.
4. Criar um backoffice separado, com autenticação individual para pequena equipe, sem mudar o site principal.
5. Atribuir solicitações a atendentes; permitir uma pessoa contatar em vários assuntos sem obrigar "família acompanhada".
6. Diretório de profissionais/serviços **verificados**, não uma lista de vagas presumidas.
7. Agregar notícias e doações somente após fluxos de revisão e validação operacional.
8. Cada mudança: cópia de segurança/exportação quando disponível, staging, teste, aprovação e publicação.

## Compatibilidade
Não presumir que o ChatGPT Sites permita modificar HTML diretamente. Confirmar via acesso oficial ao projeto original. Caso não seja possível, usar links seguros para aplicação administrativa em hospedagem própria sem substituir o site.

## Paleta aprovada
Azul #1469BD, amarelo #FFD447, branco #FFFFFF, vermelho #EA4E55, azul-escuro #173552. A logo enviada mais recentemente e aprovada prevalecerá, após confirmação do arquivo.

## Requisitos de publicação
- Navegação e botões funcionais em celular e desktop.
- Páginas de projetos mantêm suas situações reais.
- Informações pessoais nunca aparecem na área pública.
- Acolhimento humano e medidas de privacidade documentados.
- Nenhuma publicação em produção sem revisão e autorização.
