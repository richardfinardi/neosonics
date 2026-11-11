// Adiciona a área de máscaras mantendo a navegação padrão do sistema.
(function registerTaxMasksView(){
  const nav=document.querySelector('.nav button[data-page="segments"]');
  if(nav){
    nav.insertAdjacentHTML("afterend",'<button data-page="taxMasks"><span class="ico">%</span><span class="nav-text">Máscaras de impostos</span></button>');
    nav.nextElementSibling.onclick=function(){
      document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
      this.classList.add("active");
      document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
      document.getElementById("taxMasks").classList.add("active");
      currentPage="taxMasks";
      document.getElementById("pageTitle").textContent="Máscaras de impostos";
      document.getElementById("crumb").textContent="Máscaras de impostos";
      closeMobileMenu();
      window.scrollTo({top:0,behavior:"smooth"});
      initTaxMasksPage();
    };
  }
  names.taxMasks="Máscaras de impostos";
  GUIDES.taxMasks={title:"Máscaras de impostos",steps:[
    ["Defina o contexto","Escolha operação, destino, UF/município opcional e vigência."],
    ["Cadastre tributos","Inclua CBS, IBS estadual/municipal e impostos atuais para cada cenário fiscal."],
    ["Confira o markup","A soma considera os tributos marcados, já com eventual redução de alíquota."],
    ["Preserve históricos","Máscaras futuras não alteram propostas já registradas."]
  ]};
  const markup=`
  <section id="taxMasks" class="page">
    <div class="hero">
      <div><h2>Máscaras de impostos</h2><p>Tributos e alíquotas por operação, destino e vigência. Preparado para CBS, IBS e a transição de 2027.</p></div>
      <div class="badge">Reforma tributária • 2027</div>
    </div>
    <div class="guide-strip">
      <b>Como funciona:</b><span>1. Cadastre a máscara e sua vigência</span><span>2. Inclua os tributos e alíquotas</span><span>3. O orçamento usa a máscara vigente</span>
      <button type="button" onclick="openGuide('taxMasks')">Ver guia</button>
    </div>
    <div class="tax-mask-help">
      <b>Importante:</b> os percentuais da CBS em 2027 dependem das alíquotas legalmente fixadas e da operação.
      O IBS segue sua transição, enquanto ICMS/ISS continuam vigentes na fase inicial.
      Não são aplicadas alíquotas futuras presumidas. Esta tela orienta a <b>formação de preços</b>,
      não emite nem valida documentos fiscais. Confira CST, cClassTrib, NCM e demais exigências com o responsável fiscal.
    </div>
    <div class="grid2">
      <div class="panel tax-mask-list">
        <div class="panel-head">
          <div><div class="panel-title">Máscaras cadastradas</div><div class="panel-sub">Regras existentes continuam disponíveis como legado.</div></div>
          <button type="button" class="secondary" onclick="newTaxMask()">+ Nova máscara</button>
        </div>
        <div class="panel-body" style="padding-bottom:6px">
          <div class="form-grid">
            <div class="field"><label>Buscar</label><input id="taxMaskSearch" placeholder="Nome, operação, destino..." oninput="renderTaxMasksList()"></div>
            <label class="inline-check" style="align-self:end;padding-bottom:10px"><input id="taxMaskShowInactive" type="checkbox" onchange="renderTaxMasksList()"> Mostrar inativas</label>
          </div>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>Máscara</th><th>Operação</th><th>Vigência</th><th>Markup</th><th>Status</th><th></th></tr></thead>
          <tbody id="taxMasksBody"><tr class="empty-row"><td colspan="6">Carregando...</td></tr></tbody></table>
        </div>
      </div>
      <div class="panel tax-mask-editor">
        <div class="panel-head"><div><div class="panel-title" id="taxMaskEditorTitle">Nova máscara</div><div class="panel-sub">Digite as alíquotas em %, por exemplo 0,9 para 0,9%.</div></div></div>
        <div class="panel-body">
          <input type="hidden" id="taxMaskId">
          <div class="form-grid">
            <div class="field full"><label>Nome da máscara *</label><input id="taxMaskName" placeholder="Ex.: Venda SP • 2027"></div>
            <div class="field"><label>Enquadramento</label><select id="taxMaskFramework"><option value="NORMAL">Normal</option><option value="SN SUB">SN SUB</option></select></div>
            <div class="field"><label>Tipo de venda</label><select id="taxMaskType"><option value="VENDA">Venda</option><option value="REVENDA">Revenda</option><option value="SERVICO_8_02">Serviço 8.02</option><option value="SERVICO_14_01">Serviço 14.01</option></select></div>
            <div class="field"><label>Destino</label><select id="taxMaskDestination"><option value="TODOS">Todos</option><option value="INTERNA">Interna (SP)</option><option value="SUL/SUDESTE">Sul/Sudeste</option><option value="NORTE/NORDESTE/CENTRO OESTE">Norte/Nordeste/Centro-Oeste</option><option value="OUTROS">Outros</option></select></div>
            <div class="field"><label>UF específica (opcional)</label><input id="taxMaskUf" maxlength="2" placeholder="Ex.: MG"></div>
            <div class="field full"><label>Município específico (opcional)</label><input id="taxMaskCity" placeholder="Ex.: Belo Horizonte. Requer UF."></div>
            <div class="field"><label>Vigência inicial *</label><input id="taxMaskStart" type="date" value="2027-01-01"></div>
            <div class="field"><label>Vigência final</label><input id="taxMaskEnd" type="date"></div>
            <div class="field"><label>CST IBS/CBS (referência)</label><input id="taxMaskCst" placeholder="Conforme classificação fiscal"></div>
            <div class="field"><label>cClassTrib (referência)</label><input id="taxMaskClassTrib" placeholder="Conforme classificação fiscal"></div>
            <div class="field"><label>Status</label><select id="taxMaskActive"><option value="true">Ativa</option><option value="false">Inativa</option></select></div>
            <div class="field full"><label>Observações</label><textarea id="taxMaskObs" style="min-height:70px" placeholder="Exceções, legislação, orientação do contador..."></textarea></div>
          </div>
          <div class="panel-head" style="padding:18px 0 10px;border:0">
            <div><div class="panel-title">Tributos da máscara</div><div class="panel-sub">Alíquota, redução e participação no markup.</div></div>
            <button type="button" class="secondary" onclick="addTaxMaskRow()">+ Tributo</button>
          </div>
          <datalist id="taxTributos">
            <option value="CBS"><option value="IBS ESTADUAL"><option value="IBS MUNICIPAL">
            <option value="ICMS"><option value="PIS"><option value="COFINS">
            <option value="IPI"><option value="ISS"><option value="IS"><option value="OUTROS">
          </datalist>
          <div id="taxMaskRows"></div>
          <div class="tax-mask-summary"><div><b>Total considerado no markup</b><br><small id="taxMaskCount">0 tributos</small></div><strong id="taxMaskTotal">0,00%</strong></div>
          <div class="quote-item-actions" style="margin-top:14px">
            <button class="secondary" type="button" onclick="newTaxMask()">Limpar</button>
            <button class="primary" id="taxMaskSaveBtn" type="button" onclick="saveTaxMask()">Salvar máscara</button>
          </div>
        </div>
      </div>
    </div>
  </section>`;
  document.querySelector(".content").insertAdjacentHTML("beforeend",markup);
})();
