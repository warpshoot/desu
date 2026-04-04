import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function exportGLB(mesh) {
    if (!mesh) return;

    const exporter = new GLTFExporter();
    exporter.parse(mesh, function (gltf) {
        if (gltf instanceof ArrayBuffer) {
            save(new Blob([gltf], { type: 'application/octet-stream' }), 'lowpoly_' + getTimestamp() + '.glb');
        } else {
            save(new Blob([JSON.stringify(gltf)], { type: 'application/json' }), 'lowpoly_' + getTimestamp() + '.gltf');
        }
    }, function (error) {
        console.error('An error happened during GLTF export', error);
    }, { binary: true });
}

function save(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function getTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}
