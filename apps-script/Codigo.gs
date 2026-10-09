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
  IMPORT_LOG: 'IMPORT_LOG',
  TERMOS_PROPOSTA: 'TERMOS_PROPOSTA'
});

function cacheEpoch_() {
  return PropertiesService.getScriptProperties().getProperty('NEOSONICS_CACHE_EPOCH') || '1';
}

function bumpCacheEpoch_() {
  const epoch = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('NEOSONICS_CACHE_EPOCH', epoch);
  return epoch;
}

function dadosAbaCacheados_(nomeAba, ttlSegundos) {
  return cacheLeitura_('aba:' + String(nomeAba || ''), ttlSegundos || 300, function() {
    return listarObjetos_(nomeAba);
  });
}

function cacheLeitura_(chave, ttlSegundos, produtor) {
  const fullKey = 'ns5:' + cacheEpoch_() + ':' + String(chave || '');
  let cache = null;

  try {
    cache = CacheService.getScriptCache();
    const hit = cache.get(fullKey);
    if (hit) return JSON.parse(hit);
  } catch (cacheReadErr) {}

  const dados = produtor();

  try {
    if (cache) {
      const payload = JSON.stringify(dados);
      if (payload.length < 90000) cache.put(fullKey, payload, ttlSegundos || 120);
    }
  } catch (cacheWriteErr) {}

  return dados;
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const acao = String(p.acao || 'ping').toLowerCase();

    switch (acao) {
      case 'ping':
        return json_({ ok: true, sistema: 'NEOSONICS', versao: '1.5.0' });

      case 'bootstrap':
        return json_(cacheLeitura_('bootstrap', 300, function() {
          return getBootstrap_();
        }));

      case 'clientes':
        return json_(cacheLeitura_('clientes', 300, function() {
          return { ok: true, dados: listarClientes_() };
        }));

      case 'consultar_cnpj':
        return json_(consultarCnpj_(p.cnpj || ''));

      case 'map_clientes':
        return json_(cacheLeitura_('map_clientes', 180, function() {
          return { ok: true, dados: listarMapClientes_() };
        }));

      case 'segmentos':
        return json_(cacheLeitura_('segmentos', 300, function() {
          return { ok: true, dados: listarSegmentos_() };
        }));

      case 'termos_proposta':
        return json_(cacheLeitura_('termos_proposta', 300, function() {
          return { ok: true, dados: listarTermosProposta_() };
        }));

      case 'orcamentos':
        return json_(cacheLeitura_('orcamentos', 120, function() {
          return { ok: true, dados: listarOrcamentosResumo_() };
        }));

      case 'orcamento_detalhe': {
        const idOrc = String(p.id || '');
        return json_(cacheLeitura_('orcamento_detalhe:' + idOrc, 300, function() {
          return getOrcamentoDetalhe_(idOrc);
        }));
      }

      case 'pedidos':
        return json_(cacheLeitura_('pedidos', 120, function() {
          return { ok: true, dados: listarPedidosResumo_() };
        }));

      case 'vendas_snapshot':
        return json_(cacheLeitura_('vendas_snapshot', 120, function() {
          return { ok: true, dados: listarObjetos_(ABAS.VENDAS) };
        }));

      case 'pedidos_snapshot':
        return json_(cacheLeitura_('pedidos_snapshot', 120, function() {
          return {
            ok: true,
            pedidos: listarObjetos_(ABAS.PEDIDOS),
            itens: listarObjetos_(ABAS.PEDIDO_ITENS)
          };
        }));

      case 'pedido_detalhe': {
        const idPed = String(p.id || '');
        return json_(cacheLeitura_('pedido_detalhe:' + idPed, 300, function() {
          return getPedidoDetalhe_(idPed);
        }));
      }

      case 'dashboard':
        return json_(getDashboardVendas_(p));

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
    let resultado;

    switch (acao) {
      case 'salvar_cliente':
        resultado = salvarCliente_(body.cliente || {});
        break;

      case 'salvar_segmento':
        resultado = salvarSegmento_(body.segmento || {});
        break;

      case 'salvar_mapeamento_cliente':
        resultado = salvarMapeamentoCliente_(body.chave_origem, body.id_cliente_oficial);
        break;

      case 'criar_cliente_mapeamento':
        resultado = criarClienteDoMapeamento_(body.chave_origem);
        break;

      case 'resolver_grupo_cliente':
        resultado = resolverGrupoCliente_(body.cod_cliente_origem, body.modo, body.nome_oficial, body.id_cliente_oficial);
        break;

      case 'salvar_orcamento':
        resultado = salvarOrcamento_(body.orcamento || {});
        break;

      case 'enviar_orcamento':
        resultado = alterarStatusOrcamento_(body.id_orcamento, 'ENVIADO');
        break;

      case 'aprovar_orcamento':
        resultado = aprovarOrcamentoEGerarPedido_(body.id_orcamento);
        break;

      case 'recusar_orcamento':
        resultado = alterarStatusOrcamento_(body.id_orcamento, 'RECUSADO');
        break;

      case 'perder_orcamento':
        resultado = perderOrcamento_(body.id_orcamento);
        break;

      case 'salvar_termo_proposta':
        resultado = salvarTermoProposta_(body.termo || {});
        break;

      case 'converter_orcamento_pedido':
        resultado = converterOrcamentoEmPedido_(body.id_orcamento);
        break;

      case 'alterar_status_pedido':
        resultado = alterarStatusPedido_(body.id_pedido, body.status);
        break;

      case 'excluir_pedido':
        resultado = excluirPedido_(body.id_pedido);
        break;

      case 'criar_pedido_rapido':
        resultado = criarPedidoRapido_(body.pedido || {});
        break;

      case 'sincronizar_parametros_custos':
        resultado = sincronizarParametrosCustos_();
        break;

      default:
        return json_({ ok: false, erro: 'Ação POST inválida: ' + acao });
    }

    if (!resultado || resultado.ok !== false) bumpCacheEpoch_();
    return json_(resultado);
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
    termos_proposta: listarTermosProposta_(),
    impostos: listarObjetos_(ABAS.TABELA_IMPOSTOS),
    parametro_versao_ativa: getVersaoParametrosAtiva_(),
    custos_hora_ativos: getCustosHoraVersaoAtiva_()
  };
}


function garantirAbaTermosProposta_() {
  const ss = db_();
  let sh = ss.getSheetByName(ABAS.TERMOS_PROPOSTA);
  if (sh) return sh;

  sh = ss.insertSheet(ABAS.TERMOS_PROPOSTA);
  const headers = [
    'ID_TERMO','CODIGO','NOME','TEXTO','ATIVO','ORDEM','DT_CRIACAO','DT_ATUALIZACAO'
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function listarTermosProposta_() {
  garantirAbaTermosProposta_();
  return listarObjetos_(ABAS.TERMOS_PROPOSTA)
    .sort(function(a,b) {
      const oa = numero_(a.ORDEM || 9999);
      const ob = numero_(b.ORDEM || 9999);
      if (oa !== ob) return oa - ob;
      return String(a.NOME || '').localeCompare(String(b.NOME || ''), 'pt-BR');
    });
}

function salvarTermoProposta_(termo) {
  const sh = garantirAbaTermosProposta_();
  const headers = cabecalhos_(sh);
  const agora = isoAgora_();
  const nome = String(termo.NOME || '').trim();
  const texto = String(termo.TEXTO || '').trim();

  if (!nome) throw new Error('Informe o nome do modelo.');
  if (!texto) throw new Error('Informe o texto dos termos.');

  let codigo = String(termo.CODIGO || '').trim().toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!codigo) codigo = 'TERMO_' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();

  let id = String(termo.ID_TERMO || '').trim();
  let row = id && headers.ID_TERMO ? localizarLinha_(sh, headers.ID_TERMO, id) : null;

  if (!row && headers.CODIGO) {
    row = localizarLinha_(sh, headers.CODIGO, codigo);
    if (row) {
      const existente = objetoDaLinha_(sh, row);
      id = String(existente.ID_TERMO || id || novoId_('TRM'));
    }
  }

  if (!id) id = novoId_('TRM');

  let ordem = numero_(termo.ORDEM);
  if (!ordem) {
    ordem = listarTermosProposta_().reduce(function(max, x) {
      return Math.max(max, numero_(x.ORDEM));
    }, 0) + 1;
  }

  const obj = {
    ID_TERMO: id,
    CODIGO: codigo,
    NOME: nome,
    TEXTO: texto,
    ATIVO: termo.ATIVO !== false,
    ORDEM: ordem,
    DT_CRIACAO: termo.DT_CRIACAO || (row ? objetoDaLinha_(sh, row).DT_CRIACAO : agora) || agora,
    DT_ATUALIZACAO: agora
  };

  if (row) escreverObjetoNaLinha_(sh, row, obj);
  else appendObjeto_(ABAS.TERMOS_PROPOSTA, obj);

  SpreadsheetApp.flush();
  return { ok:true, termo:obj, atualizado:!!row };
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

function autorizarConsultaCnpj() {
  const resp = UrlFetchApp.fetch('https://brasilapi.com.br/api/cep/v1/01001000', {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true
  });
  return 'Autorização concluída. HTTP ' + resp.getResponseCode();
}

function consultarCnpj_(cnpjInformado) {
  const cnpj = somenteDigitos_(cnpjInformado);
  if (cnpj.length !== 14) throw new Error('Informe um CNPJ com 14 dígitos.');
  if (!validarCnpj_(cnpj)) throw new Error('CNPJ inválido.');

  const existente = listarObjetos_(ABAS.CLIENTES).find(function(c) {
    return somenteDigitos_(c.CNPJ_CPF) === cnpj;
  });

  const erros = [];

  try {
    const url = 'https://brasilapi.com.br/api/cnpj/v1/' + encodeURIComponent(cnpj);
    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'Accept': 'application/json', 'User-Agent': 'NEOSONICS/1.0' }
    });

    if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
    const j = JSON.parse(resp.getContentText() || '{}');

    return {
      ok: true,
      dados: {
        cnpj: formatarCnpj_(somenteDigitos_(j.cnpj || cnpj)),
        razao_social: j.razao_social || '',
        nome_fantasia: j.nome_fantasia || '',
        uf: j.uf || '',
        cidade: j.municipio || '',
        cep: somenteDigitos_(j.cep || ''),
        logradouro: [j.descricao_tipo_de_logradouro, j.logradouro].filter(String).join(' ').trim(),
        numero: j.numero || '',
        complemento: j.complemento || '',
        bairro: j.bairro || '',
        situacao_cadastral: j.descricao_situacao_cadastral || j.situacao_cadastral || '',
        cnae_principal: j.cnae_fiscal || '',
        cnae_principal_descricao: j.cnae_fiscal_descricao || '',
        email: j.email || '',
        telefone: j.ddd_telefone_1 || j.ddd_telefone_2 || '',
        fonte: 'BrasilAPI',
        dt_consulta: isoAgora_(),
        ja_cadastrado: existente ? {
          ID_CLIENTE: existente.ID_CLIENTE,
          NOME: existente.NOME_FANTASIA || existente.RAZAO_SOCIAL || ''
        } : null
      }
    };
  } catch (err) {
    erros.push('BrasilAPI: ' + err.message);
  }

  try {
    const url = 'https://publica.cnpj.ws/cnpj/' + encodeURIComponent(cnpj);
    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'Accept': 'application/json', 'User-Agent': 'NEOSONICS/1.0' }
    });

    if (resp.getResponseCode() !== 200) throw new Error('HTTP ' + resp.getResponseCode());
    const j = JSON.parse(resp.getContentText() || '{}');
    const e = j.estabelecimento || {};
    const atividade = e.atividade_principal || {};
    const estado = e.estado || {};
    const cidade = e.cidade || {};
    const telefone = (e.ddd1 || e.telefone1)
      ? ((e.ddd1 ? '(' + e.ddd1 + ') ' : '') + (e.telefone1 || ''))
      : ((e.ddd2 ? '(' + e.ddd2 + ') ' : '') + (e.telefone2 || ''));

    return {
      ok: true,
      dados: {
        cnpj: formatarCnpj_(somenteDigitos_(e.cnpj || cnpj)),
        razao_social: j.razao_social || '',
        nome_fantasia: e.nome_fantasia || '',
        uf: estado.sigla || '',
        cidade: cidade.nome || '',
        cep: somenteDigitos_(e.cep || ''),
        logradouro: [e.tipo_logradouro, e.logradouro].filter(String).join(' ').trim(),
        numero: e.numero || '',
        complemento: e.complemento || '',
        bairro: e.bairro || '',
        situacao_cadastral: e.situacao_cadastral || '',
        cnae_principal: atividade.id || atividade.subclasse || '',
        cnae_principal_descricao: atividade.descricao || '',
        email: e.email || '',
        telefone: telefone,
        fonte: 'CNPJ.ws',
        dt_consulta: isoAgora_(),
        ja_cadastrado: existente ? {
          ID_CLIENTE: existente.ID_CLIENTE,
          NOME: existente.NOME_FANTASIA || existente.RAZAO_SOCIAL || ''
        } : null
      }
    };
  } catch (err) {
    erros.push('CNPJ.ws: ' + err.message);
  }

  throw new Error('Não foi possível consultar o CNPJ. ' + erros.join(' | '));
}

function somenteDigitos_(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function formatarCnpj_(cnpj) {
  const d = somenteDigitos_(cnpj);
  if (d.length !== 14) return d;
  return d.substring(0,2) + '.' + d.substring(2,5) + '.' + d.substring(5,8) + '/' + d.substring(8,12) + '-' + d.substring(12);
}

function validarCnpj_(cnpj) {
  const d = somenteDigitos_(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;

  function digito(base, pesos) {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) soma += Number(base.charAt(i)) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  const d1 = digito(d.substring(0,12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  if (d1 !== Number(d.charAt(12))) return false;

  const d2 = digito(d.substring(0,13), [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return d2 === Number(d.charAt(13));
}

function salvarCliente_(cliente) {
  if (!cliente.RAZAO_SOCIAL && !cliente.NOME_FANTASIA) {
    throw new Error('Informe a razão social ou nome fantasia.');
  }

  const sh = aba_(ABAS.CLIENTES);
  const headers = cabecalhos_(sh);
  const agora = isoAgora_();

  const novo = Object.assign({}, cliente);

  const docNormalizado = somenteDigitos_(novo.CNPJ_CPF);
  if (docNormalizado.length === 14) {
    if (!validarCnpj_(docNormalizado)) throw new Error('CNPJ inválido.');

    const duplicadoCnpj = listarObjetos_(ABAS.CLIENTES).find(function(c) {
      return String(c.ID_CLIENTE || '') !== String(novo.ID_CLIENTE || '') &&
             somenteDigitos_(c.CNPJ_CPF) === docNormalizado;
    });

    if (duplicadoCnpj) {
      const nomeDup = duplicadoCnpj.NOME_FANTASIA || duplicadoCnpj.RAZAO_SOCIAL || duplicadoCnpj.ID_CLIENTE;
      throw new Error('Este CNPJ já está cadastrado para: ' + nomeDup);
    }

    novo.CNPJ_CPF = formatarCnpj_(docNormalizado);
  }

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

// Evolução idempotente das abas existentes: preserva todas as colunas e registros anteriores.
function garantirColunasMarkup_() {
  [
    [ABAS.ORCAMENTOS, ['COMISSAO_PCT', 'COMISSAO_VALOR', 'EXTRA_PCT', 'EXTRA_VALOR']],
    [ABAS.ORCAMENTO_ITENS, ['COMISSAO_PCT', 'COMISSAO_VALOR', 'EXTRA_PCT', 'EXTRA_VALOR']],
    [ABAS.PEDIDOS, ['COMISSAO_PCT', 'COMISSAO_VALOR', 'EXTRA_PCT', 'EXTRA_VALOR']],
    [ABAS.PEDIDO_ITENS, ['COMISSAO_PCT_SNAPSHOT', 'COMISSAO_VALOR_SNAPSHOT', 'EXTRA_PCT_SNAPSHOT', 'EXTRA_VALOR_SNAPSHOT']],
    [ABAS.VENDAS, ['COMISSAO_PCT', 'COMISSAO_VALOR', 'EXTRA_PCT', 'EXTRA_VALOR']]
  ].forEach(function(config) {
    const sh = aba_(config[0]);
    const h = cabecalhos_(sh);
    const faltantes = config[1].filter(function(nome) { return !h[nome]; });
    if (faltantes.length) {
      sh.getRange(1, sh.getLastColumn() + 1, 1, faltantes.length).setValues([faltantes]);
    }
  });
}

function salvarOrcamento_(orcamento) {
  const itens = Array.isArray(orcamento.itens) ? orcamento.itens : [];
  if (!orcamento.CLIENTE_ID) throw new Error('CLIENTE_ID é obrigatório.');
  if (!itens.length) throw new Error('O orçamento precisa ter pelo menos um item.');
  if (itens.length > 10) throw new Error('Limite máximo de 10 itens por proposta atingido.');

  itens.forEach(function(item, idx) {
    if (!String(item.SEGMENTO_FINAL_ID || '').trim()) {
      throw new Error('Item ' + (idx + 1) + ': Segmentação FINAL é obrigatória.');
    }
    if (!String(item.SEGMENTO_NEO_ID || '').trim()) {
      throw new Error('Item ' + (idx + 1) + ': Segmentação NEO é obrigatória.');
    }
  });

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
  const impostosPct = getImpostoPct_(enquadramento, destino, tipoVenda);

  garantirColunasMarkup_();
  const shOrc = aba_(ABAS.ORCAMENTOS);
  const hOrc = cabecalhos_(shOrc);
  const rowExistente = localizarLinha_(shOrc, hOrc.ID_ORCAMENTO, idOrcamento);
  const existente = rowExistente ? objetoDaLinha_(shOrc, rowExistente) : null;

  if (existente) {
    const statusAtual = String(existente.STATUS || '').toUpperCase();
    if (statusAtual === 'APROVADO' || statusAtual === 'CONVERTIDO' || statusAtual === 'PERDIDO') {
      throw new Error('Orçamento encerrado está congelado e não pode mais ser alterado.');
    }
  }

  const despesaFixaPct = existente && existente.DESPESA_FIXA_PCT !== ''
    ? numero_(existente.DESPESA_FIXA_PCT)
    : numero_(versaoParametros.DESPESA_FIXA_PCT);
  const comissaoPct = numero_(orcamento.COMISSAO_PCT !== undefined ? orcamento.COMISSAO_PCT : (existente ? existente.COMISSAO_PCT : 0));
  const extraPct = numero_(orcamento.EXTRA_PCT !== undefined ? orcamento.EXTRA_PCT : (existente ? existente.EXTRA_PCT : 0));
  if (comissaoPct < 0 || comissaoPct >= 1 || extraPct < 0 || extraPct >= 1) {
    throw new Error('Comissão e Extra precisam estar entre 0% e 99,99%.');
  }

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
    COMISSAO_PCT: comissaoPct,
    COMISSAO_VALOR: valorFinalOrcamento * comissaoPct,
    EXTRA_PCT: extraPct,
    EXTRA_VALOR: valorFinalOrcamento * extraPct,
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
    const comissao = numero_(cab.COMISSAO_PCT);
    const extra = numero_(cab.EXTRA_PCT);
    const custoTotal = custoMP + custoTerceiros + custoFerramental + custoHoras;
    const dvValor = precoFinalTotal * impostos;
    const dfValor = precoFinalTotal * despesaFixa;
    const comissaoValor = precoFinalTotal * comissao;
    const extraValor = precoFinalTotal * extra;
    const lucroBruto = precoFinalTotal - custoTotal;
    const margemBruta = precoFinalTotal ? lucroBruto / precoFinalTotal : 0;

    const mcFinal = precoFinalTotal
      ? precoFinalTotal - custoMP - custoTerceiros - custoFerramental - dvValor - comissaoValor - extraValor
      : 0;
    const lucroFinal = precoFinalTotal
      ? precoFinalTotal - custoTotal - dvValor - dfValor - comissaoValor - extraValor
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
      COMISSAO_PCT: comissao,
      COMISSAO_VALOR: comissaoValor,
      EXTRA_PCT: extra,
      EXTRA_VALOR: extraValor,
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

function sincronizarProdutosDoOrcamentoAprovado_(idOrcamento) {
  if (!idOrcamento) throw new Error('ID do orçamento não informado para cadastro de produtos.');

  const orc = listarObjetos_(ABAS.ORCAMENTOS).find(function(x) {
    return String(x.ID_ORCAMENTO) === String(idOrcamento);
  });
  if (!orc) throw new Error('Orçamento não encontrado para cadastro de produtos.');

  const status = String(orc.STATUS || '').toUpperCase();
  if (status !== 'APROVADO' && status !== 'CONVERTIDO') {
    throw new Error('Somente itens de orçamento aprovado podem virar produto.');
  }

  const itens = listarObjetos_(ABAS.ORCAMENTO_ITENS).filter(function(x) {
    return String(x.ORCAMENTO_ID) === String(idOrcamento);
  });
  if (!itens.length) return { criados:0, atualizados:0, total:0 };

  const shProd = aba_(ABAS.PRODUTOS);
  const hProd = cabecalhos_(shProd);
  const produtos = listarObjetos_(ABAS.PRODUTOS);
  let criados = 0;
  let atualizados = 0;
  const agora = isoAgora_();

  itens.forEach(function(item) {
    const sku = String(item.SKU || '').trim();
    const produtoIdInformado = String(item.PRODUTO_ID || '').trim();

    let existente = null;
    if (produtoIdInformado) {
      existente = produtos.find(function(p) {
        return String(p.ID_PRODUTO || '') === produtoIdInformado;
      }) || null;
    }
    if (!existente && sku) {
      existente = produtos.find(function(p) {
        return normalizarTexto_(p.SKU) === normalizarTexto_(sku);
      }) || null;
    }
    if (!existente) {
      existente = produtos.find(function(p) {
        return String(p.ORCAMENTO_ITEM_ID_ORIGEM || '') === String(item.ID_ITEM || '');
      }) || null;
    }

    const qtd = numero_(item.QTDE);
    const custoTotal = numero_(item.CUSTO_TOTAL);
    const precoTotal = numero_(item.PRECO_FINAL_TOTAL);
    const idProduto = existente ? existente.ID_PRODUTO : novoId_('PROD');

    const obj = {
      ID_PRODUTO: idProduto,
      SKU: sku,
      NCM: String(item.NCM || '').trim(),
      DESCRICAO: String(item.DESCRICAO || '').trim(),
      UNIDADE: existente ? (existente.UNIDADE || 'PC') : 'PC',
      CATEGORIA: String(item.SEGMENTO_NEO_SNAPSHOT || item.SEGMENTO_FINAL_SNAPSHOT || ''),
      CUSTO_PADRAO: qtd ? custoTotal / qtd : custoTotal,
      PRECO_ULTIMA_VENDA: qtd ? precoTotal / qtd : precoTotal,
      SEGMENTO_FINAL_ID: item.SEGMENTO_FINAL_ID || '',
      SEGMENTO_FINAL_SNAPSHOT: item.SEGMENTO_FINAL_SNAPSHOT || '',
      SEGMENTO_NEO_ID: item.SEGMENTO_NEO_ID || '',
      SEGMENTO_NEO_SNAPSHOT: item.SEGMENTO_NEO_SNAPSHOT || '',
      ORCAMENTO_ID_ORIGEM: idOrcamento,
      ORCAMENTO_ITEM_ID_ORIGEM: item.ID_ITEM || '',
      ATIVO: true,
      DT_CADASTRO: existente ? (existente.DT_CADASTRO || agora) : agora,
      DT_ATUALIZACAO: agora,
      OBS: 'Cadastro gerado/atualizado pelo orçamento aprovado ' + String(orc.NUMERO_ORCAMENTO || '')
    };

    if (existente) {
      const rowProd = localizarLinha_(shProd, hProd.ID_PRODUTO, idProduto);
      if (rowProd) escreverObjetoNaLinha_(shProd, rowProd, obj);
      atualizados++;
      Object.assign(existente, obj);
    } else {
      appendObjeto_(ABAS.PRODUTOS, obj);
      produtos.push(obj);
      criados++;
    }

    // Guarda no item aprovado qual cadastro de produto ele originou/usou.
    const shItens = aba_(ABAS.ORCAMENTO_ITENS);
    const hItens = cabecalhos_(shItens);
    if (hItens.PRODUTO_ID) {
      const rowItem = localizarLinha_(shItens, hItens.ID_ITEM, item.ID_ITEM);
      if (rowItem) setCelulaPorHeader_(shItens, hItens, rowItem, 'PRODUTO_ID', idProduto);
    }
  });

  SpreadsheetApp.flush();
  return { criados:criados, atualizados:atualizados, total:itens.length };
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

  const orc = objetoPorValor_(ABAS.ORCAMENTOS, 'ID_ORCAMENTO', idOrcamento) ||
              objetoPorValor_(ABAS.ORCAMENTOS, 'NUMERO_ORCAMENTO', idOrcamento);

  if (!orc) return { ok: false, erro: 'Orçamento não encontrado.' };

  const itens = listarObjetosPorValor_(ABAS.ORCAMENTO_ITENS, 'ORCAMENTO_ID', orc.ID_ORCAMENTO)
    .sort(function(a,b) { return numero_(a.SEQ) - numero_(b.SEQ); });

  const componentes = listarObjetosPorValor_(ABAS.ORCAMENTO_COMPONENTES, 'ORCAMENTO_ID', orc.ID_ORCAMENTO);

  const compsPorItem = {};
  componentes.forEach(function(comp) {
    const itemId = String(comp.ITEM_ID || '');
    if (!compsPorItem[itemId]) compsPorItem[itemId] = [];
    compsPorItem[itemId].push(comp);
  });

  itens.forEach(function(item) {
    item.componentes = (compsPorItem[String(item.ID_ITEM || '')] || [])
      .sort(function(a,b) { return numero_(a.ORDEM) - numero_(b.ORDEM); });
  });

  return { ok: true, orcamento: Object.assign({}, orc, { itens: itens }) };
}

function listarPedidosResumo_() {
  const pedidos = listarObjetos_(ABAS.PEDIDOS);
  const itens = listarObjetos_(ABAS.PEDIDO_ITENS);
  const porPedido = {};

  itens.forEach(function(item) {
    const id = String(item.PEDIDO_ID || '');
    if (!porPedido[id]) {
      porPedido[id] = {
        QTD_ITENS:0,
        CUSTO_TOTAL:0,
        DV_TOTAL:0,
        DF_TOTAL:0,
        LUCRO_TOTAL:0
      };
    }
    const a = porPedido[id];
    a.QTD_ITENS++;
    a.CUSTO_TOTAL += numero_(item.CUSTO_TOTAL_SNAPSHOT);
    a.DV_TOTAL += numero_(item.DV_VALOR_SNAPSHOT);
    a.DF_TOTAL += numero_(item.DF_VALOR_SNAPSHOT);
    a.LUCRO_TOTAL += numero_(item.LUCRO_SNAPSHOT);
  });

  return pedidos.map(function(p) {
    const a = porPedido[String(p.ID_PEDIDO)] || {
      QTD_ITENS:0,CUSTO_TOTAL:0,DV_TOTAL:0,DF_TOTAL:0,LUCRO_TOTAL:0
    };
    const faturamento = numero_(p.VALOR_TOTAL);
    return Object.assign({}, p, a, {
      LUCRATIVIDADE_PCT: faturamento ? a.LUCRO_TOTAL / faturamento : 0
    });
  }).sort(function(a,b) {
    const da = String(a.DATA_PEDIDO || '');
    const db = String(b.DATA_PEDIDO || '');
    if (da !== db) return db.localeCompare(da);
    return String(b.NUMERO_PEDIDO || '').localeCompare(String(a.NUMERO_PEDIDO || ''), 'pt-BR', {numeric:true});
  });
}

function getPedidoDetalhe_(idPedido) {
  if (!idPedido) throw new Error('ID do pedido não informado.');

  const pedido = objetoPorValor_(ABAS.PEDIDOS, 'ID_PEDIDO', idPedido);
  if (!pedido) throw new Error('Pedido não encontrado.');

  const itens = listarObjetosPorValor_(ABAS.PEDIDO_ITENS, 'PEDIDO_ID', idPedido)
    .sort(function(a,b) { return numero_(a.SEQ) - numero_(b.SEQ); });

  const resumo = itens.reduce(function(a,item) {
    a.custo += numero_(item.CUSTO_TOTAL_SNAPSHOT);
    a.dv += numero_(item.DV_VALOR_SNAPSHOT);
    a.df += numero_(item.DF_VALOR_SNAPSHOT);
    a.comissao += numero_(item.COMISSAO_VALOR_SNAPSHOT);
    a.extra += numero_(item.EXTRA_VALOR_SNAPSHOT);
    a.lucro += numero_(item.LUCRO_SNAPSHOT);
    return a;
  }, {custo:0,dv:0,df:0,comissao:0,extra:0,lucro:0});

  resumo.faturamento = numero_(pedido.VALOR_TOTAL);
  resumo.lucratividade = resumo.faturamento ? resumo.lucro / resumo.faturamento : 0;

  return { ok:true, pedido:pedido, itens:itens, resumo:resumo };
}

function criarPedidoRapido_(pedido) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const p = pedido || {};
    const clienteId = String(p.CLIENTE_ID || '').trim();
    if (!clienteId) throw new Error('Selecione o cliente.');

    const cliente = getClientePorId_(clienteId);
    if (!cliente) throw new Error('Cliente não encontrado.');

    const itensEntrada = Array.isArray(p.itens) ? p.itens : [];
    if (!itensEntrada.length) throw new Error('Inclua pelo menos um item no pedido.');

    const tipoVenda = normalizarTipoVendaComercial_(p.TIPO_VENDA || 'VENDA');
    const uf = String(cliente.UF || '').trim().toUpperCase();
    if (!uf) throw new Error('O cliente precisa ter UF cadastrada para calcular os impostos.');

    const destino = destinoPorUf_(uf);
    const enquadramento = 'NORMAL';
    const impostosPct = getImpostoPct_(enquadramento, destino, tipoVenda);
    const versao = getVersaoParametrosAtiva_();
    if (!versao) throw new Error('Não existe versão ativa dos parâmetros de custos.');

    const despesaFixaPct = numero_(versao.DESPESA_FIXA_PCT);
    const produtos = dadosAbaCacheados_(ABAS.PRODUTOS, 300);
    const segmentos = dadosAbaCacheados_(ABAS.SEGMENTOS, 300);

    function segmentoPorId(id, tipo) {
      const seg = segmentos.find(function(s) {
        return String(s.ID_SEGMENTO || '') === String(id || '') &&
               String(s.TIPO || '').toUpperCase() === String(tipo || '').toUpperCase();
      });
      return seg || null;
    }

    const linhasItens = [];
    let valorTotalPedido = 0;
    const agora = isoAgora_();
    const dataPedido = normalizarDataFiltro_(p.DATA_PEDIDO) || agora.substring(0, 10);
    const idPedido = novoId_('PED');
    const numeroPedido = proximoNumeroPedido_();

    itensEntrada.forEach(function(item, idx) {
      const produtoId = String(item.PRODUTO_ID || '').trim();
      const produto = produtoId
        ? produtos.find(function(x) { return String(x.ID_PRODUTO || '') === produtoId; }) || null
        : null;

      const qtde = numero_(item.QTDE);
      if (!(qtde > 0)) throw new Error('Quantidade inválida no item ' + (idx + 1) + '.');

      const descricao = String(
        item.DESCRICAO ||
        (produto ? produto.DESCRICAO : '') ||
        ''
      ).trim();
      if (!descricao) throw new Error('Informe a descrição do item ' + (idx + 1) + '.');

      const sku = String(item.SKU || (produto ? produto.SKU : '') || '').trim();
      const ncm = String(item.NCM || (produto ? produto.NCM : '') || '').trim();

      const precoUnit = numero_(
        item.PRECO_UNITARIO !== undefined && item.PRECO_UNITARIO !== ''
          ? item.PRECO_UNITARIO
          : (produto ? produto.PRECO_ULTIMA_VENDA : 0)
      );
      if (!(precoUnit > 0)) throw new Error('Informe o preço unitário do item ' + (idx + 1) + '.');

      const custoUnit = numero_(
        item.CUSTO_UNITARIO !== undefined && item.CUSTO_UNITARIO !== ''
          ? item.CUSTO_UNITARIO
          : (produto ? produto.CUSTO_PADRAO : 0)
      );
      if (custoUnit < 0) throw new Error('Custo inválido no item ' + (idx + 1) + '.');

      let segFinalId = String(
        item.SEGMENTO_FINAL_ID ||
        (produto ? produto.SEGMENTO_FINAL_ID : '') ||
        cliente.SEGMENTO_FINAL_ID ||
        ''
      );
      let segNeoId = String(
        item.SEGMENTO_NEO_ID ||
        (produto ? produto.SEGMENTO_NEO_ID : '') ||
        cliente.SEGMENTO_NEO_ID ||
        ''
      );

      const segFinal = segFinalId ? segmentoPorId(segFinalId, 'FINAL') : null;
      const segNeo = segNeoId ? segmentoPorId(segNeoId, 'NEO') : null;
      if (!segFinal) throw new Error('Item ' + (idx + 1) + ': selecione a Segmentação FINAL.');
      if (!segNeo) throw new Error('Item ' + (idx + 1) + ': selecione a Segmentação NEO.');

      const segFinalSnapshot = String(
        item.SEGMENTO_FINAL_SNAPSHOT ||
        (produto ? produto.SEGMENTO_FINAL_SNAPSHOT : '') ||
        (segFinal ? segFinal.SEGMENTO : '') ||
        ''
      );
      const segNeoSnapshot = String(
        item.SEGMENTO_NEO_SNAPSHOT ||
        (produto ? produto.SEGMENTO_NEO_SNAPSHOT : '') ||
        (segNeo ? segNeo.SEGMENTO : '') ||
        ''
      );

      const valorTotal = qtde * precoUnit;
      const custoTotal = qtde * custoUnit;
      const dvValor = valorTotal * impostosPct;
      const dfValor = valorTotal * despesaFixaPct;
      const lucro = valorTotal - custoTotal - dvValor - dfValor;
      const margem = valorTotal ? lucro / valorTotal : 0;

      valorTotalPedido += valorTotal;

      linhasItens.push({
        ID_PEDIDO_ITEM: novoId_('PEDI'),
        PEDIDO_ID: idPedido,
        ORCAMENTO_ITEM_ID_ORIGEM: '',
        SEQ: idx + 1,
        SKU: sku,
        NCM: ncm,
        PRODUTO_ID: produto ? produto.ID_PRODUTO : '',
        SEGMENTO_FINAL_ID: segFinalId,
        SEGMENTO_FINAL_SNAPSHOT: segFinalSnapshot,
        SEGMENTO_NEO_ID: segNeoId,
        SEGMENTO_NEO_SNAPSHOT: segNeoSnapshot,
        DESCRICAO: descricao,
        QTDE: qtde,
        PRECO_UNITARIO: precoUnit,
        VALOR_TOTAL: valorTotal,
        CUSTO_UNIT_SNAPSHOT: custoUnit,
        CUSTO_TOTAL_SNAPSHOT: custoTotal,
        DV_PCT_SNAPSHOT: impostosPct,
        DV_VALOR_SNAPSHOT: dvValor,
        DF_PCT_SNAPSHOT: despesaFixaPct,
        DF_VALOR_SNAPSHOT: dfValor,
        LUCRO_BRUTO_SNAPSHOT: valorTotal - custoTotal,
        MARGEM_BRUTA_PCT_SNAPSHOT: valorTotal ? (valorTotal - custoTotal) / valorTotal : 0,
        LUCRO_SNAPSHOT: lucro,
        MARGEM_PCT_SNAPSHOT: margem,
        STATUS: 'ABERTO',
        OBS: '',
        ORIGEM: 'RAPIDO',
        VENDA_ID_ORIGEM: '',
        RAW_ID: ''
      });
    });

    const nomeCliente = String(cliente.NOME_FANTASIA || cliente.RAZAO_SOCIAL || '').trim();

    appendObjeto_(ABAS.PEDIDOS, {
      ID_PEDIDO: idPedido,
      NUMERO_PEDIDO: numeroPedido,
      DATA_PEDIDO: dataPedido,
      ORCAMENTO_ID_ORIGEM: '',
      NUMERO_ORCAMENTO_ORIGEM: '',
      CLIENTE_ID: clienteId,
      CLIENTE_NOME_SNAPSHOT: nomeCliente,
      CONTATO: String(p.CONTATO || cliente.CONTATO || '').trim(),
      VENDEDOR: String(p.VENDEDOR || cliente.VENDEDOR || '').trim(),
      COND_PAGAMENTO: String(p.COND_PAGAMENTO || '').trim(),
      PRAZO_ENTREGA: String(p.PRAZO_ENTREGA || '').trim(),
      VALOR_TOTAL: valorTotalPedido,
      STATUS: 'ABERTO',
      DT_CONVERSAO: '',
      DT_CRIACAO: agora,
      DT_ATUALIZACAO: agora,
      OBS: String(p.OBS || '').trim(),
      ORIGEM: 'RAPIDO',
      ANO_ORIGEM: Number(dataPedido.substring(0, 4)),
      CHAVE_HISTORICA: ''
    });

    appendObjetos_(ABAS.PEDIDO_ITENS, linhasItens);

    const linhasVendas = linhasItens.map(function(item) {
      return {
        ID_VENDA: novoId_('VEN'),
        DATA_VENDA: dataPedido,
        ANO: Number(dataPedido.substring(0, 4)),
        MES: Number(dataPedido.substring(5, 7)),
        PEDIDO_ORIGEM: numeroPedido,
        PEDIDO_ID: idPedido,
        ORCAMENTO_ID: '',
        CLIENTE_ID: clienteId,
        CLIENTE_COD_ORIGEM: cliente.COD_CLIENTE_ORIGEM || '',
        CLIENTE_NOME_SNAPSHOT: nomeCliente,
        SEGMENTO_FINAL_ID: item.SEGMENTO_FINAL_ID || '',
        SEGMENTO_FINAL_SNAPSHOT: item.SEGMENTO_FINAL_SNAPSHOT || '',
        SEGMENTO_NEO_ID: item.SEGMENTO_NEO_ID || '',
        SEGMENTO_NEO_SNAPSHOT: item.SEGMENTO_NEO_SNAPSHOT || '',
        SKU: item.SKU || '',
        PRODUTO_ID: item.PRODUTO_ID || '',
        DESCRICAO: item.DESCRICAO || '',
        QTDE: numero_(item.QTDE),
        CUSTO_UNIT: numero_(item.CUSTO_UNIT_SNAPSHOT),
        CUSTO_TOTAL: numero_(item.CUSTO_TOTAL_SNAPSHOT),
        VALOR_UNIT: numero_(item.PRECO_UNITARIO),
        VALOR_TOTAL: numero_(item.VALOR_TOTAL),
        LUCRO_BRUTO: numero_(item.VALOR_TOTAL) - numero_(item.CUSTO_TOTAL_SNAPSHOT),
        MARGEM_BRUTA_PCT: numero_(item.VALOR_TOTAL)
          ? (numero_(item.VALOR_TOTAL) - numero_(item.CUSTO_TOTAL_SNAPSHOT)) / numero_(item.VALOR_TOTAL)
          : 0,
        ENQUADRAMENTO: enquadramento,
        TIPO_VENDA: tipoVenda,
        DESTINO: destino,
        DV_PCT: numero_(item.DV_PCT_SNAPSHOT),
        DV_VALOR: numero_(item.DV_VALOR_SNAPSHOT),
        DF_PCT: numero_(item.DF_PCT_SNAPSHOT),
        DF_VALOR: numero_(item.DF_VALOR_SNAPSHOT),
        LUCRO: numero_(item.LUCRO_SNAPSHOT),
        LUCRO_PCT: numero_(item.MARGEM_PCT_SNAPSHOT),
        MODALIDADE: tipoVenda,
        UF_DESTINO: uf,
        STATUS: 'ABERTO',
        ORIGEM: 'PEDIDO_RAPIDO',
        PARAMETRO_RENTABILIDADE_ID: versao.ID_VERSAO || '',
        RAW_ID: '',
        DT_IMPORTACAO: agora
      };
    });

    appendObjetos_(ABAS.VENDAS, linhasVendas);
    SpreadsheetApp.flush();

    return {
      ok: true,
      id_pedido: idPedido,
      numero_pedido: numeroPedido,
      valor_total: valorTotalPedido,
      itens: linhasItens.length
    };
  } finally {
    lock.releaseLock();
  }
}

function alterarStatusPedido_(idPedido, novoStatus) {
  if (!idPedido) throw new Error('ID do pedido não informado.');

  const status = String(novoStatus || '').trim().toUpperCase();
  const permitidos = ['ABERTO','CONFIRMADO','FATURADO','CANCELADO'];
  if (permitidos.indexOf(status) < 0) {
    throw new Error('Status de pedido inválido: ' + status);
  }

  const sh = aba_(ABAS.PEDIDOS);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.ID_PEDIDO, idPedido);
  if (!row) throw new Error('Pedido não encontrado.');

  const atual = objetoDaLinha_(sh, row);
  const agora = isoAgora_();

  setCelulaPorHeader_(sh, headers, row, 'STATUS', status);
  setCelulaPorHeader_(sh, headers, row, 'DT_ATUALIZACAO', agora);

  const shItens = aba_(ABAS.PEDIDO_ITENS);
  if (shItens.getLastRow() >= 2) {
    const hi = cabecalhos_(shItens);
    const ids = shItens.getRange(2, hi.PEDIDO_ID, shItens.getLastRow() - 1, 1).getValues();
    ids.forEach(function(r, i) {
      if (String(r[0]) === String(idPedido)) {
        setCelulaPorHeader_(shItens, hi, i + 2, 'STATUS', status);
      }
    });
  }

  sincronizarStatusPedidoEmVendas_(idPedido, status);
  SpreadsheetApp.flush();

  return {
    ok:true,
    id_pedido:idPedido,
    status_anterior:String(atual.STATUS || ''),
    status:status,
    atualizado_em:agora
  };
}


function excluirPedido_(idPedido) {
  if (!idPedido) throw new Error('ID do pedido não informado.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sh = aba_(ABAS.PEDIDOS);
    const headers = cabecalhos_(sh);
    const row = localizarLinha_(sh, headers.ID_PEDIDO, idPedido);
    if (!row) throw new Error('Pedido não encontrado.');

    const pedido = objetoDaLinha_(sh, row);
    const origem = String(pedido.ORIGEM || '').toUpperCase();

    if (origem !== 'ORCAMENTO' && origem !== 'RAPIDO') {
      throw new Error('Somente pedidos gerados pelo sistema podem ser excluídos.');
    }

    const orcamentoId = String(pedido.ORCAMENTO_ID_ORIGEM || '').trim();

    deletarLinhasPorValor_(ABAS.VENDAS, 'PEDIDO_ID', idPedido);
    deletarLinhasPorValor_(ABAS.PEDIDO_ITENS, 'PEDIDO_ID', idPedido);
    deletarLinhasPorValor_(ABAS.PEDIDOS, 'ID_PEDIDO', idPedido);

    if (origem === 'ORCAMENTO' && orcamentoId) {
      const shOrc = aba_(ABAS.ORCAMENTOS);
      const hOrc = cabecalhos_(shOrc);
      const rowOrc = localizarLinha_(shOrc, hOrc.ID_ORCAMENTO, orcamentoId);
      if (rowOrc) {
        setCelulaPorHeader_(shOrc, hOrc, rowOrc, 'STATUS', 'ENVIADO');
        setCelulaPorHeader_(shOrc, hOrc, rowOrc, 'CONVERTIDO_PEDIDO_ID', '');
        setCelulaPorHeader_(shOrc, hOrc, rowOrc, 'DT_ATUALIZACAO', isoAgora_());
      }
    }

    SpreadsheetApp.flush();

    return {
      ok:true,
      id_pedido:idPedido,
      origem:origem,
      orcamento_id:orcamentoId,
      orcamento_status:orcamentoId ? 'ENVIADO' : ''
    };
  } finally {
    lock.releaseLock();
  }
}

function aprovarOrcamentoEGerarPedido_(idOrcamento) {
  if (!idOrcamento) throw new Error('ID do orçamento não informado.');

  const sh = aba_(ABAS.ORCAMENTOS);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.ID_ORCAMENTO, idOrcamento);
  if (!row) throw new Error('Orçamento não encontrado.');

  const orc = objetoDaLinha_(sh, row);
  if (String(orc.STATUS || '').toUpperCase() === 'CONVERTIDO' && orc.CONVERTIDO_PEDIDO_ID) {
    const produtosRetry = sincronizarProdutosDoOrcamentoAprovado_(idOrcamento);
    return {
      ok:true,
      status:'CONVERTIDO',
      id_orcamento:idOrcamento,
      id_pedido:orc.CONVERTIDO_PEDIDO_ID,
      ja_convertido:true,
      produtos:produtosRetry
    };
  }

  alterarStatusOrcamento_(idOrcamento, 'APROVADO');
  const produtos = sincronizarProdutosDoOrcamentoAprovado_(idOrcamento);
  const pedido = converterOrcamentoEmPedido_(idOrcamento);

  return Object.assign({
    ok:true,
    status:'CONVERTIDO',
    id_orcamento:idOrcamento,
    produtos:produtos
  }, pedido);
}

function alterarStatusOrcamento_(idOrcamento, novoStatus) {
  if (!idOrcamento) throw new Error('ID do orçamento não informado.');

  const status = String(novoStatus || '').toUpperCase();
  if (status === 'ENVIADO' || status === 'APROVADO' || status === 'CONVERTIDO') {
    validarPrecoFinalOrcamentoSalvo_(idOrcamento);
    validarSegmentosOrcamentoSalvo_(idOrcamento);
  }

  const sh = aba_(ABAS.ORCAMENTOS);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.ID_ORCAMENTO, idOrcamento);
  if (!row) throw new Error('Orçamento não encontrado.');

  const atual = objetoDaLinha_(sh, row);
  const statusAtual = String(atual.STATUS || '').toUpperCase();
  if ((statusAtual === 'APROVADO' || statusAtual === 'CONVERTIDO' || statusAtual === 'PERDIDO') && status !== statusAtual) {
    throw new Error('Orçamento encerrado está congelado e não pode mais mudar de status.');
  }

  setCelulaPorHeader_(sh, headers, row, 'STATUS', status);
  setCelulaPorHeader_(sh, headers, row, 'DT_ATUALIZACAO', isoAgora_());

  return { ok: true, id_orcamento: idOrcamento, status: status };
}


function perderOrcamento_(idOrcamento) {
  if (!idOrcamento) throw new Error('ID do orçamento não informado.');

  const sh = aba_(ABAS.ORCAMENTOS);
  const headers = cabecalhos_(sh);
  const row = localizarLinha_(sh, headers.ID_ORCAMENTO, idOrcamento);
  if (!row) throw new Error('Orçamento não encontrado.');

  const atual = objetoDaLinha_(sh, row);
  const statusAtual = String(atual.STATUS || '').toUpperCase();

  if (statusAtual === 'APROVADO' || statusAtual === 'CONVERTIDO') {
    throw new Error('Este orçamento já foi aprovado/convertido e não pode ser marcado como perdido.');
  }
  if (statusAtual === 'PERDIDO') {
    return { ok:true, id_orcamento:idOrcamento, status:'PERDIDO', ja_perdido:true };
  }

  const agora = isoAgora_();
  setCelulaPorHeader_(sh, headers, row, 'STATUS', 'PERDIDO');
  setCelulaPorHeader_(sh, headers, row, 'DT_ATUALIZACAO', agora);
  SpreadsheetApp.flush();

  return { ok:true, id_orcamento:idOrcamento, status:'PERDIDO', atualizado_em:agora };
}

function converterOrcamentoEmPedido_(idOrcamento) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    if (!idOrcamento) throw new Error('ID do orçamento não informado.');

    garantirColunasMarkup_();
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
      COMISSAO_PCT: numero_(orc.COMISSAO_PCT),
      COMISSAO_VALOR: numero_(orc.COMISSAO_VALOR),
      EXTRA_PCT: numero_(orc.EXTRA_PCT),
      EXTRA_VALOR: numero_(orc.EXTRA_VALOR),
      STATUS: 'ABERTO',
      DT_CONVERSAO: agora,
      DT_CRIACAO: agora,
      DT_ATUALIZACAO: agora,
      OBS: 'Gerado automaticamente pelo orçamento ' + orc.NUMERO_ORCAMENTO,
      ORIGEM: 'ORCAMENTO',
      ANO_ORIGEM: Number(agora.substring(0,4)),
      CHAVE_HISTORICA: ''
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
        NCM: item.NCM || '',
        PRODUTO_ID: item.PRODUTO_ID || '',
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
        COMISSAO_PCT_SNAPSHOT: numero_(item.COMISSAO_PCT),
        COMISSAO_VALOR_SNAPSHOT: numero_(item.COMISSAO_VALOR),
        EXTRA_PCT_SNAPSHOT: numero_(item.EXTRA_PCT),
        EXTRA_VALOR_SNAPSHOT: numero_(item.EXTRA_VALOR),
        LUCRO_BRUTO_SNAPSHOT: numero_(item.LUCRO_BRUTO),
        MARGEM_BRUTA_PCT_SNAPSHOT: numero_(item.MARGEM_BRUTA_PCT),
        LUCRO_SNAPSHOT: numero_(item.LUCRO_FINAL),
        MARGEM_PCT_SNAPSHOT: numero_(item.MARGEM_FINAL_PCT),
        STATUS: 'ABERTO',
        OBS: '',
        ORIGEM: 'ORCAMENTO',
        VENDA_ID_ORIGEM: '',
        RAW_ID: ''
      });
    });

    registrarPedidoEmVendas_(idPedido, orc, numeroPedido, agora);

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


function registrarPedidoEmVendas_(idPedido, orc, numeroPedido, agora) {
  const existentes = listarObjetos_(ABAS.VENDAS).filter(function(v) {
    return String(v.PEDIDO_ID || '') === String(idPedido);
  });
  if (existentes.length) return existentes.length;

  const pedido = listarObjetos_(ABAS.PEDIDOS).find(function(p) {
    return String(p.ID_PEDIDO || '') === String(idPedido);
  });
  if (!pedido) throw new Error('Pedido não encontrado para registrar nos indicadores.');

  const cliente = getClientePorId_(orc.CLIENTE_ID);
  const uf = cliente ? String(cliente.UF || '').trim().toUpperCase() : '';
  const itens = listarObjetos_(ABAS.PEDIDO_ITENS).filter(function(i) {
    return String(i.PEDIDO_ID || '') === String(idPedido);
  });

  itens.forEach(function(item) {
    const faturamento = numero_(item.VALOR_TOTAL);
    const custo = numero_(item.CUSTO_TOTAL_SNAPSHOT);
    const lucroBruto = numero_(item.LUCRO_BRUTO_SNAPSHOT);
    const lucro = numero_(item.LUCRO_SNAPSHOT);
    const dataVenda = String(pedido.DATA_PEDIDO || agora.substring(0,10));
    const ano = Number(dataVenda.substring(0,4)) || Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy'));
    const mes = Number(dataVenda.substring(5,7)) || Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M'));

    appendObjeto_(ABAS.VENDAS, {
      ID_VENDA: novoId_('VEN'),
      DATA_VENDA: dataVenda,
      ANO: ano,
      MES: mes,
      PEDIDO_ORIGEM: numeroPedido || pedido.NUMERO_PEDIDO || '',
      PEDIDO_ID: idPedido,
      ORCAMENTO_ID: orc.ID_ORCAMENTO || '',
      CLIENTE_ID: orc.CLIENTE_ID || '',
      CLIENTE_COD_ORIGEM: cliente ? (cliente.COD_CLIENTE_ORIGEM || '') : '',
      CLIENTE_NOME_SNAPSHOT: orc.CLIENTE_NOME_SNAPSHOT || (cliente ? (cliente.NOME_FANTASIA || cliente.RAZAO_SOCIAL || '') : ''),
      SEGMENTO_FINAL_ID: item.SEGMENTO_FINAL_ID || '',
      SEGMENTO_FINAL_SNAPSHOT: item.SEGMENTO_FINAL_SNAPSHOT || '',
      SEGMENTO_NEO_ID: item.SEGMENTO_NEO_ID || '',
      SEGMENTO_NEO_SNAPSHOT: item.SEGMENTO_NEO_SNAPSHOT || '',
      SKU: item.SKU || '',
      PRODUTO_ID: '',
      DESCRICAO: item.DESCRICAO || '',
      QTDE: numero_(item.QTDE),
      CUSTO_UNIT: numero_(item.CUSTO_UNIT_SNAPSHOT),
      CUSTO_TOTAL: custo,
      VALOR_UNIT: numero_(item.PRECO_UNITARIO),
      VALOR_TOTAL: faturamento,
      LUCRO_BRUTO: lucroBruto,
      MARGEM_BRUTA_PCT: faturamento ? lucroBruto / faturamento : 0,
      ENQUADRAMENTO: orc.ENQUADRAMENTO || 'NORMAL',
      TIPO_VENDA: orc.TIPO_VENDA || '',
      DESTINO: orc.DESTINO || '',
      DV_PCT: numero_(item.DV_PCT_SNAPSHOT),
      DV_VALOR: numero_(item.DV_VALOR_SNAPSHOT),
      DF_PCT: numero_(item.DF_PCT_SNAPSHOT),
      DF_VALOR: numero_(item.DF_VALOR_SNAPSHOT),
      COMISSAO_PCT: numero_(item.COMISSAO_PCT_SNAPSHOT),
      COMISSAO_VALOR: numero_(item.COMISSAO_VALOR_SNAPSHOT),
      EXTRA_PCT: numero_(item.EXTRA_PCT_SNAPSHOT),
      EXTRA_VALOR: numero_(item.EXTRA_VALOR_SNAPSHOT),
      LUCRO: lucro,
      LUCRO_PCT: faturamento ? lucro / faturamento : 0,
      MODALIDADE: orc.TIPO_VENDA || '',
      UF_DESTINO: uf,
      STATUS: pedido.STATUS || 'ABERTO',
      ORIGEM: 'PEDIDO_ORCAMENTO',
      PARAMETRO_RENTABILIDADE_ID: orc.PARAMETRO_VERSAO_ID || '',
      RAW_ID: '',
      DT_IMPORTACAO: agora
    });
  });

  return itens.length;
}

function sincronizarStatusPedidoEmVendas_(idPedido, status) {
  const sh = aba_(ABAS.VENDAS);
  if (sh.getLastRow() < 2) return 0;

  const headers = cabecalhos_(sh);
  const dados = sh.getDataRange().getValues();
  let alterados = 0;

  for (let r = 1; r < dados.length; r++) {
    const pedidoId = String(dados[r][headers.PEDIDO_ID - 1] || '');
    if (pedidoId === String(idPedido)) {
      sh.getRange(r + 1, headers.STATUS).setValue(status);
      alterados++;
    }
  }
  return alterados;
}

function getClientePorId_(idCliente) {
  if (!idCliente) return null;
  const clientes = dadosAbaCacheados_(ABAS.CLIENTES, 300);
  return clientes.find(function(c) {
    return String(c.ID_CLIENTE) === String(idCliente);
  }) || null;
}

function normalizarTipoVendaComercial_(tipo) {
  const t = normalizarTexto_(tipo);
  if (t === 'VENDA' || t === 'VENDA DE PRODUTO' || t === 'LOC - EQUIP_MAQ') return 'VENDA';
  if (t === 'REVENDA' || t === 'REVENDA DE PRODUTO') return 'REVENDA';
  if (t === 'SERVICO_8_02' || t === 'SERVICO 8.02') return 'SERVICO_8_02';
  if (t === 'SERVICO_14_01' || t === 'SERVICO 14.01' || t === 'SERVICO' || t === 'SERVIÇO') return 'SERVICO_14_01';
  if (t.indexOf('PSERV - TREINAMENTO') === 0) return 'SERVICO_8_02';
  if (t.indexOf('PSERV -') === 0) return 'SERVICO_14_01';
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
  const regras = dadosAbaCacheados_(ABAS.TABELA_IMPOSTOS, 300);
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
  const segmentos = dadosAbaCacheados_(ABAS.SEGMENTOS, 300);
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

function validarSegmentosOrcamentoSalvo_(idOrcamento) {
  const itens = listarObjetos_(ABAS.ORCAMENTO_ITENS).filter(function(item) {
    return String(item.ORCAMENTO_ID) === String(idOrcamento);
  });

  if (!itens.length) throw new Error('O orçamento não possui itens.');

  itens.forEach(function(item, idx) {
    if (!String(item.SEGMENTO_FINAL_ID || '').trim()) {
      throw new Error('Item ' + (idx + 1) + ': Segmentação FINAL é obrigatória.');
    }
    if (!String(item.SEGMENTO_NEO_ID || '').trim()) {
      throw new Error('Item ' + (idx + 1) + ': Segmentação NEO é obrigatória.');
    }

    validarSegmentoTipo_(item.SEGMENTO_FINAL_ID, 'FINAL');
    validarSegmentoTipo_(item.SEGMENTO_NEO_ID, 'NEO');
  });

  return true;
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

function getDashboardVendas_(params) {
  const p = params || {};
  const cacheKey = [
    'neosonics-dashboard-v5',
    cacheEpoch_(),
    String(p.dt_inicio || ''),
    String(p.dt_fim || ''),
    String(p.segmento_final_id || ''),
    String(p.segmento_neo_id || ''),
    String(p.cliente_id || ''),
    String(p.produto_id || ''),
    String(p.modalidade || ''),
    String(p.uf || '')
  ].join('|');

  try {
    const cache = CacheService.getScriptCache();
    const hit = cache.get(cacheKey);
    if (hit) return JSON.parse(hit);

    const result = getDashboardVendasCalculado_(p);
    const payload = JSON.stringify(result);
    // CacheService limita cada valor; se o dashboard crescer demais, apenas ignora o cache.
    if (payload.length < 90000) cache.put(cacheKey, payload, 90);
    return result;
  } catch (cacheErr) {
    // Falha de cache nunca pode impedir o dashboard.
    return getDashboardVendasCalculado_(p);
  }
}

function getDashboardVendasCalculado_(params) {
  const vendas = listarObjetos_(ABAS.VENDAS);
  vendas.forEach(function(v) {
    v.__DASH_DATA = normalizarDataFiltro_(v.DATA_VENDA);
    v.__DASH_PRODUTO = chaveProdutoDashboard_(v);
  });

  const p = params || {};
  const dtInicio = normalizarDataFiltro_(p.dt_inicio);
  const dtFim = normalizarDataFiltro_(p.dt_fim);

  const filtradas = vendas.filter(function(v) {
    if (!vendaPassaFiltrosDashboard_(v, p, false)) return false;
    const dt = v.__DASH_DATA || '';
    if (dtInicio && dt && dt < dtInicio) return false;
    if (dtFim && dt && dt > dtFim) return false;
    return true;
  });

  const kpis = resumirKpisDashboard_(filtradas);
  const porMes = {};
  const porAno = {};
  const porFinal = {};
  const porNeo = {};
  const porCliente = {};
  const porProduto = {};
  const porProdutoGeral = {};
  const porEstado = {};
  const porClienteMes = {};
  const vendasDentro = {};
  const vendasFora = {};

  filtradas.forEach(function(v) {
    const fat = numero_(v.VALOR_TOTAL);
    const custo = numero_(v.CUSTO_TOTAL);
    const dv = numero_(v.DV_VALOR);
    const df = numero_(v.DF_VALOR);
    const lucro = numero_(v.LUCRO);
    const qtde = numero_(v.QTDE);
    const chaveVenda = chaveVendaDashboard_(v);
    const clienteId = String(v.CLIENTE_ID || v.CLIENTE_NOME_SNAPSHOT || 'N/I');
    const dt = v.__DASH_DATA || '';
    const mesKey = dt ? dt.substring(0, 7) : ((v.ANO || '') + '-' + String(v.MES || ''));
    const anoKey = dt ? dt.substring(0, 4) : String(v.ANO || 'N/I');

    const dentroEstado = normalizarTexto_(v.DESTINO) === 'INTERNA' ||
      String(v.UF_DESTINO || '').toUpperCase() === 'SP';
    if (dentroEstado) vendasDentro[chaveVenda] = true;
    else vendasFora[chaveVenda] = true;

    agregarDashboard_(porMes, mesKey, fat, custo, dv, df, lucro, qtde, { label: mesKey });
    registrarUnicosAgregado_(porMes, mesKey, chaveVenda, clienteId);

    agregarDashboard_(porAno, anoKey, fat, custo, dv, df, lucro, qtde, { label: anoKey });
    registrarUnicosAgregado_(porAno, anoKey, chaveVenda, clienteId);

    const finalKey = String(v.SEGMENTO_FINAL_ID || v.SEGMENTO_FINAL_SNAPSHOT || 'N/I');
    agregarDashboard_(porFinal, finalKey, fat, custo, dv, df, lucro, qtde, {
      label: String(v.SEGMENTO_FINAL_SNAPSHOT || 'N/I'),
      id: String(v.SEGMENTO_FINAL_ID || '')
    });
    registrarUnicosAgregado_(porFinal, finalKey, chaveVenda, clienteId);

    const neoKey = String(v.SEGMENTO_NEO_ID || v.SEGMENTO_NEO_SNAPSHOT || 'N/I');
    agregarDashboard_(porNeo, neoKey, fat, custo, dv, df, lucro, qtde, {
      label: String(v.SEGMENTO_NEO_SNAPSHOT || 'N/I'),
      id: String(v.SEGMENTO_NEO_ID || '')
    });
    registrarUnicosAgregado_(porNeo, neoKey, chaveVenda, clienteId);

    const cliKey = String(v.CLIENTE_ID || v.CLIENTE_NOME_SNAPSHOT || 'N/I');
    agregarDashboard_(porCliente, cliKey, fat, custo, dv, df, lucro, qtde, {
      label: String(v.CLIENTE_NOME_SNAPSHOT || 'N/I'),
      id: String(v.CLIENTE_ID || '')
    });
    registrarUnicosAgregado_(porCliente, cliKey, chaveVenda, cliKey);

    const produtoBaseKey = v.__DASH_PRODUTO || chaveProdutoDashboard_(v);
    const produtoKey = [String(v.CLIENTE_ID || ''), produtoBaseKey].join('|');
    agregarDashboard_(porProduto, produtoKey, fat, custo, dv, df, lucro, qtde, {
      label: String(v.DESCRICAO || v.SKU || 'N/I'),
      sku: String(v.SKU || ''),
      produto_id: produtoBaseKey,
      cliente_id: String(v.CLIENTE_ID || ''),
      cliente: String(v.CLIENTE_NOME_SNAPSHOT || '')
    });
    registrarUnicosAgregado_(porProduto, produtoKey, chaveVenda, clienteId);

    agregarDashboard_(porProdutoGeral, produtoBaseKey, fat, custo, dv, df, lucro, qtde, {
      label: String(v.DESCRICAO || v.SKU || 'N/I'),
      sku: String(v.SKU || ''),
      produto_id: produtoBaseKey
    });
    registrarUnicosAgregado_(porProdutoGeral, produtoBaseKey, chaveVenda, clienteId);

    const uf = String(v.UF_DESTINO || 'N/I').toUpperCase();
    agregarDashboard_(porEstado, uf, fat, custo, dv, df, lucro, qtde, {
      label: uf,
      id: uf
    });
    registrarUnicosAgregado_(porEstado, uf, chaveVenda, clienteId);

    const clienteMesKey = [cliKey, mesKey].join('|');
    agregarDashboard_(porClienteMes, clienteMesKey, fat, custo, dv, df, lucro, qtde, {
      label: mesKey,
      mes: mesKey,
      cliente_id: String(v.CLIENTE_ID || ''),
      cliente: String(v.CLIENTE_NOME_SNAPSHOT || 'N/I')
    });
    registrarUnicosAgregado_(porClienteMes, clienteMesKey, chaveVenda, cliKey);
  });

  const qtdDentro = Object.keys(vendasDentro).length;
  const qtdFora = Object.keys(vendasFora).length;
  const totalVendas = kpis.vendas || 0;
  const dentro_fora = {
    estado_base: 'SP',
    dentro: qtdDentro,
    fora: qtdFora,
    dentro_pct: totalVendas ? qtdDentro / totalVendas : 0,
    fora_pct: totalVendas ? qtdFora / totalVendas : 0
  };

  const mensal = ordenarAgregados_(porMes, 'label', false);
  const anual = ordenarAgregados_(porAno, 'label', false);
  const segmentosFinal = ordenarAgregados_(porFinal, 'faturamento', true);
  const segmentosNeo = ordenarAgregados_(porNeo, 'faturamento', true);
  const clientes = ordenarAgregados_(porCliente, 'faturamento', true);
  const produtos = ordenarAgregados_(porProduto, 'faturamento', true);
  const produtosGeral = ordenarAgregados_(porProdutoGeral, 'faturamento', true);
  const estados = ordenarAgregados_(porEstado, 'faturamento', true);
  const clienteMensal = ordenarAgregados_(porClienteMes, 'mes', false);

  const fatPorCliente = {};
  clientes.forEach(function(x) {
    fatPorCliente[String(x.id || x.chave)] = numero_(x.faturamento);
    x.participacao_total = kpis.faturamento ? numero_(x.faturamento) / kpis.faturamento : 0;
  });
  produtos.forEach(function(x) {
    const fatCliente = fatPorCliente[String(x.cliente_id || '')] || 0;
    x.participacao_cliente = fatCliente ? numero_(x.faturamento) / fatCliente : 0;
    x.participacao_total = kpis.faturamento ? numero_(x.faturamento) / kpis.faturamento : 0;
  });
  produtosGeral.forEach(function(x) {
    x.participacao_total = kpis.faturamento ? numero_(x.faturamento) / kpis.faturamento : 0;
  });
  estados.forEach(function(x) {
    x.participacao_total = kpis.faturamento ? numero_(x.faturamento) / kpis.faturamento : 0;
  });
  segmentosFinal.forEach(function(x) {
    x.participacao_total = kpis.faturamento ? numero_(x.faturamento) / kpis.faturamento : 0;
  });
  segmentosNeo.forEach(function(x) {
    x.participacao_total = kpis.faturamento ? numero_(x.faturamento) / kpis.faturamento : 0;
  });

  const todasValidas = vendas.filter(function(v) {
    return String(v.STATUS || '').toUpperCase() !== 'CANCELADO';
  });

  const filtros = {
    datas: {
      min: menorDataVendas_(todasValidas),
      max: maiorDataVendas_(todasValidas)
    },
    segmentos_final: opcoesFiltro_(todasValidas, 'SEGMENTO_FINAL_ID', 'SEGMENTO_FINAL_SNAPSHOT'),
    segmentos_neo: opcoesFiltro_(todasValidas, 'SEGMENTO_NEO_ID', 'SEGMENTO_NEO_SNAPSHOT'),
    clientes: opcoesFiltro_(todasValidas, 'CLIENTE_ID', 'CLIENTE_NOME_SNAPSHOT'),
    produtos: opcoesProdutoFiltro_(todasValidas),
    modalidades: valoresUnicos_(todasValidas, 'MODALIDADE'),
    ufs: valoresUnicos_(todasValidas, 'UF_DESTINO')
  };

  return {
    ok: true,
    origem: 'VENDAS',
    kpis: kpis,
    dentro_fora: dentro_fora,
    filtros: filtros,
    mensal: mensal,
    anual: anual,
    segmentos_final: segmentosFinal,
    segmentos_neo: segmentosNeo,
    clientes: clientes,
    produtos: produtos,
    produtos_geral: produtosGeral,
    cliente_mensal: clienteMensal,
    estados: estados
  };
}

function vendaPassaFiltrosDashboard_(v, p, considerarData) {
  if (String(v.STATUS || '').toUpperCase() === 'CANCELADO') return false;

  const filtroFinal = String(p.segmento_final_id || '').trim();
  const filtroNeo = String(p.segmento_neo_id || '').trim();
  const filtroCliente = String(p.cliente_id || '').trim();
  const filtroProduto = String(p.produto_id || '').trim();
  const filtroModalidade = String(p.modalidade || '').trim();
  const filtroUf = String(p.uf || '').trim().toUpperCase();

  if (filtroFinal && String(v.SEGMENTO_FINAL_ID || '') !== filtroFinal) return false;
  if (filtroNeo && String(v.SEGMENTO_NEO_ID || '') !== filtroNeo) return false;
  if (filtroCliente && String(v.CLIENTE_ID || '') !== filtroCliente) return false;
  if (filtroProduto && String(v.__DASH_PRODUTO || chaveProdutoDashboard_(v)) !== filtroProduto) return false;
  if (filtroModalidade && String(v.MODALIDADE || '') !== filtroModalidade) return false;
  if (filtroUf && String(v.UF_DESTINO || '').toUpperCase() !== filtroUf) return false;

  if (considerarData) {
    const dt = v.__DASH_DATA || '';
    const ini = normalizarDataFiltro_(p.dt_inicio);
    const fim = normalizarDataFiltro_(p.dt_fim);
    if (ini && dt && dt < ini) return false;
    if (fim && dt && dt > fim) return false;
  }

  return true;
}

function chaveProdutoDashboard_(v) {
  const sku = String(v.SKU || '').trim();
  const desc = String(v.DESCRICAO || '').trim();
  return [sku, desc].join('|');
}

function opcoesProdutoFiltro_(dados) {
  const mapa = {};
  dados.forEach(function(v) {
    const id = chaveProdutoDashboard_(v);
    const sku = String(v.SKU || '').trim();
    const desc = String(v.DESCRICAO || '').trim();
    if (!sku && !desc) return;
    mapa[id] = [sku, desc].filter(String).join(' • ');
  });

  return Object.keys(mapa).map(function(id) {
    return { id: id, label: mapa[id] };
  }).sort(function(a, b) {
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

function resumirKpisDashboard_(dados) {
  const k = {
    faturamento:0, custo:0, dv:0, df:0, lucro:0, qtde:0,
    registros:0, vendas:0, ticket_medio:0, margem_lucro:0, dv_pct:0, df_pct:0
  };
  const vendas = {};

  (dados || []).forEach(function(v) {
    k.faturamento += numero_(v.VALOR_TOTAL);
    k.custo += numero_(v.CUSTO_TOTAL);
    k.dv += numero_(v.DV_VALOR);
    k.df += numero_(v.DF_VALOR);
    k.lucro += numero_(v.LUCRO);
    k.qtde += numero_(v.QTDE);
    k.registros++;
    vendas[chaveVendaDashboard_(v)] = true;
  });

  k.vendas = Object.keys(vendas).length;
  k.ticket_medio = k.vendas ? k.faturamento / k.vendas : 0;
  k.margem_lucro = k.faturamento ? k.lucro / k.faturamento : 0;
  k.dv_pct = k.faturamento ? k.dv / k.faturamento : 0;
  k.df_pct = k.faturamento ? k.df / k.faturamento : 0;
  return k;
}

function registrarUnicosAgregado_(mapa, chave, chaveVenda, clienteId) {
  const k = String(chave || 'N/I');
  const item = mapa[k];
  if (!item) return;
  if (!item.__vendas) item.__vendas = {};
  if (!item.__clientes) item.__clientes = {};
  if (chaveVenda) item.__vendas[String(chaveVenda)] = true;
  if (clienteId) item.__clientes[String(clienteId)] = true;
}

function chaveVendaDashboard_(v) {
  const pedidoId = String(v.PEDIDO_ID || '').trim();
  if (pedidoId) return 'PEDIDO_ID|' + pedidoId;

  const pedidoOrigem = String(v.PEDIDO_ORIGEM || '').trim();
  if (pedidoOrigem) {
    return [
      'HIST',
      String(v.ANO || ''),
      pedidoOrigem,
      String(v.CLIENTE_ID || v.CLIENTE_NOME_SNAPSHOT || '')
    ].join('|');
  }

  return 'VENDA|' + String(v.ID_VENDA || Utilities.getUuid());
}

function agregarDashboard_(mapa, chave, faturamento, custo, dv, df, lucro, qtde, meta) {
  const k = String(chave || 'N/I');
  if (!mapa[k]) {
    mapa[k] = Object.assign({
      chave:k, faturamento:0, custo:0, dv:0, df:0, lucro:0, qtde:0, registros:0
    }, meta || {});
  }

  mapa[k].faturamento += faturamento;
  mapa[k].custo += custo;
  mapa[k].dv += dv;
  mapa[k].df += df;
  mapa[k].lucro += lucro;
  mapa[k].qtde += qtde;
  mapa[k].registros++;
}

function ordenarAgregados_(mapa, campo, desc) {
  return Object.keys(mapa).map(function(k) {
    const x = mapa[k];
    x.vendas = x.__vendas ? Object.keys(x.__vendas).length : x.registros;
    x.clientes = x.__clientes ? Object.keys(x.__clientes).length : 0;
    x.ticket_medio = x.vendas ? x.faturamento / x.vendas : 0;
    x.margem = x.faturamento ? x.lucro / x.faturamento : 0;
    x.participacao = 0;
    delete x.__vendas;
    delete x.__clientes;
    return x;
  }).sort(function(a,b) {
    const av = a[campo];
    const bv = b[campo];

    if (typeof av === 'string' || typeof bv === 'string') {
      const cmp = String(av || '').localeCompare(String(bv || ''), 'pt-BR');
      return desc ? -cmp : cmp;
    }
    return desc ? numero_(bv) - numero_(av) : numero_(av) - numero_(bv);
  });
}

function opcoesFiltro_(dados, campoId, campoLabel) {
  const mapa = {};
  dados.forEach(function(v) {
    const id = String(v[campoId] || '').trim();
    const label = String(v[campoLabel] || '').trim();
    if (id && label) mapa[id] = label;
  });

  return Object.keys(mapa).map(function(id) {
    return { id:id, label:mapa[id] };
  }).sort(function(a,b) {
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

function valoresUnicos_(dados, campo) {
  const mapa = {};
  dados.forEach(function(v) {
    const x = String(v[campo] || '').trim();
    if (x) mapa[x] = true;
  });
  return Object.keys(mapa).sort(function(a,b) {
    return a.localeCompare(b, 'pt-BR');
  });
}

function normalizarDataFiltro_(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }

  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];

  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + '-' + br[2] + '-' + br[1];

  return '';
}

function menorDataVendas_(dados) {
  let min = '';
  dados.forEach(function(v) {
    const d = v.__DASH_DATA || normalizarDataFiltro_(v.DATA_VENDA);
    if (d && (!min || d < min)) min = d;
  });
  return min;
}

function maiorDataVendas_(dados) {
  let max = '';
  dados.forEach(function(v) {
    const d = v.__DASH_DATA || normalizarDataFiltro_(v.DATA_VENDA);
    if (d && (!max || d > max)) max = d;
  });
  return max;
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

function listarObjetosPorValor_(nomeAba, nomeColuna, valor) {
  const sh = aba_(nomeAba);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const col = headers.indexOf(String(nomeColuna)) + 1;
  if (!col) return [];

  const alvo = String(valor == null ? '' : valor);
  const ids = sh.getRange(2, col, lastRow - 1, 1).getValues();
  const linhas = [];
  ids.forEach(function(r, i) {
    if (String(r[0] == null ? '' : r[0]) === alvo) linhas.push(i + 2);
  });
  if (!linhas.length) return [];

  const blocos = [];
  let ini = linhas[0];
  let fim = linhas[0];
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i] === fim + 1) fim = linhas[i];
    else {
      blocos.push([ini, fim]);
      ini = fim = linhas[i];
    }
  }
  blocos.push([ini, fim]);

  const objetos = [];
  blocos.forEach(function(b) {
    const vals = sh.getRange(b[0], 1, b[1] - b[0] + 1, lastCol).getValues();
    vals.forEach(function(r) {
      const o = {};
      headers.forEach(function(h, i) { o[h] = r[i]; });
      objetos.push(o);
    });
  });
  return objetos;
}

function objetoPorValor_(nomeAba, nomeColuna, valor) {
  const lista = listarObjetosPorValor_(nomeAba, nomeColuna, valor);
  return lista.length ? lista[0] : null;
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
