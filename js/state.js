// js/state.js
export const state = {
    propertyData: [],
    personsData: {},
    documentsData: {},
    institutionData: [],
    
    currentProperty: null,
    currentSelectedYear: 1450,
    currentView: 'owners',
    
    // NEW properties for mapping
    colorMode: 'concept', // 'concept', 'zunft', 'gewerbe'
    occupationLookup: {}, // Maps raw occupation string -> { concept, zunft, gewerbe }
    palettes: {
        concept: {},
        zunft: {},
        gewerbe: {}
    },
    COLOR_OTHER: '#808080'
};