// js/map.js
import { state } from './state.js';
import { renderSidebar } from './sidebar.js';

export const map = L.map('map', { center: [47.5596, 7.5886], zoom: 15, preferCanvas: true, attributionControl: false });
L.control.attribution({ position: 'bottomleft' }).addTo(map);

// 1. Define the 1862 layer
const map1862 = L.tileLayer.wms('https://wms.geo.bs.ch/', {
    layers: 'HP_Situationsplan_Basel_1862', format: 'image/png', transparent: true,
    attribution: 'Geodaten Kanton Basel-Stadt', updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 8 
});

// 2. Define the 1615 layer
const map1615 = L.tileLayer.wms('https://wms.geo.bs.ch/', {
    layers: 'HP_Uebersichtsplan_Basel_1615', format: 'image/png', transparent: true,
    attribution: 'Geodaten Kanton Basel-Stadt', updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 8 
});

map1862.addTo(map);

L.control.layers(
    {
        "Übersichtsplan 1862": map1862,
        "Übersichtsplan 1615": map1615
    }, 
    null,
    { position: 'topleft' }
).addTo(map);

// 1. Create a custom background pane. Standard overlays are z-index 400. 
// Putting this at 350 guarantees it sits above the map tiles but permanently BELOW your properties.
map.createPane('wallsPane');
map.getPane('wallsPane').style.zIndex = 350;

//const wallsRenderer = L.canvas({ pane: 'wallsPane' });

export const cityWallLayer = L.geoJSON(null, {
    //renderer: wallsRenderer,
    pane: 'wallsPane',
    interactive: false, // CRUCIAL: Prevents the massive wall lines from stealing your mouse clicks!
    style: {
        color: '#4a3d35',   // Deep, historical stone color
        weight: 5,
        opacity: 0.6,
        dashArray: '12, 8', // Gives it a nice drafted/surveyed look (optional)
        lineCap: 'round'
    }
}).addTo(map);

export const institutionLayer = L.layerGroup();

export const propertyLayer = L.geoJSON(null, {
    style: function(feature) { return { opacity: 0, fillOpacity: 0, weight: 0 }; },
    pointToLayer: function(feature, latlng) { return L.circle(latlng, { radius: 4 }); },
    onEachFeature: function(feature, layer) {
        layer.on('mouseover', function() {
            if (this.options.fillOpacity > 0) {
                const isSelected = state.currentProperty && feature.properties.id === state.currentProperty.id;
                this.setStyle({ weight: isSelected ? 4 : 2, color: isSelected ? '#ffcc00' : '#ffffff' });
            }
        });
        layer.on('mouseout', function() {
            if (this.options.fillOpacity > 0) {
                const isSelected = state.currentProperty && feature.properties.id === state.currentProperty.id;
                const defaultStroke = layer instanceof L.CircleMarker ? '#ffffff' : '#222222';
                this.setStyle({ weight: isSelected ? 4 : 1, color: isSelected ? '#ffcc00' : defaultStroke });
            }
        });
        layer.on('click', () => {
            if (layer.options.fillOpacity === 0) return; 
            state.currentProperty = feature.properties;
            updateMap(false); // UPDATE: Selects the property WITHOUT mathematically redrawing the entire map
            renderSidebar();
        });
    }
}).addTo(map);

function getMarkerColor(ownerIds) {
    if (!ownerIds) return state.COLOR_OTHER;
    const ids = Array.isArray(ownerIds) ? ownerIds : [ownerIds];
    
    for (let id of ids) {
        const actor = state.personsData[id];
        if (actor && actor.occ && actor.occ.length > 0) {
            const occ = actor.occ[0].toLowerCase();
            const mapping = state.occupationLookup[occ];
            
            if (mapping) {
                if (state.colorMode === 'concept') {
                    // Returns color if in top 20, otherwise falls back to grey ("other")
                    return state.palettes.concept[mapping.concept] || state.COLOR_OTHER;
                } else if (state.colorMode === 'zunft') {
                    return mapping.zunft ? (state.palettes.zunft[mapping.zunft] || state.COLOR_OTHER) : state.COLOR_OTHER;
                } else if (state.colorMode === 'gewerbe') {
                    return mapping.gewerbe ? (state.palettes.gewerbe[mapping.gewerbe] || state.COLOR_OTHER) : state.COLOR_OTHER;
                }
            }
        }
    }
    return state.COLOR_OTHER;
}

export function updateMap(restack = true) {
    let activeLayers = [];
    let inactiveLayers = [];

    // --- NEW REFACTOR: Native Leaflet Interaction Control ---
    // Because the map uses Canvas rendering (preferCanvas: true), CSS pointer-events don't exist.
    // We must toggle Leaflet's native 'interactive' option so ghosts don't block clicks.
    function setInteractive(layer, isInteractive) {
        if (layer.options) layer.options.interactive = isInteractive;
        if (layer.eachLayer) {
            layer.eachLayer(child => setInteractive(child, isInteractive));
        }
    }

    propertyLayer.eachLayer((layer) => {
        const prop = layer.feature.properties;
        let isPropertyActive = false;
        
        if (prop.dhs && prop.dhs.length > 0) {
            isPropertyActive = prop.dhs.some(d => {
                const from = parseInt(d.start || d.from);
                const to = parseInt(d.end || d.to);
                return state.currentSelectedYear >= from && state.currentSelectedYear <= to;
            });
        } else {
            isPropertyActive = prop.h && prop.h.some(r => state.currentSelectedYear >= r.s && state.currentSelectedYear <= r.e);
        }

        const isSelected = state.currentProperty && prop.id === state.currentProperty.id;

        if (isPropertyActive || isSelected) {
            const activeRecord = (prop.h || []).find(record => state.currentSelectedYear >= record.s && state.currentSelectedYear <= record.e);
            const markerColor = activeRecord ? getMarkerColor(activeRecord.p) : "#808080"; 
            
            const weight = isSelected ? 4 : 1;
            const strokeColor = isSelected ? '#ffcc00' : (layer instanceof L.CircleMarker ? '#ffffff' : '#222222');
            
            let fillOp = layer instanceof L.CircleMarker ? 0.9 : 0.75;
            let strokeOp = 1;
            
            if (!isPropertyActive && isSelected) {
                // GHOST LAYER: Selected but chronologically out of bounds
                fillOp = 0.2; 
                strokeOp = 0.5;
                setInteractive(layer, false); // <--- Lets mouse clicks pass through!
            } else {
                // ACTIVE LAYER: Fully interactive
                setInteractive(layer, true); 
            }
            
            layer.setStyle({ fillColor: markerColor, color: strokeColor, weight: weight, fillOpacity: fillOp, opacity: strokeOp });
            activeLayers.push(layer);
            
        } else {
            // INACTIVE LAYER: Invisible and unclickable
            layer.setStyle({ fillOpacity: 0, opacity: 0, weight: 0 });
            setInteractive(layer, false); 
            inactiveLayers.push(layer);
        }
    });

    if (restack) {
        inactiveLayers.forEach(layer => {
            if (layer.bringToBack) layer.bringToBack();
        });

        // Layer sorting by physical area: GUARANTEES small splits are drawn on top of large containers
        activeLayers.sort((a, b) => {
            const areaA = a.feature.properties.area || 0;
            const areaB = b.feature.properties.area || 0;
            return areaB - areaA;
        });

        activeLayers.forEach(layer => {
            if (layer.bringToFront) layer.bringToFront();
        });
    }
}

export function drawInstitutions() {
    institutionLayer.clearLayers(); 

    const churchSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26">
            <!-- Roof Cross -->
            <path d="M12 1v5m-2-3h4" stroke="#2c3e50" stroke-width="2" stroke-linecap="round" />
            <!-- Main Building Silhouette -->
            <path d="M12 6 L5 11 v11 h14 v-11 Z" fill="#2c3e50" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
            <!-- Arched Doorway -->
            <path d="M10 22 v-4 a2 2 0 0 1 4 0 v4 Z" fill="#ffffff" />
            <!-- Small Rose Window -->
            <circle cx="12" cy="13" r="1.5" fill="#ffffff" />
        </svg>
    `;

    const churchIcon = L.divIcon({
        html: `<div style="
            filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transform: translateY(-4px); /* visually centers the building mass */
        ">${churchSvg}</div>`,
        className: 'custom-church-icon',
        iconSize: [26, 26],
        iconAnchor: [13, 13] 
    });

    state.institutionData.forEach(inst => {
        // Replace L.circleMarker with a standard L.marker using our custom icon
        const marker = L.marker([inst.lat, inst.lon], { icon: churchIcon });
        
        marker.on('click', () => {
            state.currentProperty = null;
            updateMap(); // Clear highlights
            if(window.closeBottomPanel) window.closeBottomPanel(); // Close timeline

            document.getElementById('sidebar-tabs').style.display = 'none';
            document.getElementById('sidebar-title').innerText = inst.name;
            document.getElementById('sidebar-content').innerHTML = `
                <span style="font-size: 0.9em; text-transform: uppercase; color: #666;">${inst.type}</span><hr>
                <div style="font-size: 14px; line-height: 1.6;">
                    <b>Associated Houses:</b> ${inst.houses}<br>
                    <b>Index Cards Count:</b> ${inst.cards}
                </div>
            `;
        });
        institutionLayer.addLayer(marker);
    });
}

export const legendControl = L.control({ position: 'bottomleft' });

legendControl.onAdd = function() {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    div.style.padding = '10px';
    div.style.border = '2px solid rgba(0,0,0,0.2)';
    div.style.borderRadius = '5px';
    div.style.pointerEvents = 'auto';
    
    // Prevent dragging the map when interacting with the legend
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    div.innerHTML = `
        <select id="mapColorMode" style="width: 100%; margin-bottom: 10px; padding: 5px; cursor: pointer;">
            <option value="concept">Occupation Concept (Top 20)</option>
            <option value="zunft">Zunft (Guild)</option>
            <option value="gewerbe">Gewerbe (Trade)</option>
        </select>
        <div id="legend-items" style="max-height: 250px; overflow-y: auto;"></div>
    `;
    return div;
};
legendControl.addTo(map);

export function updateLegend() {
    const legendItems = document.getElementById('legend-items');
    if (!legendItems) return;

    let html = '';
    const activePalette = state.palettes[state.colorMode];

    for (const [key, color] of Object.entries(activePalette)) {
        html += `<div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <span style="background-color: ${color}; width: 14px; height: 14px; display: inline-block; margin-right: 8px; border: 1px solid #777;"></span>
                    <span style="font-size: 12px; font-family: sans-serif;">${key}</span>
                 </div>`;
    }
    
    // Always append the "Other / Unassigned" category at the bottom
    html += `<div style="display: flex; align-items: center; margin-top: 8px;">
                <span style="background-color: ${state.COLOR_OTHER}; width: 14px; height: 14px; display: inline-block; margin-right: 8px; border: 1px solid #777;"></span>
                <span style="font-size: 12px; font-family: sans-serif; color: #666; font-style: italic;">Other / Unassigned</span>
             </div>`;

    legendItems.innerHTML = html;
}

// Function to focus the map and open sidebar for a searched property
export function focusProperty(propertyId, autoYear = null) {
    let targetLayer = null;
    
    propertyLayer.eachLayer(layer => {
        if (layer.feature.properties.id === propertyId) {
            targetLayer = layer;
        }
    });

    if (targetLayer) {
        if (targetLayer.getBounds) {
            map.fitBounds(targetLayer.getBounds(), { padding: [50, 50], maxZoom: 18 });
        } else if (targetLayer.getLatLng) {
            map.setView(targetLayer.getLatLng(), 18);
        }
        
        state.currentProperty = targetLayer.feature.properties;
        
        let restack = false;
        if (autoYear !== null) {
            state.currentSelectedYear = parseInt(autoYear);
            document.getElementById('yearSlider').value = state.currentSelectedYear;
            document.getElementById('yearDisplay').innerText = state.currentSelectedYear;
            restack = true;
        }
        
        renderSidebar();
        updateMap(restack); 
    }
}