/**
 * ui.js - Orchestrator for Ink App UI and Input Handling
 * Modularized version of the 3600-line monolith.
 */

import { eventCanvas } from './state.js';
import { setupLayerPanel, updateLayerThumbnail, updateActiveLayerIndicator, renderLayerButtons } from './ui/layerPanel.js';
import { 
    setupToolPanel, 
    setupBrushPalette, 
    setupColorPickers, 
    setupBrushSettingsPanel, 
    setupFillSettingsPanel, 
    setupEraserSettingsPanel,
    setupShapeSettingsPanel,
    updateModeButtonIcon,
    updateToolButtonStates,
    updateBrushSizeVisibility,
    updateBrushSizeSlider,
    renderBrushPalette
} from './ui/toolPanel.js';
import { setupFileUI } from './ui/fileMenu.js';
import { setupZoomControls, setupModifierBar, setupSettingsPanel, setupKeyboardShortcuts } from './ui/miscUI.js';
import { setupToneMenu, updateToneMenuVisibility } from './ui/toneMenu.js';
import { setupSaveUI } from './ui/saveExport.js';
import { initSelectionOverlay } from './tools/selection.js';
import { setupSelectionUI } from './ui/selectionUI.js';
import { setupPointerEvents } from './input/pointerHandler.js';
import { handleWheel } from './input/gestureHandler.js';
import { initHUD } from './ui/hud.js';

// Re-exports for main.js and other modules
export { updateLayerThumbnail, updateActiveLayerIndicator, renderLayerButtons };

/**
 * Initialize all UI components and event handlers
 */
export function initUI() {
    // 1. Setup specialized UI components
    setupLayerPanel();
    setupToolPanel();
    setupBrushPalette();
    setupColorPickers();
    setupBrushSettingsPanel();
    setupFillSettingsPanel();
    setupEraserSettingsPanel();
    setupShapeSettingsPanel();
    setupFileUI();
    setupZoomControls();
    setupModifierBar();
    setupSettingsPanel();
    setupToneMenu();
    setupSaveUI();
    initSelectionOverlay();
    setupSelectionUI();
    initHUD();
    
    // 2. Setup Input Handlers
    setupPointerEvents(eventCanvas);
    eventCanvas.addEventListener('wheel', (e) => handleWheel(e, eventCanvas), { passive: false });
    
    // 3. Setup Keyboard Shortcuts
    setupKeyboardShortcuts();

    // 4. Expose some functions to window for legacy support or cross-module access without circularity
    window.renderLayerButtons = renderLayerButtons;
}
