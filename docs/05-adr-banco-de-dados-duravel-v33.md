# ADR-005 — Banco de dados durável e portável para o Instituto Mais Amor

**Situação:** PROPOSTA, sujeita à aprovação da direção e análise de privacidade.  
**Data:** 2026-11-24  
**Base examinada:** ZIP `Instituto-Mais-Amor-Sites-v33(1).zip`, incluindo `README-EXPORTACAO.md`, `MODELAGEM-DADOS.md`, `drizzle/*.sql` e `worker/`.  
**Não executar migração ou alteração da produção por causa deste documento.**

## 1. Contexto comprovado
A versão 33 do site original usa Cloudflare D1 (`DB`) como banco de dados de produção, R2 (`BUCKET`) para objetos e autenticação vinculada ao ChatGPT Sites. O ZIP contém o código e as migrações, **mas não o banco de produção nem todos os uploads da hospedagem**. Testes locais usam SQLite em memória e não se confundem com verificações do banco real.

D1 é uma tecnologia de banco de dados real (SQLite), não um mock. É capaz de suportar projetos em operação, mas a hospedagem atual acopla a administração e a identidade de usuários ao ambiente do ChatGPT Sites. A portabilidade do código não equivale automaticamente à portabilidade das contas, dos arquivos e dos registros.

## 2. Objetivo de longo prazo
Preservar o site público já criado e adotar, quando aprovado, uma base de dados própria da instituição, portável, com:
- contas individuais para administrador, coordenador e atendente;
- categorias de apoio não diagnósticas;
- solicitações de contato e registros administrativos mínimos;
- diretório de serviços e profissionais verificados, sem promessa de vagas;
- encaminhamentos humanos auditáveis;
- notícias e projetos com aprovação editorial;
- campanhas e doações somente com controles institucionais e financeiros;
- políticas de retenção, exportação, exclusão, backups e restauração testados.

## 3. Alternativas
### A. Permanecer integralmente em D1/ChatGPT Sites
Vantagens: evita migração agora; aproveita rotas, telas e tabelas já existentes.
Riscos: dependência operacional de autenticação e hospedagem, acesso externo ao banco de produção ainda não confirmado neste projeto, políticas específicas da plataforma e plano de recuperação a verificar.

### B. PostgreSQL gerenciado (por exemplo, Supabase), sob conta institucional — recomendação para o CRM no longo prazo
Vantagens: banco relacional amplamente portável, autenticação própria, RLS e ecossistema de ferramentas, banco independente da interface do site.
Custos e cuidados: trabalho real de migração de esquema SQLite → PostgreSQL, reimplementação e testes de rotas, controle de identidade, políticas RLS e hospedagem de API. Não supor acesso direto do ChatGPT Sites a outro banco; pode ser necessária aplicação/backend próprios.

### C. Cloudflare D1 em conta Cloudflare própria, com Workers/R2 e autenticação independente
Alternativa viável se a equipe quiser reduzir mudanças de banco mantendo tecnologias similares às atuais. Requer posse das contas, exports D1/R2, segurança e políticas operacionais. Não descartar sem análise.

## 4. Decisão proposta
1. **Não substituir nem apagar** o D1 de produção.
2. Guardar código-fonte e migrações do site original no GitHub em branch de revisão, sem segredos e sem dados pessoais.
3. Separar dados públicos do CMS e dados privados de acolhimento.
4. Projetar o **CRM V2 independente** preferencialmente em PostgreSQL numa conta institucional, em ambiente de testes com dados fictícios.
5. Exigir autenticação independente da plataforma de origem, RLS/permissões por função, regras de negócio no servidor e trilha de auditoria.
6. Exportar dados de produção somente depois de verificar titularidade, acesso, legitimidade, política de retenção, risco de dados pessoais e plano de backup/rollback.
7. Mudar o formulário público para o novo backend **somente depois** de testes ponta a ponta e aprovação.
8. Se o acesso ao banco do Sites não permitir portabilidade suficiente, manter o site informativo e direcionar solicitações para um portal seguro separado, sem criar duplicidade de cadastros.

## 5. Privacidade, crianças e saúde
Os Termos do ChatGPT Sites vedam o processamento de informações de saúde protegidas definidas pelo HIPAA e sites direcionados a menores de 13 anos ou idade digital aplicável. A LGPD demanda avaliação adicional para dados sensíveis e de menores. O MVP **não** deve solicitar laudos, CID, diagnósticos, documentos de crianças ou relatos clínicos em formulários públicos.

Antes do uso com beneficiários reais: revisão jurídica e operacional, finalidade/base legal, aviso de privacidade, acesso restrito, direitos dos titulares, treinamento da equipe e resposta a incidentes.

## 6. Requisitos não negociáveis antes de produção
- Credenciais, domínio, repositório e faturamento sob controle da instituição.
- Ambiente de desenvolvimento/teste separado do de produção.
- Migrações versionadas e testadas.
- Nenhum `service_role` ou segredo de acesso em frontend/repositório público.
- Se Supabase: RLS em todas as tabelas expostas e políticas reais por função e atribuição; testar leitura indevida, exportação e revogação.
- Backups automatizados segundo o plano contratado + cópia independente, criptografada e com acesso restrito; restaurar um backup em teste regularmente.
- Controles de prevenção de duplicidade sem bloquear novo contato; correlação protegida de telefones.
- Teste de carga compatível com uso esperado, monitoramento, logs sem dados sensíveis e documentação de recuperação.
- Contas individuais e autenticação forte.
- Publicação feita apenas após aceite formal; plano de reversão operacional documentado.

## 7. Próximas entregas técnicas
1. Inventariar `drizzle/` e as queries do CRM v33 em mapa de entidades/campos.
2. Definir papéis da pequena equipe e matriz de autorização por operação.
3. Modelar o esquema PostgreSQL equivalente com tabelas mínimas; criar migrações de teste, **sem dados reais**.
4. Fazer prova de conceito de autenticação, acesso por atendente e atribuição, com testes de autorização.
5. Validar como o site público original encaminhará uma solicitação para o backend independente.
6. Realizar inventário dos dados já existentes no D1 **somente mediante acesso autorizado e mecanismo seguro**.
7. Planejar migração assistida, exportação/transformação/verificação, sem alterar a produção até aprovação.

## 8. Fontes institucionais de referência
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/platform/limits/
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/api/securing-your-api
- https://openai.com/pt-BR/policies/chatgpt-sites-terms/

**Estado:** proposta técnica documentada. Nenhuma migração ou banco PostgreSQL criado.