import * as THREE from 'three';
import { state } from './state.js';

export function createBox() {
    const geometry = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    return createMesh(geometry);
}

export function createIcosphere(detail = 0) {
    const geometry = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
    return createMesh(geometry);
}

export function createCylinder(segments = 8) {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, segments).toNonIndexed();
    return createMesh(geometry);
}

function createMesh(geometry) {
    // Initialize vertex colors (each vertex of each face has its own color)
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color(state.currentColor);

    for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}
