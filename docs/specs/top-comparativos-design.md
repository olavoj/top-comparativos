# Top Comparativos — Especificação de Design

Data: 29 de julho de 2026  
Responsável: Olavo  
Status: aprovado para planejamento de implementação

## 1. Visão do produto

O Top Comparativos será um site editorial brasileiro de comparativos e análises de produtos, monetizado pelo Programa de Associados da Amazon Brasil. O produto deverá ajudar consumidores a tomar decisões de compra com clareza e, ao mesmo tempo, operar uma esteira semiautomática de descoberta de oportunidades, criação de rascunhos, revisão e publicação.

O princípio editorial central é: **ajudar primeiro e vender depois**.

## 2. Objetivos

- Criar um site público rápido, responsivo e preparado para SEO.
- Descobrir cinco oportunidades de conteúdo todos os dias às 9h, inclusive fins de semana e feriados, no horário de Brasília.
- Permitir que Olavo aprove ou rejeite cada oportunidade.
- Gerar artigos como rascunho somente após aprovação da pauta.
- Exigir revisão humana antes da publicação.
- Usar links do SiteStripe enquanto a PA API não estiver disponível.
- Preparar a arquitetura para integrar a PA API futuramente sem reconstruir o site.
- Conquistar as primeiras três vendas qualificadas e viabilizar a análise definitiva da conta pela Amazon.

## 3. Situação da conta Amazon

- Store ID: `topcomparat09-20`.
- Conta criada, mas ainda em fase de aprovação definitiva.
- A Amazon exige ao menos três vendas qualificadas em até 180 dias para analisar o site.
- O acesso à PA API depende da aprovação da conta e da manutenção de dez vendas qualificadas nos últimos 30 dias.
- Até que esses requisitos sejam atendidos, os links serão gerados manualmente pelo SiteStripe e inseridos no painel.
- Chaves privadas e credenciais nunca deverão ser expostas em chats, código-fonte ou páginas públicas.

## 4. Público-alvo

Consumidores brasileiros que pesquisam antes de comprar e precisam:

- Comparar produtos semelhantes.
- Entender diferenças técnicas sem linguagem excessivamente especializada.
- Encontrar opções por perfil e faixa de preço.
- Identificar o melhor custo-benefício.
- Conhecer limitações antes da compra.

## 5. Categorias

### Prioritárias

- Casa e cozinha.
- Tecnologia e eletrônicos.

### Secundárias

- Fitness e bem-estar.
- Viagem e acessórios.

Novas categorias poderão ser incluídas posteriormente com base em demanda, concorrência, cliques, conversão e comissão.

## 6. Radar diário de oportunidades

### Agenda

- Frequência: diária.
- Horário: 9h.
- Fuso: America/Sao_Paulo.
- Quantidade: cinco oportunidades por execução.

### Critérios de pontuação

Cada oportunidade receberá uma nota de 0 a 100:

- 25 pontos: intenção de compra.
- 20 pontos: procura e tendência.
- 15 pontos: nível de concorrência.
- 15 pontos: potencial de comissão.
- 10 pontos: preço e disponibilidade.
- 10 pontos: qualidade e quantidade de fontes verificáveis.
- 5 pontos: atualidade, lançamento ou mudança relevante.

### Regras de diversidade

- No máximo duas oportunidades da mesma categoria por dia.
- Priorizar casa/cozinha e tecnologia no início.
- Permitir uma oportunidade excepcional de qualquer categoria quando a pontuação justificar.
- Recalibrar a pontuação futuramente usando cliques, pedidos, conversão e comissões reais.

### Informações exibidas em cada oportunidade

- Título provisório.
- Produtos sugeridos.
- Categoria.
- Tipo de conteúdo.
- Palavra-chave principal.
- Intenção de busca.
- Motivo da oportunidade.
- Nota total e decomposição dos critérios.
- Faixa de preço estimada.
- Potencial de comissão.
- Concorrência estimada.
- Fontes encontradas.
- Riscos ou informações ainda não confirmadas.

## 7. Fluxo editorial

1. O radar executa diariamente.
2. Cinco oportunidades são gravadas no painel.
3. Olavo aprova ou rejeita cada pauta.
4. Uma pauta aprovada entra na pesquisa aprofundada.
5. A IA produz um rascunho com fontes e ressalvas.
6. Olavo revisa o conteúdo.
7. Os links do SiteStripe são inseridos.
8. O sistema extrai o ASIN e a tag do associado.
9. O sistema bloqueia a publicação se faltar link, aviso de afiliado ou informação obrigatória.
10. Olavo visualiza a prévia e publica.
11. O artigo público passa a integrar categorias, busca, sitemap e links internos.

## 8. Estados do conteúdo

- Oportunidade.
- Aprovada.
- Em pesquisa.
- Rascunho gerado.
- Em revisão.
- Aguardando links.
- Pronto para publicar.
- Publicado.
- Rejeitado.
- Arquivado.

Cada mudança de estado deverá registrar data e histórico.

## 9. Site público

### Rotas

- `/` — página inicial.
- `/comparativos` — todos os comparativos.
- `/comparativos/[slug]` — artigo individual.
- `/categorias/[slug]` — página de categoria.
- `/buscar` — busca.
- `/como-avaliamos` — metodologia editorial.
- `/sobre` — informações sobre o projeto.
- `/aviso-de-afiliado` — relação comercial.
- `/privacidade` — política de privacidade.

### Página inicial

- Cabeçalho com marca, categorias, busca e acesso às páginas institucionais.
- Hero com promessa editorial.
- Comparativos em destaque.
- Categorias prioritárias.
- Conteúdos recentes.
- Explicação resumida da metodologia.
- Aviso de afiliado no rodapé.

### Página de artigo

- Título e data da última revisão.
- Resumo rápido.
- Indicação por perfil.
- Critérios de comparação.
- Tabela comparativa.
- Análise individual dos produtos.
- Pontos positivos e limitações.
- Recomendação final por perfil.
- Botões “Ver na Amazon”.
- Aviso de afiliado visível.
- Fontes utilizadas.
- Perguntas frequentes quando úteis.
- Conteúdos relacionados.

## 10. Painel privado

O painel será acessível somente por Olavo.

### Áreas

- Visão geral.
- Radar diário.
- Fila editorial.
- Editor de artigos.
- Produtos e links.
- Conteúdos publicados.
- Histórico.
- Configurações.

### Funções

- Aprovar e rejeitar pautas.
- Visualizar a nota e os motivos da oportunidade.
- Solicitar geração de rascunho.
- Editar texto e metadados.
- Inserir links SiteStripe.
- Extrair ASIN e tag dos links.
- Validar se a tag esperada é `topcomparat09-20`.
- Pré-visualizar o artigo.
- Publicar ou devolver para revisão.
- Despublicar sem excluir o histórico.

## 11. Automação e geração por IA

### Permitido

- Pesquisa de tendências e intenção de busca.
- Análise de páginas oficiais, fabricantes e manuais.
- Geração de títulos, estruturas, tabelas e rascunhos.
- Identificação de divergências.
- Criação de metadados, resumo e perguntas frequentes.
- Sugestão de links internos.

### Restrições

- Não inventar testes, uso pessoal, preço, avaliação ou especificação.
- Não declarar que o Top Comparativos testou um produto sem evidência fornecida por Olavo.
- Não copiar avaliações ou descrições extensas.
- Não raspar automaticamente conteúdo da Amazon de forma incompatível com suas políticas.
- Não publicar automaticamente na primeira fase.
- Não usar preço ou disponibilidade sem indicar que podem mudar.
- Não transformar conteúdo publicitário obtido via PA API em material de treinamento de modelos.

## 12. SiteStripe e PA API

### Primeira fase

- Links gerados manualmente via SiteStripe.
- Painel recebe o link completo.
- Sistema extrai ASIN e tag.
- Sistema verifica a presença da tag esperada.
- Botão público mostra um texto limpo, sem exibir a URL extensa.
- O conteúdo não é publicado enquanto os links obrigatórios estiverem ausentes.

### Fase futura

Quando a conta estiver apta:

- Armazenar credenciais da PA API somente em ambiente protegido.
- Buscar produtos e dados autorizados programaticamente.
- Usar imagens, preço e disponibilidade conforme as políticas vigentes.
- Respeitar limites de requisição e regras de cache.
- Exibir carimbo de data e hora quando exigido.
- Manter modo SiteStripe como alternativa de contingência.

## 13. Identidade visual aprovada

Direção: **Guia inteligente**.

### Características

- Verde profundo como cor principal.
- Tons naturais e fundo claro.
- Tipografia editorial nos títulos.
- Tipografia sem serifa nos textos e controles.
- Aparência de curadoria independente.
- Botões comerciais discretos.
- Cards com pouco ruído visual.
- Alta legibilidade e prioridade para dispositivos móveis.

### Tokens iniciais

- Verde principal: `#18352B`.
- Verde de ação: `#2F6F59`.
- Verde auxiliar: `#39745F`.
- Fundo: `#F6F4ED`.
- Texto secundário: `#5D665F`.
- Borda suave: `#D8D4C8`.
- Títulos: família serifada editorial.
- Corpo e interface: família sem serifa.

## 14. Conteúdo inicial

O lançamento terá dez artigos revisados:

- Quatro de casa e cozinha.
- Três de tecnologia.
- Dois de fitness e bem-estar.
- Um de viagem.

As pautas específicas serão definidas pelo mesmo modelo de pontuação do radar.

## 15. SEO e descoberta

- HTML rastreável e responsivo.
- Títulos e descrições únicos.
- URLs legíveis.
- Sitemap atualizado.
- Robots.txt adequado.
- Canonical por artigo.
- Dados estruturados apropriados para conteúdo editorial de produto.
- Imagens com texto alternativo.
- Links internos entre artigos e categorias.
- Data de publicação e atualização.
- Integração futura com Search Console.

O sistema não deverá garantir indexação ou posicionamento.

## 16. Dados e persistência

O banco deverá armazenar:

- Oportunidades e suas pontuações.
- Produtos e ASINs.
- Links SiteStripe.
- Artigos, revisões e estados.
- Categorias.
- Fontes.
- Histórico de aprovação e publicação.
- Métricas agregadas futuras.

Arquivos e imagens, quando necessários, deverão ser armazenados separadamente dos registros estruturados.

## 17. Segurança

- Painel protegido e não indexável.
- Nenhuma credencial no cliente.
- Validação de entradas e URLs.
- Ações de publicação restritas ao usuário autorizado.
- Histórico para ações editoriais.
- Rotas administrativas separadas das páginas públicas.
- Falhas de pesquisa ou geração não poderão publicar conteúdo parcial.

## 18. Tratamento de erros

- Radar sem fontes suficientes: oportunidade não elegível.
- Fontes conflitantes: destacar divergência e exigir revisão.
- Link sem tag válida: bloquear publicação.
- Produto indisponível: alertar e solicitar substituição ou ressalva.
- Falha de geração: manter pauta aprovada e permitir nova tentativa.
- Falha na publicação: preservar rascunho e histórico.
- PA API indisponível no futuro: manter operação via SiteStripe.

## 19. Validação

Antes do lançamento, verificar:

- Navegação desktop e mobile.
- Acessibilidade básica.
- Busca.
- Proteção do painel.
- Criação e mudança de status das pautas.
- Extração de ASIN e tag.
- Bloqueios editoriais.
- Pré-visualização.
- Publicação e despublicação.
- Sitemap e metadados.
- Desempenho das páginas principais.
- Links de associado em ambiente de produção.

## 20. Fora do escopo inicial

- Publicação sem revisão humana.
- Aplicativos móveis nativos.
- Vários usuários no painel.
- Pagamentos ou assinaturas.
- Comentários públicos.
- Importação automática de avaliações da Amazon.
- Integração imediata com PA API.
- Domínio próprio no lançamento.

## 21. Critérios de sucesso da primeira versão

- Site público publicado na URL gratuita do Sites.
- Painel privado acessível apenas por Olavo.
- Dez artigos iniciais revisados e publicados.
- Radar diário oferecendo cinco pautas às 9h.
- Fluxo completo de aprovação, rascunho, links e publicação funcionando.
- Links com a tag `topcomparat09-20`.
- Aviso de afiliado presente.
- Estrutura pronta para a integração futura da PA API.

