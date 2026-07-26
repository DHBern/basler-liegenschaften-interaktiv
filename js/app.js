// js/app.js
import { state } from './state.js';
import { map, propertyLayer, institutionLayer, cityWallLayer, updateMap, drawInstitutions, updateLegend, focusProperty } from './map.js';
import { renderSidebar, closeBottomPanel, selectOwnerInSidebar } from './sidebar.js';
import { showPersonProfile, closeProfile } from './profile.js';
import { openModal, closeModal, changeImage, setupModalInteractions } from './modal.js';

// 1. Expose specific UI functions to the global window 
// (Required because our inline HTML strings use onclick="window.functionName()")
window.showPersonProfile = showPersonProfile;
window.closeProfile = closeProfile;
window.openModal = openModal;
window.closeModal = closeModal;
window.changeImage = changeImage;
window.closeBottomPanel = closeBottomPanel;
window.selectOwnerInSidebar = selectOwnerInSidebar;
window.focusProperty = focusProperty;

const SHOW_WELCOME_PROMPT = true;

// 2. Setup DOM Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupModalInteractions();

    const slider = document.getElementById('yearSlider');
    const display = document.getElementById('yearDisplay');

    slider.addEventListener('input', (e) => display.innerText = e.target.value);
    
    slider.addEventListener('change', (e) => {
        state.currentSelectedYear = parseInt(e.target.value);
        updateMap();
        if (state.currentProperty && state.currentView === 'owners') {
            renderSidebar();
        }
    });

    //document.getElementById('institutionToggle').addEventListener('change', (e) => {
    //    if (e.target.checked) map.addLayer(institutionLayer);
    //    else map.removeLayer(institutionLayer);
    //});

    document.getElementById('mapColorMode').addEventListener('change', (e) => {
        state.colorMode = e.target.value;
        updateMap();
        updateLegend(); 
    });

    const searchInput = document.getElementById('propertySearch');
    const autocompleteList = document.getElementById('autocomplete-list');

    searchInput.addEventListener('input', function() {
        const val = this.value.toLowerCase();
        autocompleteList.innerHTML = ''; // Clear previous suggestions
        if (!val) return;

        // Filter properties by ID or Address
        const matches = state.propertyData.filter(p => 
            p.id.toLowerCase().includes(val) || 
            (p.adrs && p.adrs.toLowerCase().includes(val))
        ).slice(0, 15); // Show top 15 matches

        matches.forEach(match => {
            const item = document.createElement('div');
            const address = match.adrs || 'No Address';
            item.innerHTML = `<strong>${address}</strong><span class="search-id">${match.id}</span>`;
            
            item.addEventListener('click', function() {
                searchInput.value = address;
                autocompleteList.innerHTML = '';
                focusProperty(match.id); // Pan map and open sidebar
            });
            autocompleteList.appendChild(item);
        });
    });

    // Close the dropdown if the user clicks anywhere outside of it
    document.addEventListener('click', function (e) {
        if (e.target !== searchInput) {
            autocompleteList.innerHTML = '';
        }
    });

    if (SHOW_WELCOME_PROMPT && !localStorage.getItem('hasSeenIntroPrompt')) {
        const promptOverlay = document.getElementById('welcome-prompt-overlay');
        promptOverlay.style.display = 'flex';

        // If they click Yes
        document.getElementById('btn-yes-intro').onclick = () => {
            promptOverlay.style.display = 'none';
            localStorage.setItem('hasSeenIntroPrompt', 'true'); // Remember for next time
            document.getElementById('intro-modal-overlay').style.display = 'flex'; // Open main intro
        };

        // If they click No
        document.getElementById('btn-no-intro').onclick = () => {
            promptOverlay.style.display = 'none';
            localStorage.setItem('hasSeenIntroPrompt', 'true'); // Remember for next time
        };
    }
});

// 3. Fetch Data & Bootstrap the Application
Promise.all([
    fetch('prepare_data/geometries.geojson').then(res => res.json()), 
    fetch('prepare_data/actors.json').then(res => res.json()),
    fetch('prepare_data/documents.json').then(res => res.json()),
    fetch('prepare_data/zuenfte.tsv').then(res => res.text()) // <-- NEW
]).then(([geoJsonData, fetchedPersons, fetchedDocs, tsvData]) => {

    geoJsonData.features.sort((a, b) => (b.properties.area || 0) - (a.properties.area || 0));
    
    // Hydrate standard state
    geoJsonData.features.forEach(f => {
        if (typeof f.properties.h === 'string') f.properties.h = JSON.parse(f.properties.h);
        if (typeof f.properties.dhs === 'string') f.properties.dhs = JSON.parse(f.properties.dhs);
    });
    
    state.propertyData = geoJsonData.features.map(f => f.properties);
    state.personsData = fetchedPersons;
    state.documentsData = fetchedDocs;

    const lines = tsvData.trim().split('\n');
    const headers = lines[0].split('\t').map(h => h.trim());
    const normIdx = headers.indexOf('Normvarianten');
    const zunftIdx = headers.indexOf('Zunft');
    const gewIdx = headers.indexOf('Gewerbe');

    const uniqueZuenfte = new Set();
    const uniqueGewerbe = new Set();

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length <= Math.max(normIdx, zunftIdx, gewIdx)) continue;
        
        // Split normvarianten by semicolon, trim whitespace, and lowercase
        const variants = cols[normIdx].split(';').map(v => v.trim().toLowerCase()).filter(v => v);
        if (variants.length === 0) continue;
        
        const concept = variants[0]; // First variant acts as the primary concept name
        const zunft = cols[zunftIdx] ? cols[zunftIdx].trim() : '';
        const gewerbe = cols[gewIdx] ? cols[gewIdx].trim() : '';
        
        if (zunft) uniqueZuenfte.add(zunft);
        if (gewerbe) uniqueGewerbe.add(gewerbe);

        variants.forEach(v => {
            state.occupationLookup[v] = { concept, zunft, gewerbe };
        });
    }

    // --- NEW: Calculate Top 20 Concepts based on actual person data ---
    const conceptCounts = {};
    Object.values(fetchedPersons).forEach(actor => {
        if (actor.occ && actor.occ.length > 0) {
            const occ = actor.occ[0].toLowerCase();
            const mapping = state.occupationLookup[occ];
            if (mapping) {
                conceptCounts[mapping.concept] = (conceptCounts[mapping.concept] || 0) + 1;
            }
        }
    });

    const top20Concepts = Object.entries(conceptCounts)
        .sort((a, b) => b[1] - a[1]) // Sort descending by frequency
        .slice(0, 20)
        .map(entry => entry[0]);

    // --- NEW: Generate color palettes dynamically (using HSL distribution) ---
    function generatePalette(keys) {
        const palette = {};
        const step = 360 / Math.max(keys.length, 1);
        keys.forEach((key, i) => {
            palette[key] = `hsl(${Math.round(i * step)}, 75%, 45%)`;
        });
        return palette;
    }

    state.palettes.concept = generatePalette(top20Concepts); // Only the top 20 get colors
    state.palettes.zunft = generatePalette(Array.from(uniqueZuenfte));
    state.palettes.gewerbe = generatePalette(Array.from(uniqueGewerbe));
    
    // Inject Geographic Data & Render
    propertyLayer.addData(geoJsonData);
    updateMap(); 
    updateLegend();
    
}).catch(err => console.error("Error loading data:", err));

// Load institutions (Optional layer)
fetch('institutions_data.json').then(res => res.json()).then(data => { 
    state.institutionData = data; 
    drawInstitutions();
    map.addLayer(institutionLayer); // Checked by default in HTML
}).catch(err => console.warn("Institutions data not found (optional)."));

fetch('Stadtmauern_web.geojson').then(res => res.json()).then(data => {
    cityWallLayer.addData(data);
}).catch(err => console.warn("City walls data not found."));