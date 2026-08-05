# Reconstrução segura da automação editorial — Top Comparativos

Data: 04/08/2026

## 1. Objetivo

Reconstruir a base da automação editorial perdida durante a manutenção do workspace e deixá-la pronta para receber artigos e imagens produzidos pelo fluxo Google Sheets + Drive + Apps Script, sem permitir publicação acidental nem perda de mídia.

Esta especificação cobre somente a reconstrução das etapas de persistência, contrato editorial, autenticação, importação de rascunhos e mídia. Linkagem interna, aprovação pública, renderização, SEO final e conector Apps Script permanecem em etapas posteriores.

## 2. Princípios obrigatórios

- O Google Sheets controla pauta, status e aprovação.
- O Drive guarda os documentos e imagens de origem, mas o site não depende do Drive para servir conteúdo público.
- D1 guarda artigos, versões, operações e relacionamentos.
- R2, com binding lógico `MEDIA`, guarda as imagens servidas pelo site.
- Importar ou reenviar conteúdo nunca publica nem modifica a versão pública existente.
- O site só cria link de afiliado quando o artigo contém produto e URL de afiliado explícitos.
- Toda chamada do Apps Script usa HMAC-SHA256, timestamp, request ID e assinatura do corpo exato.
- Operações são idempotentes e seguras diante de repetição e concorrência.
- Segredos, corpos de imagem e dados sensíveis não entram em logs, auditoria ou mensagens de erro.
- Cada marco concluído e revisado é enviado ao GitHub antes do próximo marco.

## 3. Arquitetura reconstruída

### 3.1 Persistência editorial

O artigo mantém dois estados separados:

- `draft_*`: conteúdo importado e em revisão;
- `published_*`: snapshot que está público.

Produtos, fontes, mídia e hero seguem a mesma separação lógica. Um novo rascunho de artigo já publicado não altera título, corpo, produtos, fontes, imagens ou URL públicos.

As tabelas também registram:

- operações automatizadas e seus request IDs;
- eventos de auditoria sem conteúdo sensível;
- mídias de rascunho e publicadas;
- candidatos a coleta de objetos órfãos;
- lease exclusivo do coletor;
- cursor persistente do inventário R2.

Migrações são aditivas e preservam os artigos existentes.

### 3.2 Contrato de conteúdo seguro

O documento importado aceita apenas blocos editoriais conhecidos e versionados. HTML bruto, scripts, estilos e URLs arbitrárias não são aceitos.

Tipos iniciais: parágrafo, título, lista, chamada, tabela, imagem, produto e FAQ. `mediaKey` é sempre um basename seguro, sem barras ou travessia de diretório.

### 3.3 Autenticação e idempotência

Formato canônico da assinatura:

```text
timestamp\nrequestId\nsourceKey\nsha256(body)
```

Regras:

- HMAC-SHA256 com segredo hospedado;
- janela máxima de cinco minutos;
- comparação de assinatura em tempo constante;
- request ID único por escopo de operação;
- replay idêntico retorna o resultado anterior;
- request ID reutilizado com outra origem ou conteúdo retorna conflito;
- corpo é limitado antes e durante a leitura.

### 3.4 Importação de artigos

A API recebe um envelope validado contendo metadados, palavra-chave, intenção, documento estruturado, produtos opcionais e fontes.

Comportamento:

- cria ou atualiza somente o rascunho;
- preserva integralmente a versão publicada;
- grava o envelope suficiente para uma promoção futura;
- atualiza produtos e fontes apenas no espaço de rascunho;
- usa controle otimista para impedir confirmação falsa em corridas;
- não publica e não cria afiliado sem URL explícita.

### 3.5 Upload e entrega de mídia

O upload aceita JPEG, PNG e WebP entre 1 byte e 10 MiB, valida SHA-256 e autentica os bytes exatos recebidos.

Objetos usam chaves imutáveis derivadas do artigo e checksum. Reenviar a mesma imagem reutiliza o objeto, mas pode atualizar `alt`, papel e posição do rascunho. Substituir uma imagem nunca altera a referência publicada.

A rota pública de mídia:

- consulta D1 antes do R2;
- expõe apenas referências publicadas;
- usa allowlist de caminho;
- envia MIME, tamanho, cache e ETag corretos;
- suporta `If-None-Match` forte ou fraco;
- não lista objetos.

## 4. Coleta de mídia com exclusividade

### 4.1 Lease global

Somente um coletor pode excluir objetos por vez. Ao iniciar, ele tenta adquirir atomicamente um lease global contendo:

- `owner_token` aleatório;
- `acquired_at`;
- `expires_at`;
- `fencing_token` monotônico, incrementado a cada nova aquisição.

Se existir lease válido, a segunda execução termina sem processar objetos. Um lease expirado pode ser retomado atomicamente por outro coletor.

### 4.2 Renovação e perda do lease

O coletor renova o lease antes da expiração. Cada ação destrutiva verifica no banco que o `owner_token` e o `fencing_token` ainda são os proprietários e que o lease não expirou.

Se perder o lease, o worker interrompe imediatamente, sem excluir nem confirmar candidatos adicionais.

### 4.3 Exclusão protegida

Para cada candidato:

1. o coletor, com lease válido, adquire o candidato por compare-and-swap;
2. revalida referências de rascunho e publicadas;
3. uploads e promoção recusam reutilizar uma chave cujo candidato esteja em estado destrutivo;
4. o coletor verifica novamente lease, token do candidato e ausência de referências;
5. exclui o objeto R2;
6. finaliza o candidato condicionalmente ao mesmo token.

Uma execução antiga nunca pode continuar usando um token vencido. Assim, mesmo após pausa, timeout ou retomada, um coletor obsoleto não apaga um objeto recriado.

### 4.4 Progresso e recuperação

- A fila gira por `last_checked_at` e ID, evitando starvation.
- O cursor opaco do inventário R2 é persistido após cada página confirmada.
- O inventário continua além de mil objetos e reinicia somente ao chegar ao fim.
- Respostas D1 com `success: false` ou `changes: 0` nunca contam como progresso.
- Falhas deixam estado recuperável e observável, sem exclusão insegura.
- O consumidor do GC é autenticado e recebe corpo pequeno com limite rígido.

## 5. Testes de aceitação

Além dos testes unitários e de integração existentes, a reconstrução precisa provar:

- importação concorrente não altera conteúdo público;
- replay e conflito de request ID são determinísticos;
- upload publicado permanece imutável quando o rascunho muda;
- corpo acima de 10 MiB é interrompido sem materialização completa;
- duas execuções do GC não processam o mesmo período de lease;
- um coletor pausado e posteriormente retomado não consegue excluir objeto recriado;
- lease expirado pode ser retomado com segurança;
- perda de lease durante o processamento interrompe exclusões;
- falhas D1 não produzem progresso falso;
- fila e inventário avançam de forma justa e persistente;
- suíte completa, lint, build e artefato de hospedagem passam.

## 6. Entrega e recuperação

Cada marco terá esta sequência:

1. teste falhando que reproduz o requisito;
2. implementação mínima;
3. suíte focada e completa;
4. revisão independente de especificação e qualidade;
5. correção dos achados relevantes;
6. commit e envio ao GitHub.

Nenhuma mudança será publicada no site durante esta reconstrução. O primeiro checkpoint hospedado ocorrerá somente depois que a base reconstruída estiver aprovada e as etapas posteriores de publicação estiverem concluídas.

## 7. Fora de escopo

- algoritmo de link juice pilar–satélite;
- comando de publicação aprovado pela planilha;
- painel de pré-visualização final;
- renderização pública dos blocos;
- sitemap editorial e metadados finais;
- código do Apps Script e gatilhos da planilha;
- agendamento operacional definitivo do GC.

Esses itens serão implementados na sequência, apoiados por esta base.
