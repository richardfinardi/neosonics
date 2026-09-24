# Arquitetura inicial — Neosonics

## Escopo da fase atual

O sistema será composto por:

1. Cadastro de clientes.
2. Base histórica de vendas importada sem alteração.
3. Camada de tratamento/mapeamento do histórico.
4. Análises comerciais e de lucratividade.
5. Calculadora de formação de preço integrada ao módulo de orçamento.
6. Histórico e versionamento de orçamentos.
7. Conversão de orçamento aprovado em pedido.
8. Carteira de pedidos.

**Produção está fora do escopo desta fase.**

## Banco de dados

Banco principal: `NEOSONICS_DB`.

### Histórico

- `RAW_VENDAS_HISTORICO`: cópia imutável da base recebida.
- `MAP_CLIENTES`: DE/PARA para identidade de clientes.
- `MAP_CLASSIFICACOES`: DE/PARA de segmentações/modalidades.
- `IMPORT_LOG`: controle de cargas.
- `VENDAS`: camada tratada/oficial para análises.

### Comercial

- `CLIENTES`
- `SEGMENTOS`
- `PRODUTOS`
- `ORCAMENTOS`
- `ORCAMENTO_ITENS`
- `ORCAMENTO_COMPONENTES`
- `PEDIDOS`
- `PEDIDO_ITENS`

### Formação de preço

- `PROCESSOS_CUSTO`: processos e custo/hora.
- `TABELA_IMPOSTOS`: combinação enquadramento/destino/tipo de venda.
- `CONFIG`: parâmetros gerais.

## Fluxo comercial

```
Cliente
  ↓
Calculadora / Orçamento
  ↓
Rascunho
  ↓
Enviado
  ↓
Aprovado
  ↓
Converter em Pedido
  ↓
Pedido aberto
```

Ao converter, o pedido recebe um snapshot dos dados comerciais aprovados, mantendo vínculo com o orçamento de origem.

## Histórico antigo

O histórico recebido não é alterado. Ele permanece em RAW e será tratado por DE/PARA. Isso permite corrigir classificações no futuro sem perder a origem do dado.


## Versionamento de parâmetros de custos

A despesa fixa e o custo/hora não são lidos de forma dinâmica a cada visualização de orçamento. Eles são importados da planilha oficial de custos e transformados em uma versão de parâmetros com vigência.

Tabelas:
- `PARAMETRO_VERSOES`: cabeçalho da versão, vigência, despesa fixa e origem.
- `CUSTO_HORA_VERSOES`: custo/hora por processo vinculado à versão.
- `ORCAMENTOS.PARAMETRO_VERSAO_ID`: versão usada pelo orçamento.
- `ORCAMENTO_COMPONENTES.CUSTO_HORA`: snapshot do custo/hora efetivamente usado.

Regra:
1. Uma alteração na planilha de custos não sobrescreve o histórico.
2. A versão vigente é encerrada com data/hora final.
3. Uma nova versão é criada com início naquele momento.
4. Somente orçamentos criados a partir dali usam os novos valores.
5. Orçamentos já existentes continuam presos à versão original.
6. Um orçamento antigo só poderá adotar a versão atual mediante uma ação explícita de recálculo, nunca automaticamente.

Fonte inicial:
- Planilha: `LEVANTAMENTO DE CUSTOS NEOSONICS (SETEMBRO DE 2026)`
- ID: `13dOBvngdDVoFxvvaH3rTurVTInsEXhPPk62WMxGeXGU`
- Despesa fixa: `DADOS!X2`
- Custos/hora: `CUSTO HORA!A:B`

O backend possui a ação `sincronizar_parametros_custos`, que compara os valores atuais da fonte com a versão ativa e só cria uma nova versão quando detectar alteração.


## Regra do preço sugerido

O preço sugerido **não é calculado automaticamente** pela regra legado.

Na calculadora atual, o usuário informa o preço sugerido e o sistema calcula sobre esse valor os indicadores de margem de contribuição, lucro e percentual de lucro. Portanto:

- preço objetivo: calculado;
- preço mínimo: calculado;
- preço sugerido: informado pelo usuário;
- margens/lucros do preço sugerido: calculados a partir do valor informado.

O backend deve validar que o preço sugerido de cada item seja maior que zero, mas nunca substituí-lo por uma fórmula automática.

## Proposta e reenvio

O banco é a fonte oficial do orçamento. Não é necessário persistir um PDF por orçamento.

Ao pesquisar um orçamento, o sistema deve remontar a proposta a partir do cabeçalho, itens, componentes e snapshots gravados. A visualização/arquivo para envio é gerada sob demanda. Assim, o usuário pode reenviar a mesma proposta sem depender de um PDF previamente salvo no Drive.
