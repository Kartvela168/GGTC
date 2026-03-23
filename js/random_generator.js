// random_generator.js - GGTC ვერსია

function generateRandomNetwork() {
    if (typeof cy === 'undefined' || !cy) return;

    // 1. ვასუფთავებთ არსებულ ქსელს
    if (typeof clearGraph === 'function') {
        clearGraph();
    } else {
        cy.elements().remove();
        if (typeof nodeIdCounter !== 'undefined') nodeIdCounter = 0;
    }

    const numNodes = 6;
    const nodes = [];

    // 2. ვქმნით კვანძებს (Nodes)
    for (let i = 0; i < numNodes; i++) {
        const id = 'n' + i;
        const x = 100 + Math.random() * 600;
        const y = 100 + Math.random() * 400;
        
        const node = cy.add({
            group: 'nodes',
            data: { 
                id: id, 
                name: 'წერტილი ' + i, 
                injection: i === 0 ? 0.277 : (i === numNodes - 1 ? -0.277 : 0), // პირველი შედის, ბოლო გადის
                pressure: i === 0 ? 5.0 / ATM_COEFF : 0, // საწყისი წნევა 5 ატმ
                pressureSet: i === 0 ? true : false,
                label: ''
            },
            position: { x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 }
        });
        nodes.push(node);
    }

    // 3. ვაკავშირებთ კვანძებს მილებით (Edges)
    for (let i = 0; i < numNodes - 1; i++) {
        const sourceId = nodes[i].id();
        const targetId = nodes[i + 1].id();
        
        // მანძილის დათვლა კოორდინატებს შორის
        const p1 = nodes[i].position();
        const p2 = nodes[i + 1].position();
        const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) * 0.2;
        const L = Math.max(dist, 0.1);
        
        // სეგმენტების რაოდენობა (UI.js-დან)
        const sc = typeof getSegmentCount === 'function' ? getSegmentCount(L) : 2;

        cy.add({
            group: 'edges',
            data: {
                id: `${sourceId}_${targetId}_${Date.now()}_${i}`,
                source: sourceId,
                target: targetId,
                length: L.toFixed(1),
                diameter: "1000",
                E: "0.95",
                T: "15",
                name: "მაგისტრალი " + (i + 1),
                disable: false,
                volumeSegments: Array(sc).fill(0),
                flowSegments: Array(sc - 1).fill(0),
                pressureSegments: Array(sc).fill(0),
                zSegments: Array(sc).fill(1.0)
            }
        });
    }

    // დამატებითი კავშირი სირთულისთვის
    if (numNodes > 3) {
        const L_extra = 50.0;
        const sc_extra = 5;
        cy.add({
            group: 'edges',
            data: {
                id: `n1_n4_${Date.now()}`,
                source: 'n1',
                target: 'n4',
                length: L_extra.toFixed(1),
                diameter: "700",
                E: "0.95",
                T: "15",
                name: "შემოვლითი",
                disable: false,
                volumeSegments: Array(sc_extra).fill(0),
                flowSegments: Array(sc_extra - 1).fill(0),
                pressureSegments: Array(sc_extra).fill(0),
                zSegments: Array(sc_extra).fill(1.0)
            }
        });
    }

    // 4. ვაახლებთ ინტერფეისს და ცხრილებს
    cy.layout({ name: 'preset' }).run();
    if (typeof updateInfo === 'function') {
        updateInfo();
    }
    
    // ვაახლებთ ID მთვლელს, რომ შემდეგი ხელით დასმული წერტილი არ აირიოს
    if (typeof nodeIdCounter !== 'undefined') {
        nodeIdCounter = numNodes;
    }
}

// ექსპორტი გლობალურ გარემოში
window.generateRandomNetwork = generateRandomNetwork;