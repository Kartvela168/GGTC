// simulation.js - GGTC ჰიდრავლიკური გაანგარიშების ძრავა (ოპტიმიზებული ვერსია)

let simulationInterval = null;
window.simulationMode = "stop"; 
window.simulatedSeconds = 0; 

const MIN_FLOW_THRESHOLD = 0.001; 
const ATM_COEFF = 9.86923; // MPa to Atm

// --- ფიზიკური გათვლების დამხმარე ფუნქციები ---

function computeNodeVolume(geometry, pressure, T, Z) {
  if (geometry <= 0) return 0;
  const P_base = 0.101325; 
  const T_base = 293.15;   
  const T_k = T + 273.15;
  return geometry * (pressure / P_base) * (T_base / T_k) / Z;
}

function computeNodePressure(geometry, volume, T, Z) {
  if (geometry <= 0) return 0;
  const P_base = 0.101325;
  const T_base = 293.15;
  const T_k = T + 273.15;
  return volume * (P_base / geometry) * (T_k / T_base) * Z;
}

function getSegmentLength(i, n, L) {
  if (n <= 1) return L;
  const fullLen = L / (n - 1);
  const halfLen = fullLen / 2;
  return (i === 0 || i === n - 1) ? halfLen : fullLen;
}

function calculateSegmentZ(pressureSegments, T_C) {
  const T_K = T_C + 273.15;
  const Tr = T_K / 190.4; 
  const A1 = -1.0000 + 3.8740 / Tr - 4.5767 / (Tr * Tr);
  const A2 = 0.1708 - 0.5606 / Tr;

  return pressureSegments.map(P_MPa => {
    const Pr = P_MPa / 4.6; 
    return 1 + A1 * Pr + A2 * Pr * Pr;
  });
}

/**
 * სიჩქარის გამოთვლა მილის ბოლოებში (მ/წმ)
 */
function updateEdgeVelocities(edge) {
  const D_m = (parseFloat(edge.data('diameter')) || 1000) / 1000;
  const area = Math.PI * Math.pow(D_m, 2) / 4;
  const flowSegs = edge.data('flowSegments') || [];
  const pressSegs = edge.data('pressureSegments') || [];
  const zSegs = edge.data('zSegments') || [];
  const T_K = (parseFloat(edge.data('T')) || 15) + 273.15;

  if (flowSegs.length > 0 && area > 0) {
    // სტანდარტული სიმკვრივე (ბაზისური პირობებისთვის)
    const rho_std = 0.717; // კგ/მ3 (მეთანისთვის)
    
    // შესავალი (v1) და გამოსავალი (v2)
    [0, flowSegs.length - 1].forEach((idx, i) => {
      const Q_std = flowSegs[idx];
      const P_act = pressSegs[idx === 0 ? 0 : pressSegs.length - 1] * 1000; // kPa
      const Z_act = zSegs[idx === 0 ? 0 : zSegs.length - 1] || 0.85;
      
      // ფაქტიური სიმკვრივე მოცემულ წნევაზე
      const rho_act = (P_act * 0.01604) / (Z_act * 8.314 * T_K);
      const velocity = (Q_std * rho_std) / (rho_act * area);
      
      edge.data(i === 0 ? 'v1' : 'v2', velocity);
    });
  }
}

// --- ძირითადი სიმულაციის ბიჯები ---

function updateNodeSegments(cy) {
  cy.nodes().forEach(node => {
    let connectedEdgeSegments = [];
    let existingTotalVolume = 0;

    node.connectedEdges().forEach(edge => {
      if (edge.data('disable')) return;
      let vs = edge.data('volumeSegments') || [];
      if (vs.length > 0) {
        let idx = edge.target().id() === node.id() ? vs.length - 1 : 0;
        existingTotalVolume += vs[idx];
        connectedEdgeSegments.push({ edge, index: idx });
      }
    });

    let injection = (parseFloat(node.data('injection')) || 0) / 3600; 
    let newPressure = node.data('pressureSet') ? 
        (parseFloat(node.data('pressure')) || 0) : 
        node.data('pressure');

    if (!node.data('pressureSet')) {
      // წნევის გაანგარიშება ჯამური მასის მიხედვით
      let totalGeom = 0;
      connectedEdgeSegments.forEach(seg => {
        const L = parseFloat(seg.edge.data('length')) || 1;
        const D = parseFloat(seg.edge.data('diameter')) || 1000;
        const n = (seg.edge.data('volumeSegments') || []).length;
        totalGeom += 3.1415 * Math.pow(D/1000, 2) * getSegmentLength(seg.index, n, L) * 250;
      });
      newPressure = computeNodePressure(totalGeom, existingTotalVolume + injection, 15, 0.85);
      node.data('pressure', newPressure);
    }

    connectedEdgeSegments.forEach(seg => {
      const vs = seg.edge.data('volumeSegments');
      const D = parseFloat(seg.edge.data('diameter')) || 1000;
      const L = parseFloat(seg.edge.data('length')) || 1;
      const n = vs.length;
      const geom = 3.1415 * Math.pow(D/1000, 2) * getSegmentLength(seg.index, n, L) * 250;
      vs[seg.index] = computeNodeVolume(geom, newPressure, 15, 0.85);
      seg.edge.data('volumeSegments', vs);
    });
  });
}

function updateEdgeSegments(cy) {
  cy.edges().forEach(edge => {
    if (edge.data('disable')) return;
    let vs = edge.data('volumeSegments') || [];
    if (vs.length < 2) return;

    const L = parseFloat(edge.data('length')) || 1;
    const D = parseFloat(edge.data('diameter')) || 1000;
    const E = parseFloat(edge.data('E')) || 0.95;
    
    // 1. წნევების და Z-ის განახლება
    let ps = vs.map((v, i) => {
      const geom = 3.1415 * Math.pow(D/1000, 2) * getSegmentLength(i, vs.length, L) * 250;
      return computeNodePressure(geom, v, 15, 0.85);
    });
    let zs = calculateSegmentZ(ps, 15);
    edge.data('pressureSegments', ps);
    edge.data('zSegments', zs);

    // 2. ნაკადის გადატანა (Panhandle A)
    let flows = [];
    for (let i = 0; i < vs.length - 1; i++) {
      const p1 = ps[i], p2 = ps[i+1];
      const diffP2 = Math.pow(p1, 2) - Math.pow(p2, 2);
      const flow = Math.sign(diffP2) * E * 0.005 * Math.pow(D, 2.61) * Math.pow(Math.abs(diffP2)/(L/(vs.length-1) * 0.85), 0.539);
      
      vs[i] -= flow;
      vs[i+1] += flow;
      flows.push(flow);
    }
    edge.data('flowSegments', flows);
    edge.data('volumeSegments', vs);
    
    // 3. სიჩქარეების განახლება UI-სთვის
    updateEdgeVelocities(edge);
  });
}

function updateSimulation(cy, updateInfoCallback) {
  updateNodeSegments(cy);
  updateEdgeSegments(cy);
  window.simulatedSeconds += 1;
  if (updateInfoCallback) updateInfoCallback();
}

// --- კონტროლის ფუნქციები ---

function runSimulation(cy, updateInfoCallback) {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(() => {
    let iterations = window.simulationMode === "min" ? 60 : (window.simulationMode === "hour" ? 3600 : 1);
    for (let i = 0; i < iterations; i++) {
      updateSimulation(cy, updateInfoCallback);
    }
  }, 1000);
}

function stopSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = null;
  window.simulationMode = "stop";
}

function setSimulationMode(mode, cy, updateInfoCallback) {
  stopSimulation();
  if (mode !== "stop") {
    window.simulationMode = mode;
    runSimulation(cy, updateInfoCallback);
  }
}

function resetSimulation() {
  stopSimulation();
  window.simulatedSeconds = 0;
  if (window.cy) {
    window.cy.nodes().forEach(n => n.data('pressure', n.data('pressureSet') ? n.data('pressure') : 0));
    window.cy.edges().forEach(e => {
      const n = e.data('volumeSegments')?.length || 2;
      e.data({ volumeSegments: Array(n).fill(0), flowSegments: Array(n-1).fill(0), v1: 0, v2: 0 });
    });
  }
  if (typeof updateInfo === 'function') updateInfo();
}

window.setSimulationMode = setSimulationMode;
window.resetSimulation = resetSimulation;
