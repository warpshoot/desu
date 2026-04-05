import * as THREE from 'three';

export let scene, camera, renderer, ambientLight, wireframe;

export function initScene() {
    const container = document.getElementById('viewport-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0a');

    // CAMERA
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);

    // RENDERER
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // LIGHTING - Start with just ambient as requested
    ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    // GRID & HELPERS
    const grid = new THREE.GridHelper(20, 20, '#333333', '#222222');
    scene.add(grid);

    // WIREFRAME HELPER
    const wireMat = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.5 });
    wireframe = new THREE.LineSegments(new THREE.BufferGeometry(), wireMat);
    scene.add(wireframe);

    // HANDLE RESIZE
    window.addEventListener('resize', onWindowResize);

    return { scene, camera, renderer };
}

function onWindowResize() {
    const container = document.getElementById('viewport-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

export function updateWireframe(mesh) {
    if (!mesh || !wireframe) return;
    wireframe.geometry.dispose();
    wireframe.geometry = new THREE.WireframeGeometry(mesh.geometry);
    wireframe.position.copy(mesh.position);
    wireframe.rotation.copy(mesh.rotation);
    wireframe.scale.copy(mesh.scale);
}

export function render() {
    renderer.render(scene, camera);
}
