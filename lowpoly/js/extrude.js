import * as THREE from 'three';
import { state } from './state.js';

const tempNormal = new THREE.Vector3();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();

// Extrude-local state (not polluting global state)
let extrudeNormal = null;
let extrudeBasePoints = null;
let extrudeFaceIndex = -1;

// Start extrusion: Prep the geometry by adding side faces
export function startExtrude(mesh, faceIndex) {
    if (!mesh || faceIndex < 0) return;

    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const colorAttr = geometry.attributes.color;
    const vertexCount = posAttr.count;

    // Bounds check
    if (faceIndex * 3 + 2 >= vertexCount) return;

    // 1. Get original vertices of the face
    const idx = faceIndex * 3;
    va.fromBufferAttribute(posAttr, idx);
    vb.fromBufferAttribute(posAttr, idx + 1);
    vc.fromBufferAttribute(posAttr, idx + 2);

    // Get face normal (cross product of two edges)
    const edge1 = new THREE.Vector3().subVectors(vb, va);
    const edge2 = new THREE.Vector3().subVectors(vc, va);
    tempNormal.crossVectors(edge1, edge2).normalize();

    // Check for degenerate face (zero-area triangle)
    if (tempNormal.lengthSq() < 0.0001) return;

    // 2. Prepare new buffers with 6 more triangles (18 more vertices)
    const oldPos = posAttr.array;
    const oldColor = colorAttr.array;
    const newPos = new Float32Array(oldPos.length + 18 * 3);
    const newColor = new Float32Array(oldColor.length + 18 * 3);

    newPos.set(oldPos);
    newColor.set(oldColor);

    // Determine the actual color (not the highlighted one)
    let faceColor;
    if (state.selection.faceIndex === faceIndex && state.selection.originalColors) {
        faceColor = new THREE.Color(
            state.selection.originalColors[0],
            state.selection.originalColors[1],
            state.selection.originalColors[2]
        );
    } else {
        faceColor = new THREE.Color().fromArray(oldColor, idx * 3);
    }

    // Replace the cap's highlighted color with original in newColor buffer
    for (let i = 0; i < 3; i++) {
        const ci = (idx + i) * 3;
        newColor[ci] = faceColor.r;
        newColor[ci + 1] = faceColor.g;
        newColor[ci + 2] = faceColor.b;
    }

    // Cap vertices (initial copy, will move during drag)
    const va_cap = va.clone();
    const vb_cap = vb.clone();
    const vc_cap = vc.clone();

    // Helper to add a triangle to the buffer
    let offset = oldPos.length;
    function addTri(p1, p2, p3) {
        newPos[offset]     = p1.x; newPos[offset + 1] = p1.y; newPos[offset + 2] = p1.z;
        newPos[offset + 3] = p2.x; newPos[offset + 4] = p2.y; newPos[offset + 5] = p2.z;
        newPos[offset + 6] = p3.x; newPos[offset + 7] = p3.y; newPos[offset + 8] = p3.z;

        // Side faces use same color as the extruded face
        for (let i = 0; i < 3; i++) {
            newColor[offset + i * 3]     = faceColor.r;
            newColor[offset + i * 3 + 1] = faceColor.g;
            newColor[offset + i * 3 + 2] = faceColor.b;
        }

        offset += 9;
    }

    // 3 side quads (6 triangles), CCW winding for outward normals
    // Quad AB: va→vb edge
    addTri(va, vb, vb_cap);
    addTri(va, vb_cap, va_cap);
    // Quad BC: vb→vc edge
    addTri(vb, vc, vc_cap);
    addTri(vb, vc_cap, vb_cap);
    // Quad CA: vc→va edge
    addTri(vc, va, va_cap);
    addTri(vc, va_cap, vc_cap);

    // Update geometry
    geometry.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(newColor, 3));

    // Store extrude state locally
    state.isExtruding = true;
    extrudeNormal = tempNormal.clone();
    extrudeBasePoints = [va_cap, vb_cap, vc_cap];
    extrudeFaceIndex = faceIndex;
}

export function updateExtrude(mesh, amount) {
    if (!state.isExtruding || !extrudeNormal || !extrudeBasePoints) return;

    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const idx = extrudeFaceIndex * 3;
    const norm = extrudeNormal;
    const points = extrudeBasePoints;

    // Update CAP positions (the top face moves along normal)
    for (let i = 0; i < 3; i++) {
        const p = points[i];
        posAttr.setXYZ(idx + i,
            p.x + norm.x * amount,
            p.y + norm.y * amount,
            p.z + norm.z * amount
        );
    }

    // Update SIDE vertices that connect to the cap
    // Side triangles start at (total - 18 vertices)
    // Each quad = 2 tris = 6 vertices. 3 quads = 18 vertices.
    // Layout per quad: [base1, base2, cap2, base1, cap2, cap1]
    //   cap vertices are at offsets: 2, 4, 5 within each quad
    const sideStart = posAttr.count - 18;

    // Quad AB: cap vertices are vb_cap(2), vb_cap(4), va_cap(5)
    setSideCapVertex(posAttr, sideStart + 2, points[1], norm, amount);
    setSideCapVertex(posAttr, sideStart + 4, points[1], norm, amount);
    setSideCapVertex(posAttr, sideStart + 5, points[0], norm, amount);

    // Quad BC: cap vertices are vc_cap(2), vc_cap(4), vb_cap(5)
    setSideCapVertex(posAttr, sideStart + 8, points[2], norm, amount);
    setSideCapVertex(posAttr, sideStart + 10, points[2], norm, amount);
    setSideCapVertex(posAttr, sideStart + 11, points[1], norm, amount);

    // Quad CA: cap vertices are va_cap(2), va_cap(4), vc_cap(5)
    setSideCapVertex(posAttr, sideStart + 14, points[0], norm, amount);
    setSideCapVertex(posAttr, sideStart + 16, points[0], norm, amount);
    setSideCapVertex(posAttr, sideStart + 17, points[2], norm, amount);

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
}

function setSideCapVertex(attr, vertexIdx, basePoint, normal, amount) {
    attr.setXYZ(vertexIdx,
        basePoint.x + normal.x * amount,
        basePoint.y + normal.y * amount,
        basePoint.z + normal.z * amount
    );
}

export function endExtrude(mesh) {
    state.isExtruding = false;
    extrudeNormal = null;
    extrudeBasePoints = null;
    extrudeFaceIndex = -1;

    if (mesh) {
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
    }
}

// Force-cancel extrude without modifying geometry further
export function cancelExtrude() {
    state.isExtruding = false;
    extrudeNormal = null;
    extrudeBasePoints = null;
    extrudeFaceIndex = -1;
}
