// js/map.js
import { state } from './state.js';
import { renderSidebar } from './sidebar.js';

export const map = L.map('map', { center: [47.5596, 7.5886], zoom: 15, preferCanvas: true, attributionControl: false });
L.control.attribution({ position: 'bottomleft' }).addTo(map);

// 1. Define the 1862 layer
const map1862 = L.tileLayer.wms('https://wms.geo.bs.ch/', {
    layers: 'HP_Situationsplan_Basel_1862', format: 'image/png', transparent: true,
    attribution: 'Geodaten Kanton Basel-Stadt', updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 4 
});

// 2. Define the 1615 layer
const map1615 = L.tileLayer.wms('https://wms.geo.bs.ch/', {
    layers: 'HP_Uebersichtsplan_Basel_1615', format: 'image/png', transparent: true,
    attribution: 'Geodaten Kanton Basel-Stadt', updateWhenZooming: false, updateWhenIdle: true, keepBuffer: 4 
});

// 3. Automatic Retry Logic for Failed Tiles
function handleTileError(error) {
    const tile = error.tile;
    
    // Attach a retry counter directly to the image element
    tile.retryCount = tile.retryCount || 0;
    
    // Attempt to reload up to 3 times
    if (tile.retryCount < 3) {
        tile.retryCount++;
        
        // Stagger the retries exponentially (1s, 2s, 3s) so we don't hammer the server again
        setTimeout(() => {
            // Append a dummy timestamp parameter to force the browser to bypass its cache
            const originalSrc = tile.src.split('&_retry')[0]; 
            tile.src = `${originalSrc}&_retry=${Date.now()}`;
        }, tile.retryCount * 1000); 
    }
}

// Bind the error listener to both WMS layers
map1862.on('tileerror', handleTileError);
map1615.on('tileerror', handleTileError);

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

function getPriceScale(year) {
    if (state.priceScales[year] && state.priceScales[year].mid !== null) {
        return state.priceScales[year];
    }
    
    // Fallback: If the exact year is missing or null, expand outwards to find the closest valid year
    let searchRadius = 1;
    while (searchRadius <= 50) {
        if (state.priceScales[year - searchRadius] && state.priceScales[year - searchRadius].mid !== null) {
            return state.priceScales[year - searchRadius];
        }
        if (state.priceScales[year + searchRadius] && state.priceScales[year + searchRadius].mid !== null) {
            return state.priceScales[year + searchRadius];
        }
        searchRadius++;
    }
    
    // Extreme fallback if dataset is completely empty
    return { min: 10, mid: 100, max: 200 }; 
}

function getPriceColor(price, year) {
    const scale = getPriceScale(year);
    
    // Clamp the price to the dynamic min/max
    const val = Math.max(scale.min, Math.min(scale.max, price));
    
    let pct, c1, c2;
    if (val <= scale.mid) {
        pct = (val - scale.min) / (scale.mid - scale.min);
        c1 = [69, 117, 180];  // Blue
        c2 = [255, 255, 191]; // Yellow
    } else {
        pct = (val - scale.mid) / (scale.max - scale.mid);
        c1 = [255, 255, 191]; // Yellow
        c2 = [215, 48, 39];   // Red
    }
    
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * pct);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * pct);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * pct);
    
    return `rgb(${r}, ${g}, ${b})`;
}

function getClosestPriceRecord(property, targetYear, window = 12) {
    if (!property.price_history || property.price_history.length === 0) return null;
    
    let bestRecord = null;
    let smallestDiff = Infinity;

    property.price_history.forEach(record => {
        const diff = Math.abs(record.year - targetYear);
        if (diff <= window && diff < smallestDiff) {
            smallestDiff = diff;
            bestRecord = record;
        }
    });
    
    return bestRecord;
}

export function getMarkerColor(ownerIds) {
    if (!ownerIds) return state.COLOR_OTHER;
    const ids = Array.isArray(ownerIds) ? ownerIds : [ownerIds];
    
    for (let id of ids) {
        const actor = state.personsData[id];
        if (actor && actor.occ && actor.occ.length > 0) {
            for (let i = 0; i < actor.occ.length; i++) {
                const occ = actor.occ[i].toLowerCase();
                const mapping = state.occupationLookup[occ];
                
                if (mapping) {
                    let matchedColor = null;
                    
                    if (state.colorMode === 'group') {
                        matchedColor = mapping.group ? state.palettes.group[mapping.group] : null;
                    } else if (state.colorMode === 'concept') {
                        matchedColor = state.palettes.concept[mapping.concept];
                    } else if (state.colorMode === 'zunft') {
                        matchedColor = mapping.zunft ? state.palettes.zunft[mapping.zunft] : null;
                    } else if (state.colorMode === 'gewerbe') {
                        matchedColor = mapping.gewerbe ? state.palettes.gewerbe[mapping.gewerbe] : null;
                    }
                    
                    // If a valid color is found for this mode, return it immediately
                    if (matchedColor) {
                        return matchedColor;
                    }
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
            let markerColor = "#808080";
            
            if (state.colorMode === 'price') {
                const priceRecord = getClosestPriceRecord(prop, state.currentSelectedYear, 12);
                if (priceRecord && priceRecord.price_including_dues !== null) {
                    markerColor = getPriceColor(priceRecord.price_including_dues, state.currentSelectedYear);
                }
            } else {
                const activeRecord = (prop.h || []).find(record => state.currentSelectedYear >= record.s && state.currentSelectedYear <= record.e);
                markerColor = activeRecord ? getMarkerColor(activeRecord.p) : "#808080"; 
            }
            
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

    if (state.activeFilter) {
        highlightLegendCategory(state.activeFilter);
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

export const legendControl = L.control({ position: 'topleft' });

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
            <option value="group">Occupation</option>
            <option value="concept">Most Frequent Occupations</option>
            <option value="zunft">Zunft (Guild)</option>
            <option value="gewerbe">Gewerbe (Trade)</option>
            <option value="price">Property Value</option>
        </select>
        <div id="legend-items" style="max-height: 250px; overflow-y: auto;"></div>
    `;
    return div;
};
legendControl.addTo(map);

export function updateLegend() {
    const legendItems = document.getElementById('legend-items');
    if (!legendItems) return;

    if (state.colorMode === 'price') {
        const scale = getPriceScale(state.currentSelectedYear);
        
        legendItems.innerHTML = `
            <div style="margin-bottom: 5px; font-weight: bold; font-size: 12px; color: #444;">
                Relative Values in ${state.currentSelectedYear}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-bottom: 2px;">
                <span>${Math.round(scale.min)} lb.</span>
                <span>${Math.round(scale.mid)}</span>
                <span>${Math.round(scale.max)}+ lb.</span>
            </div>
            <div style="height: 12px; width: 100%; background: linear-gradient(to right, rgb(69, 117, 180), rgb(255, 255, 191), rgb(215, 48, 39)); border: 1px solid #999; border-radius: 3px; margin-bottom: 8px;"></div>
            <div style="display: flex; align-items: center; margin-top: 8px;">
                <span style="background-color: ${state.COLOR_OTHER}; width: 14px; height: 14px; display: inline-block; margin-right: 8px; border: 1px solid #777;"></span>
                <span style="font-size: 12px; font-family: sans-serif; color: #666; font-style: italic;">No sale in time window</span>
            </div>
        `;
        return; 
    }

    let html = '';
    const activePalette = state.palettes[state.colorMode];

    for (const [key, color] of Object.entries(activePalette)) {
        const safeKey = key.replace(/'/g, "\\'"); 
        
        // Check if this row is the currently locked filter
        const isActive = state.activeFilter === key;
        const bgStyle = isActive ? '#e2e8f0' : 'transparent';
        const fontWeight = isActive ? 'bold' : 'normal';
        const borderStyle = isActive ? 'border-left: 3px solid #0076ff;' : 'border-left: 3px solid transparent;';
        
        html += `<div style="display: flex; align-items: center; margin-bottom: 4px; padding: 2px 4px 2px 8px; cursor: pointer; transition: background 0.2s; background: ${bgStyle}; font-weight: ${fontWeight}; ${borderStyle}"
                      onclick="window.toggleLegendFilter('${safeKey}')"
                      onmouseenter="if(!state.activeFilter) window.highlightLegendCategory('${safeKey}')"
                      onmouseleave="if(!state.activeFilter) window.resetLegendHighlight()">
                    <span style="background-color: ${color}; width: 14px; height: 14px; display: inline-block; margin-right: 8px; border: 1px solid #777;"></span>
                    <span style="font-size: 12px; font-family: sans-serif;">${key}</span>
                 </div>`;
    }
    
    // Do the same for the "Other" category
    const isOtherActive = state.activeFilter === 'other';
    const otherBg = isOtherActive ? '#e2e8f0' : 'transparent';
    const otherWeight = isOtherActive ? 'bold' : 'normal';
    const otherBorder = isOtherActive ? 'border-left: 3px solid #0076ff;' : 'border-left: 3px solid transparent;';

    html += `<div style="display: flex; align-items: center; margin-top: 8px; padding: 2px 4px 2px 8px; cursor: pointer; transition: background 0.2s; background: ${otherBg}; font-weight: ${otherWeight}; ${otherBorder}"
                  onclick="window.toggleLegendFilter('other')"
                  onmouseenter="if(!state.activeFilter) window.highlightLegendCategory('other')"
                  onmouseleave="if(!state.activeFilter) window.resetLegendHighlight()">
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

export function highlightLegendCategory(categoryKey) {
    if (!categoryKey) return;
    
    propertyLayer.eachLayer(layer => {
        // Skip properties that are already invisible (not active in this year)
        if (layer.options.fillOpacity === 0) return; 

        let matches = false;
        
        // Fast-path for the "Other" category based on the default grey color
        if (categoryKey === 'other') {
            if (layer.options.fillColor === state.COLOR_OTHER) matches = true;
        } else {
            const prop = layer.feature.properties;
            const activeRecord = (prop.h || []).find(record => state.currentSelectedYear >= record.s && state.currentSelectedYear <= record.e);
            
            if (activeRecord && activeRecord.p) {
                const ids = Array.isArray(activeRecord.p) ? activeRecord.p : [activeRecord.p];
                for (let id of ids) {
                    const actor = state.personsData[id];
                    if (actor && actor.occ) {
                        for (let i = 0; i < actor.occ.length; i++) {
                            const occ = actor.occ[i].toLowerCase();
                            const mapping = state.occupationLookup[occ];
                            if (mapping) {
                                if (state.colorMode === 'group' && mapping.group === categoryKey) matches = true;
                                else if (state.colorMode === 'concept' && mapping.concept === categoryKey) matches = true;
                                else if (state.colorMode === 'zunft' && mapping.zunft === categoryKey) matches = true;
                                else if (state.colorMode === 'gewerbe' && mapping.gewerbe === categoryKey) matches = true;
                            }
                        }
                    }
                }
            }
        }

        // Apply the visual filter
        if (matches) {
            layer.setStyle({ 
                fillOpacity: layer instanceof L.CircleMarker ? 1 : 0.9, 
                opacity: 1, 
                weight: 3 
            });
            if (layer.bringToFront) layer.bringToFront();
        } else {
            layer.setStyle({ 
                fillOpacity: 0.05,  // Dim out non-matching properties
                opacity: 0.1, 
                weight: 1 
            });
        }
    });
}

export function resetLegendHighlight() {
    updateMap(false); // Restores all default styling without completely restacking
}

export function toggleLegendFilter(categoryKey) {
    if (state.activeFilter === categoryKey) {
        // If clicking the already-active filter, turn it off
        state.activeFilter = null;
        resetLegendHighlight();
    } else {
        // Otherwise, lock the new filter
        state.activeFilter = categoryKey;
        highlightLegendCategory(categoryKey);
    }
    updateLegend(); // Refresh the legend to show the selected state
}