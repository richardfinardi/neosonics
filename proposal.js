(function(){
  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function num(v){var n=Number(v||0);return Number.isFinite(n)?n:0}
  function money(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(num(v))}
  function dateBR(v){
    if(!v)return '';
    var s=String(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return m[3]+'/'+m[2]+'/'+m[1];
    var d=new Date(v);return isNaN(d.getTime())?s:d.toLocaleDateString('pt-BR');
  }
  function addDays(v,days){
    var s=String(v||''),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var d=m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):new Date();
    d.setDate(d.getDate()+days);
    return d.toLocaleDateString('pt-BR');
  }
  function currentClient(id,name){
    var list=(typeof APP_DATA!=='undefined'&&Array.isArray(APP_DATA.clients))?APP_DATA.clients:[];
    return list.find(function(c){return String(c.ID_CLIENTE||'')===String(id||'')}) ||
      list.find(function(c){return String(c.NOME_FANTASIA||c.RAZAO_SOCIAL||'').trim().toUpperCase()===String(name||'').trim().toUpperCase()}) || {};
  }
  function clientName(c,q){return String((c&&c.RAZAO_SOCIAL)||(q&&q.CLIENTE_NOME_SNAPSHOT)||(c&&c.NOME_FANTASIA)||'').trim()}
  function address(c){
    var line=[c.LOGRADOURO,c.NUMERO?('nº '+c.NUMERO):'',c.COMPLEMENTO].filter(Boolean).join(', ');
    if(c.CEP)line+=(line?' ':'')+'CEP '+c.CEP;
    return line;
  }
  function brand(){
    return '<div class="neo-brand"><div class="neo-mark"><i></i><i></i></div><div class="neo-name">NEO-SONICS</div></div>';
  }
  function quoteFromScreen(){
    if(typeof quoteState==='undefined')return null;
    var q={
      ID_ORCAMENTO:quoteState.id||'',
      NUMERO_ORCAMENTO:quoteState.number||'',
      STATUS:quoteState.status||'RASCUNHO',
      DATA_ORCAMENTO:new Date().toISOString().slice(0,10),
      CLIENTE_ID:document.getElementById('qClientId')?.value||'',
      CLIENTE_NOME_SNAPSHOT:document.getElementById('qClient')?.value||'',
      CIDADE_UF:document.getElementById('qCity')?.value||'',
      CONTATO:document.getElementById('qContact')?.value||'',
      VENDEDOR:document.getElementById('qSeller')?.value||'',
      COND_PAGAMENTO:document.getElementById('qPayment')?.value||'',
      PRAZO_ENTREGA:document.getElementById('qDelivery')?.value||'',
      itens:Array.isArray(quoteState.items)?quoteState.items:[]
    };
    return q;
  }
  function contractualClauses(q,c,total){
    var cli=esc(clientName(c,q)||'CLIENTE');
    var prazo=esc(q.PRAZO_ENTREGA||'a combinar');
    var garantia='90 dias';
    var frete='FOB';
    return [
      ['I - Descrição Detalhada do Objeto',
       'Cada produto já possui em seu campo o detalhamento específico para o seu funcionamento. São eles:<br>'+
       '• SONOTRODOS – nas frequências de 20 / 30 / 35 / 40kHz;<br>'+
       '• BOOSTERS STANDAR – nas frequências de 20 / 30 / 35 / 40kHz e amplitude de 1:0,6 / 1:1,0 / 1:1,5 / 1:2,0 / 1:2,5;<br>'+
       '• CONVERSORES – nas frequências de 20 / 30 / 35 / 40kHz com diversas conexões;<br>'+
       '• BIGORNAS – para selagem de embalagens flexíveis;<br>'+
       '• BERÇOS SUPORTE – para centralização e acomodação de produtos diversos.'],
      ['II - Valor Total do contrato',
       'O valor total do presente contrato é de: <b>'+money(total)+'</b>, para os produtos listados na tabela inicial ou a soma deles, quando mais que um, dentro do escopo de cada item.'],
      ['III - Tributos',
       'Os tributos aplicáveis, incluindo PIS, COFINS, IPI e ISS, serão considerados conforme legislação vigente na data de emissão da Nota Fiscal. Novos tributos ou alterações de alíquotas durante a vigência do contrato poderão ensejar revisão dos preços, mediante comum acordo entre as partes, a fim de reequilibrar a equação econômico-financeira.'],
      ['IV - Prazo de Entrega/Execução',
       'O prazo para a execução do produto será de <b>'+prazo+'</b>, contado a partir do envio da aprovação do orçamento via e-mail. Atrasos decorrentes de motivos fora do controle da NEO-SONICS, como desastres naturais, greve de órgãos públicos e portuários, entre outros, não serão de sua responsabilidade.'],
      ['V - Condições de Frete',
       'O frete e custos de transporte serão de responsabilidade exclusiva da empresa '+cli+'. Será na modalidade <b>'+frete+'</b>. Caso aconteça extravio do produto pela transportadora contratada pelo cliente, a resolução deverá ser feita entre o cliente e a transportadora. Caso a NEO-SONICS seja solicitada a realizar o transporte, os custos adicionais serão repassados ao cliente. Devoluções não serão aceitas sem alinhamento prévio entre as partes.'],
      ['VI - Preço e Condições de Pagamento',
       'O valor total da venda será de <b>'+money(total)+'</b>. Para itens de importação com valores em USD, a conversão para Reais será realizada na data da efetivação do pagamento, utilizando-se a taxa de câmbio de venda praticada pelo Banco Central do Brasil no dia útil imediatamente anterior. Para vendas faturadas, a NEO-SONICS se reserva o direito de realizar consultas aos órgãos de crédito para aprovação do pedido. Os valores da proposta estarão sujeitos a alterações após a validade do orçamento.'],
      ['VII - Prazo da Garantia',
       'A NEO-SONICS EQUIPAMENTOS LTDA oferece garantia de <b>'+garantia+'</b> para os produtos listados na tabela inicial dentro do escopo de cada item.'],
      ['VIII - Início da Contagem da Garantia',
       'O prazo de garantia terá validade a partir da data de emissão da Nota Fiscal.'],
      ['IX - Cobertura da Garantia',
       'A garantia cobre defeitos de projeto, fabricação, montagem ou componentes que afetem a funcionalidade e o desempenho do produto, conforme especificações técnicas. Para peças desenvolvidas em dispositivos, berços de apoio ou peças de conjuntos, a garantia será de 180 dias. Máquinas e equipamentos Dukane possuem garantia de 360 dias; os demais itens listados no escopo comercial seguem os prazos informados na proposta.'],
      ['X - Exclusões da Garantia',
       'A. Danos causados por uso indevido, instalação inadequada, negligência, acidentes ou condições de operação que excedam os limites e especificações técnicas do produto.<br>B. Danos resultantes de manutenção ou reparos realizados por terceiros não autorizados pela NEO-SONICS.<br>C. Desgaste natural do produto em função do uso.'],
      ['XI - Obrigações da NEO-SONICS em Caso de Ativação da Garantia',
       'Em caso de constatação de defeito coberto pela garantia, a NEO-SONICS se compromete a providenciar, sem ônus adicional ao cliente, o reparo ou a substituição do item defeituoso, conforme avaliação técnica, no menor prazo possível. Para itens adquiridos diretamente entre o cliente e a Dukane, as garantias serão tratadas diretamente entre as partes, cabendo à NEO-SONICS auxiliar na utilização e em treinamentos quando aplicável.'],
      ['XII - Padrões de Execução',
       'O produto será fornecido em estrita conformidade com as boas práticas de engenharia, padrões da indústria e normas técnicas aplicáveis, visando segurança pessoal e patrimonial, confiabilidade e flexibilidade da solução.'],
      ['XIII - Qualidade dos Componentes',
       'Para a execução do presente contrato, a NEO-SONICS utilizará componentes e materiais de qualidade comprovada e, onde aplicável, dará preferência a fornecedores homologados ou que atendam a padrões técnicos equivalentes.'],
      ['XIV - Processos de Teste e Aceitação',
       'A NEO-SONICS realizará os testes de funcionamento e desempenho necessários para o objeto do contrato, garantindo sua plena operacionalidade antes da liberação. Relatórios de testes e ensaios, quando aplicáveis, serão disponibilizados ao cliente para verificação da conformidade.'],
      ['XV - Comunicações',
       'Toda comunicação formal relativa a este contrato deverá ser realizada por escrito via e-mail ou correspondência física, direcionada aos contatos entre as partes. Alterações de contato devem ser informadas mutuamente.'],
      ['XVI - Confidencialidade',
       'As Partes comprometem-se a manter a confidencialidade de todas as informações técnicas, comerciais, financeiras ou quaisquer outras obtidas em razão deste contrato, mesmo após seu término ou rescisão. Esta obrigação não se aplica a informações de domínio público ou legalmente exigidas.'],
      ['XVII - Modificações e Aditivos',
       'Os pedidos feitos com base neste orçamento serão executados pela NEO-SONICS em sua íntegra. Toda exigência ou alteração no escopo deste contrato poderá gerar impactos nos prazos e custos e deverá ser formalizada por meio de Termo Aditivo previamente acordado entre as Partes.'],
      ['XVIII - Aceitação da Proposta de Orçamento',
       'A empresa '+cli+' declara ciência das cláusulas deste instrumento. A aprovação formal da proposta, por assinatura, emissão de pedido de compra ou outro meio que demonstre inequívoca aceitação, implica na automática conversão desta proposta em contrato, vinculando as partes aos termos e condições aqui estabelecidos.'],
      ['XIX - Do Cancelamento Unilateral pela COMPRADORA e Multa Compensatória',
       'A formalização e aprovação da proposta implicam na mobilização de recursos humanos, técnicos e administrativos pela NEO-SONICS. Em caso de cancelamento unilateral pela COMPRADORA, após a aprovação e sem justa causa atribuível à NEO-SONICS, será devida multa compensatória equivalente a 20% do valor total do contrato. Valores já pagos poderão ser utilizados para compensação da multa; eventual saldo devido deverá ser quitado em até 10 dias após a notificação de cancelamento, salvo acordo diferente entre as partes.'],
      ['XX - Da Rescisão',
       'O presente contrato poderá ser rescindido por qualquer das Partes em caso de comprovado e injustificado descumprimento de suas cláusulas ou condições, mediante notificação escrita à parte infratora e concessão de prazo razoável para sanar a irregularidade. Os custos incorridos até a data da rescisão serão de responsabilidade da parte que deu causa, conforme apuração.'],
      ['XXI - Do Foro',
       'As Partes elegem o Foro da Comarca de OSASCO para dirimir quaisquer dúvidas ou litígios decorrentes do presente contrato, com exclusão de qualquer outro, por mais privilegiado que seja.'],
      ['XXII - Formalização e Validade do Contrato',
       'As partes reconhecem que a manifestação inequívoca de aceite deste instrumento, realizada por meio eletrônico — incluindo resposta de e-mail corporativo, envio de pedido de compra, aceite em plataforma digital ou outro meio eletrônico que permita comprovar autoria e integridade — produz os mesmos efeitos jurídicos da assinatura física. O registro eletrônico de aceite passará a integrar o presente contrato como prova da concordância das partes.'],
      ['XXIII - Título Executivo Extrajudicial',
       'O presente instrumento particular, uma vez devidamente assinado pelas Partes, constituirá título executivo extrajudicial, nos termos da legislação aplicável.']
    ];
  }
  function proposalHtml(q){
    q=q||{};
    var c=currentClient(q.CLIENTE_ID,q.CLIENTE_NOME_SNAPSHOT);
    var items=Array.isArray(q.itens)?q.itens:[];
    var total=items.reduce(function(s,x){return s+num(x.PRECO_FINAL_TOTAL)},0)||num(q.VALOR_TOTAL);
    var issue=q.DATA_ORCAMENTO||new Date().toISOString().slice(0,10);
    var company=clientName(c,q);
    var city=[c.CIDADE,c.UF].filter(Boolean).join(' - ') || q.CIDADE_UF || '';
    var clauses=contractualClauses(q,c,total);
    var rows=items.map(function(x,i){
      var qty=num(x.QTDE)||1,unit=num(x.PRECO_FINAL_UNIT)||(num(x.PRECO_FINAL_TOTAL)/qty);
      return '<tr><td class="center">'+(i+1)+'</td><td>'+esc(x.SKU||x.CODIGO||'')+'</td><td>'+esc(x.NCM||'')+'</td><td>'+esc(x.DESCRICAO||'')+'</td><td class="center">'+qty.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td><td class="money">'+money(unit)+'</td><td class="money"><b>'+money(x.PRECO_FINAL_TOTAL)+'</b></td></tr>';
    }).join('');
    if(!rows)rows='<tr><td colspan="7" class="center">Nenhum item no orçamento.</td></tr>';
    var clauseHtml=clauses.map(function(x){return '<section class="clause"><h3>'+x[0]+':</h3><p>'+x[1]+'</p></section>'}).join('');
    var titleNum=q.NUMERO_ORCAMENTO||'PRÉVIA';
    var payment=esc(q.COND_PAGAMENTO||'A combinar');
    var delivery=esc(q.PRAZO_ENTREGA||'A combinar');
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>Proposta '+esc(titleNum)+'</title><style>'+
      '@page{size:A4;margin:9mm 10mm 11mm}*{box-sizing:border-box}body{margin:0;background:#eceff1;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:10.5px;line-height:1.25}.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:8px;padding:10px;background:#152536}.toolbar button{border:0;border-radius:7px;padding:9px 14px;font-weight:700;cursor:pointer}.toolbar .print{background:#69c4c9;color:#08282a}.toolbar .close{background:#fff;color:#222}.paper{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:0;box-shadow:0 8px 30px #0002}.content{padding:0}.topgrid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #111}.topgrid>div{min-height:20px;border-right:1px solid #111;border-bottom:1px solid #111;padding:4px 7px}.topgrid>div:nth-child(2n){border-right:0}.topgrid .brandcell{min-height:62px;display:flex;align-items:center}.topgrid .companycell{min-height:62px;text-align:center;font-size:9px}.topgrid .last{border-bottom:0}.neo-brand{display:flex;align-items:center;gap:9px}.neo-name{font-style:italic;font-weight:900;font-size:26px;color:#159ba7;letter-spacing:-1px}.neo-mark{position:relative;width:48px;height:48px;border-radius:50%;background:#159ba7;overflow:hidden}.neo-mark:before,.neo-mark:after,.neo-mark i{content:"";position:absolute;background:#fff;border-radius:50%}.neo-mark:before{width:34px;height:22px;left:7px;top:-4px}.neo-mark:after{width:34px;height:22px;right:-7px;bottom:4px}.neo-mark i:first-child{width:30px;height:17px;left:-8px;bottom:2px}.neo-mark i:last-child{width:22px;height:12px;right:5px;top:18px;background:#159ba7}.linegrid{margin-top:8px;border:1px solid #111}.r{display:grid;border-bottom:1px solid #111}.r:last-child{border-bottom:0}.r2{grid-template-columns:98px 1fr 64px 1fr}.r1{grid-template-columns:98px 1fr}.cell{padding:4px 7px;border-right:1px solid #111}.cell:last-child{border-right:0}.label{font-weight:700}.items{width:100%;border-collapse:collapse;margin-top:10px}.items th,.items td{border:1px solid #111;padding:5px 6px}.items th{background:#69c4c9;color:#fff;font-size:9px}.items th:nth-child(1){width:7%}.items th:nth-child(2){width:14%}.items th:nth-child(3){width:12%}.items th:nth-child(4){width:33%}.items th:nth-child(5){width:8%}.items th:nth-child(6),.items th:nth-child(7){width:13%}.center{text-align:center}.money{text-align:right;white-space:nowrap}.totalrow{display:flex;justify-content:flex-end;border:1px solid #111;border-top:0;padding:5px 7px;font-weight:700}.conditions{margin-top:10px;border:1px solid #111}.condHead,.sectionbar{text-align:center;font-weight:700}.condHead{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #111}.condHead div{padding:4px;border-right:1px solid #111}.condHead div:last-child{border-right:0}.condVals{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #111;text-align:center}.condVals div{padding:5px;border-right:1px solid #111}.condVals div:last-child{border-right:0}.condPay{padding:5px;text-align:center;border-bottom:1px solid #111}.guarantee{padding:5px}.sectionbar{margin:12px 0 8px;padding:4px;background:#69c4c9;color:#fff;border:1px solid #111}.obs{min-height:28px;border:1px solid #111;margin-top:-8px}.contract{margin-top:12px}.clause{break-inside:auto;margin:0 0 8px}.clause h3{font-size:10.5px;margin:0 0 1px}.clause p{margin:0;text-align:justify}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin:26px 0 8px}.sig{border-top:1px solid #111;padding-top:4px;text-align:center;font-weight:700}.page-note{font-size:8px;color:#555;text-align:center;margin-top:12px}@media print{body{background:#fff}.toolbar{display:none}.paper{width:auto;min-height:0;margin:0;box-shadow:none}.content{padding:0}.sectionbar{print-color-adjust:exact;-webkit-print-color-adjust:exact}.items th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'+
      '</style></head><body><div class="toolbar"><button class="print" onclick="window.print()">Imprimir / Salvar PDF</button><button class="close" onclick="window.close()">Fechar</button></div><main class="paper"><div class="content">'+
      '<div class="topgrid"><div class="brandcell">'+brand()+'</div><div class="companycell"><b>NEO-SONICS – EQUIPAMENTOS LTDA</b><br>RUA ESPÍRITO SANTO, 630 ROCHDALE<br>CEP 06220-090 – OSASCO – SP<br>(11) 4624-5256 Ramal: 221<br>CNPJ – 24.805.007/0001-49 / IE – 120.076.704.113</div>'+
      '<div><b>ORÇAMENTO DE PRODUTO:</b> '+esc(titleNum)+'</div><div><b>EMISSÃO:</b> '+dateBR(issue)+'</div>'+
      '<div class="last"><b>VENDEDOR:</b> '+esc(q.VENDEDOR||c.VENDEDOR||'')+'</div><div class="last"><b>VALIDADE:</b> '+addDays(issue,30)+'</div></div>'+
      '<div class="linegrid"><div class="r r2"><div class="cell label">CLIENTE:</div><div class="cell">'+esc(company)+'</div><div class="cell label">CNPJ:</div><div class="cell">'+esc(c.CNPJ_CPF||'')+'</div></div>'+
      '<div class="r r2"><div class="cell label">CONTATO:</div><div class="cell">'+esc(q.CONTATO||c.CONTATO||'')+'</div><div class="cell label">TELEFONE:</div><div class="cell">'+esc(c.TELEFONE||'')+'</div></div>'+
      '<div class="r r2"><div class="cell label">EMAIL:</div><div class="cell">'+esc(c.EMAIL||'')+'</div><div class="cell label">CELULAR:</div><div class="cell">'+esc(c.CELULAR||c.TELEFONE||'')+'</div></div>'+
      '<div class="r r1"><div class="cell label">ENDEREÇO:</div><div class="cell">'+esc(address(c))+'</div></div>'+
      '<div class="r r2"><div class="cell label">BAIRRO:</div><div class="cell">'+esc(c.BAIRRO||'')+'</div><div class="cell label">CIDADE:</div><div class="cell">'+esc(city)+'</div></div></div>'+
      '<table class="items"><thead><tr><th>ITEM</th><th>CÓDIGO</th><th>NCM</th><th>PRODUTO</th><th>QTD.</th><th>R$ UNIT.</th><th>R$ TOTAL</th></tr></thead><tbody>'+rows+'</tbody></table><div class="totalrow">VALOR TOTAL:&nbsp; '+money(total)+'</div>'+
      '<div class="conditions"><div class="condHead"><div>FORMA DE PAGAMENTO:</div><div>MODELO DE FRETE:</div><div>PRAZO DE ENTREGA:</div></div><div class="condVals"><div>TRANSFERÊNCIA BANCÁRIA</div><div>FOB</div><div>'+delivery+'</div></div><div class="condPay"><b>CONDIÇÕES DE PAGAMENTO:</b><br>'+payment+'</div><div class="guarantee"><b>GARANTIA:</b> 90 dias</div></div>'+
      '<div class="sectionbar">OBSERVAÇÕES ADICIONAIS</div><div class="obs"></div><div class="sectionbar">CLÁUSULAS CONTRATUAIS DE VENDAS</div><div class="contract">'+clauseHtml+'</div>'+
      '<div class="signatures"><div class="sig">NEO-SONICS – EQUIPAMENTOS LTDA</div><div class="sig">'+esc(company||'CLIENTE')+'</div></div><div class="page-note">Proposta gerada pelo sistema NEOSONICS</div></div></main></body></html>';
  }
  function openProposal(q){
    if(!q){alert('Não foi possível montar a proposta.');return}
    if(!Array.isArray(q.itens)||!q.itens.length){alert('Adicione pelo menos um item antes de gerar a proposta.');return}
    var w=window.open('','_blank');
    if(!w){alert('O navegador bloqueou a nova janela. Libere pop-ups para gerar a proposta.');return}
    w.document.open();w.document.write(proposalHtml(q));w.document.close();
  }
  window.printCurrentQuoteProposal=function(){openProposal(quoteFromScreen())};
  window.printQuoteById=async function(id){
    try{
      var j=await apiGet('orcamento_detalhe',{id:id});
      if(!j||!j.orcamento)throw new Error((j&&j.erro)||'Orçamento não encontrado');
      openProposal(j.orcamento);
    }catch(e){alert('Não foi possível gerar a proposta: '+e.message)}
  };
})();