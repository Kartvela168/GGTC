// graph_io.js - გრაფიკის იმპორტისა და ექსპორტის მოდული
class GraphIO {
  constructor() {
    this.storageKey = 'gas-flows-saved-graphs';
    this.currentGraphKey = 'gas-flows-current-graph';
  }

  // მიმდინარე გრაფიკის (ქსელის) ექსპორტი JSON ფაილში
  exportGraph() {
    try {
      const graphData = this.captureGraphData();
      const dataStr = JSON.stringify(graphData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      
      // გადმოწერის ლინკის შექმნა
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // ფაილის სახელის გენერირება დროის აღნიშვნით
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `gazis-qseli-${timestamp}.json`;
      
      // გადმოწერის დაწყება
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('ქსელის ექსპორტი წარმატებით დასრულდა');
      
      // ასევე ვინახავთ localStorage-ში სარეზერვო ასლისთვის
      this.saveToLocalStorage(graphData);
      
    } catch (error) {
      console.error('შეცდომა ექსპორტისას:', error);
      alert('შეცდომა ქსელის ექსპორტისას: ' + error.message);
    }
  }

  // გრაფიკის (ქსელის) იმპორტი JSON ფაილიდან
  importGraph() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const graphData = JSON.parse(e.target.result);
            this.loadGraphData(graphData);
            console.log('ქსელის იმპორტი წარმატებით დასრულდა');
            
            // იმპორტირებული ქსელის შენახვა localStorage-ში
            this.saveToLocalStorage(graphData);
            
          } catch (error) {
            console.error('შეცდომა ფაილის წაკითხვისას:', error);
            alert('შეცდომა იმპორტისას: JSON ფაილის ფორმატი არასწორია');
          }
        };
        reader.readAsText(file);
      };
      
      input.click();
      
    } catch (error) {
      console.error('შეცდომა იმპორტისას:', error);
      alert('შეცდომა იმპორტისას: ' + error.message);
    }
  }

  // მიმდინარე მონაცემების ამოღება Cytoscape-დან
  captureGraphData() {
    const elements = cy.json().elements;
    
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      simulatedSeconds: simulatedSeconds || 0,
      nodeIdCounter: nodeIdCounter || 0,
      uiMode: uiMode || 'build',
      simState: simState || 'pause',
      elements: elements,
      metadata: {
        nodeCount: cy.nodes().length,
        edgeCount: cy.edges().length,
        totalVolume: this.calculateTotalVolume(),
        description: 'გაზის ნაკადების სიმულატორის მონაცემები'
      }
    };
  }

  // მონაცემების ჩატვირთვა სიმულატორში
  loadGraphData(graphData, silent = false) {
    try {
      // მონაცემების სტრუქტურის ვალიდაცია
      if (!graphData.elements) {
        throw new Error('მონაცემები არასრულია: აკლია ელემენტები');
      }

      // ნებისმიერი მიმდინარე სიმულაციის გაჩერება
      if (window.setSimulationMode) {
        window.setSimulationMode('stop', cy, updateInfo);
      }

      // არსებული ელემენტების წაშლა
      cy.elements().remove();

      // ელემენტების ჩატვირთვა
      cy.json({ elements: graphData.elements });

      // სიმულაციის მდგომარეობის აღდგენა
      if (graphData.simulatedSeconds !== undefined) {
        simulatedSeconds = graphData.simulatedSeconds;
      }
      if (graphData.nodeIdCounter !== undefined) {
        nodeIdCounter = graphData.nodeIdCounter;
      }

      // UI მდგომარეობის აღდგენა
      if (graphData.uiMode && window.setUIMode) {
        window.setUIMode(graphData.uiMode);
      }
      if (graphData.simState && window.setSimState) {
        window.setSimState(graphData.simState);
      }

      // ეკრანის განახლება
      if (window.updateInfo) {
        window.updateInfo();
      }

      console.log(`ქსელი წარმატებით ჩაიტვირთა! კვანძები: ${graphData.metadata?.nodeCount || cy.nodes().length}, მილები: ${graphData.metadata?.edgeCount || cy.edges().length}`);

    } catch (error) {
      console.error('შეცდომა მონაცემების ჩატვირთვისას:', error);
      alert('შეცდომა ჩატვირთვისას: ' + error.message);
    }
  }

  // localStorage-ში შენახვა მუდმივობისთვის
  saveToLocalStorage(graphData) {
    try {
      const savedGraphs = this.getSavedGraphs();
      
      // მიმდინარე ქსელის დამატება შენახულების სიაში
      const graphEntry = {
        id: Date.now(),
        name: `ქსელი ${new Date().toLocaleString('ka-GE')}`,
        timestamp: new Date().toISOString(),
        data: graphData
      };
      
      savedGraphs.push(graphEntry);
      
      // ვინახავთ მხოლოდ ბოლო 10 ვერსიას
      if (savedGraphs.length > 10) {
        savedGraphs.splice(0, savedGraphs.length - 10);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(savedGraphs));
      localStorage.setItem(this.currentGraphKey, JSON.stringify(graphData));
      
    } catch (error) {
      console.error('შეცდომა localStorage-ში შენახვისას:', error);
    }
  }

  // localStorage-დან ჩატვირთვა
  loadFromLocalStorage() {
    try {
      const currentGraph = localStorage.getItem(this.currentGraphKey);
      if (currentGraph) {
        const graphData = JSON.parse(currentGraph);
        this.loadGraphData(graphData, true); // silent = true ავტომატური ჩატვირთვისთვის
        return true;
      }
    } catch (error) {
      console.error('შეცდომა localStorage-დან ჩატვირთვისას:', error);
    }
    return false;
  }

  // შენახული ქსელების სიის მიღება
  getSavedGraphs() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('შეცდომა შენახული სიის მიღებისას:', error);
      return [];
    }
  }

  // მიმდინარე მდგომარეობის ავტომატური შენახვა
  autoSave() {
    try {
      const graphData = this.captureGraphData();
      localStorage.setItem(this.currentGraphKey, JSON.stringify(graphData));
    } catch (error) {
      console.error('შეცდომა ავტომატური შენახვისას:', error);
    }
  }

  // მთლიანი მოცულობის დათვლა მეტამონაცემებისთვის
  calculateTotalVolume() {
    let totalVol = 0;
    cy.edges().forEach(edge => {
      const volumeSegments = edge.data('volumeSegments') || [];
      const sumVol = volumeSegments.reduce((s, v) => s + (v || 0), 0);
      totalVol += sumVol;
    });
    return totalVol;
  }

  // ყველა შენახული მონაცემის წაშლა
  clearSavedData() {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.currentGraphKey);
      console.log('ყველა შენახული მონაცემი წაშლილია');
    } catch (error) {
      console.error('შეცდომა მონაცემების წაშლისას:', error);
    }
  }

  // შენახული ქსელების სიის ჩვენება (სამომავლო ფუნქციონალისთვის)
  showSavedGraphsList() {
    const savedGraphs = this.getSavedGraphs();
    if (savedGraphs.length === 0) {
      console.log('შენახული ქსელები ვერ მოიძებნა.');
      return;
    }

    let list = 'შენახული ქსელები:\n\n';
    savedGraphs.forEach((graph, index) => {
      list += `${index + 1}. ${graph.name}\n   ${new Date(graph.timestamp).toLocaleString('ka-GE')}\n   კვანძები: ${graph.data.metadata?.nodeCount || 'უცნობია'}, მილები: ${graph.data.metadata?.edgeCount || 'უცნობია'}\n\n`;
    });
    
    console.log(list);
  }

  // ბოლო შენახული ქსელის აღდგენა
  recoverLastGraph() {
    try {
      const currentGraph = localStorage.getItem(this.currentGraphKey);
      if (currentGraph) {
        const graphData = JSON.parse(currentGraph);
        
        // მომხმარებლის დასტური
        const nodeCount = graphData.metadata?.nodeCount || 'უცნობია';
        const edgeCount = graphData.metadata?.edgeCount || 'უცნობია';
        const timestamp = new Date(graphData.timestamp).toLocaleString('ka-GE');
        
        const confirmed = confirm(
          `აღვადგინოთ ბოლო შენახული ქსელი?\n\n` +
          `შენახვის დრო: ${timestamp}\n` +
          `კვანძები: ${nodeCount}, მილები: ${edgeCount}\n\n` +
          `ეს მოქმედება ჩაანაცვლებს თქვენს მიმდინარე ნახაზს.`
        );
        
        if (confirmed) {
          this.loadGraphData(graphData);
          return true;
        }
      } else {
        console.log('აღსადგენი მონაცემები ვერ მოიძებნა.');
      }
    } catch (error) {
      console.error('შეცდომა აღდგენისას:', error);
      alert('შეცდომა აღდგენისას: ' + error.message);
    }
    return false;
  }
}

// გლობალური ინსტანციის შექმნა
window.graphIO = new GraphIO();

// ღილაკების მიბმა DOM-ის ჩატვირთვისას
document.addEventListener('DOMContentLoaded', function() {
  const exportButton = document.getElementById('exportButton');
  const importButton = document.getElementById('importButton');
  const recoverButton = document.getElementById('recoverButton');
  
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      if (cy.elements().length === 0) {
        console.log('ექსპორტისთვის მონაცემები არ არსებობს. ჯერ შექმენით კვანძები და მილები.');
        return;
      }
      window.graphIO.exportGraph();
    });
  }
  
  if (importButton) {
    importButton.addEventListener('click', () => {
      window.graphIO.importGraph();
    });
  }

  if (recoverButton) {
    recoverButton.addEventListener('click', () => {
      window.graphIO.recoverLastGraph();
    });
  }
});

// ავტომატური შენახვა ყოველ 30 წამში, თუ ქსელში არის ცვლილებები
setInterval(() => {
  if (cy && cy.elements().length > 0) {
    window.graphIO.autoSave();
  }
}, 30000);

// შენახვა გვერდიდან გასვლისას
window.addEventListener('beforeunload', () => {
  if (window.graphIO && cy && cy.elements().length > 0) {
    window.graphIO.autoSave();
  }
});