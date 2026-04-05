export const state = {
    mesh: null,              // Single mesh being edited
    selection: {
        faceIndex: -1,         // Selected face index
        originalColors: null,  // Backup colors for highlight removal
    },
    currentColor: '#4a90d9', // Active paint color
    palette: [
        '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
        '#4a90d9', '#f5a623', '#7ed321', '#bd10e0'
    ],
    tool: 'select',          // Current active tool
    isExtruding: false,      // Interaction flag
    extrudeStartY: 0,        // Drag start position
    history: [],             // Snapshots
    historyIndex: -1,
    maxHistory: 30
};
