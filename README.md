# Neosonics

Sistema web comercial da Neosonics.

## Fase atual

- Cadastro de clientes
- Análise do histórico 2025/2026
- Segmentos, clientes, produtos e estados
- Formação de preço
- Orçamentos
- Conversão de orçamento aprovado em pedido
- Carteira de pedidos

Produção não faz parte da fase atual.

## Dados

O banco principal é o Google Sheets **NEOSONICS_DB**. O histórico original é preservado sem tratamento e uma camada de mapeamento permite transformar os dados antigos para o padrão do novo sistema.

## Backend

A pasta `apps-script/` contém a base do backend em Google Apps Script. Ela já contempla:

- bootstrap de cadastros
- clientes
- salvar orçamento com itens/componentes
- aprovação/recusa
- conversão de orçamento em pedido
- leitura inicial do histórico para dashboard

O Web App do Apps Script ainda precisa ser criado/deployado para gerar a URL da API.

## Frontend

`index.html` contém a interface inicial responsiva do sistema.
