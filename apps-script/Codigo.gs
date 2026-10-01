const DB_SPREADSHEET_ID = '1muCnR88feYxBnzTdtLKuPFgu_d0nq9HB5vsY3js6Gfs';
const CUSTOS_ORIGEM_SPREADSHEET_ID = '13dOBvngdDVoFxvvaH3rTurVTInsEXhPPk62WMxGeXGU';
const CUSTOS_ORIGEM_TITULO = 'LEVANTAMENTO DE CUSTOS NEOSONICS';

const ABAS = Object.freeze({
  CLIENTES: 'CLIENTES',
  SEGMENTOS: 'SEGMENTOS',
  PRODUTOS: 'PRODUTOS',
  VENDAS: 'VENDAS',
  RAW: 'RAW_VENDAS_HISTORICO',
  MAP_CLIENTES: 'MAP_CLIENTES',
  MAP_CLASSIFICACOES: 'MAP_CLASSIFICACOES',
  ORCAMENTOS: 'ORCAMENTOS',
  ORCAMENTO_ITENS: 'ORCAMENTO_ITENS',
  ORCAMENTO_COMPONENTES: 'ORCAMENTO_COMPONENTES',
  PEDIDOS: 'PEDIDOS',
  PEDIDO_ITENS: 'PEDIDO_ITENS',
  PROCESSOS_CUSTO: 'PROCESSOS_CUSTO',
  TABELA_IMPOSTOS: 'TABELA_IMPOSTOS',
  SEGMENTO_RELACOES: 'SEGMENTO_RELACOES',
  PARAMETRO_VERSOES: 'PARAMETRO_VERSOES',
  CUSTO_HORA_VERSOES: 'CUSTO_HORA_VERSOES',
  CONFIG: 'CONFIG',
  IMPORT_LOG: 'IMPORT_LOG'
});

function doGet(e) {
  try {
    const acao = String((e && e.parameter && e.parameter.acao) || 'ping').toLowerCase();

    switch (acao) {
      case 'ping':
        return json_({ ok: true, sistema: 'NEOSONICS', versao: '0.9.0' });

      case 'bootstrap':
        return json_(getBootstrap_());

      case 'clientes':
        return json_({ ok: true, dados: listarClientes_() });

      case 'map_clientes':
        return json_({ ok: true, dados: listarMapClientes_() });

      case 'segmentos':
        return json_({ ok: true, dados: listarSegmentos_() });

      case 'orcamentos':
        return json_({ ok: true, dados: listarOrcamentosResumo_() });

      case 'orcamento_detalhe':
        return json_(getOrcamentoDetalhe_((e && e.parameter && e.parameter.id) || ''));

      case 'pedidos':
        return json_({ ok: true, dados: listarObjetos_(ABAS.PEDIDOS) });

      case 'dashboard':
        return json_(getDashboardHistorico_());

      default:
        return json_({ ok: false, erro: 'Ação GET inválida: ' + acao });
    }
  } catch (err) {
    return json_({ ok: false, erro: err.message, stack: err.stack });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const acao = String(body.acao || '').toLowerCase();

    switch (acao) {
      case 'salvar_cliente':
        return json_(salvarCliente_(body.cliente || {}));

      case 'salvar_segmento':
        return json_(salvarSegmento_(body.segmento || {}));

      case 'salvar_mapeamento_cliente':
        return json_(salvarMapeamentoCliente_(body.chave_origem, body.id_cliente_oficial));

      case 'criar_cliente_mapeamento':
        return json_(criarClienteDoMapeamento_(body.chave_origem));

      case 'resolver_grupo_cliente':
        return json_(resolverGrupoCliente_(body.cod_cliente_origem, body.modo, body.nome_oficial, body.id_cliente_oficial));

      case 'salvar_orcamento':
        return json_(salvarOrcamento_(body.orcamento || {}));

      case 'enviar_orcamento':
        return json_(alterarStatusOrcamento_(body.id_orcamento, 'ENVIADO'));

      case 'aprovar_orcamento':
        return json_(alterarStatusOrcamento_(body.id_orcamento, 'APROVADO'));

      case 'recusar_orcamento':
        return json_(alterarStatusOrcamento_(body.id_orcamento, 'RECUSADO'));

      case 'converter_orcamento_pedido':
        return json_(converterOrcamentoEmPedido_(body.id_orcamento));

      case 'sincronizar_parametros_custos':
        return json_(sincronizarParametrosCustos_());

      default:
        return json_({ ok: false, erro: 'Ação POST inválida: ' + acao });
    }
  } catch (err) {
    return json_({ ok: false, erro: err.message, stack: err.stack });
  }
}

function getBootstrap_() {
  return {
    ok: true,
    clientes: listarObjetos_(ABAS.CLIENTES),
    segmentos: listarObjetos_(ABAS.SEGMENTOS),
    segmento_relacoes: listarObjetos_(ABAS.SEGMENTO_RELACOES),
    produtos: listarObjetos_(ABAS.PRODUTOS),
    processos: listarObjetos_(ABAS.PROCESSOS_CUSTO),
    impostos: listarObjetos_(ABAS.TABELA_IMPOSTOS),
    parametro_versao_ativa: getVersaoParametrosAtiva_(),
    custos_hora_ativos: getCustosHoraVersaoAtiva_(),
    config: listarObjetos_(ABAS.CONFIG)
  };
}

function listarClientes_() {
  return listarObjetos_(ABAS.CLIENTES)
    .sort(function(a, b) {
      const na = String(a.NOME_FANTASIA || a.RAZAO_SOCIAL || '').toUpperCase();
      const nb = String(b.NOME_FANTASIA || b.RAZAO_SOCIAL || '').toUpperCase();
      return na.localeCompare(nb, 'pt-BR');
    });
}

function listarSegmentos_() {
  return listarObjetos_(ABAS.SEGMENTOS)
    .sort(function(a,b) {
      const ta = String(a.TIPO || '');
      const tb = String(b.TIPO || '');
      if (ta !== tb) return ta.localeCompare(tb);
      const aa = a.ATIVO === false ? 1 : 0;
      const ab = b.ATIVO === false ? 1 : 0;
      if (aa !== ab) return aa - ab;
      const oa = numero_(a.ORDEM || 9999);
      const ob = numero_(b.ORDEM || 9999);
      if (oa !== ob) return oa - ob;
      return String(a.SEGMENTO || '').localeCompare(String(b.SEGMENTO || ''), 'pt-BR');
    });
}

function salvarSegmento_(segmento) {
  const tipo = String(segmento.TIPO || '').trim().toUpperCase();
  const nome = String(segmento.SEGMENTO || '').trim().replace(/\s+/g, ' ');

  if (tipo !== 'FINAL' && tipo !== 'NEO') {
    throw new Error('Tipo de segmentação inválido. Use FINAL ou NEO.');
  }
  if (!nome) throw new Error('Informe o nome da segmentação.');

  const todos = listarObjetos_(ABAS.SEGMENTOS);
  const duplicado = todos.find(function(s) {
    return String(s.ID_SEGMENTO) !== String(segmento.ID_SEGMENTO || '') &&
           String(s.TIPO || '').toUpperCase() === tipo &&
           normalizarTexto_(s.SEGMENTO) === normalizarTexto_(nome) &&
           s.ATIVO !== false;
  });
  if (duplicado) {
    throw new Error('Já existe uma segmentação ' + tipo + ' com este nome.');
  }

  const sh = aba_(ABAS.SEGMENTOS);
  const headers = cabecalhos_(sh);
  let id = String(segmento.ID_SEGMENTO || '').trim();
  let row = id ? localizarLinha_(sh, headers.ID_SEGMENTO, id) : null;

  if (!id) {
    id = 'SEG-' + tipo + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  let ordem = numero_(segmento.ORDEM);
  if (!ordem) {
    ordem = todos
      .filter(function(s) { return String(s.TIPO || '').toUpperCase() === tipo; })
      .reduce(function(max, s) { return Math.max(max, numero_(s.ORDEM)); }, 0) + 1;
  }

  const obj = {
    ID_SEGMENTO: id,
    TIPO: tipo,
    SEGMENTO: nome,
    DESCRICAO: String(segmento.DESCRICAO || '').trim(),
    ATIVO: segmento.ATIVO !== false,
    ORDEM: ordem,
    ORIGEM: segmento.ORIGEM || (row ? 'SISTEMA' : 'SISTEMA')
  };

  if (row) escreverObjetoNaLinha_(sh, row, obj);
  else appendObjeto_(ABAS.SEGMENTOS, obj);

  atualizarNomeSegmentoReferencias_(id, tipo, nome);

  SpreadsheetApp.flush();
  return { ok: true, segmento: obj, atualizado: !!row };
}

function atualizarNomeSegmentoReferencias_(idSegmento, tipo, nome) {
  const shRel = aba_(ABAS.SEGMENTO_RELACOES);
  if (shRel.getLastRow() >= 2) {
    const h = cabecalhos_(shRel);
    const idCol = tipo === 'FINAL' ? h.SEGMENTO_FINAL_ID : h.SEGMENTO_NEO_ID;
    const nomeCol = tipo === 'FINAL' ? h.SEGMENTO_FINAL : h.SEGMENTO_NEO;

    if (idCol && nomeCol) {
      const vals = shRel.getRange(2, idCol, shRel.getLastRow() - 1, 1).getValues();
      vals.forEach(function(r, i) {
        if (String(r[0]) === String(idSegmento)) {
          shRel.getRange(i + 2, nomeCol).setValue(nome);
        }
      });
    }
  }

  const shMap = aba_(ABAS.MAP_CLASSIFICACOES);
  if (shMap.getLastRow() >= 2) {
    const h = cabecalhos_(shMap);
    const vals = shMap.getRange(2, h.ID_PADRAO, shMap.getLastRow() - 1, 1).getValues();
    vals.forEach(function(r, i) {
      if (String(r[0]) === String(idSegmento)) {
        shMap.getRange(i + 2, h.VALOR_PADRAO).setValue(nome);
        if (h.DT_REVISAO) shMap.getRange(i + 2, h.DT_REVISAO).setValue(isoAgora_().substring(0,10));
        if (h.REVISADO_POR) shMap.getRange(i + 2, h.REVISADO_POR).setValue('SISTEMA');
      }
    });
  }
}

function listarMapClientes_() {
  return listarObjetos_(ABAS.MAP_CLIENTES)
    .sort(function(a,b) {
      const sa = String(a.STATUS_MAPEAMENTO || '');
      const sb = String(b.STATUS_MAPEAMENTO || '');
      if (sa !== sb) return sa.localeCompare(sb);
      const ca = numero_(a.COD_CLIENTE_ORIGEM);
      const cb = numero_(b.COD_CLIENTE_ORIGEM);
      if (ca !== cb) return ca - cb;
      return String(a.CLIENTE_ORIGEM || '').localeCompare(String(b.CLIENTE_ORIGEM || ''), 'pt-BR');
    });
}

function salvarMapeamentoCliente_(chaveOrigem, idClienteOficial) {
  if (!chaveOrigem) throw new Error('CHAVE_ORIGEM não informada.');
  if (!idClienteOficial) throw new Error('Selecione o cliente oficial.');

  const clientes = listarObjetos_(ABAS.CLIENTES);
  const cliente = clientes.find(function(c) {
    return String(c.ID_CLIENTE) === String(idClienteOficial);
  });
  if (!cliente) throw new Error('Cliente oficial não encontrado.');

  const sh = aba_(ABAS.MAP_CLIENTES);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.CHAVE_ORIGEM, chaveOrigem);
  if (!row) throw new Error('Origem histórica não encontrada.');

  setCelulaPorHeader_(sh, headers, row, 'ID_CLIENTE_OFICIAL', cliente.ID_CLIENTE);
  setCelulaPorHeader_(sh, headers, row, 'CLIENTE_OFICIAL', cliente.NOME_FANTASIA || cliente.RAZAO_SOCIAL || '');
  setCelulaPorHeader_(sh, headers, row, 'SEGMENTO_OFICIAL', cliente.SEGMENTO_ID || '');
  setCelulaPorHeader_(sh, headers, row, 'STATUS_MAPEAMENTO', 'MAPEADO_MANUAL');
  setCelulaPorHeader_(sh, headers, row, 'OBS', 'Vinculado manualmente pelo sistema.');
  setCelulaPorHeader_(sh, headers, row, 'ATIVO', true);

  SpreadsheetApp.flush();
  return { ok: true, chave_origem: chaveOrigem, cliente: cliente };
}

function criarClienteDoMapeamento_(chaveOrigem) {
  if (!chaveOrigem) throw new Error('CHAVE_ORIGEM não informada.');

  const mapas = listarObjetos_(ABAS.MAP_CLIENTES);
  const origem = mapas.find(function(m) {
    return String(m.CHAVE_ORIGEM) === String(chaveOrigem);
  });
  if (!origem) throw new Error('Origem histórica não encontrada.');

  const nome = String(origem.CLIENTE_ORIGEM || '').trim().replace(/\s+/g, ' ');
  const cliente = {
    ID_CLIENTE: novoId_('CLI'),
    COD_CLIENTE_ORIGEM: origem.COD_CLIENTE_ORIGEM || '',
    RAZAO_SOCIAL: nome,
    NOME_FANTASIA: nome,
    CNPJ_CPF: '',
    SEGMENTO_ID: '',
    UF: origem.UF_ORIGEM || '',
    CIDADE: '',
    CONTATO: '',
    EMAIL: '',
    TELEFONE: '',
    VENDEDOR: '',
    ATIVO: true,
    DT_CADASTRO: isoAgora_(),
    OBS: 'Criado a partir do histórico da planilha do cliente.'
  };

  appendObjeto_(ABAS.CLIENTES, cliente);
  salvarMapeamentoCliente_(chaveOrigem, cliente.ID_CLIENTE);

  return { ok: true, cliente: cliente, chave_origem: chaveOrigem };
}

function resolverGrupoCliente_(codClienteOrigem, modo, nomeOficial, idClienteOficial) {
  const codigo = String(codClienteOrigem || '').trim();
  const acao = String(modo || '').trim().toUpperCase();

  if (!codigo) throw new Error('Código antigo não informado.');
  if (acao !== 'UNIFICAR' && acao !== 'SEPARAR') {
    throw new Error('Modo inválido. Use UNIFICAR ou SEPARAR.');
  }

  const mapas = listarObjetos_(ABAS.MAP_CLIENTES).filter(function(m) {
    return String(m.COD_CLIENTE_ORIGEM || '').trim() === codigo &&
           String(m.STATUS_MAPEAMENTO || '').toUpperCase() === 'PENDENTE';
  });

  if (!mapas.length) {
    return { ok: true, mensagem: 'Este grupo já foi resolvido.', codigo: codigo };
  }

  if (acao === 'UNIFICAR') {
    const clientes = listarObjetos_(ABAS.CLIENTES);
    let cliente = null;

    if (idClienteOficial) {
      cliente = clientes.find(function(c) {
        return String(c.ID_CLIENTE) === String(idClienteOficial);
      });
      if (!cliente) throw new Error('Cliente oficial selecionado não foi encontrado.');
    } else {
      const nome = String(nomeOficial || '').trim().replace(/\s+/g, ' ');
      if (!nome) throw new Error('Selecione um cliente oficial ou informe o nome para criar um novo.');

      const ufs = {};
      mapas.forEach(function(m) {
        const uf = String(m.UF_ORIGEM || '').trim().toUpperCase();
        if (uf) ufs[uf] = true;
      });
      const ufUnica = Object.keys(ufs).length === 1 ? Object.keys(ufs)[0] : '';

      cliente = clientes.find(function(c) {
        return String(c.COD_CLIENTE_ORIGEM || '').trim() === codigo &&
               normalizarTexto_(c.NOME_FANTASIA || c.RAZAO_SOCIAL) === normalizarTexto_(nome);
      });

      if (!cliente) {
        cliente = {
          ID_CLIENTE: novoId_('CLI'),
          COD_CLIENTE_ORIGEM: codigo,
          RAZAO_SOCIAL: nome,
          NOME_FANTASIA: nome,
          CNPJ_CPF: '',
          SEGMENTO_ID: '',
          UF: ufUnica,
          CIDADE: '',
          CONTATO: '',
          EMAIL: '',
          TELEFONE: '',
          VENDEDOR: '',
          ATIVO: true,
          DT_CADASTRO: isoAgora_(),
          OBS: 'Cliente unificado a partir do histórico da planilha.'
        };
        appendObjeto_(ABAS.CLIENTES, cliente);
      }
    }

    mapas.forEach(function(m) {
      salvarMapeamentoCliente_(m.CHAVE_ORIGEM, cliente.ID_CLIENTE);
    });

    return {
      ok: true,
      modo: 'UNIFICAR',
      codigo: codigo,
      cliente: cliente,
      registros_resolvidos: mapas.length
    };
  }

  // SEPARAR: cria um cliente por variação única de nome + UF.
  const grupos = {};
  mapas.forEach(function(m) {
    const nome = String(m.CLIENTE_ORIGEM || '').trim().replace(/\s+/g, ' ');
    const uf = String(m.UF_ORIGEM || '').trim().toUpperCase();
    const chave = normalizarTexto_(nome) + '|' + uf;
    if (!grupos[chave]) grupos[chave] = { nome: nome, uf: uf, mapas: [] };
    grupos[chave].mapas.push(m);
  });

  const clientesCriados = [];
  Object.keys(grupos).forEach(function(chave) {
    const g = grupos[chave];
    const clientes = listarObjetos_(ABAS.CLIENTES);
    let cliente = clientes.find(function(c) {
      return String(c.COD_CLIENTE_ORIGEM || '').trim() === codigo &&
             normalizarTexto_(c.NOME_FANTASIA || c.RAZAO_SOCIAL) === normalizarTexto_(g.nome) &&
             String(c.UF || '').trim().toUpperCase() === g.uf;
    });

    if (!cliente) {
      cliente = {
        ID_CLIENTE: novoId_('CLI'),
        COD_CLIENTE_ORIGEM: codigo,
        RAZAO_SOCIAL: g.nome,
        NOME_FANTASIA: g.nome,
        CNPJ_CPF: '',
        SEGMENTO_ID: '',
        UF: g.uf,
        CIDADE: '',
        CONTATO: '',
        EMAIL: '',
        TELEFONE: '',
        VENDEDOR: '',
        ATIVO: true,
        DT_CADASTRO: isoAgora_(),
        OBS: 'Cliente separado a partir de variação encontrada no histórico.'
      };
      appendObjeto_(ABAS.CLIENTES, cliente);
    }

    g.mapas.forEach(function(m) {
      salvarMapeamentoCliente_(m.CHAVE_ORIGEM, cliente.ID_CLIENTE);
    });
    clientesCriados.push(cliente);
  });

  return {
    ok: true,
    modo: 'SEPARAR',
    codigo: codigo,
    clientes: clientesCriados,
    registros_resolvidos: mapas.length
  };
}

function salvarCliente_(cliente) {
  if (!cliente.RAZAO_SOCIAL && !cliente.NOME_FANTASIA) {
    throw new Error('Informe a razão social ou nome fantasia.');
  }

  const sh = aba_(ABAS.CLIENTES);
  const headers = cabecalhos_(sh);
  const agora = isoAgora_();

  const novo = Object.assign({}, cliente);

  if (novo.SEGMENTO_FINAL_ID) validarSegmentoTipo_(novo.SEGMENTO_FINAL_ID, 'FINAL');
  if (novo.SEGMENTO_NEO_ID) validarSegmentoTipo_(novo.SEGMENTO_NEO_ID, 'NEO');

  novo.ID_CLIENTE = novo.ID_CLIENTE || novoId_('CLI');
  novo.ATIVO = novo.ATIVO !== false;
  novo.DT_CADASTRO = novo.DT_CADASTRO || agora;

  const row = localizarLinha_(sh, headers.ID_CLIENTE, novo.ID_CLIENTE);

  if (row) {
    escreverObjetoNaLinha_(sh, row, novo);
  } else {
    appendObjeto_(ABAS.CLIENTES, novo);
  }

  SpreadsheetApp.flush();
  return { ok: true, cliente: novo, atualizado: !!row };
}

function salvarOrcamento_(orcamento) {
  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : [];
  if (!orcamento.CLIENTE_ID) throw new Error('CLIENTE_ID é obrigatório.');
  if (!itens.length) throw new Error('O orçamento precisa ter pelo menos um item.');
  if (itens.length > 10) throw new Error('Limite máximo de 10 itens por proposta atingido.');

  const idOrcamento = orcamento.ID_ORCAMENTO || novoId_('ORC');
  const numero = orcamento.NUMERO_ORCAMENTO || proximoNumeroOrcamentoSeguro_();
  const agora = isoAgora_();
  const statusSolicitado = String(orcamento.STATUS || 'RASCUNHO').toUpperCase();

  if (statusSolicitado !== 'RASCUNHO') {
    validarPrecoFinalItensPayload_(itens);
  }

  const valorFinalOrcamento = itens.reduce(function(total, item) {
    return total + numero_(item.PRECO_FINAL_TOTAL);
  }, 0);

  const versaoParametros = orcamento.PARAMETRO_VERSAO_ID
    ? getVersaoParametrosPorId_(orcamento.PARAMETRO_VERSAO_ID)
    : getVersaoParametrosAtiva_();

  if (!versaoParametros) {
    throw new Error('Nenhuma versão de parâmetros de custo está ativa.');
  }

  const cliente = getClientePorId_(orcamento.CLIENTE_ID);
  if (!cliente) throw new Error('Cliente não encontrado.');
  if (!String(cliente.UF || '').trim()) {
    throw new Error('O cliente precisa ter UF cadastrada para calcular os impostos.');
  }

  const tipoVenda = normalizarTipoVendaComercial_(orcamento.TIPO_VENDA || 'VENDA');
  const enquadramento = 'NORMAL';
  const destino = destinoPorUf_(cliente.UF);
  const tipoTributario = tipoVenda === 'SERVICO' ? 'SERVICO_14_01' : tipoVenda;
  const impostosPct = getImpostoPct_(enquadramento, destino, tipoTributario);

  const shOrc = aba_(ABAS.ORCAMENTOS);
  const hOrc = cabecalhos_(shOrc);
  const rowExistente = localizarLinha_(shOrc, hOrc.ID_ORCAMENTO, idOrcamento);
  const existente = rowExistente ? objetoDaLinha_(shOrc, rowExistente) : null;

  const despesaFixaPct = existente && existente.DESPESA_FIXA_PCT !== ''
    ? numero_(existente.DESPESA_FIXA_PCT)
    : numero_(versaoParametros.DESPESA_FIXA_PCT);

  const cab = Object.assign({}, orcamento, {
    ID_ORCAMENTO: idOrcamento,
    NUMERO_ORCAMENTO: numero,
    VERSAO: orcamento.VERSAO || 1,
    DATA_ORCAMENTO: orcamento.DATA_ORCAMENTO || agora.substring(0, 10),
    CLIENTE_NOME_SNAPSHOT: cliente.NOME_FANTASIA || cliente.RAZAO_SOCIAL || orcamento.CLIENTE_NOME_SNAPSHOT || '',
    CIDADE_UF: [cliente.CIDADE, cliente.UF].filter(String).join(' / '),
    ENQUADRAMENTO: enquadramento,
    TIPO_VENDA: tipoVenda,
    DESTINO: destino,
    IMPOSTOS_PCT: impostosPct,
    STATUS: statusSolicitado,
    VALOR_TOTAL: valorFinalOrcamento || numero_(orcamento.VALOR_TOTAL),
    PARAMETRO_VERSAO_ID: versaoParametros.ID_VERSAO,
    DESPESA_FIXA_PCT: despesaFixaPct,
    FONTE_PARAMETROS: orcamento.FONTE_PARAMETROS || versaoParametros.ORIGEM_TITULO || CUSTOS_ORIGEM_TITULO,
    DT_CRIACAO: orcamento.DT_CRIACAO || (existente ? existente.DT_CRIACAO : agora),
    DT_ATUALIZACAO: agora,
    CONVERTIDO_PEDIDO_ID: orcamento.CONVERTIDO_PEDIDO_ID || (existente ? existente.CONVERTIDO_PEDIDO_ID : '') || ''
  });
  delete cab.itens;

  // Cabeçalho primeiro. Não mantemos um lock global durante toda a gravação.
  // Isso evita que um orçamento com muitos componentes bloqueie outros usuários.
  if (rowExistente) {
    escreverObjetoNaLinha_(shOrc, rowExistente, cab);
    deletarLinhasPorValor_(ABAS.ORCAMENTO_COMPONENTES, 'ORCAMENTO_ID', idOrcamento);
    deletarLinhasPorValor_(ABAS.ORCAMENTO_ITENS, 'ORCAMENTO_ID', idOrcamento);
  } else {
    appendObjeto_(ABAS.ORCAMENTOS, cab);
  }

  const linhasItens = [];
  const linhasComponentes = [];

  itens.forEach(function(item, idx) {
    const idItem = item.ID_ITEM || novoId_('ORI');

    const segFinal = item.SEGMENTO_FINAL_ID
      ? validarSegmentoTipo_(item.SEGMENTO_FINAL_ID, 'FINAL')
      : null;
    const segNeo = item.SEGMENTO_NEO_ID
      ? validarSegmentoTipo_(item.SEGMENTO_NEO_ID, 'NEO')
      : null;

    const precoFinalTotal = numero_(item.PRECO_FINAL_TOTAL);
    const qtdeItem = numero_(item.QTDE);
    const custoMP = numero_(item.CUSTO_MP);
    const custoTerceiros = numero_(item.CUSTO_TERCEIROS);
    const custoFerramental = numero_(item.CUSTO_FERRAMENTAL);
    const custoHoras = numero_(item.CUSTO_HORAS);
    const impostos = numero_(cab.IMPOSTOS_PCT);
    const despesaFixa = numero_(cab.DESPESA_FIXA_PCT);
    const custoTotal = custoMP + custoTerceiros + custoFerramental + custoHoras;
    const dvValor = precoFinalTotal * impostos;
    const dfValor = precoFinalTotal * despesaFixa;
    const lucroBruto = precoFinalTotal - custoTotal;
    const margemBruta = precoFinalTotal ? lucroBruto / precoFinalTotal : 0;

    const mcFinal = precoFinalTotal
      ? precoFinalTotal - custoMP - custoTerceiros - custoFerramental - dvValor
      : 0;
    const lucroFinal = precoFinalTotal
      ? precoFinalTotal - custoTotal - dvValor - dfValor
      : 0;

    const linhaItem = Object.assign({}, item, {
      ID_ITEM: idItem,
      ORCAMENTO_ID: idOrcamento,
      SEQ: item.SEQ || (idx + 1),
      SEGMENTO_FINAL_ID: segFinal ? segFinal.ID_SEGMENTO : '',
      SEGMENTO_FINAL_SNAPSHOT: segFinal ? segFinal.SEGMENTO : '',
      SEGMENTO_NEO_ID: segNeo ? segNeo.ID_SEGMENTO : '',
      SEGMENTO_NEO_SNAPSHOT: segNeo ? segNeo.SEGMENTO : '',
      PRECO_FINAL_TOTAL: precoFinalTotal,
      PRECO_FINAL_UNIT: qtdeItem ? precoFinalTotal / qtdeItem : precoFinalTotal,
      DV_PCT: impostos,
      DV_VALOR: dvValor,
      DF_PCT: despesaFixa,
      DF_VALOR: dfValor,
      LUCRO_BRUTO: lucroBruto,
      MARGEM_BRUTA_PCT: margemBruta,
      MC_FINAL: mcFinal,
      LUCRO_FINAL: lucroFinal,
      MARGEM_FINAL_PCT: precoFinalTotal ? lucroFinal / precoFinalTotal : 0,
      STATUS: item.STATUS || 'ATIVO'
    });
    delete linhaItem.componentes;
    linhasItens.push(linhaItem);

    const componentes = Array.isArray(item.componentes) ? item.componentes : [];
    componentes.forEach(function(comp, compIdx) {
      const linhaComp = Object.assign({}, comp, {
        ID_COMPONENTE: comp.ID_COMPONENTE || novoId_('ORC-CMP'),
        ORCAMENTO_ID: idOrcamento,
        ITEM_ID: idItem,
        ORDEM: comp.ORDEM || (compIdx + 1),
        ATIVO: comp.ATIVO !== false
      });

      const tipo = String(linhaComp.TIPO_COMPONENTE || '').toUpperCase();
      if ((tipo === 'MO' || tipo === 'PROCESSO' || tipo === 'PROCESSO_PRODUTIVO') &&
          (!linhaComp.CUSTO_HORA && linhaComp.CUSTO_HORA !== 0)) {
        linhaComp.CUSTO_HORA = getCustoHoraNaVersao_(versaoParametros.ID_VERSAO, linhaComp.DESCRICAO);
      }

      if ((tipo === 'MO' || tipo === 'PROCESSO' || tipo === 'PROCESSO_PRODUTIVO') &&
          (linhaComp.CUSTO_TOTAL === undefined || linhaComp.CUSTO_TOTAL === '')) {
        linhaComp.CUSTO_TOTAL =
          numero_(linhaComp.HORAS_SETUP) * numero_(linhaComp.CUSTO_HORA) +
          numero_(linhaComp.HORAS_PECA) * numero_(linhaComp.CUSTO_HORA) * numero_(item.QTDE);
      }

      linhasComponentes.push(linhaComp);
    });
  });

  appendObjetos_(ABAS.ORCAMENTO_ITENS, linhasItens);
  appendObjetos_(ABAS.ORCAMENTO_COMPONENTES, linhasComponentes);

  SpreadsheetApp.flush();

  return {
    ok: true,
    id_orcamento: idOrcamento,
    numero_orcamento: numero,
    status: cab.STATUS
  };
}

function listarOrcamentosResumo_() {
  const shOrc = aba_(ABAS.ORCAMENTOS);
  const lastOrc = shOrc.getLastRow();
  if (lastOrc < 2) return [];

  const lastCol = shOrc.getLastColumn();
  const headers = shOrc.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const idx = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  const dados = shOrc.getRange(2, 1, lastOrc - 1, lastCol).getValues();
  const contador = {};

  const shItens = aba_(ABAS.ORCAMENTO_ITENS);
  const lastItens = shItens.getLastRow();
  if (lastItens >= 2) {
    const hItens = shItens.getRange(1, 1, 1, shItens.getLastColumn()).getValues()[0].map(String);
    const colOrcId = hItens.indexOf('ORCAMENTO_ID') + 1;
    if (colOrcId > 0) {
      shItens.getRange(2, colOrcId, lastItens - 1, 1).getValues().forEach(function(r) {
        const id = String(r[0] || '');
        if (id) contador[id] = (contador[id] || 0) + 1;
      });
    }
  }

  return dados
    .filter(function(r) { return r.some(function(v) { return v !== '' && v !== null; }); })
    .map(function(r) {
      const o = {};
      headers.forEach(function(h, i) { o[h] = r[i]; });
      o.QTD_ITENS = contador[String(o.ID_ORCAMENTO)] || 0;
      return o;
    })
    .sort(function(a, b) {
      const nb = numero_(b.NUMERO_ORCAMENTO);
      const na = numero_(a.NUMERO_ORCAMENTO);
      if (nb !== na) return nb - na;
      return String(b.DT_ATUALIZACAO || '').localeCompare(String(a.DT_ATUALIZACAO || ''));
    });
}

function getOrcamentoDetalhe_(idOrcamento) {
  if (!idOrcamento) return { ok: false, erro: 'ID do orçamento não informado.' };

  const orcamentos = listarObjetos_(ABAS.ORCAMENTOS);
  const orc = orcamentos.find(function(x) {
    return String(x.ID_ORCAMENTO) === String(idOrcamento) ||
           String(x.NUMERO_ORCAMENTO) === String(idOrcamento);
  });

  if (!orc) return { ok: false, erro: 'Orçamento não encontrado.' };

  const itens = listarObjetos_(ABAS.ORCAMENTO_ITENS)
    .filter(function(x) { return String(x.ORCAMENTO_ID) === String(orc.ID_ORCAMENTO); })
    .sort(function(a,b) { return numero_(a.SEQ) - numero_(b.SEQ); });

  const componentes = listarObjetos_(ABAS.ORCAMENTO_COMPONENTES)
    .filter(function(x) { return String(x.ORCAMENTO_ID) === String(orc.ID_ORCAMENTO); });

  itens.forEach(function(item) {
    item.componentes = componentes
      .filter(function(c) { return String(c.ITEM_ID) === String(item.ID_ITEM); })
      .sort(function(a,b) { return numero_(a.ORDEM) - numero_(b.ORDEM); });
  });

  return { ok: true, orcamento: Object.assign({}, orc, { itens: itens }) };
}

function alterarStatusOrcamento_(idOrcamento, novoStatus) {
  if (!idOrcamento) throw new Error('ID do orçamento não informado.');

  const status = String(novoStatus || '').toUpperCase();
  if (status === 'ENVIADO' || status === 'APROVADO' || status === 'CONVERTIDO') {
    validarPrecoFinalOrcamentoSalvo_(idOrcamento);
  }

  const sh = aba_(ABAS.ORCAMENTOS);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.ID_ORCAMENTO, idOrcamento);
  if (!row) throw new Error('Orçamento não encontrado.');

  setCelulaPorHeader_(sh, headers, row, 'STATUS', status);
  setCelulaPorHeader_(sh, headers, row, 'DT_ATUALIZACAO', isoAgora_());

  return { ok: true, id_orcamento: idOrcamento, status: status };
}

function converterOrcamentoEmPedido_(idOrcamento) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!idOrcamento) throw new Error('ID do orçamento não informado.');

    const shOrc = aba_(ABAS.ORCAMENTOS);
    const hOrc = cabecalhos_(shOrc);
    const row = localizarLinha_(shOrc, hOrc.ID_ORCAMENTO, idOrcamento);
    if (!row) throw new Error('Orçamento não encontrado.');

    const orc = objetoDaLinha_(shOrc, row);
    if (String(orc.STATUS).toUpperCase() !== 'APROVADO') {
      throw new Error('Somente orçamento APROVADO pode ser convertido em pedido.');
    }
    if (orc.CONVERTIDO_PEDIDO_ID) {
      return { ok: true, ja_convertido: true, id_pedido: orc.CONVERTIDO_PEDIDO_ID };
    }

    const idPedido = novoId_('PED');
    const numeroPedido = proximoNumeroPedido_();
    const agora = isoAgora_();

    appendObjeto_(ABAS.PEDIDOS, {
      ID_PEDIDO: idPedido,
      NUMERO_PEDIDO: numeroPedido,
      DATA_PEDIDO: agora.substring(0, 10),
      ORCAMENTO_ID_ORIGEM: idOrcamento,
      NUMERO_ORCAMENTO_ORIGEM: orc.NUMERO_ORCAMENTO,
      CLIENTE_ID: orc.CLIENTE_ID,
      CLIENTE_NOME_SNAPSHOT: orc.CLIENTE_NOME_SNAPSHOT,
      CONTATO: orc.CONTATO,
      VENDEDOR: orc.VENDEDOR,
      COND_PAGAMENTO: orc.COND_PAGAMENTO,
      PRAZO_ENTREGA: orc.PRAZO_ENTREGA,
      VALOR_TOTAL: orc.VALOR_TOTAL,
      STATUS: 'ABERTO',
      DT_CONVERSAO: agora,
      DT_CRIACAO: agora,
      DT_ATUALIZACAO: agora,
      OBS: 'Gerado automaticamente pelo orçamento ' + orc.NUMERO_ORCAMENTO
    });

    const itens = listarObjetos_(ABAS.ORCAMENTO_ITENS).filter(function(x) {
      return String(x.ORCAMENTO_ID) === String(idOrcamento);
    });

    itens.forEach(function(item) {
      const qtd = numero_(item.QTDE);
      const valorTotal = numero_(item.PRECO_FINAL_TOTAL);
      if (!valorTotal || valorTotal <= 0) {
        throw new Error('Item sem PRECO_FINAL_TOTAL. O pedido só pode usar o preço efetivamente enviado ao cliente.');
      }
      const preco = qtd ? valorTotal / qtd : valorTotal;
      const custoTotal = numero_(item.CUSTO_TOTAL);

      appendObjeto_(ABAS.PEDIDO_ITENS, {
        ID_PEDIDO_ITEM: novoId_('PEDI'),
        PEDIDO_ID: idPedido,
        ORCAMENTO_ITEM_ID_ORIGEM: item.ID_ITEM,
        SEQ: item.SEQ,
        SKU: item.SKU,
        SEGMENTO_FINAL_ID: item.SEGMENTO_FINAL_ID || '',
        SEGMENTO_FINAL_SNAPSHOT: item.SEGMENTO_FINAL_SNAPSHOT || '',
        SEGMENTO_NEO_ID: item.SEGMENTO_NEO_ID || '',
        SEGMENTO_NEO_SNAPSHOT: item.SEGMENTO_NEO_SNAPSHOT || '',
        DESCRICAO: item.DESCRICAO,
        QTDE: qtd,
        PRECO_UNITARIO: preco,
        VALOR_TOTAL: valorTotal,
        CUSTO_UNIT_SNAPSHOT: qtd ? custoTotal / qtd : custoTotal,
        CUSTO_TOTAL_SNAPSHOT: custoTotal,
        DV_PCT_SNAPSHOT: numero_(item.DV_PCT),
        DV_VALOR_SNAPSHOT: numero_(item.DV_VALOR),
        DF_PCT_SNAPSHOT: numero_(item.DF_PCT),
        DF_VALOR_SNAPSHOT: numero_(item.DF_VALOR),
        LUCRO_BRUTO_SNAPSHOT: numero_(item.LUCRO_BRUTO),
        MARGEM_BRUTA_PCT_SNAPSHOT: numero_(item.MARGEM_BRUTA_PCT),
        LUCRO_SNAPSHOT: numero_(item.LUCRO_FINAL),
        MARGEM_PCT_SNAPSHOT: numero_(item.MARGEM_FINAL_PCT),
        STATUS: 'ABERTO',
        OBS: ''
      });
    });

    setCelulaPorHeader_(shOrc, hOrc, row, 'STATUS', 'CONVERTIDO');
    setCelulaPorHeader_(shOrc, hOrc, row, 'CONVERTIDO_PEDIDO_ID', idPedido);
    setCelulaPorHeader_(shOrc, hOrc, row, 'DT_ATUALIZACAO', agora);

    return {
      ok: true,
      id_pedido: idPedido,
      numero_pedido: numeroPedido,
      orcamento_id: idOrcamento
    };
  } finally {
    lock.releaseLock();
  }
}


function getClientePorId_(idCliente) {
  if (!idCliente) return null;
  const clientes = listarObjetos_(ABAS.CLIENTES);
  return clientes.find(function(c) {
    return String(c.ID_CLIENTE) === String(idCliente);
  }) || null;
}

function normalizarTipoVendaComercial_(tipo) {
  const t = normalizarTexto_(tipo);
  if (t === 'VENDA' || t === 'VENDA DE PRODUTO' || t === 'LOC - EQUIP_MAQ') return 'VENDA';
  if (t === 'REVENDA' || t === 'REVENDA DE PRODUTO') return 'REVENDA';
  if (t === 'SERVICO' || t === 'SERVIÇO' || t === 'SERVICO_14_01' || t === 'SERVICO_8_02' || t.indexOf('PSERV -') === 0) return 'SERVICO';
  throw new Error('Tipo de venda inválido: ' + tipo);
}

function destinoPorUf_(uf) {
  const estado = String(uf || '').trim().toUpperCase();
  if (!estado) throw new Error('UF não informada.');
  if (estado === 'SP') return 'INTERNA';

  const sulSudeste = ['MG','RJ','ES','PR','SC','RS'];
  if (sulSudeste.indexOf(estado) >= 0) return 'SUL/SUDESTE';

  return 'NORTE/NORDESTE/CENTRO OESTE';
}

function getImpostoPct_(enquadramento, destino, tipoTributario) {
  const regras = listarObjetos_(ABAS.TABELA_IMPOSTOS);
  const e = normalizarTexto_(enquadramento);
  const d = normalizarTexto_(destino);
  const t = normalizarTexto_(tipoTributario);

  const regra = regras.find(function(r) {
    return r.ATIVO !== false &&
           normalizarTexto_(r.ENQUADRAMENTO) === e &&
           normalizarTexto_(r.DESTINO) === d &&
           normalizarTexto_(r.TIPO_VENDA) === t;
  });

  if (!regra) {
    throw new Error('Regra de imposto não encontrada para ' + enquadramento + ' / ' + destino + ' / ' + tipoTributario);
  }

  return numero_(regra.IMPOSTOS_PCT);
}

function validarSegmentoTipo_(idSegmento, tipoEsperado) {
  const segmentos = listarObjetos_(ABAS.SEGMENTOS);
  const segmento = segmentos.find(function(s) {
    return String(s.ID_SEGMENTO) === String(idSegmento) &&
           String(s.TIPO || '').toUpperCase() === String(tipoEsperado || '').toUpperCase() &&
           s.ATIVO !== false;
  });

  if (!segmento) {
    throw new Error('Segmentação ' + tipoEsperado + ' inválida ou inativa: ' + idSegmento);
  }

  return segmento;
}

function validarPrecoFinalItensPayload_(itens) {
  itens.forEach(function(item) {
    const preco = numero_(item.PRECO_FINAL_TOTAL);
    if (!preco || preco <= 0) {
      throw new Error('Defina o preço final que será enviado ao cliente para todos os itens.');
    }
  });
}

function validarPrecoFinalOrcamentoSalvo_(idOrcamento) {
  const itens = listarObjetos_(ABAS.ORCAMENTO_ITENS).filter(function(item) {
    return String(item.ORCAMENTO_ID) === String(idOrcamento);
  });

  if (!itens.length) throw new Error('O orçamento não possui itens.');

  itens.forEach(function(item) {
    const preco = numero_(item.PRECO_FINAL_TOTAL);
    if (!preco || preco <= 0) {
      throw new Error('Existe item sem preço final definido. Informe o preço que será enviado ao cliente.');
    }
  });
}

function getVersaoParametrosAtiva_() {
  const versoes = listarObjetos_(ABAS.PARAMETRO_VERSOES);
  const ativas = versoes
    .filter(function(v) { return String(v.STATUS || '').toUpperCase() === 'ATIVO'; })
    .sort(function(a, b) {
      return String(b.DATA_INICIO || '').localeCompare(String(a.DATA_INICIO || ''));
    });
  return ativas.length ? ativas[0] : null;
}

function getVersaoParametrosPorId_(idVersao) {
  if (!idVersao) return null;
  const versoes = listarObjetos_(ABAS.PARAMETRO_VERSOES);
  for (let i = 0; i < versoes.length; i++) {
    if (String(versoes[i].ID_VERSAO) === String(idVersao)) return versoes[i];
  }
  return null;
}

function getCustosHoraVersaoAtiva_() {
  const versao = getVersaoParametrosAtiva_();
  if (!versao) return [];
  return listarObjetos_(ABAS.CUSTO_HORA_VERSOES).filter(function(x) {
    return String(x.VERSAO_ID) === String(versao.ID_VERSAO) && x.ATIVO !== false;
  });
}

function getCustoHoraNaVersao_(idVersao, processo) {
  if (!processo) return 0;
  const alvo = normalizarTexto_(processo);
  const custos = listarObjetos_(ABAS.CUSTO_HORA_VERSOES);

  for (let i = 0; i < custos.length; i++) {
    if (String(custos[i].VERSAO_ID) !== String(idVersao)) continue;
    if (normalizarTexto_(custos[i].PROCESSO) === alvo) return numero_(custos[i].CUSTO_HORA);
  }

  throw new Error('Custo/hora não encontrado para "' + processo + '" na versão ' + idVersao);
}

function sincronizarParametrosCustos_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const origem = SpreadsheetApp.openById(CUSTOS_ORIGEM_SPREADSHEET_ID);
    const shDados = origem.getSheetByName('DADOS');
    const shCustoHora = origem.getSheetByName('CUSTO HORA');

    if (!shDados || !shCustoHora) {
      throw new Error('A planilha de custos precisa possuir as abas DADOS e CUSTO HORA.');
    }

    const despesaFixa = numero_(shDados.getRange('X2').getValue());
    const lastRow = Math.max(shCustoHora.getLastRow(), 1);
    const custoHoraRaw = shCustoHora.getRange(1, 1, lastRow, 2).getValues()
      .filter(function(r) { return String(r[0] || '').trim() !== ''; })
      .map(function(r) {
        return { PROCESSO: String(r[0]).trim(), CUSTO_HORA: numero_(r[1]) };
      });

    const ativa = getVersaoParametrosAtiva_();
    const atualCustos = ativa
      ? listarObjetos_(ABAS.CUSTO_HORA_VERSOES).filter(function(x) {
          return String(x.VERSAO_ID) === String(ativa.ID_VERSAO) && x.ATIVO !== false;
        })
      : [];

    if (ativa && parametrosIguais_(ativa, atualCustos, despesaFixa, custoHoraRaw)) {
      return {
        ok: true,
        alterado: false,
        versao_atual: ativa.ID_VERSAO,
        mensagem: 'Nenhuma alteração encontrada na planilha de custos.'
      };
    }

    const agora = isoAgora_();
    const novaVersao = 'PV-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    // Encerra a versão anterior, sem apagar nem alterar os valores que já foram usados.
    if (ativa) {
      const shVersoes = aba_(ABAS.PARAMETRO_VERSOES);
      const hVersoes = cabecalhos_(shVersoes);
      const rowVersao = localizarLinha_(shVersoes, hVersoes.ID_VERSAO, ativa.ID_VERSAO);
      if (rowVersao) {
        setCelulaPorHeader_(shVersoes, hVersoes, rowVersao, 'DATA_FIM', agora);
        setCelulaPorHeader_(shVersoes, hVersoes, rowVersao, 'STATUS', 'ENCERRADA');
      }

      const shCH = aba_(ABAS.CUSTO_HORA_VERSOES);
      const hCH = cabecalhos_(shCH);
      const dadosCH = shCH.getDataRange().getValues();
      for (let r = 1; r < dadosCH.length; r++) {
        if (String(dadosCH[r][hCH.VERSAO_ID - 1]) === String(ativa.ID_VERSAO)) {
          shCH.getRange(r + 1, hCH.DATA_FIM).setValue(agora);
          shCH.getRange(r + 1, hCH.ATIVO).setValue(false);
        }
      }
    }

    appendObjeto_(ABAS.PARAMETRO_VERSOES, {
      ID_VERSAO: novaVersao,
      DATA_INICIO: agora,
      DATA_FIM: '',
      STATUS: 'ATIVO',
      DESPESA_FIXA_PCT: despesaFixa,
      ORIGEM_SPREADSHEET_ID: CUSTOS_ORIGEM_SPREADSHEET_ID,
      ORIGEM_TITULO: CUSTOS_ORIGEM_TITULO,
      DT_IMPORTACAO: agora,
      HASH_REFERENCIA: hashParametros_(despesaFixa, custoHoraRaw),
      OBS: 'Criada automaticamente após detectar mudança na planilha de custos.'
    });

    custoHoraRaw.forEach(function(x) {
      appendObjeto_(ABAS.CUSTO_HORA_VERSOES, {
        ID_REGISTRO: novoId_('CHV'),
        VERSAO_ID: novaVersao,
        DATA_INICIO: agora,
        DATA_FIM: '',
        PROCESSO: x.PROCESSO,
        CUSTO_HORA: x.CUSTO_HORA,
        ATIVO: true,
        ORIGEM_SPREADSHEET_ID: CUSTOS_ORIGEM_SPREADSHEET_ID,
        DT_IMPORTACAO: agora,
        OBS: ''
      });
    });

    atualizarConfig_('PARAMETRO_VERSAO_ATIVA', novaVersao);

    return {
      ok: true,
      alterado: true,
      versao_anterior: ativa ? ativa.ID_VERSAO : null,
      versao_nova: novaVersao,
      despesa_fixa_pct: despesaFixa,
      processos: custoHoraRaw.length
    };
  } finally {
    lock.releaseLock();
  }
}

function parametrosIguais_(ativa, custosAtuais, despesaNova, custosNovos) {
  if (Math.abs(numero_(ativa.DESPESA_FIXA_PCT) - numero_(despesaNova)) > 0.000000001) return false;

  const mapaAtual = {};
  custosAtuais.forEach(function(x) {
    mapaAtual[normalizarTexto_(x.PROCESSO)] = numero_(x.CUSTO_HORA);
  });

  if (Object.keys(mapaAtual).length !== custosNovos.length) return false;

  for (let i = 0; i < custosNovos.length; i++) {
    const chave = normalizarTexto_(custosNovos[i].PROCESSO);
    if (!Object.prototype.hasOwnProperty.call(mapaAtual, chave)) return false;
    if (Math.abs(mapaAtual[chave] - numero_(custosNovos[i].CUSTO_HORA)) > 0.000001) return false;
  }

  return true;
}

function hashParametros_(despesaFixa, custos) {
  const payload = JSON.stringify({
    despesa_fixa: numero_(despesaFixa),
    custos: custos.map(function(x) {
      return [normalizarTexto_(x.PROCESSO), numero_(x.CUSTO_HORA)];
    })
  });
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload, Utilities.Charset.UTF_8);
  return digest.map(function(b) {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function atualizarConfig_(chave, valor) {
  const sh = aba_(ABAS.CONFIG);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.CHAVE, chave);
  if (row) {
    setCelulaPorHeader_(sh, headers, row, 'VALOR', valor);
  } else {
    appendObjeto_(ABAS.CONFIG, {
      CHAVE: chave,
      VALOR: valor,
      DESCRICAO: '',
      ATIVO: true
    });
  }
}

function normalizarTexto_(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function getDashboardHistorico_() {
  const sh = aba_(ABAS.RAW);
  const dados = sh.getDataRange().getValues();
  if (dados.length < 2) return { ok: true, registros: 0 };

  const h = indiceCabecalhos_(dados[0]);
  let faturamento = 0;
  let custo = 0;
  let qtde = 0;
  const porAno = {};
  const porEstado = {};

  dados.slice(1).forEach(function(r) {
    const valor = numero_(r[h['VALOR DO PEDIDO']]);
    const q = numero_(r[h['QTDE.']]);
    const cUnit = numero_(r[h['UNIT CUSTO']]);
    const ano = String(r[h['ANO']] || '');
    const uf = String(r[h['ESTADO']] || 'N/I');

    faturamento += valor;
    custo += q * cUnit;
    qtde += q;

    if (!porAno[ano]) porAno[ano] = { faturamento: 0, custo: 0, registros: 0 };
    porAno[ano].faturamento += valor;
    porAno[ano].custo += q * cUnit;
    porAno[ano].registros++;

    if (!porEstado[uf]) porEstado[uf] = { faturamento: 0, registros: 0 };
    porEstado[uf].faturamento += valor;
    porEstado[uf].registros++;
  });

  const lucro = faturamento - custo;

  return {
    ok: true,
    origem: 'RAW_VENDAS_HISTORICO',
    registros: dados.length - 1,
    qtde_total: qtde,
    faturamento: faturamento,
    custo: custo,
    lucro_bruto: lucro,
    margem_bruta: faturamento ? lucro / faturamento : 0,
    por_ano: porAno,
    por_estado: porEstado
  };
}

function listarObjetos_(nomeAba) {
  const sh = aba_(nomeAba);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values.slice(1)
    .filter(function(r) { return r.some(function(v) { return v !== '' && v !== null; }); })
    .map(function(r) {
      const o = {};
      headers.forEach(function(h, i) { o[h] = r[i]; });
      return o;
    });
}

function appendObjeto_(nomeAba, obj) {
  const sh = aba_(nomeAba);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(function(h) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
  });
  sh.appendRow(row);
}

function appendObjetos_(nomeAba, objetos) {
  if (!Array.isArray(objetos) || !objetos.length) return;

  const sh = aba_(nomeAba);
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const rows = objetos.map(function(obj) {
    return headers.map(function(h) {
      return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : '';
    });
  });

  const startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
}

function escreverObjetoNaLinha_(sh, row, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const atual = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  const valores = headers.map(function(h, i) {
    return Object.prototype.hasOwnProperty.call(obj, h) ? obj[h] : atual[i];
  });
  sh.getRange(row, 1, 1, headers.length).setValues([valores]);
}

function deletarLinhasPorValor_(nomeAba, nomeColuna, valor) {
  const sh = aba_(nomeAba);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const headers = cabecalhos_(sh);
  const col = headers[nomeColuna];
  if (!col) throw new Error('Coluna não encontrada em ' + nomeAba + ': ' + nomeColuna);

  const vals = sh.getRange(2, col, lastRow - 1, 1).getValues();
  const rows = [];

  vals.forEach(function(r, i) {
    if (String(r[0]) === String(valor)) rows.push(i + 2);
  });

  if (!rows.length) return;

  // Exclui em blocos contíguos, de baixo para cima, reduzindo chamadas ao Sheets.
  const blocos = [];
  let inicio = rows[0];
  let anterior = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i] === anterior + 1) {
      anterior = rows[i];
    } else {
      blocos.push([inicio, anterior]);
      inicio = anterior = rows[i];
    }
  }
  blocos.push([inicio, anterior]);

  blocos.reverse().forEach(function(b) {
    sh.deleteRows(b[0], b[1] - b[0] + 1);
  });
}

function objetoDaLinha_(sh, row) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const values = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function(h, i) { obj[h] = values[i]; });
  return obj;
}

function cabecalhos_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach(function(h, i) { map[String(h)] = i + 1; });
  return map;
}

function indiceCabecalhos_(headers) {
  const map = {};
  headers.forEach(function(h, i) { map[String(h)] = i; });
  return map;
}

function localizarLinha_(sh, coluna, valor) {
  if (!coluna || sh.getLastRow() < 2) return 0;
  const vals = sh.getRange(2, coluna, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(valor)) return i + 2;
  }
  return 0;
}

function setCelulaPorHeader_(sh, headers, row, header, value) {
  const col = headers[header];
  if (!col) throw new Error('Coluna não encontrada: ' + header);
  sh.getRange(row, col).setValue(value);
}

function proximoNumeroOrcamento_() {
  return proximoSequencial_(ABAS.ORCAMENTOS, 'NUMERO_ORCAMENTO', 1001);
}

function proximoNumeroOrcamentoSeguro_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) {
    throw new Error('O sistema está gerando outro número de orçamento. Tente salvar novamente em alguns segundos.');
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const chave = 'NEOSONICS_ORC_SEQ';
    const salvo = Number(props.getProperty(chave) || 0);

    let proximo;
    if (salvo > 0) {
      proximo = salvo + 1;
    } else {
      proximo = proximoNumeroOrcamento_();
    }

    props.setProperty(chave, String(proximo));
    return proximo;
  } finally {
    lock.releaseLock();
  }
}

function proximoNumeroPedido_() {
  const n = proximoSequencial_(ABAS.PEDIDOS, 'NUMERO_PEDIDO', 1);
  return 'PED-' + Utilities.formatString('%05d', n);
}

function proximoSequencial_(nomeAba, header, inicio) {
  const dados = listarObjetos_(nomeAba);
  let max = inicio - 1;

  dados.forEach(function(o) {
    const raw = String(o[header] || '');
    const match = raw.match(/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  });

  return max + 1;
}

function novoId_(prefixo) {
  return prefixo + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}

let DB_CACHE_ = null;

function db_() {
  if (!DB_CACHE_) DB_CACHE_ = SpreadsheetApp.openById(DB_SPREADSHEET_ID);
  return DB_CACHE_;
}

function aba_(nome) {
  const sh = db_().getSheetByName(nome);
  if (!sh) throw new Error('Aba não encontrada: ' + nome);
  return sh;
}

function numero_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v === null || v === undefined || v === '') return 0;

  let s = String(v).trim();
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.indexOf(',') >= 0) {
    s = s.replace(',', '.');
  }
  s = s.replace(/[^\d.-]/g, '');

  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function isoAgora_() {
  return new Date().toISOString();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
