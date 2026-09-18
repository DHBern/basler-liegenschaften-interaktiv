// js/state.js
export const state = {
    propertyData: [],
    personsData: {},
    documentsData: {},
    institutionData: [],
    
    currentProperty: null,
    currentSelectedYear: 1450,
    currentView: 'owners',
    activeFilter: null,
    
    // NEW properties for mapping
    colorMode: 'group', // 'concept', 'zunft', 'gewerbe'
    occupationLookup: {}, // Maps raw occupation string -> { concept, zunft, gewerbe }
    palettes: {
        concept: {},
        zunft: {},
        gewerbe: {}
    },
    COLOR_OTHER: '#808080',
    priceScales: {},
    priceGraphMode: 'absolute', // 'absolute' or 'relative'
};