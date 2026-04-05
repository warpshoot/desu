import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export let controls;

export function initControls(camera, domElement) {
    controls = new OrbitControls(camera, domElement);
    
    // CONFIGURE FOR MOBILE
    // ONE-FINGER: NONE (We'll use it for tap/extrude manually)
    // TWO-FINGER: DOLLY_ROTATE
    controls.touches = {
        ONE: THREE.TOUCH.NONE,
        TWO: THREE.TOUCH.DOLLY_ROTATE
    };

    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 2;
    controls.maxDistance = 50;

    return controls;
}

export function updateControls() {
    if (controls) controls.update();
}
