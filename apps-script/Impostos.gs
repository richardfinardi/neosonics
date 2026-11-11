// Máscaras fiscais versionadas. Alíquotas guardadas como fração: 0,009 = 0,9%.
// A máscara serve à precificação, não substitui o enquadramento fiscal da NF-e.
const CAB_MASCARAS_IMPOSTOS_ = [
  'ID_MASCARA','NOME','ENQUADRAMENTO','DESTINO','UF_DESTINO','MUNICIPIO_DESTINO',
  'TIPO_VENDA','VIGENCIA_INICIO','VIGENCIA_FIM','CST_IBS_CBS','CCLASSTRIB',
  'OBS','ATIVO','DT_CRIACAO','DT_ATUALIZACAO'
];
const CAB_MASCARA_ITENS_ = [
  'ID_ITEM','ID_MASCARA','TRIBUTO','ALIQUOTA_PCT','REDUCAO_PCT',
  'INCLUI_MARKUP','ORDEM','OBS'
];

function garantirAbasMascarasImpostos_() {
  const ss = db_();
  [
    [ABAS.IMPOSTOS_MASCARAS, CAB_MASCARAS_IMPOSTOS_],
    [ABAS.IMPOSTOS_MASCARA_ITENS, CAB_MASCARA_ITENS_]
  ].forEach(function(config) {
    let sh = ss.getSheetByName(config[0]);
    if (!sh) {
      sh = ss.insertSheet(config[0]);
      sh.getRange(1, 1, 1, config[1].length).setValues([config[1]]);
      sh.setFrozenRows(1);
    } else {
      const existentes = cabecalhos_(sh);
      const faltantes = config[1].filter(function(h) { return !existentes[h]; });
      if (faltantes.length) {
        sh.getRange(1, sh.getLastColumn() + 1, 1, faltantes.length).setValues([faltantes]);
      }
    }
  });
}

function mascaraAtiva_(valor) {
  return !(valor === false || String(valor).toLowerCase() === 'false' || String(valor) === '0');
}

function listarMascarasImpostos_() {
  garantirAbasMascarasImpostos_();
  const mascaras = listarObjetos_(ABAS.IMPOSTOS_MASCARAS);
  const itens = listarObjetos_(ABAS.IMPOSTOS_MASCARA_ITENS);
  const agrupados = {};
  itens.forEach(function(x) {
    const id = String(x.ID_MASCARA || '');
    if (!agrupados[id]) agrupados[id] = [];
    agrupados[id].push(x);
  });
  return mascaras.map(function(m) {
    return Object.assign({}, m, {
      ATIVO: mascaraAtiva_(m.ATIVO),
      itens: (agrupados[String(m.ID_MASCARA)] || []).sort(function(a,b) {
        return numero_(a.ORDEM) - numero_(b.ORDEM);
      })
    });
  }).sort(function(a,b) {
    return String(b.VIGENCIA_INICIO || '').localeCompare(String(a.VIGENCIA_INICIO || '')) ||
      String(a.NOME || '').localeCompare(String(b.NOME || ''), 'pt-BR');
  });
}

function salvarMascaraImpostos_(entrada) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const m = entrada || {};
    const nome = String(m.NOME || '').trim();
    if (!nome) throw new Error('Informe o nome da máscara.');
    const enquadramento = normalizarTexto_(m.ENQUADRAMENTO || 'NORMAL');
    const destino = normalizarTexto_(m.DESTINO || 'TODOS');
    const tipo = normalizarTipoVendaComercial_(m.TIPO_VENDA || 'VENDA');
    const uf = String(m.UF_DESTINO || '').trim().toUpperCase();
    const municipio = normalizarTexto_(m.MUNICIPIO_DESTINO || '');
    if (municipio && !uf) throw new Error('Informe a UF antes do município.');
    if (uf && !/^[A-Z]{2}$/.test(uf)) throw new Error('UF inválida.');
    const inicio = normalizarDataFiltro_(m.VIGENCIA_INICIO);
    const fim = normalizarDataFiltro_(m.VIGENCIA_FIM);
    if (!inicio) throw new Error('Informe a data inicial da vigência.');
    if (fim && fim < inicio) throw new Error('A data final não pode ser anterior à inicial.');
    const ativos = mascaraAtiva_(m.ATIVO);
    const entradas = Array.isArray(m.itens) ? m.itens : [];
    if (!entradas.length || entradas.length > 40) {
      throw new Error('Cadastre entre 1 e 40 tributos por máscara.');
    }
    const itens = entradas.map(function(x,i) {
      const tributo = String(x.TRIBUTO || '').trim().toUpperCase();
      if (!tributo) throw new Error('Informe o tributo na linha ' + (i+1) + '.');
      const aliquota = numero_(x.ALIQUOTA_PCT);
      const reducao = numero_(x.REDUCAO_PCT);
      if (!isFinite(aliquota) || aliquota < 0 || aliquota > 1) {
        throw new Error('Alíquota inválida na linha ' + (i+1) + '. Use 0,9% = 0,009.');
      }
      if (!isFinite(reducao) || reducao < 0 || reducao > 1) {
        throw new Error('Redução inválida na linha ' + (i+1) + '.');
      }
      return {
        TRIBUTO: tributo,
        ALIQUOTA_PCT: aliquota,
        REDUCAO_PCT: reducao,
        INCLUI_MARKUP: mascaraAtiva_(x.INCLUI_MARKUP),
        ORDEM: i+1,
        OBS: String(x.OBS || '').trim()
      };
    });
    const total = itens.reduce(function(s,x) {
      return s + (x.INCLUI_MARKUP ? x.ALIQUOTA_PCT * (1-x.REDUCAO_PCT) : 0);
    }, 0);
    if (total >= 1) throw new Error('Total de impostos para markup deve ser inferior a 100%.');

    garantirAbasMascarasImpostos_();
    const sh = aba_(ABAS.IMPOSTOS_MASCARAS);
    const headers = cabecalhos_(sh);
    const id = String(m.ID_MASCARA || '').trim() || novoId_('MSI');
    const linha = localizarLinha_(sh, headers.ID_MASCARA, id);
    const anterior = linha ? objetoDaLinha_(sh, linha) : null;
    const demais = listarObjetos_(ABAS.IMPOSTOS_MASCARAS);
    if (ativos) {
      const conflito = demais.find(function(x) {
        if (!mascaraAtiva_(x.ATIVO) || String(x.ID_MASCARA) === id) return false;
        if (normalizarTexto_(x.ENQUADRAMENTO) !== enquadramento ||
            normalizarTexto_(x.DESTINO) !== destino ||
            normalizarTexto_(x.TIPO_VENDA) !== normalizarTexto_(tipo) ||
            String(x.UF_DESTINO || '').toUpperCase() !== uf ||
            normalizarTexto_(x.MUNICIPIO_DESTINO || '') !== municipio) return false;
        const xi = normalizarDataFiltro_(x.VIGENCIA_INICIO) || '0000-01-01';
        const xf = normalizarDataFiltro_(x.VIGENCIA_FIM) || '9999-12-31';
        return inicio <= xf && xi <= (fim || '9999-12-31');
      });
      if (conflito) throw new Error('Existe uma máscara ativa para o mesmo contexto e período: ' + conflito.NOME);
    }
    const agora = isoAgora_();
    const salva = {
      ID_MASCARA:id, NOME:nome, ENQUADRAMENTO:enquadramento,
      DESTINO:destino, UF_DESTINO:uf, MUNICIPIO_DESTINO:municipio,
      TIPO_VENDA:tipo, VIGENCIA_INICIO:inicio, VIGENCIA_FIM:fim,
      CST_IBS_CBS:String(m.CST_IBS_CBS || '').trim(),
      CCLASSTRIB:String(m.CCLASSTRIB || '').trim(),
      OBS:String(m.OBS || '').trim(), ATIVO:ativos,
      DT_CRIACAO:anterior ? anterior.DT_CRIACAO : agora,
      DT_ATUALIZACAO:agora
    };
    if (linha) escreverObjetoNaLinha_(sh, linha, salva);
    else appendObjeto_(ABAS.IMPOSTOS_MASCARAS, salva);
    deletarLinhasPorValor_(ABAS.IMPOSTOS_MASCARA_ITENS, 'ID_MASCARA', id);
    appendObjetos_(ABAS.IMPOSTOS_MASCARA_ITENS, itens.map(function(x) {
      return Object.assign({ID_ITEM:novoId_('IMI'),ID_MASCARA:id},x);
    }));
    SpreadsheetApp.flush();
    return {ok:true,mascara:Object.assign({},salva,{itens:itens}),atualizado:!!linha};
  } finally {
    lock.releaseLock();
  }
}

function mascaraVigente_(m, data, enquadramento, destino, tipo, uf, municipio) {
  if (!mascaraAtiva_(m.ATIVO)) return false;
  const inicio = normalizarDataFiltro_(m.VIGENCIA_INICIO);
  const fim = normalizarDataFiltro_(m.VIGENCIA_FIM);
  if (inicio && data < inicio) return false;
  if (fim && data > fim) return false;
  if (normalizarTexto_(m.ENQUADRAMENTO) !== normalizarTexto_(enquadramento)) return false;
  if (normalizarTexto_(m.TIPO_VENDA) !== normalizarTexto_(tipo)) return false;
  if (normalizarTexto_(m.DESTINO) !== 'TODOS' && normalizarTexto_(m.DESTINO) !== normalizarTexto_(destino)) return false;
  if (m.UF_DESTINO && String(m.UF_DESTINO).toUpperCase() !== String(uf || '').toUpperCase()) return false;
  if (m.MUNICIPIO_DESTINO && normalizarTexto_(m.MUNICIPIO_DESTINO) !== normalizarTexto_(municipio || '')) return false;
  return true;
}

function totalMascaraImpostos_(mascara) {
  return (mascara.itens || []).reduce(function(s,x) {
    const inclui = mascaraAtiva_(x.INCLUI_MARKUP);
    return s + (inclui ? numero_(x.ALIQUOTA_PCT) * (1 - numero_(x.REDUCAO_PCT)) : 0);
  },0);
}

// O total legado só é usado quando não há máscara vigente aplicável.
function resolverImpostosPorContexto_(enquadramento, destino, tipo, data, uf, municipio, idExplicito) {
  const dia = normalizarDataFiltro_(data) || isoAgora_().substring(0, 10);
  const candidatas = listarMascarasImpostos_().filter(function(m) {
    return mascaraVigente_(m, dia, enquadramento, destino, tipo, uf, municipio);
  });
  if (idExplicito) {
    const selecionada = candidatas.find(function(m) {
      return String(m.ID_MASCARA) === String(idExplicito);
    });
    if (!selecionada) throw new Error('Máscara fiscal selecionada não está ativa ou não se aplica a esta operação/data.');
    candidatas.splice(0, candidatas.length, selecionada);
  }
  candidatas.sort(function(a,b) {
    function score(x) {
      return (x.MUNICIPIO_DESTINO ? 4 : 0) + (x.UF_DESTINO ? 2 : 0) +
        (normalizarTexto_(x.DESTINO) === 'TODOS' ? 0 : 1);
    }
    return score(b)-score(a) ||
      String(b.VIGENCIA_INICIO).localeCompare(String(a.VIGENCIA_INICIO));
  });
  if (candidatas.length) {
    const m = candidatas[0];
    const total = totalMascaraImpostos_(m);
    if (total >= 1) throw new Error('Máscara fiscal inválida: total igual ou superior a 100%.');
    return {
      percentual:total,
      mascara_id:String(m.ID_MASCARA),
      detalhes:JSON.stringify({nome:m.NOME,inicio:normalizarDataFiltro_(m.VIGENCIA_INICIO),itens:m.itens})
    };
  }
  if (dia >= '2027-01-01') {
    throw new Error('Não existe máscara de impostos ativa para esta operação a partir de 2027. Cadastre a máscara fiscal e suas alíquotas antes de emitir orçamento ou pedido.');
  }
  return {
    percentual:getImpostoPctLegado_(enquadramento,destino,tipo),
    mascara_id:'',
    detalhes:''
  };
}

function getImpostoPctLegado_(enquadramento, destino, tipoTributario) {
  const regras = dadosAbaCacheados_(ABAS.TABELA_IMPOSTOS,300);
  const e = normalizarTexto_(enquadramento);
  const d = normalizarTexto_(destino);
  const t = normalizarTexto_(tipoTributario);
  const regra = regras.find(function(r) {
    return mascaraAtiva_(r.ATIVO) &&
      normalizarTexto_(r.ENQUADRAMENTO) === e &&
      normalizarTexto_(r.DESTINO) === d &&
      normalizarTexto_(r.TIPO_VENDA) === t;
  });
  if (!regra) throw new Error('Regra de imposto não encontrada para ' + enquadramento + ' / ' + destino + ' / ' + tipoTributario);
  return numero_(regra.IMPOSTOS_PCT);
}
