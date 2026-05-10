'use strict';

// ─── DOM references ───────────────────────────────────────
const canvas   = document.getElementById('canvas');
const loading  = document.getElementById('loading');
const modal    = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const modalBg  = document.getElementById('modal-bg');
const closeBtn = document.getElementById('close-btn');

// ─── Renderer / Scene / Camera ────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x050010);
renderer.outputEncoding = THREE.sRGBEncoding;

const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x050010, 0.042);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.5, 10);
camera.lookAt(0, 0, 0);

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// ─── Lighting ─────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffeedd, 0.5));

const movingLights = [];
[
    { color: 0xff6496, intensity: 3.0, pos: [ 5,  6,  5] },
    { color: 0x9b5de5, intensity: 2.5, pos: [-5, -4,  5] },
    { color: 0xffd700, intensity: 2.0, pos: [ 0,  9,  0] },
    { color: 0x00d4ff, intensity: 1.2, pos: [-6,  2, -6] },
].forEach(({ color, intensity, pos }, i) => {
    const l = new THREE.PointLight(color, intensity, 28);
    l.position.set(...pos);
    scene.add(l);
    if (i < 2) movingLights.push(l);
});

// ─── Particle field ───────────────────────────────────────
const N = 1200;
const pPos = new Float32Array(N * 3);
const pCol = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
    pPos[i*3]   = (Math.random() - 0.5) * 55;
    pPos[i*3+1] = (Math.random() - 0.5) * 55;
    pPos[i*3+2] = (Math.random() - 0.5) * 55;
    const t = Math.random();
    pCol[i*3]   = 1;
    pCol[i*3+1] = 0.45 + t * 0.55;
    pCol[i*3+2] = 0.55 + t * 0.45;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true,
    transparent: true, opacity: 0.75, sizeAttenuation: true,
}));
scene.add(particles);

// ─── Photo carousel ───────────────────────────────────────
const photoGroup = new THREE.Group();
photoGroup.rotation.x = -0.07;
scene.add(photoGroup);

const RADIUS = 5.5;
const IMG_PATHS = [
    'images/photo1.jpg', 'images/photo2.jpg',
    'images/photo3.jpg', 'images/photo4.jpg',
    'images/photo5.jpg', 'images/photo6.jpg',
    'images/photo7.jpg', 'images/photo8.jpg',
];

const photoMeshes = [];
const cardGroups  = [];
const tmpVec      = new THREE.Vector3();

const manager = new THREE.LoadingManager();
manager.onLoad = () => {
    loading.classList.add('fade-out');
    setTimeout(() => { loading.style.display = 'none'; }, 950);
};
const texLoader = new THREE.TextureLoader(manager);

IMG_PATHS.forEach((src, i) => {
    const angle = (i / IMG_PATHS.length) * Math.PI * 2;
    const x = Math.cos(angle) * RADIUS;
    const z = Math.sin(angle) * RADIUS;
    const y = Math.sin(i * 0.85) * 1.2;

    const cg = new THREE.Group();
    cg.position.set(x, y, z);
    cg.lookAt(tmpVec.set(0, y, 0));
    cg.userData.originalY = y;

    // Gold frame
    const frameMat = new THREE.MeshStandardMaterial({
        color:    new THREE.Color(0xfff5e8),
        emissive: new THREE.Color(0xff8844),
        emissiveIntensity: 0.12,
        roughness: 0.3,
        metalness: 0.55,
        side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 3.2), frameMat);
    frame.position.z = -0.025;
    cg.userData.frame = frame;
    cg.add(frame);

    // Photo (placed once texture is ready)
    texLoader.load(src, (tex) => {
        tex.encoding = THREE.sRGBEncoding;

        const asp  = tex.image.width / tex.image.height;
        let pw = asp >= 1 ? 2.2 : 2.2 * asp;
        let ph = asp >= 1 ? 2.2 / asp : 2.2;
        if (pw > 2.2) { ph *= 2.2 / pw; pw = 2.2; }
        if (ph > 2.9) { pw *= 2.9 / ph; ph = 2.9; }

        frame.geometry.dispose();
        frame.geometry = new THREE.PlaneGeometry(pw + 0.26, ph + 0.24);

        const photo = new THREE.Mesh(
            new THREE.PlaneGeometry(pw, ph),
            new THREE.MeshStandardMaterial({
                map: tex, roughness: 0.1,
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 0,
            })
        );
        photo.userData.isPhoto = true;
        photo.userData.src     = src;
        cg.add(photo);
        photoMeshes.push(photo);
    });

    photoGroup.add(cg);
    cardGroups.push(cg);
});

// ─── Decorative rings ─────────────────────────────────────
[
    { r: 7.2, tube: 0.018, color: 0xff6496, opacity: 0.25, tiltX: 0.3, tiltZ: 0.1 },
    { r: 8.8, tube: 0.012, color: 0x9b5de5, opacity: 0.18, tiltX: -0.2, tiltZ: 0.15 },
].forEach(({ r, tube, color, opacity, tiltX, tiltZ }) => {
    const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(r, tube, 8, 120),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
    );
    mesh.rotation.x = tiltX;
    mesh.rotation.z = tiltZ;
    scene.add(mesh);
});

// ─── Interaction ──────────────────────────────────────────
let isDragging    = false;
let prevX         = 0;
let mouseDownX    = 0;
let mouseDownTime = 0;
let targetRotY    = 0;
let currentRotY   = 0;
const mouseNDC    = new THREE.Vector2();
const raycaster   = new THREE.Raycaster();

function onDragStart(clientX) {
    isDragging    = true;
    prevX         = clientX;
    mouseDownX    = clientX;
    mouseDownTime = Date.now();
}
function onDragMove(clientX) {
    if (!isDragging) return;
    targetRotY += (clientX - prevX) * 0.005;
    prevX = clientX;
}
function onDragEnd() { isDragging = false; }

function tryClick(clientX, clientY) {
    if (Math.abs(clientX - mouseDownX) > 6) return;
    if (Date.now() - mouseDownTime > 400)   return;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(photoMeshes);
    if (hits.length && hits[0].object.userData.isPhoto) openModal(hits[0].object.userData.src);
}

function updateMouseNDC(clientX, clientY) {
    mouseNDC.x =  (clientX / innerWidth)  * 2 - 1;
    mouseNDC.y = -(clientY / innerHeight) * 2 + 1;
}

window.addEventListener('mousedown', e => { onDragStart(e.clientX); });
window.addEventListener('mousemove', e => { updateMouseNDC(e.clientX, e.clientY); onDragMove(e.clientX); });
window.addEventListener('mouseup',   () => onDragEnd());
window.addEventListener('click',     e => tryClick(e.clientX, e.clientY));

window.addEventListener('touchstart', e => { onDragStart(e.touches[0].clientX); }, { passive: true });
window.addEventListener('touchmove',  e => {
    e.preventDefault();
    updateMouseNDC(e.touches[0].clientX, e.touches[0].clientY);
    onDragMove(e.touches[0].clientX);
}, { passive: false });
window.addEventListener('touchend', e => {
    onDragEnd();
    tryClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
});

// ─── Modal helpers ────────────────────────────────────────
const modalContent = document.getElementById('modal-content');

function openModal(src) {
    if (modal.classList.contains('closing')) return;
    modalImg.src = src;
    modal.classList.remove('hidden');
    // Force animation restart after re-show
    modalContent.style.animation = 'none';
    modalContent.offsetHeight; // reflow
    modalContent.style.animation = '';
}
function closeModal() {
    if (modal.classList.contains('hidden') || modal.classList.contains('closing')) return;
    modal.classList.add('closing');
    modalContent.addEventListener('animationend', () => {
        modal.classList.add('hidden');
        modal.classList.remove('closing');
        modalImg.src = '';
    }, { once: true });
}
modalBg.addEventListener('click',  closeModal);
closeBtn.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── Animation loop ───────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Auto-rotation
    if (!isDragging) targetRotY += 0.0028;
    currentRotY += (targetRotY - currentRotY) * 0.05;
    photoGroup.rotation.y = currentRotY;

    // Card bobbing
    cardGroups.forEach((cg, i) => {
        cg.position.y = cg.userData.originalY + Math.sin(t * 0.65 + i * 0.92) * 0.24;
    });

    // Particle drift
    particles.rotation.y = t * 0.017;
    particles.rotation.x = Math.sin(t * 0.04) * 0.07;

    // Orbit moving lights
    movingLights[0].position.x = Math.cos(t * 0.28) * 7;
    movingLights[0].position.z = Math.sin(t * 0.28) * 7;
    movingLights[1].position.x = Math.cos(t * 0.35 + Math.PI) * 7;
    movingLights[1].position.z = Math.sin(t * 0.35 + Math.PI) * 7;

    // Hover detection & glow
    raycaster.setFromCamera(mouseNDC, camera);
    const hits    = raycaster.intersectObjects(photoMeshes);
    const hovered = hits.length ? hits[0].object : null;

    photoMeshes.forEach(m => {
        const isHot      = m === hovered;
        const targetEmi  = isHot ? 0.13 : 0;
        const targetScale = isHot ? 1.09 : 1.0;

        m.material.emissiveIntensity += (targetEmi   - m.material.emissiveIntensity) * 0.14;
        const s = m.scale.x + (targetScale - m.scale.x) * 0.1;
        m.scale.setScalar(s);

        if (m.parent && m.parent.userData.frame) {
            const f   = m.parent.userData.frame;
            const fEmi = isHot ? 0.55 : 0.12;
            f.material.emissiveIntensity += (fEmi - f.material.emissiveIntensity) * 0.14;
        }
    });

    document.body.style.cursor = hovered ? 'pointer' : 'default';

    renderer.render(scene, camera);
}

animate();
