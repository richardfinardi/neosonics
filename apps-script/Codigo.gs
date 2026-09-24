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
        return json_({ ok: true, sistema: 'NEOSONICS', versao: '0.2.0' });

      case 'bootstrap':
        return json_(getBootstrap_());

      case 'clientes':
        return json_({ ok: true, dados: listarObjetos_(ABAS.CLIENTES) });

      case 'orcamentos':
        return json_({ ok: true, dados: listarObjetos_(ABAS.ORCAMENTOS) });

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

      case 'salvar_orcamento':
        return json_(salvarOrcamento_(body.orcamento || {}));

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
    produtos: listarObjetos_(ABAS.PRODUTOS),
    processos: listarObjetos_(ABAS.PROCESSOS_CUSTO),
    impostos: listarObjetos_(ABAS.TABELA_IMPOSTOS),
    parametro_versao_ativa: getVersaoParametrosAtiva_(),
    custos_hora_ativos: getCustosHoraVersaoAtiva_(),
    config: listarObjetos_(ABAS.CONFIG)
  };
}

function salvarCliente_(cliente) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!cliente.RAZAO_SOCIAL && !cliente.NOME_FANTASIA) {
      throw new Error('Informe a razão social ou nome fantasia.');
    }

    const novo = Object.assign({}, cliente);
    novo.ID_CLIENTE = novo.ID_CLIENTE || novoId_('CLI');
    novo.ATIVO = novo.ATIVO !== false;
    novo.DT_CADASTRO = novo.DT_CADASTRO || isoAgora_();

    appendObjeto_(ABAS.CLIENTES, novo);
    return { ok: true, cliente: novo };
  } finally {
    lock.releaseLock();
  }
}

function salvarOrcamento_(orcamento) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const itens = Array.isArray(orcamento.itens) ? orcamento.itens : [];
    if (!orcamento.CLIENTE_ID) throw new Error('CLIENTE_ID é obrigatório.');
    if (!itens.length) throw new Error('O orçamento precisa ter pelo menos um item.');

    const idOrcamento = orcamento.ID_ORCAMENTO || novoId_('ORC');
    const numero = orcamento.NUMERO_ORCAMENTO || proximoNumeroOrcamento_();
    const agora = isoAgora_();

    // Regra de versionamento:
    // - orçamento novo fixa a versão vigente naquele momento;
    // - orçamento já criado continua usando sua versão original;
    // - atualização global de custos nunca recalcula orçamento antigo automaticamente.
    const versaoParametros = orcamento.PARAMETRO_VERSAO_ID
      ? getVersaoParametrosPorId_(orcamento.PARAMETRO_VERSAO_ID)
      : getVersaoParametrosAtiva_();

    if (!versaoParametros) {
      throw new Error('Nenhuma versão de parâmetros de custo está ativa.');
    }

    const cab = Object.assign({}, orcamento, {
      ID_ORCAMENTO: idOrcamento,
      NUMERO_ORCAMENTO: numero,
      VERSAO: orcamento.VERSAO || 1,
      DATA_ORCAMENTO: orcamento.DATA_ORCAMENTO || agora.substring(0, 10),
      STATUS: orcamento.STATUS || 'RASCUNHO',
      PARAMETRO_VERSAO_ID: versaoParametros.ID_VERSAO,
      DESPESA_FIXA_PCT: orcamento.DESPESA_FIXA_PCT !== undefined && orcamento.DESPESA_FIXA_PCT !== ''
        ? orcamento.DESPESA_FIXA_PCT
        : versaoParametros.DESPESA_FIXA_PCT,
      FONTE_PARAMETROS: orcamento.FONTE_PARAMETROS || versaoParametros.ORIGEM_TITULO || CUSTOS_ORIGEM_TITULO,
      DT_CRIACAO: orcamento.DT_CRIACAO || agora,
      DT_ATUALIZACAO: agora,
      CONVERTIDO_PEDIDO_ID: orcamento.CONVERTIDO_PEDIDO_ID || ''
    });
    delete cab.itens;

    appendObjeto_(ABAS.ORCAMENTOS, cab);

    itens.forEach(function(item, idx) {
      const idItem = item.ID_ITEM || novoId_('ORI');
      const linhaItem = Object.assign({}, item, {
        ID_ITEM: idItem,
        ORCAMENTO_ID: idOrcamento,
        SEQ: item.SEQ || (idx + 1),
        STATUS: item.STATUS || 'ATIVO'
      });
      delete linhaItem.componentes;
      appendObjeto_(ABAS.ORCAMENTO_ITENS, linhaItem);

      const componentes = Array.isArray(item.componentes) ? item.componentes : [];
      componentes.forEach(function(comp, compIdx) {
        const linhaComp = Object.assign({}, comp, {
          ID_COMPONENTE: comp.ID_COMPONENTE || novoId_('ORC-CMP'),
          ORCAMENTO_ID: idOrcamento,
          ITEM_ID: idItem,
          ORDEM: comp.ORDEM || (compIdx + 1),
          ATIVO: comp.ATIVO !== false
        });

        // Para mão de obra/processo produtivo, congela o custo/hora da versão do orçamento.
        const tipo = String(linhaComp.TIPO_COMPONENTE || '').toUpperCase();
        if ((tipo === 'MO' || tipo === 'PROCESSO' || tipo === 'PROCESSO_PRODUTIVO') &&
            (!linhaComp.CUSTO_HORA && linhaComp.CUSTO_HORA !== 0)) {
          linhaComp.CUSTO_HORA = getCustoHoraNaVersao_(versaoParametros.ID_VERSAO, linhaComp.DESCRICAO);
        }

        // Replica a regra atual da calculadora:
        // custo processo = (horas setup * custo/hora) + (horas/peça * custo/hora * quantidade do item)
        if ((tipo === 'MO' || tipo === 'PROCESSO' || tipo === 'PROCESSO_PRODUTIVO') &&
            (linhaComp.CUSTO_TOTAL === undefined || linhaComp.CUSTO_TOTAL === '')) {
          linhaComp.CUSTO_TOTAL =
            numero_(linhaComp.HORAS_SETUP) * numero_(linhaComp.CUSTO_HORA) +
            numero_(linhaComp.HORAS_PECA) * numero_(linhaComp.CUSTO_HORA) * numero_(item.QTDE);
        }

        appendObjeto_(ABAS.ORCAMENTO_COMPONENTES, linhaComp);
      });
    });

    return {
      ok: true,
      id_orcamento: idOrcamento,
      numero_orcamento: numero,
      status: cab.STATUS
    };
  } finally {
    lock.releaseLock();
  }
}

function alterarStatusOrcamento_(idOrcamento, novoStatus) {
  if (!idOrcamento) throw new Error('ID do orçamento não informado.');

  const sh = aba_(ABAS.ORCAMENTOS);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.ID_ORCAMENTO, idOrcamento);
  if (!row) throw new Error('Orçamento não encontrado.');

  setCelulaPorHeader_(sh, headers, row, 'STATUS', novoStatus);
  setCelulaPorHeader_(sh, headers, row, 'DT_ATUALIZACAO', isoAgora_());

  return { ok: true, id_orcamento: idOrcamento, status: novoStatus };
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
      const preco = numero_(item.PRECO_APROVADO || item.PRECO_SUGERIDO || item.PRECO_OBJETIVO);
      const custoTotal = numero_(item.CUSTO_TOTAL);
      const valorTotal = qtd * preco;

      appendObjeto_(ABAS.PEDIDO_ITENS, {
        ID_PEDIDO_ITEM: novoId_('PEDI'),
        PEDIDO_ID: idPedido,
        ORCAMENTO_ITEM_ID_ORIGEM: item.ID_ITEM,
        SEQ: item.SEQ,
        SKU: item.SKU,
        DESCRICAO: item.DESCRICAO,
        QTDE: qtd,
        PRECO_UNITARIO: preco,
        VALOR_TOTAL: valorTotal,
        CUSTO_UNIT_SNAPSHOT: qtd ? custoTotal / qtd : custoTotal,
        CUSTO_TOTAL_SNAPSHOT: custoTotal,
        LUCRO_SNAPSHOT: valorTotal - custoTotal,
        MARGEM_PCT_SNAPSHOT: valorTotal ? (valorTotal - custoTotal) / valorTotal : 0,
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

function aba_(nome) {
  const sh = SpreadsheetApp.openById(DB_SPREADSHEET_ID).getSheetByName(nome);
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
