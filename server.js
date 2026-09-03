// Servidor completo — zero dependências. Painel + API + webhook WhatsApp + CRM leve.
const http = require('http');
const { analisar, fichaMarkdown } = require('./src/ficha');
const { handleIncoming } = require('./src/bot/handler');
const { sendText } = require('./src/bot/evolution');
const store = require('./src/db');
const { fetchTextoAnuncio } = require('./src/fetchAnuncio');
const { runMonitor, ensureSeed } = require('./src/monitor');
const { mapaData } = require('./src/mapa');
const { prever } = require('./src/ia/valorizacao');
const { comparar } = require('./src/comparar');
const { gerarLegenda } = require('./src/ia/legenda');
const { alertasOportunidade } = require('./src/alertas');

const STATUS_VALIDOS = ['novo', 'analisado', 'visitado', 'proposta', 'fechado', 'descartado'];

function send(res, code, obj, type = 'application/json') {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' });
  res.end(body);
}
async function readJson(req) {
  let raw = '';
  for await (const c of req) raw += c;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { _raw: raw }; }
}
function query(url) {
  const i = url.indexOf('?');
  const out = {};
  if (i < 0) return out;
  for (const p of url.slice(i + 1).split('&')) {
    const [k, v] = p.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return out;
}

const PAINEL = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IA Imóveis — Painel</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body{font-family:system-ui;margin:0;background:#f4f4f5}header{background:#111827;color:#fff;padding:14px 20px}main{max-width:1100px;margin:0 auto;padding:16px}section{background:#fff;border-radius:10px;padding:14px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #eee;padding:6px;text-align:left}input,select,textarea,button{padding:8px;border-radius:6px;border:1px solid #ccc}button{background:#111827;color:#fff;cursor:pointer}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:800px){.grid{grid-template-columns:1fr}}.pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;background:#eee}</style>
<header><b>IA Imóveis</b> — DFImóveis • WImóveis • NetImóveis | <span id="total"></span></header>
<main>
<section><h3>Nova análise</h3>
<input id="url" style="width:100%" placeholder="Cole o link do anúncio"><br><br>
<textarea id="texto" style="width:100%" rows="3" placeholder="Ou cole o texto: Ap 70m2 R$ 550 mil, aceita financiamento, escritura e habite-se ok"></textarea><br><br>
<button onclick="analisar()">Analisar e salvar</button> <span id="nova"></span></section>
<div class="grid">
<section><h3>Filtros + Histórico</h3>
<input id="q" placeholder="buscar..." oninput="carregar()"> 
<select id="fFonte" onchange="carregar()"><option value="">todas fontes</option><option>dfimoveis</option><option>wimoveis</option><option>netimoveis</option><option>manual</option></select>
<select id="fStatus" onchange="carregar()"><option value="">todos status</option><option>novo</option><option>analisado</option><option>visitado</option><option>proposta</option><option>fechado</option><option>descartado</option></select>
<label><input type="checkbox" id="fFin" onchange="carregar()"> financiáveis</label>
<label><input type="checkbox" id="fDoc" onchange="carregar()"> com escritura</label><br><br>
<button onclick="compararSel()">Comparar selecionados (2-3)</button>
<div id="hist"></div></section>
<section><h3>Comparador</h3><div id="comp">Selecione 2-3 no histórico.</div>
<h3>Funil CRM</h3><div id="funil"></div>
<h3>Média m² por bairro (base local)</h3><div id="medias"></div>
<h3>Alertas — abaixo da média</h3><div id="alertas"></div></section>
</div>
<section><h3>Legenda p/ cliente</h3><input id="legId" placeholder="id da análise" style="width:300px"> <button onclick="legenda()">Gerar legenda</button> <button onclick="valorizacao()">Previsão valorização</button><div id="leg"></div></section>
<section><h3>Monitor diário (watchlist)</h3>
<input id="wUrl" style="width:55%" placeholder="https://... busca salva"> <input id="wRot" style="width:25%" placeholder="rótulo"> <button onclick="wAdd()">Adicionar</button> <button onclick="mRun()">Rodar agora</button><div id="mon"></div></section>
<section><h3>Mapa de calor — R$/m² por bairro</h3><div id="map" style="height:320px"></div><div id="mapTab"></div></section>
</main>
<script>
async function analisar(){
 const url=document.getElementById('url').value, texto=document.getElementById('texto').value;
 const r=await fetch('/api/analisar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,texto})}).then(r=>r.json());
 document.getElementById('nova').innerHTML='<b>'+r.veredito+'</b> '+r.score+'/100 <span class=pill>'+r.id+'</span><pre>'+r.ficha+'</pre>';
 carregar();
}
async function carregar(){
 const p=new URLSearchParams({q:q.value,fonte:fFonte.value,status:fStatus.value,financiavel:fFin.checked?1:'',comEscritura:fDoc.checked?1:''});
 const h=await fetch('/api/historico?'+p).then(r=>r.json());
 total.textContent=h.length+' análises';
 hist.innerHTML='<table><tr><th></th><th>Score</th><th>Veredito</th><th>R$/m²</th><th>Bairro</th><th>Status</th><th></th></tr>'+h.map(a=>'<tr><td><input type=checkbox class=sel value='+a.id+'></td><td><b>'+a.score+'</b></td><td>'+a.veredito+'</td><td>'+(a.extracao.preco_m2||'—')+'</td><td>'+(a.bairro||a.fonte)+'</td><td><select onchange="status_(\\''+a.id+'\\',this.value)">'+['novo','analisado','visitado','proposta','fechado','descartado'].map(s=>'<option '+(a.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></td><td><button onclick="legenda(\\''+a.id+'\\')">legenda</button></td></tr>').join('')+'</table>';
 const f=await fetch('/api/funil').then(r=>r.json());
 funil.innerHTML=Object.entries(f).map(([k,v])=>'<span class=pill>'+k+': '+v+'</span>').join(' ');
 const m=await fetch('/api/medias').then(r=>r.json());
 medias.innerHTML='<table>'+m.map(x=>'<tr><td>'+x.bairro+'</td><td>'+x.media+'</td><td>n='+x.qtd+'</td></tr>').join('')+'</table>';
 const al=await fetch('/api/alertas').then(r=>r.json());
 alertas.innerHTML=al.length?al.map(a=>'<div>• <b>-'+a.desconto+'%</b> '+a.id.slice(-4)+' — '+a.score+'/100 '+(a.bairro||'')+'</div>').join(''):'Nenhum alerta ainda.';
}
async function status_(id,status){await fetch('/api/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});carregar();}
async function compararSel(){const ids=[...document.querySelectorAll('.sel:checked')].map(e=>e.value);const c=await fetch('/api/comparar?ids='+ids.join(',')).then(r=>r.json());comp.innerHTML=c.error||('<b>'+c.resumo+'</b><table>'+c.linhas.map(l=>'<tr><td>'+l.criterio+'</td>'+l.valores.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</table>');}
async function legenda(id){id=id||legId.value;const l=await fetch('/api/legenda',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}).then(r=>r.json());leg.innerHTML='<pre>'+(l.legenda||l.error)+'</pre><p>'+(l.hashtags||'')+'</p>';}
async function valorizacao(){const v=await fetch('/api/valorizacao?id='+legId.value).then(r=>r.json());leg.innerHTML='<b>'+(v.classificacao||v.error)+'</b> '+(v.projecao12m_pct!=null?v.projecao12m_pct+'% em 12m (faixa '+v.faixa12m_pct+')':'')+'<ul>'+((v.motivos||[]).map(m=>'<li>'+m+'</li>').join(''))+'</ul><small>'+(v.aviso||'')+'</small>';}
async function wAdd(){await fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:wUrl.value,rotulo:wRot.value})});wUrl.value='';monCarregar();}
async function wDel(id){await fetch('/api/watchlist?id='+id,{method:'DELETE'});monCarregar();}
async function mRun(){mon.innerHTML='rodando...';const r=await fetch('/api/monitor/run',{method:'POST'}).then(r=>r.json());mon.innerHTML='<b>verificadas:</b> '+r.verificadas+' <b>novas:</b> '+r.novas+' <b>alertas:</b> '+r.alertas;carregar();monCarregar();}
async function monCarregar(){const w=await fetch('/api/watchlist').then(r=>r.json());mon.innerHTML=w.map(x=>'<div>• '+x.rotulo+' <small>'+x.url+'</small> <button onclick="wDel(\\''+x.id+'\\')">x</button></div>').join('');}
async function mapaCarregar(){const d=await fetch('/api/mapa').then(r=>r.json());mapTab.innerHTML='<table>'+d.map(x=>'<tr><td>'+x.bairro+'</td><td><b>'+x.media+'</b></td><td>n='+x.qtd+'</td></tr>').join('')+'</table>';if(window.L&&d.length){if(!window._map){window._map=L.map('map').setView([-15.79,-47.93],11);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(window._map);}d.forEach(x=>L.circle([x.lat,x.lng],{radius:600+x.qtd*300,color:x.media>10000?'red':x.media>8000?'orange':'green'}).addTo(window._map).bindPopup(x.bairro+': R$'+x.media+'/m² (n='+x.qtd+')'));}}
carregar();monCarregar();mapaCarregar();
</script>`;

const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method === 'GET' && path === '/') return send(res, 200, PAINEL, 'text/html');

  if (req.method === 'POST' && path === '/api/analisar') {
    const input = await readJson(req);
    let texto = input.texto || input._raw || '';
    if (input.url && !texto) texto = await fetchTextoAnuncio(input.url);
    else if (input.url && texto.length < 8000) texto = texto + '\n' + await fetchTextoAnuncio(input.url);
    const r = analisar({ url: input.url, texto, preco: input.preco ?? null, area: input.area ?? null, localizacaoNota: input.localizacaoNota ?? 6 });
    r.ficha = fichaMarkdown(r);
    const saved = await store.addAnalise({ ...r, origem: 'painel' });
    return send(res, 200, saved);
  }

  if (req.method === 'GET' && path === '/api/historico') {
    const q = query(req.url);
    return send(res, 200, await store.listAnalises({ fonte: q.fonte || undefined, status: q.status || undefined, q: q.q || undefined, minScore: q.minScore ? Number(q.minScore) : undefined, financiavel: q.financiavel === '1', comEscritura: q.comEscritura === '1' }));
  }
  if (req.method === 'GET' && path === '/api/analise') {
    const rec = await store.getAnalise(query(req.url).id);
    return rec ? send(res, 200, rec) : send(res, 404, { error: 'não encontrada' });
  }
  if (req.method === 'POST' && path === '/api/status') {
    const { id, status } = await readJson(req);
    if (!STATUS_VALIDOS.includes(status)) return send(res, 400, { error: 'status inválido: ' + STATUS_VALIDOS.join(',') });
    const rec = await store.setStatus(id, status);
    return rec ? send(res, 200, rec) : send(res, 404, { error: 'não encontrada' });
  }
  if (req.method === 'GET' && path === '/api/comparar') {
    const ids = (query(req.url).ids || '').split(',').filter(Boolean);
    return send(res, 200, comparar(await Promise.all(ids.map((id) => store.getAnalise(id)))));
  }
  if (req.method === 'POST' && path === '/api/legenda') {
    const { id, analise } = await readJson(req);
    const a = analise || (id ? await store.getAnalise(id) : null);
    if (!a) return send(res, 404, { error: 'informe id ou analise' });
    return send(res, 200, gerarLegenda(a));
  }
  if (req.method === 'GET' && path === '/api/medias') return send(res, 200, await store.mediasPorBairro());
  if (req.method === 'GET' && path === '/api/funil') return send(res, 200, await store.funil());
  if (req.method === 'GET' && path === '/api/alertas') return send(res, 200, alertasOportunidade(await store.listAnalises({})));

  if (req.method === 'POST' && path === '/webhook/evolution') {
    const body = await readJson(req);
    const evento = body?.event || body?.type || '';
    if (evento && !String(evento).toUpperCase().includes('MESSAGES')) return send(res, 200, { ignored: true, evento });
    const out = await handleIncoming(body, fetchTextoAnuncio);
    if (out.ignored) return send(res, 200, { ignored: true });
    if (out.analise) await store.addAnalise({ ...out.analise, origem: 'whatsapp', whatsapp: out.number });
    for (const reply of out.replies) {
      try { await sendText(out.number, reply); } catch (e) { console.error('falha ao enviar WhatsApp:', e.message); }
    }
    return send(res, 200, { ok: true, number: out.number, score: out.analise?.score, veredito: out.analise?.veredito });
  }

  if (req.method === 'GET' && path === '/api/mapa') return send(res, 200, mapaData(await store.mediasPorBairro()));
  if (req.method === 'GET' && path === '/api/valorizacao') {
    const a = await store.getAnalise(query(req.url).id);
    if (!a) return send(res, 404, { error: 'análise não encontrada' });
    return send(res, 200, prever(a, await store.listSnapshots(10)));
  }
  if (req.method === 'GET' && path === '/api/watchlist') return send(res, 200, await ensureSeed(store));
  if (req.method === 'POST' && path === '/api/watchlist') {
    const { url, rotulo } = await readJson(req);
    if (!url) return send(res, 400, { error: 'informe url' });
    return send(res, 200, await store.watchAdd(url, rotulo));
  }
  if (req.method === 'DELETE' && path === '/api/watchlist') {
    await store.watchRemove(query(req.url).id);
    return send(res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/monitor/run') {
    return send(res, 200, await runMonitor(store, fetchTextoAnuncio));
  }

  send(res, 404, { error: 'rota não encontrada' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Sistema rodando em http://localhost:${PORT}`));
