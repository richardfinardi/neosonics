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
