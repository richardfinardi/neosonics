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


## Publicação

Frontend:
- GitHub Pages: `https://richardfinardi.github.io/neosonics/`
- Workflow: `.github/workflows/pages.yml`

Backend:
- Apps Script ID: `19bBKpBAxecnbcp4aCRaG15CXdnww2mdhX2sb-jTuaIK9Hc17MlniEwGL`
- Deployment ID: `AKfycbzIK1DMOScjbly8BguctT2-1fiZYTIOOa0nVEAvHKCkvFnCFNd9tgO3wZTwBSAlp9kT`
- Web App: `https://script.google.com/macros/s/AKfycbzIK1DMOScjbly8BguctT2-1fiZYTIOOa0nVEAvHKCkvFnCFNd9tgO3wZTwBSAlp9kT/exec`

O deploy automático do backend usa o workflow central em `richardfinardi/fluxo_caixa` com a autorização CLASP já existente.

### Primeiro acesso do Web App

O projeto e o deployment foram criados automaticamente, mas o `clasp deploy` não configura o acesso público do Web App em um deployment novo. Portanto, uma única vez é necessário abrir o Apps Script e editar o deployment como Web App, executando como o proprietário e permitindo acesso a qualquer pessoa. Depois disso, os redeploys automáticos preservam o mesmo deployment e URL.
