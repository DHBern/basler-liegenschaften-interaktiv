// js/sidebar.js
import { state } from './state.js';

let lastPropertyId = null;

export function renderSidebar() {
    if (!state.currentProperty) return;
    
    // Reset selected person when switching to a completely new property
    if (lastPropertyId !== state.currentProperty.id) {
        state.selectedPerson = null;
        lastPropertyId = state.currentProperty.id;
    }
    
    // 1. POPULATE RIGHT SIDEBAR HEADER
    const titleStr = state.currentProperty.adrs ? state.currentProperty.adrs : "Property";
    document.getElementById('sidebar-title').innerHTML = `
        ${titleStr}
        <div style="font-size: 12px; color: #888; font-weight: normal; margin-top: 4px;">ID: ${state.currentProperty.id}</div>
    `;
    
    // Hide the old tabs as we are replacing them with dynamic content
    const tabsEl = document.getElementById('sidebar-tabs');
    if (tabsEl) tabsEl.style.display = 'none';
    
    // Render the contextual sidebar content and the bottom timeline
    renderSidebarContent();
    renderBottomTimeline();
    
    // Slide panel up!
    document.getElementById('bottom-panel').classList.add('open');
}

export function closeBottomPanel() {
    document.getElementById('bottom-panel').classList.remove('open');
}

// NEW: Handles clicking an owner on the timeline
export function selectOwnerInSidebar(personId) {
    state.selectedPerson = personId;
    renderSidebarContent();
    renderBottomTimeline(true);
}

function renderSidebarContent() {
    const contentDiv = document.getElementById('sidebar-content');
    
    if (!state.selectedPerson) {
        contentDiv.innerHTML = `
            <div style="padding: 20px 0; text-align: center; color: #666; font-style: italic;">
                <p>Select an owner on the timeline below to view their details and associated documents.</p>
            </div>`;
        return;
    }

    const actor = state.personsData[state.selectedPerson];
    const name = actor ? actor.n : `Unknown Actor (${state.selectedPerson})`;

    // 1. Person Profile Section
    let html = `<div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #eee;">
                    <h3 style="margin-top: 0; margin-bottom: 5px; color: #2c3e50;">${name}</h3>`;
    
    if (actor) {
        // 1) Name Variants Dropdown
        if (actor.variants && actor.variants.length > 0) {
            html += `<details style="margin-bottom: 15px; font-size: 12px; color: #666; cursor: pointer;">
                        <summary style="outline: none; font-style: italic;">Name Variants</summary>
                        <ul style="margin: 5px 0 0 20px; padding: 0; color: #444;">
                            ${actor.variants.map(v => `<li>${v}</li>`).join('')}
                        </ul>
                     </details>`;
        } else {
            html += `<div style="margin-bottom: 15px;"></div>`; // Adds spacing if no variants exist
        }

        // 4) Removed class and affiliation, keeping Occupation
        if (actor.occ) {
            html += `<div class="profile-section"><span class="profile-label">Occupation</span>${actor.occ.join(', ')}</div>`;
        }
        
        // 2) Relationships List
        if (actor.rel && Object.keys(actor.rel).length > 0) {
            html += `<div class="profile-section"><span class="profile-label">Relationships</span>`;
            
            let relLinks = []; // Create an empty array to hold the formatted links
            
            for (const [role, targetIds] of Object.entries(actor.rel)) {
                targetIds.forEach(tId => {
                    const targetActor = state.personsData[tId];
                    const tName = targetActor ? targetActor.n : tId;
                    
                    // Push each formatted string into the array
                    relLinks.push(`${role} to <a href="#" onclick="window.showPersonProfile('${tId}'); return false;" style="color: #0076ff; text-decoration: none;">${tName}</a>`);
                });
            }
            
            // Join the array with a comma and space, then close the div!
            html += relLinks.join(', ') + `</div>`;
        }
    }
    html += `</div>`;

    // 2. Extract & Filter Documents
    let uniqueDocIds = new Set();
    
    const actorOwnerDocs = (actor && actor.doc && actor.doc.owner) ? actor.doc.owner : [];

    (state.currentProperty.h || []).forEach(record => {
        let owners = Array.isArray(record.p) ? record.p : [record.p];
        
        if (owners.includes(state.selectedPerson) && record.doc) {
            let docs = Array.isArray(record.doc) ? record.doc : [record.doc];
            
            docs.forEach(d => {
                if (actorOwnerDocs.includes(d)) {
                    uniqueDocIds.add(d);
                }
            });
        }
    });

    let ownerDocs = [];
    let neighborDocs = [];

    Array.from(uniqueDocIds).forEach(id => {
        const doc = state.documentsData[id];
        if (doc && doc.y !== undefined) {
            // Check if the document natively belongs to the property we are looking at!
            if (doc.dossier === state.currentProperty.id) {
                ownerDocs.push({ id, ...doc });
            } else {
                neighborDocs.push({ id, ...doc });
            }
        }
    });

    ownerDocs.sort((a, b) => a.y - b.y);
    neighborDocs.sort((a, b) => a.y - b.y);

    function buildTimelineHtml(docsList) {
        let tlHtml = `<div class="timeline">`;
        docsList.forEach(doc => {
            const previewText = doc.txt ? doc.txt : "No summary available.";
            tlHtml += `
                <div class="timeline-node" onclick="window.openModal('${doc.id}')">
                    <div class="node-year">${doc.y}</div>
                    <div class="node-text">${previewText}</div>
                </div>
            `;
        });
        tlHtml += `</div>`;
        return tlHtml;
    }

    if (ownerDocs.length === 0 && neighborDocs.length === 0) {
        html += `<h4 style="margin-bottom: 15px; color: #444; border-bottom: 2px solid #eee; padding-bottom: 5px;">Documents</h4>`;
        html += `<p style="color: #888; font-size: 13px; font-style: italic;">No specific documents found linking this person to this property.</p>`;
    } else {
        if (ownerDocs.length > 0) {
            html += `<h4 style="margin-bottom: 15px; color: #444; border-bottom: 2px solid #eee; padding-bottom: 5px;">Documents as Owner</h4>`;
            html += buildTimelineHtml(ownerDocs);
        }
        if (neighborDocs.length > 0) {
            html += `<h4 style="margin-bottom: 15px; margin-top: 25px; color: #444; border-bottom: 2px solid #eee; padding-bottom: 5px;">Documents as Neighbor</h4>`;
            html += buildTimelineHtml(neighborDocs);
        }
    }

    contentDiv.innerHTML = html;
}

function renderBottomTimeline(keepScroll = false) {
    const container = document.getElementById('timeline-container');
    const property = state.currentProperty;

    // Memorize the current scroll position before we wipe the HTML
    const previousScroll = keepScroll ? container.scrollLeft : 0;
    
    if (!property.owners) {
        container.innerHTML = "<p style='padding:20px; color:#888;'>No ownership timeline data available.</p>";
        document.getElementById('bottom-panel').style.height = '150px';
        return;
    }

    // --- 1. CALCULATE DYNAMIC TIME BOUNDARIES ---
    let minYear = 1700;
    let maxYear = 1400;

    if (property.dhs && property.dhs.length > 0) {
        property.dhs.forEach(phase => {
            const s = parseInt(phase.start || phase.from || 1400);
            const e = parseInt(phase.end || phase.to || 1700);
            if (s < minYear) minYear = s;
            if (e > maxYear) maxYear = e;
        });
    }

    const START_YEAR = Math.max(1300, Math.floor(minYear / 10) * 10 - 10);
    const END_YEAR = Math.min(1800, Math.ceil(maxYear / 10) * 10 + 10);
    
    const PIXELS_PER_YEAR = 8; 
    const TOTAL_WIDTH = (END_YEAR - START_YEAR) * PIXELS_PER_YEAR;

    // --- 2. CALCULATE DYNAMIC HEIGHTS ---
    const LANE_HEIGHT = 45; 
    const BAR_HEIGHT = 35;

    const owners = typeof property.owners === 'string' ? JSON.parse(property.owners) : property.owners;
    let maxLane = 0;
    if (owners.length > 0) {
        owners.forEach(o => { if (o.lane > maxLane) maxLane = o.lane; });
    } else {
        maxLane = -1; 
    }
    const numLanes = maxLane + 1;

    let relGroups = {};
    (property.dhs || []).forEach(phase => {
        if (phase.relationships) {
            const startYr = parseInt(phase.start || phase.from || 1400);
            const endYr = parseInt(phase.end || phase.to || 1700);
            
            phase.relationships.forEach(rel => {
                const type = rel[0];
                const targetId = rel[1];
                if (type === 'predecessor') {
                    if (!relGroups[startYr]) relGroups[startYr] = { preds: [], succs: [] };
                    relGroups[startYr].preds.push(targetId);
                } else if (type === 'successor') {
                    if (!relGroups[endYr]) relGroups[endYr] = { preds: [], succs: [] };
                    relGroups[endYr].succs.push(targetId);
                }
            });
        }
    });

    let maxRelStack = 0;
    const isPartOf = property['is-part-of'] || [];
    const contains = property.contains || [];
    const spatialStack = isPartOf.length + contains.length;
    maxRelStack = Math.max(maxRelStack, spatialStack);
    
    for (const data of Object.values(relGroups)) {
        maxRelStack = Math.max(maxRelStack, data.preds.length, data.succs.length);
    }
    
    // NEW: Check if there are any relations to draw at all
    const hasRelations = (spatialStack > 0 || Object.keys(relGroups).length > 0);
    const RELATIONS_TRACK_HEIGHT = hasRelations ? Math.max(45, (maxRelStack * 28) + 16) : 0;

    // Group documents by year for vertical stacking
    let docsByYear = {};
    let ownershipDocIds = new Set(); // Keep track of which ones have ownership

    // 1. Collect documents tied to ownership phases
    (property.h || []).forEach(record => {
        if (record.doc) {
            const docs = Array.isArray(record.doc) ? record.doc : [record.doc];
            docs.forEach(d => {
                ownershipDocIds.add(d);
                const actualDoc = state.documentsData[d];
                // Fallback to the record's start year if the doc lacks a year
                const docYear = (actualDoc && actualDoc.y) ? actualDoc.y : record.s; 
                if (docYear) {
                    if (!docsByYear[docYear]) docsByYear[docYear] = new Set();
                    docsByYear[docYear].add(d);
                }
            });
        }
    });

    // 2. Add all general documents from the dossier's 'd' array
    (property.d || []).forEach(d => {
        if (!ownershipDocIds.has(d)) { // Only add if it wasn't already added as an ownership doc
            const actualDoc = state.documentsData[d];
            if (actualDoc && actualDoc.y) {
                if (!docsByYear[actualDoc.y]) docsByYear[actualDoc.y] = new Set();
                docsByYear[actualDoc.y].add(d);
            }
        }
    });

    let maxDocStack = 0;
    for (const docSet of Object.values(docsByYear)) {
        maxDocStack = Math.max(maxDocStack, docSet.size);
    }
    const DOC_TRACK_HEIGHT = Math.max(40, (maxDocStack * 16) + 24);

    // Dynamic Panel Height with reduced padding if relations track is hidden
    const basePadding = hasRelations ? 70 : 60;
    const requiredHeight = (numLanes * LANE_HEIGHT) + RELATIONS_TRACK_HEIGHT + DOC_TRACK_HEIGHT + basePadding; 
    document.getElementById('bottom-panel').style.height = `${requiredHeight}px`;

    let html = `<div class="timeline-wrapper" style="width: ${TOTAL_WIDTH}px; height: 100%;">`;

    for (let y = START_YEAR; y <= END_YEAR; y += 10) {
        const leftPos = (y - START_YEAR) * PIXELS_PER_YEAR;
        html += `<div class="year-tick" style="left: ${leftPos}px; z-index: 1;"></div>`;
    }

    // --- TRACK 1: OWNERSHIP LANES (TOP) ---
    html += `<div class="owners-track" style="position: relative; z-index: 5;">`;
    for (let i = 0; i < numLanes; i++) {
        html += `<div class="gantt-lane" style="height: ${LANE_HEIGHT}px;">`;
        
        const laneOwners = owners.filter(o => o.lane === i);
        laneOwners.forEach(ownerBlock => {
            const start = Math.max(START_YEAR, ownerBlock.start);
            const end = Math.min(END_YEAR, ownerBlock.end);
            
            const left = (start - START_YEAR) * PIXELS_PER_YEAR;
            const width = Math.max((end - start) * PIXELS_PER_YEAR, 4); 
            
            let sc = ownerBlock.sc !== undefined && ownerBlock.sc !== null ? Math.max(START_YEAR, ownerBlock.sc) : start;
            let ec = ownerBlock.ec !== undefined && ownerBlock.ec !== null ? Math.min(END_YEAR, ownerBlock.ec) : end;
            
            let fadeStartPct = Math.max(0, ((sc - start) / (end - start)) * 100);
            let fadeEndPct = Math.min(100, ((ec - start) / (end - start)) * 100);

            let maskStyle = '';
            if (fadeStartPct > 0 || fadeEndPct < 100) {
                maskStyle = `-webkit-mask-image: linear-gradient(to right, rgba(0,0,0,0.25) 0%, rgba(0,0,0,1) ${fadeStartPct}%, rgba(0,0,0,1) ${fadeEndPct}%, rgba(0,0,0,0.25) 100%); 
                             mask-image: linear-gradient(to right, rgba(0,0,0,0.25) 0%, rgba(0,0,0,1) ${fadeStartPct}%, rgba(0,0,0,1) ${fadeEndPct}%, rgba(0,0,0,0.25) 100%);`;
            }
            
            const actor = state.personsData[ownerBlock.id];
            const name = actor ? actor.n : `Unknown (${ownerBlock.id})`;
            let occStr = '';
            let relStr = '';
            let color = state.COLOR_OTHER;
            
            if (actor) {
                if (actor.occ && actor.occ.length > 0) {
                    occStr = actor.occ.join(', ');
                    const mapping = state.occupationLookup[actor.occ[0].toLowerCase()];
                    if (mapping && state.palettes.concept[mapping.concept]) {
                        color = state.palettes.concept[mapping.concept];
                    }
                }
                
                if (actor.rel) {
                    let relParts = [];
                    for (const [role, targetIds] of Object.entries(actor.rel)) {
                        targetIds.forEach(tId => {
                            const targetActor = state.personsData[tId];
                            const tName = targetActor ? targetActor.n : tId;
                            relParts.push(`${role} of ${tName}`);
                        });
                    }
                    if (relParts.length > 0) {
                        relStr = relParts.join(', ');
                    }
                }
            }
            
            const isSelected = state.selectedPerson === ownerBlock.id;
            const borderStyle = isSelected ? 'border: 2px solid #000; box-shadow: 0 0 8px rgba(0,0,0,0.5); z-index: 50;' : 'border: 1px solid rgba(0,0,0,0.1);';

            html += `<div class="gantt-bar" 
                          style="left: ${left}px; width: ${width}px; height: ${BAR_HEIGHT}px; background-color: ${color}; ${maskStyle} ${borderStyle}"
                          title="${name} (Inferred: ${Math.floor(ownerBlock.start)}-${Math.floor(ownerBlock.end)} | Confirmed: ${sc}-${ec})"
                          onclick="window.selectOwnerInSidebar('${ownerBlock.id}')"
                          onmouseenter="if(!${isSelected}) { this.style.zIndex=100; this.style.width='max-content'; this.style.minWidth='${width}px'; this.style.boxShadow='2px 4px 10px rgba(0,0,0,0.4)'; }"
                          onmouseleave="if(!${isSelected}) { this.style.zIndex=10; this.style.width='${width}px'; this.style.boxShadow=''; }">
                        <div style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; padding: 0 4px;">${name}</div>
                        ${occStr ? `<div style="font-size: 10px; opacity: 0.9; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; padding: 0 4px;">${occStr}</div>` : ''}
                        ${relStr ? `<div style="font-size: 10px; opacity: 0.8; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; font-style: italic;">${relStr}</div>` : ''}
                     </div>`;
        });
        html += `</div>`;
    }
    html += `</div>`;


    // --- TRACK 2: RELATIONS TRACK (MIDDLE) (Conditionally Rendered) ---
    if (hasRelations) {
        html += `<div class="relations-track" style="height: ${RELATIONS_TRACK_HEIGHT}px; position: relative; border-top: 2px solid #ccc; background: rgba(245, 247, 250, 0.8); z-index: 5;">`;

        if (spatialStack > 0) {
            html += `<div style="position: sticky; left: 10px; top: 8px; display: inline-flex; flex-direction: column; gap: 4px; z-index: 50; width: max-content;">`;
            isPartOf.forEach(targetId => {
                const targetProp = state.propertyData.find(p => p.id === targetId);
                const targetName = targetProp && targetProp.adrs ? targetProp.adrs : targetId;
                html += `<div onclick="window.focusProperty('${targetId}')" class="related-tag part-of-tag timeline-rel-tag" style="margin:0;">⬆️ Part of: ${targetName}</div>`;
            });
            contains.forEach(targetId => {
                const targetProp = state.propertyData.find(p => p.id === targetId);
                const targetName = targetProp && targetProp.adrs ? targetProp.adrs : targetId;
                html += `<div onclick="window.focusProperty('${targetId}')" class="related-tag contains-tag timeline-rel-tag" style="margin:0;">⬇️ Contains: ${targetName}</div>`;
            });
            html += `</div>`;
        }

        (property.dhs || []).forEach(phase => {
            if (phase.relationships && phase.relationships.length > 0) {
                const startYr = parseInt(phase.start || phase.from || 1400);
                const endYr = parseInt(phase.end || phase.to || 1700);
                const startX = Math.max(0, (startYr - START_YEAR) * PIXELS_PER_YEAR);
                const endX = Math.max(0, (endYr - START_YEAR) * PIXELS_PER_YEAR);
                
                const lineTop = RELATIONS_TRACK_HEIGHT / 2;
                html += `<div style="position: absolute; left: ${startX}px; width: ${endX - startX}px; top: ${lineTop}px; height: 2px; background: rgba(0, 118, 255, 0.2);"></div>`;
            }
        });

        for (const [year, data] of Object.entries(relGroups)) {
            const x = (year - START_YEAR) * PIXELS_PER_YEAR;
            
            if (data.preds.length > 0) {
                html += `<div style="position: absolute; left: ${x}px; top: 8px; transform: translateX(-100%); margin-left: -5px; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; z-index: 60;">`;
                data.preds.forEach(targetId => {
                    const targetProp = state.propertyData.find(p => p.id === targetId);
                    const targetName = targetProp && targetProp.adrs ? targetProp.adrs : targetId;
                    
                    // FIX 1: Jump to 1 year BEFORE the merge so the predecessor is actively visible!
                    const jumpYr = Math.max(1400, parseInt(year) - 1); 
                    
                    html += `<div onclick="window.focusProperty('${targetId}', ${jumpYr})" class="related-tag pred-tag timeline-rel-tag" style="margin:0;" title="Predecessor: ${targetId}">⬅️ ${targetName}</div>`;
                });
                html += `</div>`;
            }
            
            if (data.succs.length > 0) {
                html += `<div style="position: absolute; left: ${x}px; top: 8px; margin-left: 5px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start; z-index: 60;">`;
                data.succs.forEach(targetId => {
                    const targetProp = state.propertyData.find(p => p.id === targetId);
                    const targetName = targetProp && targetProp.adrs ? targetProp.adrs : targetId;
                    
                    // FIX 2: Jump to 1 year AFTER the split so the successor is actively visible!
                    const jumpYr = Math.min(1700, parseInt(year) + 1); 
                    
                    html += `<div onclick="window.focusProperty('${targetId}', ${jumpYr})" class="related-tag succ-tag timeline-rel-tag" style="margin:0;" title="Successor: ${targetId}">➡️ ${targetName}</div>`;
                });
                html += `</div>`;
            }
        }
        html += `</div>`;
    }

    html += `<div class="doc-track" style="height: ${DOC_TRACK_HEIGHT}px; margin-top: 0; border-top: 1px solid #ccc; z-index: 5;">`;
    for (let y = START_YEAR; y <= END_YEAR; y += 10) {
        const leftPos = (y - START_YEAR) * PIXELS_PER_YEAR;
        html += `<div style="position: absolute; left: ${leftPos}px; top: 2px; font-size: 10px; color: #666; transform: translateX(-50%); font-weight: bold; z-index: 5;">${y}</div>`;
    }
    
    for (const [year, docSet] of Object.entries(docsByYear)) {
        const left = (year - START_YEAR) * PIXELS_PER_YEAR;
        let stackIndex = 0;
        
        docSet.forEach(docId => {
            const doc = state.documentsData[docId];
            const isNeighbor = doc && doc.dossier !== property.id;
            const isOwnership = ownershipDocIds.has(docId); // Check if it's an ownership doc
            
            const bottomOffset = 4 + (stackIndex * 8); 
            
            if (isNeighbor) {
                html += `<div class="doc-diamond" style="left: ${left}px; bottom: ${bottomOffset}px;" 
                              title="Neighbor Doc: ${year} (From: ${doc.dossier})" 
                              onclick="window.openModal('${docId}')"></div>`;
            } else if (!isOwnership) {
                // NEW: Small Grey Dot for General Documents
                html += `<div class="doc-grey-dot" style="left: ${left}px; bottom: ${bottomOffset}px;" 
                              title="General Doc: ${year}" 
                              onclick="window.openModal('${docId}')"></div>`;
            } else {
                // EXISTING: Red Dot for Ownership Documents
                html += `<div class="doc-dot" style="left: ${left}px; bottom: ${bottomOffset}px;" 
                              title="Ownership Doc: ${year}" 
                              onclick="window.openModal('${docId}')"></div>`;
            }
            stackIndex++;
        });
    }
    html += `</div>`; 

    html += `<svg class="timeline-svg-overlay"></svg></div>`;
    container.innerHTML = html;

    if (keepScroll) {
        container.scrollLeft = previousScroll;
    } else {
        const targetScroll = (state.currentSelectedYear - START_YEAR) * PIXELS_PER_YEAR;
        container.scrollLeft = targetScroll - (container.clientWidth / 2);
    }
}