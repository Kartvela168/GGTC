// csv_logger.js
// CSV მონაცემების ლოგირების ფუნქციონალი გაზის ნაკადების სიმულატორისთვის
// ახდენს სიმულაციის მონაცემების ჩაწერას ყოველ წუთში და უზრუნველყოფს გადმოწერის შესაძლებლობას

// CSV მონაცემების ლოგირების ცვლადები
let csvData = [];
let csvHeaders = [];
let lastLoggedMinute = -1;

// --- CSV მონაცემების ლოგირების ფუნქციები ---
function initializeCSVHeaders(cy) {
  csvHeaders = ['დრო'];
  
  // კვანძების წნევის სვეტების დამატება
  cy.nodes().forEach(node => {
    csvHeaders.push(`კვანძი_${node.id()}_წნევა_მპა`);
  });
  
  // მილის სეგმენტების მონაცემების სვეტების დამატება
  cy.edges().forEach(edge => {
    const edgeId = edge.id();
    const name = edge.data('name') || '.';
    const L = edge.data('length');
    const D = edge.data('diameter');
    
    csvHeaders.push(`მილი_${edgeId}_სახელი`);
    csvHeaders.push(`მილი_${edgeId}_სიგრძე_კმ`);
    csvHeaders.push(`მილი_${edgeId}_დიამეტრი_მმ`);
    csvHeaders.push(`მილი_${edgeId}_სიჩქარე1_მწ`);
    csvHeaders.push(`მილი_${edgeId}_სიჩქარე2_მწ`);
    csvHeaders.push(`მილი_${edgeId}_მთლიანი_მოცულობა_მ3`);
    
    // სეგმენტების მოცულობების დამატება
    const volumeSegments = edge.data('volumeSegments') || [];
    for (let i = 0; i < volumeSegments.length; i++) {
      csvHeaders.push(`მილი_${edgeId}_სეგმ_მოცულობა${i}_მ3`);
    }
    
    // სეგმენტების ნაკადების დამატება
    const flowSegments = edge.data('flowSegments') || [];
    for (let i = 0; i < flowSegments.length; i++) {
      csvHeaders.push(`მილი_${edgeId}_სეგმ_ნაკადი${i}_მ3სთ`);
    }
    
    // სეგმენტების წნევების დამატება
    const pressureSegments = edge.data('pressureSegments') || [];
    for (let i = 0; i < pressureSegments.length; i++) {
      csvHeaders.push(`მილი_${edgeId}_სეგმ_წნევა${i}_მპა`);
    }
  });
}

function formatTimeForExcel(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // ფორმატირება როგორც სთ:წთ:წმ Excel-თან თავსებადობისთვის
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function logSimulationData(cy, simulatedSeconds) {
  const currentMinute = Math.floor(simulatedSeconds / 60);
  
  // მონაცემების ჩაწერა ხდება მხოლოდ წუთში ერთხელ
  if (currentMinute === lastLoggedMinute) return;
  lastLoggedMinute = currentMinute;
  
  const row = [];
  
  // დროის სვეტი Excel-ის ფორმატში
  row.push(formatTimeForExcel(simulatedSeconds));
  
  // კვანძების წნევები
  cy.nodes().forEach(node => {
    const pressure = parseFloat(node.data('pressure')) || 0;
    row.push(pressure.toFixed(3));
  });
  
  // მილის სეგმენტების მონაცემები
  cy.edges().forEach(edge => {
    const name = edge.data('name') || '.';
    const L = edge.data('length');
    const D = edge.data('diameter');
    const v1 = parseFloat(edge.data('v1')) || 0;
    const v2 = parseFloat(edge.data('v2')) || 0;
    
    // მთლიანი მოცულობის დათვლა
    const volumeSegments = edge.data('volumeSegments') || [];
    const totalVolume = volumeSegments.reduce((sum, vol) => sum + (parseFloat(vol) || 0), 0);
    
    row.push(name, L, D, v1.toFixed(3), v2.toFixed(3), totalVolume.toFixed(1));
    
    // სეგმენტების მოცულობები
    volumeSegments.forEach(vol => {
      row.push((parseFloat(vol) || 0).toFixed(1));
    });
    
    // სეგმენტების ნაკადები (მ3/წმ-დან მ3/სთ-ში გადაყვანა)
    const flowSegments = edge.data('flowSegments') || [];
    flowSegments.forEach(flow => {
      row.push(((parseFloat(flow) || 0) * 3600).toFixed(2));
    });
    
    // სეგმენტების წნევები
    const pressureSegments = edge.data('pressureSegments') || [];
    pressureSegments.forEach(pressure => {
      row.push((parseFloat(pressure) || 0).toFixed(3));
    });
  });
  
  csvData.push(row);
  
  // CSV ღილაკის მდგომარეობის განახლება
  updateCSVButtonState();
}

function generateCSV() {
  if (csvData.length === 0) {
    alert('ექსპორტისთვის მონაცემები არ არსებობს. ჯერ გაუშვით სიმულაცია მინიმუმ 1 წუთით.');
    return;
  }
  
  let csvContent = csvHeaders.join(',') + '\n';
  csvData.forEach(row => {
    csvContent += row.join(',') + '\n';
  });
  
  // ფაილის შექმნა და გადმოწერა
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  
  // ფაილის სახელის გენერირება დროის აღნიშვნით
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
  link.setAttribute('download', `gazis_simulacia_${timestamp}.csv`);
  
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function resetCSVData() {
  csvData = [];
  csvHeaders = [];
  lastLoggedMinute = -1;
  updateCSVButtonState();
}

function hasCSVData() {
  return csvData.length > 0;
}

function updateCSVButtonState() {
  const csvButton = document.getElementById('csvButton');
  if (csvButton) {
    if (hasCSVData()) {
      csvButton.classList.remove('deactivated');
      csvButton.disabled = false;
    } else {
      csvButton.classList.add('deactivated');
      csvButton.disabled = true;
    }
  }
}

// ფუნქციების გლობალურად ხელმისაწვდომობა
window.generateCSV = generateCSV;
window.resetCSVData = resetCSVData;
window.initializeCSVHeaders = initializeCSVHeaders;
window.logSimulationData = logSimulationData;
window.hasCSVData = hasCSVData;
window.updateCSVButtonState = updateCSVButtonState;

// CSV ღილაკის მდგომარეობის ინიციალიზაცია გვერდის ჩატვირთვისას
document.addEventListener('DOMContentLoaded', function() {
  // მცირე დაყოვნება სხვა სკრიპტების ჩატვირთვის უზრუნველსაყოფად
  setTimeout(updateCSVButtonState, 100);
});