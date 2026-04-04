import * as THREE from 'three';
import { state } from './state.js';

const tempNormal = new THREE.Vector3();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();

// Start extrusion: Prep the geometry by adding side faces
export function startExtrude(mesh, faceIndex) {
    if (!mesh || faceIndex === -1) return;

    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const colorAttr = geometry.attributes.color;

    // 1. Get original vertices of the face
    const idx = faceIndex * 3;
    va.fromBufferAttribute(posAttr, idx);
    vb.fromBufferAttribute(posAttr, idx + 1);
    vc.fromBufferAttribute(posAttr, idx + 2);

    // Get face normal
    tempNormal.copy(vb).sub(va).cross(vc.clone().sub(va)).normalize();

    // 2. Prepare new buffers with 6 more triangles (18 more vertices)
    const oldPos = posAttr.array;
    const oldColor = colorAttr.array;
    const newPos = new Float32Array(oldPos.length + 18 * 3);
    const newColor = new Float32Array(oldColor.length + 18 * 3);

    newPos.set(oldPos);
    newColor.set(oldColor);

    // Face A-B-C becomes the "cap"
    // We'll add 3 side quads (6 triangles)
    // Quad 1: (va, vb, vb', va') -> (va, vb, vb_copy, va_copy)
    // Quad 2: (vb, vc, vc', vb')
    // Quad 3: (vc, va, va', vc')
    
    const sideVertices = [
        va, vb, vb, // Tri 1 of Quad 1
        va, vb, va, // Tri 2 of Quad 1
        // Wait, proper order for outward normals:
        // va, vb, vb_next (next being extruding)
    ];

    // Helper to add a triangle to the buffer
    let offset = oldPos.length;
    function addTri(p1, p2, p3, c1, c2, c3) {
        newPos[offset] = p1.x; newPos[offset+1] = p1.y; newPos[offset+2] = p1.z;
        newPos[offset+3] = p2.x; newPos[offset+4] = p2.y; newPos[offset+5] = p2.z;
        newPos[offset+6] = p3.x; newPos[offset+7] = p3.y; newPos[offset+8] = p3.z;
        
        const cIdx = offset;
        newColor[cIdx] = c1.r; newColor[cIdx+1] = c1.g; newColor[cIdx+2] = c1.b;
        newColor[cIdx+3] = c2.r; newColor[cIdx+4] = c2.g; newColor[cIdx+5] = c2.b;
        newColor[cIdx+6] = c3.r; newColor[cIdx+7] = c3.g; newColor[cIdx+8] = c3.b;
        
        offset += 9;
    }

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

    // Replace the cap's highlighted color with original in newColor buffer immediately
    newColor[idx * 3] = faceColor.r; newColor[idx * 3 + 1] = faceColor.g; newColor[idx * 3 + 2] = faceColor.b;
    newColor[idx * 3 + 3] = faceColor.r; newColor[idx * 3 + 4] = faceColor.g; newColor[idx * 3 + 5] = faceColor.b;
    newColor[idx * 3 + 6] = faceColor.r; newColor[idx * 3 + 7] = faceColor.g; newColor[idx * 3 + 8] = faceColor.b;

    // Cap vertices (initial copy)
    const va_cap = va.clone();
    const vb_cap = vb.clone();
    const vc_cap = vc.clone();

    // Add 6 triangles for sides
    // Improved winding to ensure outward pointing normals
    addTri(va, vb, vb_cap, faceColor, faceColor, faceColor);
    addTri(va, vb_cap, va_cap, faceColor, faceColor, faceColor);
    
    addTri(vb, vc, vc_cap, faceColor, faceColor, faceColor);
    addTri(vb, vc_cap, vb_cap, faceColor, faceColor, faceColor);
    
    addTri(vc, va, va_cap, faceColor, faceColor, faceColor);
    addTri(vc, va_cap, vc_cap, faceColor, faceColor, faceColor);

    // Update geometry
    geometry.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(newColor, 3));
    
    state.isExtruding = true;
    state.extrudeNormal = tempNormal.clone();
    state.extrudeBasePoints = [va_cap, vb_cap, vc_cap];
    state.extrudeFaceIndex = faceIndex;
}

export function updateExtrude(mesh, amount) {
    if (!state.isExtruding) return;

    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const idx = state.extrudeFaceIndex * 3;

    const norm = state.extrudeNormal;
    const points = state.extrudeBasePoints;

    // Update CAP positions
    for (let i = 0; i < 3; i++) {
        const p = points[i];
        posAttr.setXYZ(idx + i, 
            p.x + norm.x * amount,
            p.y + norm.y * amount,
            p.z + norm.z * amount
        );
    }

    // Update SIDE positions
    const startIdx = (posAttr.count - 18);
    updateSideTri(posAttr, startIdx + 2, points[1], norm, amount); 
    updateSideTri(posAttr, startIdx + 4, points[1], norm, amount); 
    updateSideTri(posAttr, startIdx + 5, points[0], norm, amount); 
    
    updateSideTri(posAttr, startIdx + 8, points[2], norm, amount); 
    updateSideTri(posAttr, startIdx + 10, points[2], norm, amount); 
    updateSideTri(posAttr, startIdx + 11, points[1], norm, amount); 
    
    updateSideTri(posAttr, startIdx + 14, points[0], norm, amount); 
    updateSideTri(posAttr, startIdx + 16, points[0], norm, amount); 
    updateSideTri(posAttr, startIdx + 17, points[2], norm, amount); 

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
}

function updateSideTri(attr, vertexIdx, basePoint, normal, amount) {
    attr.setXYZ(vertexIdx,
        basePoint.x + normal.x * amount,
        basePoint.y + normal.y * amount,
        basePoint.z + normal.z * amount
    );
}

export function endExtrude(mesh) {
    state.isExtruding = false;
    if (mesh) {
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingBox();
        mesh.geometry.computeBoundingSphere();
    }
}
