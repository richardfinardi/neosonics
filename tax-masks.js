/* Cadastro de máscaras de impostos e integração com precificação. */
function taxMasksActive(v) {
  return !(v===false || String(v).toLowerCase()==="false" || String(v)==="0");
}
function taxNorm(v) {
  return String(v||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
}
function taxDate(v) {
  const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?m[0]:"";
}
function taxToday() {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function taxMaskPercent(mask) {
  return (mask.itens||[]).reduce((sum,item)=>{
    if(!taxMasksActive(item.INCLUI_MARKUP))return sum;
    return sum+Number(item.ALIQUOTA_PCT||0)*(1-Number(item.REDUCAO_PCT||0));
  },0);
}
function taxMaskApplicable(mask,ctx) {
  if(!taxMasksActive(mask.ATIVO))return false;
  const date=taxDate(ctx.date)||taxToday();
  const start=taxDate(mask.VIGENCIA_INICIO),end=taxDate(mask.VIGENCIA_FIM);
  return (!start||start<=date)&&(!end||end>=date)&&
    taxNorm(mask.ENQUADRAMENTO||"NORMAL")===taxNorm(ctx.framework||"NORMAL")&&
    taxNorm(mask.TIPO_VENDA)===taxNorm(ctx.type)&&
    (taxNorm(mask.DESTINO)==="TODOS"||taxNorm(mask.DESTINO)===taxNorm(ctx.destination))&&
    (!mask.UF_DESTINO||taxNorm(mask.UF_DESTINO)===taxNorm(ctx.uf))&&
    (!mask.MUNICIPIO_DESTINO||taxNorm(mask.MUNICIPIO_DESTINO)===taxNorm(ctx.city));
}
function taxMaskScore(mask) {
  return (mask.MUNICIPIO_DESTINO?4:0)+(mask.UF_DESTINO?2:0)+(taxNorm(mask.DESTINO)==="TODOS"?0:1);
}
function matchingTaxMasks(ctx) {
  return (APP_DATA.taxMasks||[]).filter(m=>taxMaskApplicable(m,ctx))
    .sort((a,b)=>taxMaskScore(b)-taxMaskScore(a)||
      String(b.VIGENCIA_INICIO||"").localeCompare(String(a.VIGENCIA_INICIO||"")));
}
function resolveTaxForClient(client,type,date,requestedMaskId) {
  if(!client||!client.UF)return null;
  const dest=destinationByUf(client.UF);
  const ctx={framework:"NORMAL",destination:dest,type,uf:client.UF,city:client.CIDADE,date};
  const candidates=matchingTaxMasks(ctx);
  const mask=requestedMaskId
    ?candidates.find(m=>String(m.ID_MASCARA)===String(requestedMaskId))
    :candidates[0];
  if(requestedMaskId&&!mask)return null;
  if(mask)return {pct:taxMaskPercent(mask),mask,source:"MASCARA"};
  const key="NORMAL|"+dest+"|"+String(type||"VENDA").toUpperCase();
  if(!Object.prototype.hasOwnProperty.call(TAX_RULES,key))return null;
  return {pct:Number(TAX_RULES[key]),mask:null,source:"LEGADO"};
}
function taxMaskSumLabel(mask) {
  return formatPct(taxMaskPercent(mask));
}
async function initTaxMasksPage(force=false) {
  await loadBootstrap(force);
  renderTaxMasksList();
  if(!document.getElementById("taxMaskName").value&&!document.getElementById("taxMaskId").value)newTaxMask();
}
function renderTaxMasksList() {
  const body=document.getElementById("taxMasksBody");
  if(!body)return;
  const search=taxNorm(document.getElementById("taxMaskSearch")?.value);
  const showInactive=document.getElementById("taxMaskShowInactive")?.checked;
  const items=(APP_DATA.taxMasks||[])
    .filter(x=>(showInactive||taxMasksActive(x.ATIVO))&&
      (!search||taxNorm([x.NOME,x.TIPO_VENDA,x.DESTINO,x.UF_DESTINO,x.MUNICIPIO_DESTINO].join(" ")).includes(search)));
  body.innerHTML=items.length?items.map(x=>
    '<tr><td><b>'+escapeHtml(x.NOME)+'</b><small class="table-sub">'+escapeHtml(x.UF_DESTINO||x.DESTINO||"TODOS")+
    (x.MUNICIPIO_DESTINO?" • "+escapeHtml(x.MUNICIPIO_DESTINO):"")+'</small></td>'+
    '<td>'+escapeHtml(x.TIPO_VENDA)+'</td>'+
    '<td>'+escapeHtml(formatDateBR(x.VIGENCIA_INICIO))+(x.VIGENCIA_FIM?" a "+escapeHtml(formatDateBR(x.VIGENCIA_FIM)):" em diante")+'</td>'+
    '<td><b>'+formatPct(taxMaskPercent(x))+'</b></td>'+
    '<td><span class="status '+(taxMasksActive(x.ATIVO)?"good":"low")+'">'+(taxMasksActive(x.ATIVO)?"ATIVA":"INATIVA")+'</span></td>'+
    '<td><button type="button" class="secondary" onclick="editTaxMask(\''+escapeJs(x.ID_MASCARA)+'\')">Editar</button></td></tr>'
  ).join(""):'<tr class="empty-row"><td colspan="6">Nenhuma máscara encontrada.</td></tr>';
}
function newTaxMask() {
  const e=id=>document.getElementById(id);
  e("taxMaskId").value="";
  e("taxMaskName").value="";
  e("taxMaskFramework").value="NORMAL";
  e("taxMaskDestination").value="TODOS";
  e("taxMaskType").value="VENDA";
  e("taxMaskUf").value="";
  e("taxMaskCity").value="";
  e("taxMaskStart").value="2027-01-01";
  e("taxMaskEnd").value="";
  e("taxMaskCst").value="";
  e("taxMaskClassTrib").value="";
  e("taxMaskObs").value="";
  e("taxMaskActive").value="true";
  e("taxMaskEditorTitle").textContent="Nova máscara";
  e("taxMaskRows").innerHTML="";
  ["CBS","IBS ESTADUAL","IBS MUNICIPAL"].forEach(t=>addTaxMaskRow({TRIBUTO:t,ALIQUOTA_PCT:null,REDUCAO_PCT:0,INCLUI_MARKUP:true}));
  recalcTaxMaskEditor();
}
function editTaxMask(id) {
  const mask=(APP_DATA.taxMasks||[]).find(x=>String(x.ID_MASCARA)===String(id));
  if(!mask)return;
  const fields={
    taxMaskId:"ID_MASCARA",taxMaskName:"NOME",taxMaskFramework:"ENQUADRAMENTO",
    taxMaskDestination:"DESTINO",taxMaskType:"TIPO_VENDA",taxMaskUf:"UF_DESTINO",
    taxMaskCity:"MUNICIPIO_DESTINO",taxMaskStart:"VIGENCIA_INICIO",taxMaskEnd:"VIGENCIA_FIM",
    taxMaskCst:"CST_IBS_CBS",taxMaskClassTrib:"CCLASSTRIB",taxMaskObs:"OBS"
  };
  Object.entries(fields).forEach(([id,key])=>{
    const val=key==="VIGENCIA_INICIO"||key==="VIGENCIA_FIM"?taxDate(mask[key]):mask[key];
    document.getElementById(id).value=val||"";
  });
  document.getElementById("taxMaskActive").value=taxMasksActive(mask.ATIVO)?"true":"false";
  document.getElementById("taxMaskEditorTitle").textContent="Editar • "+mask.NOME;
  document.getElementById("taxMaskRows").innerHTML="";
  (mask.itens||[]).forEach(x=>addTaxMaskRow(x));
  recalcTaxMaskEditor();
  document.getElementById("taxMaskName").focus();
}
function addTaxMaskRow(data={}) {
  const el=document.createElement("div");
  el.className="tax-mask-row";
  el.innerHTML='<div class="field"><label>Tributo</label><input class="tax-line-name" list="taxTributos" placeholder="CBS, ICMS, IBS..." value="'+escapeHtml(data.TRIBUTO||"")+'" oninput="recalcTaxMaskEditor()"></div>'+
    '<div class="field"><label>Alíquota (%)</label><input class="tax-line-rate" inputmode="decimal" placeholder="Ex.: 0,9" value="'+(data.ALIQUOTA_PCT===null||data.ALIQUOTA_PCT===undefined?"":escapeHtml((Number(data.ALIQUOTA_PCT)*100).toLocaleString("pt-BR",{maximumFractionDigits:6})))+'" oninput="recalcTaxMaskEditor()"></div>'+
    '<div class="field"><label>Redução (%)</label><input class="tax-line-discount" inputmode="decimal" value="'+escapeHtml((Number(data.REDUCAO_PCT||0)*100).toLocaleString("pt-BR",{maximumFractionDigits:4}))+'" oninput="recalcTaxMaskEditor()"></div>'+
    '<label class="tax-line-checkbox"><input type="checkbox" class="tax-line-includes" '+(taxMasksActive(data.INCLUI_MARKUP)?"checked":"")+' onchange="recalcTaxMaskEditor()"><span>Entra no markup</span></label>'+
    '<div class="tax-line-effective"><small>Efetiva</small><b>0,00%</b></div>'+
    '<button type="button" class="secondary tax-line-remove" aria-label="Remover tributo" onclick="this.closest(\'.tax-mask-row\').remove();recalcTaxMaskEditor()">×</button>';
  document.getElementById("taxMaskRows").appendChild(el);
  recalcTaxMaskEditor();
}
function recalcTaxMaskEditor() {
  const rows=[...document.querySelectorAll("#taxMaskRows .tax-mask-row")];
  let total=0;
  rows.forEach(row=>{
    const rate=Math.max(0,parsePct(row.querySelector(".tax-line-rate").value));
    const red=Math.max(0,parsePct(row.querySelector(".tax-line-discount").value));
    const eff=rate*(1-red);
    row.querySelector(".tax-line-effective b").textContent=formatPct(eff);
    if(row.querySelector(".tax-line-includes").checked)total+=eff;
  });
  const sum=document.getElementById("taxMaskTotal");
  if(sum)sum.textContent=formatPct(total);
  const count=document.getElementById("taxMaskCount");
  if(count)count.textContent=rows.length+" tributo(s)";
}
function collectTaxMaskRows() {
  return [...document.querySelectorAll("#taxMaskRows .tax-mask-row")].map((row,i)=>{
    const name=row.querySelector(".tax-line-name").value.trim().toUpperCase();
    const rateInput=row.querySelector(".tax-line-rate").value.trim();
    const reduceInput=row.querySelector(".tax-line-discount").value.trim();
    if(!name)throw Error("Informe o tributo da linha "+(i+1)+".");
    if(!rateInput)throw Error("Informe a alíquota da linha "+(i+1)+", mesmo quando for zero.");
    const rate=parsePct(rateInput),reduction=parsePct(reduceInput);
    if(rate<0||rate>1||reduction<0||reduction>1)throw Error("Percentuais inválidos na linha "+(i+1)+".");
    return {
      TRIBUTO:name,ALIQUOTA_PCT:rate,REDUCAO_PCT:reduction,
      INCLUI_MARKUP:row.querySelector(".tax-line-includes").checked,ORDEM:i+1
    };
  });
}
async function saveTaxMask() {
  const v=id=>document.getElementById(id).value.trim();
  const btn=document.getElementById("taxMaskSaveBtn");
  let mask;
  try{
    const itens=collectTaxMaskRows();
    mask={
      ID_MASCARA:v("taxMaskId"),NOME:v("taxMaskName"),
      ENQUADRAMENTO:v("taxMaskFramework"),DESTINO:v("taxMaskDestination"),
      TIPO_VENDA:v("taxMaskType"),UF_DESTINO:v("taxMaskUf").toUpperCase(),
      MUNICIPIO_DESTINO:v("taxMaskCity"),VIGENCIA_INICIO:v("taxMaskStart"),
      VIGENCIA_FIM:v("taxMaskEnd"),CST_IBS_CBS:v("taxMaskCst"),
      CCLASSTRIB:v("taxMaskClassTrib"),OBS:v("taxMaskObs"),
      ATIVO:v("taxMaskActive")==="true",itens
    };
    if(!mask.NOME||!mask.VIGENCIA_INICIO||!itens.length)throw Error("Informe nome, vigência e pelo menos um tributo.");
    if(mask.VIGENCIA_FIM&&mask.VIGENCIA_FIM<mask.VIGENCIA_INICIO)throw Error("Vigência final anterior à inicial.");
    if(mask.MUNICIPIO_DESTINO&&!mask.UF_DESTINO)throw Error("Informe a UF para restringir por município.");
    if(taxMaskPercent(mask)>=1)throw Error("A soma para markup não pode alcançar 100%.");
  }catch(err){alert(err.message);return}
  btn.disabled=true;
  const old=btn.textContent;btn.textContent="Salvando...";
  try{
    const r=await fetch(NEOSONICS_API_URL,{
      method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({acao:"salvar_mascara_imposto",mascara:mask})
    });
    if(!r.ok)throw Error("HTTP "+r.status);
    const j=await r.json();
    if(!j.ok)throw Error(j.erro||"Erro na API");
    const saved=j.mascara||mask;
    const idx=(APP_DATA.taxMasks||[]).findIndex(x=>String(x.ID_MASCARA)===String(saved.ID_MASCARA));
    if(idx>=0)APP_DATA.taxMasks[idx]=saved;
    else APP_DATA.taxMasks.push(saved);
    persistBootstrapCache();
    renderTaxMasksList();
    editTaxMask(saved.ID_MASCARA);
    await refreshBootstrap();
    renderTaxMasksList();
    alert("Máscara de impostos salva.");
  }catch(err){alert("Não foi possível salvar a máscara: "+err.message)}
  finally{btn.disabled=false;btn.textContent=old}
}
function quoteTaxContextKey(clientId,type,destination) {
  return [String(clientId||""),String(type||""),String(destination||"")].join("|");
}
function populateQuoteTaxMaskOptions(client,type,destination,selectedOverride) {
  const select=document.getElementById("qTaxMask");
  if(!select)return;
  const previous=selectedOverride===undefined?(select.value||""):String(selectedOverride||"");
  const ctx={framework:"NORMAL",destination,type,uf:client?.UF,city:client?.CIDADE,
    date:quoteState?.taxDate||taxToday()};
  const matches=client?matchingTaxMasks(ctx):[];
  select.innerHTML='<option value="">Automática (por vigência)</option>'+
    matches.map(m=>'<option value="'+escapeHtml(m.ID_MASCARA)+'">'+escapeHtml(m.NOME)+" • "+formatPct(taxMaskPercent(m))+'</option>').join("");
  if(previous&&!matches.some(m=>String(m.ID_MASCARA)===previous)){
    const old=(APP_DATA.taxMasks||[]).find(x=>String(x.ID_MASCARA)===previous);
    if(old&&quoteState?.id)select.insertAdjacentHTML("beforeend",'<option value="'+escapeHtml(previous)+'">'+escapeHtml(old.NOME)+" (histórica)"+'</option>');
  }
  if(previous&&[...select.options].some(x=>x.value===previous))select.value=previous;
}
function showQuoteTaxSummary(result,original) {
  const note=document.getElementById("qTaxDetails");
  if(!note)return;
  if(original){
    note.textContent=original;
    return;
  }
  if(!result){note.textContent="Sem regra fiscal aplicável. Revise cliente, UF e tipo de venda.";return;}
  if(!result.mask){note.textContent="Regra anterior (total consolidado). Cadastre uma máscara para detalhar os tributos.";return;}
  note.textContent="Máscara: "+result.mask.NOME+" • "+result.mask.itens.map(x=>
    x.TRIBUTO+" "+formatPct(Number(x.ALIQUOTA_PCT||0)*(1-Number(x.REDUCAO_PCT||0)))+
    (taxMasksActive(x.INCLUI_MARKUP)?"":" (fora do markup)")
  ).join(" • ");
}
