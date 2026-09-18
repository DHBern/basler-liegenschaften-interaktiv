// js/sidebar.js
import { state } from './state.js';

let lastPropertyId = null;

export function renderSidebar(forceOpen = true) {
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
    if (forceOpen) {
        document.getElementById('bottom-panel').classList.add('open');
    }
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
        let ecoHtml = `<div style="padding: 15px 0; text-align: center; color: #666; font-style: italic; margin-bottom: 15px;">
            <p>Select an owner on the timeline below to view their details and associated documents.</p>
        </div>`;

        // Check if there is price history, and sort it chronologically
        if (state.currentProperty.price_history && state.currentProperty.price_history.length > 0) {
            const prices = [...state.currentProperty.price_history].sort((a, b) => a.year - b.year);
            
            ecoHtml += `<h4 style="margin-bottom: 10px; color: #444; border-bottom: 2px solid #eee; padding-bottom: 5px;">Economic History</h4>`;
            ecoHtml += `<table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="border-bottom: 1px solid #ddd; color: #666;">
                        <th style="padding: 6px 2px;">Year</th>
                        <th style="padding: 6px 2px;">Price (Pfund)</th>
                        <th style="padding: 6px 2px;">Properties Traded</th>
                    </tr>
                </thead>
                <tbody>`;
            
            prices.forEach(p => {
                const price = p.price_including_dues !== null ? p.price_including_dues.toFixed(2) : 'Unknown';
                const traded = p.properties_traded ? p.properties_traded.replace(/\|/g, ', ') : '-';
                
                // USE THE NEW IDENTIFIER HERE:
                const docId = p.doc_id;

                ecoHtml += `
                    <tr style="border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;" 
                        onmouseover="this.style.background='#f0f8ff'" 
                        onmouseout="this.style.background='transparent'"
                        onclick="window.openModal('${docId}')"
                        title="Click to view document">
                        <td style="padding: 8px 2px; color: #0076ff;">${p.year}</td>
                        <td style="padding: 8px 2px; font-weight: bold;">${price}</td>
                        <td style="padding: 8px 2px; color: #555;">${traded}</td>
                    </tr>`;
            });
            ecoHtml += `</tbody></table>`;
        }
        
        contentDiv.innerHTML = ecoHtml;
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
    html += `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 11px; color: #888; font-style: italic; line-height: 1.3;">
                Please note person information has only been identified on property and neighbor-level.
             </div>`;

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

export function renderBottomTimeline(keepScroll = false) {
    const container = document.getElementById('timeline-container');
    const property = state.currentProperty;

    // Memorize the current scroll position before we wipe the HTML
    const previousScroll = keepScroll ? container.scrollLeft : 0;

    // Memorize the current open/closed states of the accordions
    const existingOwn = document.getElementById('ownership-content');
    const existingEco = document.getElementById('economics-content');
    const ownDisplay = existingOwn ? existingOwn.style.display : (state.colorMode === 'price' ? 'none' : 'block');
    const ecoDisplay = existingEco ? existingEco.style.display : (state.colorMode === 'price' ? 'block' : 'none');
    const ownIcon = ownDisplay === 'none' ? '&#9654;' : '&#9660;';
    const ecoIcon = ecoDisplay === 'none' ? '&#9654;' : '&#9660;';
    
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

    let html = `<div class="timeline-wrapper" style="width: ${TOTAL_WIDTH}px; height: 100%; display: flex; flex-direction: column;">`;

    // --- BACKGROUND TICK LINES (Always visible) ---
    for (let y = START_YEAR; y <= END_YEAR; y += 10) {
        const leftPos = (y - START_YEAR) * PIXELS_PER_YEAR;
        html += `<div class="year-tick" style="left: ${leftPos}px; z-index: 1;"></div>`;
    }

    // --- 1. SHARED X-AXIS (Years) ---
    html += `<div class="shared-year-axis" style="position: relative; height: 25px; background: rgba(255,255,255,0.9); z-index: 100; border-bottom: 1px solid #ccc;">`;
    for (let y = START_YEAR; y <= END_YEAR; y += 10) {
        const leftPos = (y - START_YEAR) * PIXELS_PER_YEAR;
        html += `<div style="position: absolute; left: ${leftPos}px; top: 5px; font-size: 11px; color: #555; transform: translateX(-50%); font-weight: bold;">${y}</div>`;
    }
    html += `</div>`;

    // --- 2. SHARED RELATIONS TRACK ---
    if (hasRelations) {
        html += `<div class="relations-track" style="height: ${RELATIONS_TRACK_HEIGHT}px; position: relative; background: rgba(245, 247, 250, 0.8); z-index: 5;">`;

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

    // --- 3. OWNERSHIP ACCORDION ---
    // Add 25px to the track height to accommodate the document dots right inside the track
    const OWNERS_TRACK_HEIGHT = (numLanes * LANE_HEIGHT) + 25;

    html += `
        <div class="timeline-section" style="position: relative; z-index: 10;">
            <div class="timeline-section-header" style="width: ${TOTAL_WIDTH}px;" onclick="window.toggleTimelineSection('ownership-content', 'ownership-icon')">
                <div style="position: sticky; left: 15px; display: flex; align-items: center; gap: 8px;">
                    <span id="ownership-icon" class="accordion-icon">${ownIcon}</span>
                    <span>Ownership History</span>
                </div>
            </div>
            <div id="ownership-content" style="display: ${ownDisplay}; position: relative;">
                <div class="owners-track" style="position: relative; height: ${OWNERS_TRACK_HEIGHT}px;">
    `;

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

    for (const [year, docSet] of Object.entries(docsByYear)) {
        const left = (year - START_YEAR) * PIXELS_PER_YEAR;
        let stackIndex = 0;
        docSet.forEach(docId => {
            const doc = state.documentsData[docId];
            const isNeighbor = doc && doc.dossier !== property.id;
            const isOwnership = ownershipDocIds.has(docId);
            
            // Starts 2px from the bottom, stacking upwards
            const bottomOffset = 2 + (stackIndex * 8); 
            
            if (isNeighbor) {
                html += `<div class="doc-diamond" style="left: ${left}px; bottom: ${bottomOffset}px;" title="Neighbor Doc: ${year}" onclick="window.openModal('${docId}')"></div>`;
            } else if (!isOwnership) {
                html += `<div class="doc-grey-dot" style="left: ${left}px; bottom: ${bottomOffset}px;" title="General Doc: ${year}" onclick="window.openModal('${docId}')"></div>`;
            } else {
                html += `<div class="doc-dot" style="left: ${left}px; bottom: ${bottomOffset}px;" title="Ownership Doc: ${year}" onclick="window.openModal('${docId}')"></div>`;
            }
            stackIndex++;
        });
    }
    
    html += `</div></div></div>`;

    // --- 4. ECONOMICS ACCORDION ---
    const prices = property.price_history || []; 
    let ecoHtml = '';
    
    const isRelative = state.priceGraphMode === 'relative';

    if (prices.length === 0) {
        ecoHtml = `<div style="position: sticky; left: 15px; top: 15px; color: #888; font-style: italic;">No price history available for this property.</div>`;
    } else {
        prices.sort((a, b) => a.year - b.year);
        
        // 1. MAXIMIZED VERTICAL SPACE
        const GRAPH_HEIGHT = 100; // Expanded from 80
        const GRAPH_TOP_MARGIN = 10; // Tightened from 20

        // 2. NEW: VERTICAL GRIDLINES (Every 10 years)
        let verticalGridSvg = '';
        for (let y = START_YEAR; y <= END_YEAR; y += 10) {
            const lineX = (y - START_YEAR) * PIXELS_PER_YEAR;
            verticalGridSvg += `<line x1="${lineX}" y1="${GRAPH_TOP_MARGIN}" x2="${lineX}" y2="${GRAPH_TOP_MARGIN + GRAPH_HEIGHT}" stroke="#eaeaea" stroke-width="1" />`;
        }

        let yAxisHtml = '';
        let gridLinesSvg = `
            ${verticalGridSvg}
            <line x1="0" y1="${GRAPH_TOP_MARGIN}" x2="${TOTAL_WIDTH}" y2="${GRAPH_TOP_MARGIN}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4" />
            <line x1="0" y1="${GRAPH_TOP_MARGIN + GRAPH_HEIGHT/2}" x2="${TOTAL_WIDTH}" y2="${GRAPH_TOP_MARGIN + GRAPH_HEIGHT/2}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4" />
            <line x1="0" y1="${GRAPH_TOP_MARGIN + GRAPH_HEIGHT}" x2="${TOTAL_WIDTH}" y2="${GRAPH_TOP_MARGIN + GRAPH_HEIGHT}" stroke="#cbd5e1" stroke-width="1" />
        `;
        let svgPolylinePoints = [];
        let medianSvgPoints = [];
        let dataPointsHtml = '';

        if (isRelative) {
            // RELATIVE MODE: Y-Axis is locked 0 to 100
            const maxPrice = 100;
            
            prices.forEach(record => {
                if (record.relative_percentile === null || record.relative_percentile === undefined) return;
                
                const x = (record.year - START_YEAR) * PIXELS_PER_YEAR;
                const y = GRAPH_TOP_MARGIN + GRAPH_HEIGHT - ((record.relative_percentile / maxPrice) * GRAPH_HEIGHT);
                
                svgPolylinePoints.push(`${x},${y}`);
                
                const tradedClean = record.properties_traded ? record.properties_traded.replace(/\|/g, ', ') : 'Unknown';
                let docId = record.doc_id;
                
                dataPointsHtml += `
                    <div class="price-node" 
                         style="left: ${x}px; top: ${y}px;"
                         title="Year: ${record.year}&#10;This property was more expensive than ${record.relative_percentile}% of properties sold between ${record.window_start} and ${record.window_end}.&#10;Included: ${tradedClean}&#10;(Click to open document)"
                         onclick="window.openModal('${docId}')">
                    </div>
                `;
            });

            // Draw a flat 50% benchmark line
            const y50 = GRAPH_TOP_MARGIN + (GRAPH_HEIGHT / 2);
            medianSvgPoints.push(`0,${y50} ${TOTAL_WIDTH},${y50}`);

            yAxisHtml = `
                <div style="position: sticky; left: 0; width: 45px; height: 100%; z-index: 50; background: rgba(255,255,255,0.7); backdrop-filter: blur(2px); border-right: 1px solid #e2e8f0; pointer-events: none;">
                    <div style="position: absolute; top: ${GRAPH_TOP_MARGIN - 6}px; right: 6px; font-size: 10px; color: #64748b;">100%</div>
                    <div style="position: absolute; top: ${GRAPH_TOP_MARGIN + GRAPH_HEIGHT/2 - 6}px; right: 6px; font-size: 10px; color: #64748b;">50%</div>
                    <div style="position: absolute; top: ${GRAPH_TOP_MARGIN + GRAPH_HEIGHT - 6}px; right: 6px; font-size: 10px; color: #64748b;">0%</div>
                </div>
            `;
            
        } else {
            // ABSOLUTE MODE: Y-Axis scales to maximum values + 5% headroom
            function getSafeMedian(targetYear) {
                if (state.priceScales[targetYear] && state.priceScales[targetYear].mid !== null) return state.priceScales[targetYear].mid;
                let radius = 1;
                while(radius <= 50) {
                    if (state.priceScales[targetYear - radius] && state.priceScales[targetYear - radius].mid !== null) return state.priceScales[targetYear - radius].mid;
                    if (state.priceScales[targetYear + radius] && state.priceScales[targetYear + radius].mid !== null) return state.priceScales[targetYear + radius].mid;
                    radius++;
                }
                return 0; 
            }

            let medianPointsData = [];
            let rawMedianMax = 0;
            for (let y = START_YEAR; y <= END_YEAR; y += 5) {
                const midVal = getSafeMedian(y);
                if (midVal > 0) {
                    medianPointsData.push({ year: y, val: midVal });
                    if (midVal > rawMedianMax) rawMedianMax = midVal;
                }
            }

            const rawPropMax = Math.max(...prices.map(p => p.price_including_dues || 0));
            const rawMax = Math.max(rawPropMax, rawMedianMax);
            
            // Reduced headroom to 5% so the absolute graph also utilizes more vertical space
            const maxPrice = rawMax > 0 ? rawMax * 1.05 : 100; 
            
            prices.forEach(record => {
                if (record.price_including_dues === null) return; 
                const x = (record.year - START_YEAR) * PIXELS_PER_YEAR;
                const y = GRAPH_TOP_MARGIN + GRAPH_HEIGHT - ((record.price_including_dues / maxPrice) * GRAPH_HEIGHT);
                
                svgPolylinePoints.push(`${x},${y}`);
                
                const tradedClean = record.properties_traded ? record.properties_traded.replace(/\|/g, ', ') : 'Unknown';
                let docId = record.doc_id;
                
                dataPointsHtml += `
                    <div class="price-node" 
                         style="left: ${x}px; top: ${y}px;"
                         title="Year: ${record.year}&#10;Price: ${record.price_including_dues.toFixed(2)} Pfund&#10;Included: ${tradedClean}&#10;(Click to open document)"
                         onclick="window.openModal('${docId}')">
                    </div>
                `;
            });

            medianPointsData.forEach(m => {
                const x = (m.year - START_YEAR) * PIXELS_PER_YEAR;
                const y = GRAPH_TOP_MARGIN + GRAPH_HEIGHT - ((m.val / maxPrice) * GRAPH_HEIGHT);
                medianSvgPoints.push(`${x},${y}`);
            });

            yAxisHtml = `
                <div style="position: sticky; left: 0; width: 45px; height: 100%; z-index: 50; background: rgba(255,255,255,0.7); backdrop-filter: blur(2px); border-right: 1px solid #e2e8f0; pointer-events: none;">
                    <div style="position: absolute; top: ${GRAPH_TOP_MARGIN - 6}px; right: 6px; font-size: 10px; color: #64748b;">${Math.round(maxPrice)}</div>
                    <div style="position: absolute; top: ${GRAPH_TOP_MARGIN + GRAPH_HEIGHT/2 - 6}px; right: 6px; font-size: 10px; color: #64748b;">${Math.round(maxPrice/2)}</div>
                    <div style="position: absolute; top: ${GRAPH_TOP_MARGIN + GRAPH_HEIGHT - 6}px; right: 6px; font-size: 10px; color: #64748b;">0</div>
                </div>
            `;
        }

        ecoHtml = `
            ${yAxisHtml}
            <svg style="position: absolute; left: 0; top: 0; width: ${TOTAL_WIDTH}px; height: 100%; pointer-events: none;">
                ${gridLinesSvg}
                <polyline points="${medianSvgPoints.join(' ')}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,4" opacity="0.8" />
                <polyline points="${svgPolylinePoints.join(' ')}" fill="none" stroke="#28a745" stroke-width="2" opacity="0.6" />
            </svg>
            ${dataPointsHtml}
        `;
    }

    const toggleBtnText = isRelative ? 'Switch to Absolute Values' : 'Switch to Relative Values';
    const legendText = isRelative 
        ? `<span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; border-top: 2px dashed #94a3b8; display: inline-block;"></span> 50% Benchmark</span>`
        : `<span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; border-top: 2px dashed #94a3b8; display: inline-block;"></span> City Median</span>`;

    html += `
        <div class="timeline-section" style="position: relative; z-index: 10;">
            <div class="timeline-section-header" style="width: ${TOTAL_WIDTH}px;" onclick="window.toggleTimelineSection('economics-content', 'economics-icon')">
                <div style="position: sticky; left: 15px; display: flex; align-items: center; gap: 8px;">
                    <span id="economics-icon" class="accordion-icon">${ecoIcon}</span>
                    <span>Price History</span>
                    
                    <!-- The Toggle Button -->
                    <button onclick="window.togglePriceGraphMode(); event.stopPropagation();" style="margin-left: 10px; padding: 2px 8px; font-size: 10px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #f8f9fa;">${toggleBtnText}</button>
                    
                    <!-- Miniature Legend for the Graph -->
                    ${prices.length > 0 ? `<div style="margin-left: 15px; font-weight: normal; font-size: 11px; color: #64748b; display: flex; gap: 15px;">
                        <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 2px; background: #28a745; display: inline-block;"></span> Property</span>
                        ${legendText}
                    </div>` : ''}
                </div>
            </div>
            <div id="economics-content" style="display: ${ecoDisplay}; position: relative; height: 120px; background: #fff; border-bottom: 1px solid #ccc;">
                ${ecoHtml}
            </div>
        </div>
    `;

    html += `<svg class="timeline-svg-overlay"></svg></div>`;

    container.innerHTML = html;

    if (keepScroll) {
        container.scrollLeft = previousScroll;
    } else {
        const targetScroll = (state.currentSelectedYear - START_YEAR) * PIXELS_PER_YEAR;
        container.scrollLeft = targetScroll - (container.clientWidth / 2);
    }
}