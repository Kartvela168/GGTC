// ui.js - GGTC ოფიციალური ვერსია (სრული ფუნქციონალი + ხაზების ხილვადობის გარანტია)

const ATM_COEFF = 9.86923; // 1 MPa = 9.86923 atm

function getSegmentCount(lengthKm) {
  if (lengthKm <= 30) return 2;
  if (lengthKm > 300) return 30;
  const extra = Math.ceil((lengthKm - 30) / 10);
  return Math.min(2 + extra, 30);
}

let nodeIdCounter      = 0;
let tappedTimeout      = null;
window.creationActive  = false;
window.firstNode       = null;
window.activePopup     = null;
window.simulatedSeconds = 0; // სიმულაციის დროის საწყისი მნიშვნელობა

function closeActivePopup() {
  if (window.activePopup) {
    if (window.activePopup.parentNode) document.body.removeChild(window.activePopup);
    window.activePopup = null;
  }
}

function initializeCollapsibleContainers() {
  const headers = document.querySelectorAll('.collapsible-header');
  headers.forEach(header => {
    const content = header.nextElementSibling;
    if (!content) return;
    header.addEventListener('click', () => {
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
      const toggle = header.querySelector('.collapsible-toggle');
      if (toggle) toggle.textContent = content.style.display === 'none' ? '▼' : '▲';
    });
  });
}

function speedToColor(speed) {
  const absSpeed = Math.abs(speed);
  if (absSpeed < 0.1) return '#888'; // თუ სიჩქარე 0-ია, იყოს მუქი ნაცრისფერი (რომ გამოჩნდეს)
  
  const stops = [
    { speed: 0, color: [136, 136, 136] }, 
    { speed: 5, color: [40, 167, 69] },   
    { speed: 20, color: [220, 53, 69] },  
    { speed: 40, color: [111, 66, 193] }  
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const curr = stops[i], next = stops[i + 1];
    if (absSpeed <= next.speed) {
      const ratio = (absSpeed - curr.speed) / (next.speed - curr.speed);
      const r = Math.round(curr.color[0] * (1 - ratio) + next.color[0] * ratio);
      const g = Math.round(curr.color[1] * (1 - ratio) + next.color[1] * ratio);
      const b = Math.round(curr.color[2] * (1 - ratio) + next.color[2] * ratio);
      return `rgb(${r},${g},${b})`;
    }
  }
  return `rgb(${stops[stops.length - 1].color.join(',')})`;
}

function animateDashOffset() {
  if (typeof cy === 'undefined' || !cy) { requestAnimationFrame(animateDashOffset); return; }
  if (typeof simulationMode !== "undefined" && simulationMode !== "stop") {
    const delta = 1 / 60;
    let speedMultiplier = (simulationMode === "min") ? 2 : (simulationMode === "hour" ? 5 : 0.5);
    
    cy.edges().forEach(edge => {
      const v1 = parseFloat(edge.data('v1')) || 0, v2 = parseFloat(edge.data('v2')) || 0;
      const targetSpeed = speedMultiplier * Math.max(Math.abs(v1), Math.abs(v2));
      const smoothedSpeed = (edge.data('_prevSpeed') || 0) * 0.8 + targetSpeed * 0.2;
      edge.data('_prevSpeed', smoothedSpeed);

      const sourceNode = cy.getElementById(edge.data('source')), targetNode = cy.getElementById(edge.data('target'));
      if (!sourceNode.length || !targetNode.length) return;

      const pStart = parseFloat(sourceNode.data('pressure')) || 0, pEnd = parseFloat(targetNode.data('pressure')) || 0;
      const direction = Math.sign(pEnd - pStart) || 1;

      const newOffset = (edge.data('_dashOffset') || 0) + direction * smoothedSpeed * delta;
      edge.data('_dashOffset', newOffset);
      edge.style({ 'line-dash-offset': newOffset });
    });
  }
  requestAnimationFrame(animateDashOffset);
}

// Cytoscape-ის ინიციალიზაცია მკაფიო ხაზებით
let cy = cytoscape({
  container: document.getElementById('cy'),
  wheelSensitivity: 0.15,
  style: [
    {
      selector: 'node',
      style: {
        'background-color': ele => ele.data('pressureSet') ? '#004a99' : (ele.data('injection') > 0 ? '#28a745' : (ele.data('injection') < 0 ? '#dc3545' : '#dee2e6')),
        'label': 'data(label)',
        'text-halign': 'center', 'text-valign': 'center', 'color': '#333', 'font-size': '10px', 'font-weight': 'bold',
        'width': '18px', 'height': '18px', 'border-width': 2, 'border-color': '#fff', 'text-wrap': 'wrap',
        'z-index': 10 // წერტილები იყოს ხაზების ზემოთ
      }
    },
    {
      selector: 'edge',
      style: {
        'width': edge => 3 + Math.round((parseFloat(edge.data('diameter')) || 0) / 400),
        'line-color': edge => speedToColor(Math.max(Math.abs(edge.data('v1') || 0), Math.abs(edge.data('v2') || 0))),
        'line-style': ele => ele.data('disable') ? 'solid' : 'dashed',
        'line-dash-pattern': [6, 3],
        'target-arrow-shape': 'triangle', 
        'target-arrow-color': '#888', 
        'curve-style': 'bezier',
        'label': 'data(label)', 'font-size': '10px', 'text-rotation': 'autorotate', 'color': '#444',
        'opacity': 1,
        'z-index': 1 // ხაზები იყოს წერტილების ქვეშ
      }
    },
    {
      selector: 'edge:selected',
      style: { 'line-color': '#007bff', 'width': 5, 'opacity': 1 }
    }
  ],
  layout: { name: 'preset' }
});

// გლობალურად ხელმისაწვდომი რომ იყოს
window.cy = cy;

function updateInfo() {
  if (!cy) return;
  let totalVol = 0, posInj = 0, negInj = 0;
  
  let nodeHTML = `<table><tr><th>ID</th><th>სახელი</th><th>წნევა (ატმ)</th><th>ინექცია (მ³/სთ)</th></tr>`;
  cy.nodes().forEach(node => {
    const inj = parseFloat(node.data('injection') || 0), pres_atm = parseFloat(node.data('pressure') || 0) * ATM_COEFF;
    inj > 0 ? posInj += inj : negInj += inj;
    node.data('label', `${pres_atm.toFixed(2)} ატმ\n${node.data('name') || "."}`);
    nodeHTML += `<tr><td>${node.id()}</td><td>${node.data('name')}</td><td><b>${pres_atm.toFixed(2)}</b></td><td>${(inj * 3600).toFixed(0)}</td></tr>`;
  });
  nodeHTML += `</table>`;

  let edgeHTML = `<table><tr><th>ID</th><th>სიგრძე (კმ)</th><th>დიამეტრი (მმ)</th><th>v1 (მ/წმ)</th><th>მოცულობა</th></tr>`;
  cy.edges().forEach(edge => {
    const sumVol = (edge.data('volumeSegments') || []).reduce((s, v) => s + v, 0);
    totalVol += sumVol;
    const vol_fmt = sumVol >= 1000000 ? (sumVol/1000000).toFixed(2)+'M მ³' : sumVol.toFixed(0)+' მ³';
    edge.data('label', `${edge.data('length')} კმ`);
    edgeHTML += `<tr><td>${edge.id()}</td><td>${edge.data('length')}</td><td>${edge.data('diameter')}</td><td>${parseFloat(edge.data('v1')||0).toFixed(1)}</td><td>${vol_fmt}</td></tr>`;
  });
  edgeHTML += `</table>`;

  document.getElementById('info-nodes').innerHTML = nodeHTML;
  document.getElementById('info-edges').innerHTML = edgeHTML;
  
  const summary = document.getElementById('simulation-summary');
  if (summary) {
    const total_fmt = totalVol >= 1000000 ? (totalVol/1000000).toFixed(2)+' × 10⁶' : totalVol.toFixed(0);
    const ts = window.simulatedSeconds || 0;
    const h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60;
    summary.innerHTML = `📦 მოცულობა: <b>${total_fmt} მ³</b> | 📥 შემავალი: <b>${(posInj*3600).toFixed(0)} მ³/სთ</b> | ⏱️ დრო: <b style="color:#004a99;">${h}სთ ${m}წთ ${s}წმ</b>`;
  }
}

function showMultiInputPopup(fields, x, y) {
  return new Promise(resolve => {
    closeActivePopup();
    const pop = document.createElement('div');
    pop.style.cssText = `position:absolute; top:${y}px; left:${x}px; padding:15px; background:#fff; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.15); z-index:2000; min-width:240px; border:1px solid #eee;`;
    let html = `<div style="display:grid; gap:12px;">`;
    fields.forEach((f, i) => {
      const type = f.type === 'checkbox' ? 'checkbox' : 'text', chk = (f.type === 'checkbox' && f.defaultValue) ? 'checked' : '', val = f.type !== 'checkbox' ? `value="${f.defaultValue}"` : '';
      html += `<div style="display:flex; justify-content:space-between; align-items:center;"><label style="font-size:12px; color:#555; font-weight:500;">${f.label}</label><input type="${type}" id="inp${i}" ${val} ${chk} style="width:100px; padding:5px; border:1px solid #ddd; border-radius:4px;"></div>`;
    });
    html += `<div style="text-align:right; margin-top:10px; padding-top:10px; border-top:1px solid #f0f0f0;"><button id="okBtn" style="padding:6px 15px; background:#007bff; color:white; border:none; border-radius:5px; cursor:pointer;">დიახ</button><button id="cancelBtn" style="padding:6px 15px; background:#fff; border:1px solid #ddd; border-radius:5px; cursor:pointer; margin-left:5px;">გაუქმება</button></div></div>`;
    pop.innerHTML = html; document.body.appendChild(pop); window.activePopup = pop;
    pop.querySelector('#okBtn').onclick = () => { const res = {}; fields.forEach((f, i) => { const inp = pop.querySelector(`#inp${i}`); res[f.key] = inp.type === 'checkbox' ? inp.checked : inp.value; }); closeActivePopup(); resolve(res); };
    pop.querySelector('#cancelBtn').onclick = () => { closeActivePopup(); resolve(null); };
  });
}

cy.on('tap', evt => {
  closeActivePopup();
  if (tappedTimeout) {
    clearTimeout(tappedTimeout); tappedTimeout = null;
    if (window.uiMode === 'build' && evt.target !== cy) { evt.target.remove(); updateInfo(); }
    return;
  }
  tappedTimeout = setTimeout(() => {
    if (window.uiMode === 'build') {
      if (!window.creationActive) {
        if (evt.target === cy || evt.target.isNode()) {
          window.firstNode = (evt.target === cy) ? cy.add({ group:'nodes', data:{ id:'n'+nodeIdCounter, injection:0, pressure:0, name:'.' }, position:evt.position }) : evt.target;
          if (evt.target === cy) nodeIdCounter++;
          window.firstNode.style({ 'border-color':'#007bff', 'border-width':'3px' });
          window.creationActive = true;
        }
      } else {
        const source = window.firstNode;
        let target = (evt.target === cy) ? cy.add({ group:'nodes', data:{ id:'n'+nodeIdCounter, injection:0, pressure:0, name:'.' }, position:evt.position }) : (evt.target.isNode() ? evt.target : null);
        if (evt.target === cy) nodeIdCounter++;
        if (target && source.id() !== target.id()) {
          const L = Math.max(Math.sqrt(Math.pow(target.position().x-source.position().x,2)+Math.pow(target.position().y-source.position().y,2)) * 0.2, 0.1);
          const sc = getSegmentCount(L);
          cy.add({ group:'edges', data: { id: `e${Date.now()}`, source: source.id(), target: target.id(), length: L.toFixed(1), diameter: "1000", E: "0.95", T: "15", name: ".", disable: false, volumeSegments: Array(sc).fill(0), flowSegments: Array(sc-1).fill(0), pressureSegments: Array(sc).fill(0), zSegments: Array(sc).fill(1.0) }});
        }
        source.style({ 'border-color':'#fff', 'border-width':'2px' });
        window.creationActive = false; window.firstNode = null; updateInfo();
      }
    }
    tappedTimeout = null;
  }, 250);
});

cy.on('cxttap', async evt => {
  if (evt.target === cy) { closeActivePopup(); return; }
  const { x, y } = evt.renderedPosition;
  if (evt.target.isNode()) {
    const n = evt.target;
    const res = await showMultiInputPopup([{ key:'name', label:"სახელი:", defaultValue: n.data('name') }, { key:'injection', label:"შემოდ/გად (მ³/სთ):", defaultValue: n.data('injection') ? (n.data('injection') * 3600).toFixed(0) : "" }, { key:'pressure', label:"წნევა (ატმ):", defaultValue: n.data('pressure') ? (n.data('pressure') * ATM_COEFF).toFixed(2) : "" }, { key:'pressureSet', label:"დაფიქსირება:", type:'checkbox', defaultValue: n.data('pressureSet') }], x, y);
    if (res) { n.data('name', res.name); if (res.injection !== "") n.data('injection', parseFloat(res.injection)/3600); if (res.pressure !== "") n.data('pressure', parseFloat(res.pressure)/ATM_COEFF); n.data('pressureSet', res.pressureSet); updateInfo(); }
  } else if (evt.target.isEdge()) {
    const e = evt.target;
    const res = await showMultiInputPopup([{ key:'name', label:"სახელი:", defaultValue: e.data('name') }, { key:'length', label:"სიგრძე (კმ):", defaultValue: e.data('length') }, { key:'diameter', label:"დიამეტრი (მმ):", defaultValue: e.data('diameter') }, { key:'E', label:"ეფექტურობა (E):", defaultValue: e.data('E') }, { key:'T', label:"ტემპერატურა (°C):", defaultValue: e.data('T') }, { key:'disable', label:"გათიშვა:", type:'checkbox', defaultValue: e.data('disable') }], x, y);
    if (res) { const nl = parseFloat(res.length), nd = parseFloat(res.diameter); if (nl >= 0.1 && nd >= 50) { e.data({ name: res.name, length: nl.toFixed(1), diameter: nd.toFixed(0), E: res.E, T: res.T, disable: res.disable }); const sc = getSegmentCount(nl); e.data({ volumeSegments: Array(sc).fill(0), flowSegments: Array(sc-1).fill(0), pressureSegments: Array(sc).fill(0), zSegments: Array(sc).fill(1.0) }); } updateInfo(); }
  }
});

cy.on('dragfree','node', evt => { const p = evt.target.position(); evt.target.position({ x:Math.round(p.x/10)*10, y:Math.round(p.y/10)*10 }); });

window.addEventListener('load', () => { 
  animateDashOffset(); 
  initializeCollapsibleContainers(); 
  updateInfo(); 
});

window.updateInfo = updateInfo;
window.clearGraph = function() { if(cy) cy.elements().remove(); nodeIdCounter = 0; updateInfo(); };