// simulation.js - GGTC ჰიდრავლიკური გაანგარიშების ძრავა

let simulationInterval = null;
window.simulationMode = "stop"; 
window.simulatedSeconds = 0; // გლობალური ცვლადი UI-სთვის

const MIN_FLOW_THRESHOLD = 0.001; 
const PRESSURE_CHANGE_THRESHOLD = 0.01; 

let previousPressures = [];

// --- ფიზიკური გათვლების დამხმარე ფუნქციები ---

function computeNodeVolume(geometry, pressure, T, Z) {
  if (geometry <= 0) return 0;
  const P_base = 0.101325; // MPa
  const T_base = 293.15;   // 20°C
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
  const Tr = T_K / 190.4; // მეთანის კრიტიკული ტემპერატურა
  const A1 = -1.0000 + 3.8740 / Tr - 4.5767 / (Tr * Tr);
  const A2 = 0.1708 - 0.5606 / Tr;

  return pressureSegments.map(P_MPa => {
    const Pr = P_MPa / 4.6; // კრიტიკული წნევა
    return 1 + A1 * Pr + A2 * Pr * Pr;
  });
}

// --- ძირითადი სიმულაციის ბიჯები ---

function updateNodeSegments(cy) {
  cy.nodes().forEach(node => {
    let connectedEdgeSegments = [];
    let existingTotalVolume = 0;

    node.connectedEdges().forEach(edge => {
      if (edge.data('disable')) return;

      let edgeVolSegs = edge.data('volumeSegments') || [];
      let edgeZSegs = edge.data('zSegments') || [];
      const numEdgeSegs = edgeVolSegs.length;
      let D = parseFloat(edge.data('diameter')) || 0;
      let L = parseFloat(edge.data('length')) || 0;
      let T_edge = parseFloat(edge.data('T')) || 15;

      if (numEdgeSegs > 0) {
        let segIdx = edge.target().id() === node.id() ? numEdgeSegs - 1 : 0;
        let segLength = getSegmentLength(segIdx, numEdgeSegs, L);
        let segGeometry = 3.1415 * Math.pow(D/1000, 2) * segLength * 250;
        let vol = parseFloat(edgeVolSegs[segIdx]) || 0;
        let Z_seg = edgeZSegs[segIdx] || 0.85;
        
        existingTotalVolume += vol;
        connectedEdgeSegments.push({ edge, index: segIdx, geometry: segGeometry, Z: Z_seg, T: T_edge });
      }
    });

    let injection = (parseFloat(node.data('injection')) || 0) / 3600; // მ3/სთ -> მ3/წმ
    let newPressure;

    if (node.data('pressureSet')) {
      newPressure = parseFloat(node.data('pressure')) || 0;
    } else {
      const P_base = 0.101325, T_base = 293.15;
      let denom = 0;
      connectedEdgeSegments.forEach(seg => {
        denom += seg.geometry / ((seg.T + 273.15) * seg.Z);
      });
      newPressure = denom ? ((existingTotalVolume + injection) * P_base) / (T_base * denom) : 0;
      node.data('pressure', newPressure);
    }

    // მოცულობების განახლება მილებში
    connectedEdgeSegments.forEach(seg => {
      let vs = seg.edge.data('volumeSegments') || [];
      vs[seg.index] = computeNodeVolume(seg.geometry, newPressure, seg.T, seg.Z);
      seg.edge.data('volumeSegments', vs);
    });
  });
}

function updateEdgeSegments(cy) {
  cy.edges().forEach(edge => {
    if (edge.data('disable')) return;
    
    const edgeLength = parseFloat(edge.data('length')) || 0;
    const D = parseFloat(edge.data('diameter')) || 0;
    const E = parseFloat(edge.data('E')) || 0.95;
    const T = parseFloat(edge.data('T')) || 15;
    
    let edgeVolSegs = edge.data('volumeSegments') || [];
    const numSegs = edgeVolSegs.length;
    if (numSegs < 2) return;

    let segPressures = [];
    for (let i = 0; i < numSegs; i++) {
      let segLen = getSegmentLength(i, numSegs, edgeLength);
      let segGeom = 3.1415 * Math.pow(D / 1000, 2) * segLen * 250;
      segPressures.push(computeNodePressure(segGeom, edgeVolSegs[i], T, 0.85));
    }

    let segZ = calculateSegmentZ(segPressures, T);
    edge.data('pressureSegments', segPressures);
    edge.data('zSegments', segZ);

    let newFlows = [];
    let flowLen = edgeLength / (numSegs - 1);

    for (let i = 0; i < numSegs - 1; i++) {
      const p1 = segPressures[i], p2 = segPressures[i + 1];
      const avgZ = (segZ[i] + segZ[i+1]) / 2;
      
      // Panhandle A გამარტივებული ფორმულა
      let diffP2 = Math.pow(p1, 2) - Math.pow(p2, 2);
      let sign = Math.sign(diffP2);
      let flow = sign * E * 0.005 * Math.pow(D, 2.61) * Math.pow(Math.abs(diffP2) / (flowLen * avgZ), 0.539);
      
      // მასის ბალანსი (მოცულობის გადატანა)
      if (Math.abs(flow) < MIN_FLOW_THRESHOLD) flow = 0;
      
      edgeVolSegs[i] -= flow;
      edgeVolSegs[i+1] += flow;
      newFlows.push(flow);
    }
    
    edge.data('flowSegments', newFlows);
    edge.data('volumeSegments', edgeVolSegs);
  });
}

function updateSimulation(cy, updateInfoCallback) {
  updateNodeSegments(cy);
  updateEdgeSegments(cy);
  
  // დროს ვუმატებთ გლობალურ ცვლადს
  window.simulatedSeconds += 1;
  
  if (updateInfoCallback) updateInfoCallback();
}

// --- კონტროლის ფუნქციები ---

function runSimulation(cy, updateInfoCallback) {
  if (simulationInterval) clearInterval(simulationInterval);
  
  simulationInterval = setInterval(() => {
    let iterations = 1;
    if (window.simulationMode === "min") iterations = 60;
    if (window.simulationMode === "hour") iterations = 3600;

    for (let i = 0; i < iterations; i++) {
      updateSimulation(cy, updateInfoCallback);
    }
  }, 1000);
}

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
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
    window.cy.nodes().forEach(n => {
       n.data('pressure', n.data('pressureSet') ? n.data('pressure') : 0);
    });
    window.cy.edges().forEach(e => {
       const n = e.data('volumeSegments')?.length || 2;
       e.data('volumeSegments', Array(n).fill(0));
       e.data('flowSegments', Array(n-1).fill(0));
       e.data('v1', 0); e.data('v2', 0);
    });
  }
  if (typeof updateInfo === 'function') updateInfo();
}

// ექსპორტი
window.setSimulationMode = setSimulationMode;
window.resetSimulation = resetSimulation;