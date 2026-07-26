// js/profile.js
import { state } from './state.js';

export function showPersonProfile(personId) {
    const actor = state.personsData[personId];
    if (!actor) return;

    // 1. Gather Owned Properties (and get their addresses!)
    let ownedProperties = [];
    state.propertyData.forEach(p => {
        let ownsThis = (p.h || []).some(record => {
            let ids = Array.isArray(record.p) ? record.p : [record.p];
            return ids.includes(personId);
        });
        if (ownsThis) {
            ownedProperties.push({ id: p.id, adrs: p.adrs || p.id });
        }
    });

    // 2. Build HTML (Matching the beautiful sidebar style)
    let html = `<div style="margin-bottom: 0;">
                    <h3 style="margin-top: 0; margin-bottom: 5px; color: #2c3e50; font-family: inherit;">${actor.n || "Unknown Actor"}</h3>`;
    
    // Name Variants
    if (actor.variants && actor.variants.length > 0) {
        html += `<details style="margin-bottom: 15px; font-size: 12px; color: #666; cursor: pointer;">
                    <summary style="outline: none; font-style: italic;">Name Variants</summary>
                    <ul style="margin: 5px 0 0 20px; padding: 0; color: #444;">
                        ${actor.variants.map(v => `<li>${v}</li>`).join('')}
                    </ul>
                 </details>`;
    } else {
        html += `<div style="margin-bottom: 15px;"></div>`;
    }

    // Occupation
    if (actor.occ && actor.occ.length > 0) {
        html += `<div style="margin-bottom: 10px; font-size: 13px;">
                    <span style="font-weight: bold; display: block; color: #555; margin-bottom: 2px;">Occupation</span>
                    ${actor.occ.join(', ')}
                 </div>`;
    }
    
    // Relationships
    if (actor.rel && Object.keys(actor.rel).length > 0) {
        html += `<div style="margin-bottom: 10px; font-size: 13px;">
                    <span style="font-weight: bold; display: block; color: #555; margin-bottom: 2px;">Relationships</span>
                    <ul style="margin: 0; padding-left: 20px;">`;
        for (const [role, targetIds] of Object.entries(actor.rel)) {
            targetIds.forEach(tId => {
                const targetActor = state.personsData[tId];
                const tName = targetActor ? targetActor.n : tId;
                html += `<li>Is ${role} to <a href="#" onclick="window.showPersonProfile('${tId}'); return false;" style="color: #0076ff; text-decoration: none;">${tName}</a></li>`;
            });
        }
        html += `</ul></div>`;
    }

    // Owned Properties
    if (ownedProperties.length > 0) {
        html += `<div style="margin-top: 15px; font-size: 13px;">
                    <span style="font-weight: bold; display: block; color: #555; margin-bottom: 5px;">Known Properties Owned</span>
                    <ul style="margin: 0; padding-left: 20px;">`;
        ownedProperties.forEach(prop => {
            html += `<li><a href="#" onclick="window.focusProperty('${prop.id}'); window.selectOwnerInSidebar('${personId}'); window.closeProfile(); return false;" style="color: #0076ff; text-decoration: none;">${prop.adrs}</a></li>`;
        });
        html += `</ul></div>`;
    }

    html += `</div>`;
    
    // Close button
    html += `<button onclick="window.closeProfile()" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 20px; cursor: pointer; color: #888; line-height: 1;">&times;</button>`;

    const profileDiv = document.getElementById('person-profile');
    profileDiv.innerHTML = html;
    
    // Grab the main sidebar container (the parent holding the title/content)
    const sidebarContainer = document.getElementById('sidebar-title').parentElement;
    
    if (sidebarContainer) {
        const rect = sidebarContainer.getBoundingClientRect();
        // Calculate the exact distance from the right edge of the browser window to the left edge of the sidebar
        const offsetFromRight = window.innerWidth - rect.left;
        // Apply that exact offset + a 15px gap so it doesn't rub shoulders!
        profileDiv.style.right = `${offsetFromRight + 15}px`; 
    }

    profileDiv.style.display = 'block';
}

export function closeProfile() {
    document.getElementById('person-profile').style.display = 'none';
}