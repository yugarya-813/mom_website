'use strict';

// ─── DOM ──────────────────────────────────────────────────
const canvas       = document.getElementById('canvas');
const loadingEl    = document.getElementById('loading');
const modal        = document.getElementById('modal');
const modalImg     = document.getElementById('modal-img');
const modalBg      = document.getElementById('modal-bg');
const modalContent = document.getElementById('modal-content');
const closeBtn     = document.getElementById('close-btn');
const tooltip      = document.getElementById('tooltip');
const bursts       = document.getElementById('burst-container');
const cursorDot    = document.querySelector('.cursor-dot');
const cursorRing   = document.querySelector('.cursor-ring');
const easterHint   = document.getElementById('easter-hint');

// ─── Custom cursor ────────────────────────────────────────
let cx = -100, cy = -100, rx = -100, ry = -100;

window.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });
window.addEventListener('mousedown', () => { cursorDot.classList.add('clicking'); cursorRing.classList.add('clicking'); });
window.addEventListener('mouseup',   () => { cursorDot.classList.remove('clicking'); cursorRing.classList.remove('clicking'); });

(function animCursor() {
    rx += (cx - rx) * 0.1;
    ry += (cy - ry) * 0.1;
    cursorDot.style.transform  = `translate(${cx}px,${cy}px)`;
    cursorRing.style.transform = `translate(${rx}px,${ry}px)`;
    requestAnimationFrame(animCursor);
})();

// ─── Renderer / Scene / Camera ───────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x050010);
renderer.outputEncoding = THREE.sRGBEncoding;

const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x050010, 0.040);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.5, 10);
camera.lookAt(0, 0, 0);

let camTargetX = 0, camTargetY = 1.5;

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
    const l = new THREE.PointLight(color, intensity, 30);
    l.position.set(...pos);
    scene.add(l);
    if (i < 2) movingLights.push(l);
});

// ─── Star particles ───────────────────────────────────────
const N = 1200;
const pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
    pPos[i*3]   = (Math.random()-0.5)*55;
    pPos[i*3+1] = (Math.random()-0.5)*55;
    pPos[i*3+2] = (Math.random()-0.5)*55;
    const t = Math.random();
    pCol[i*3]=1; pCol[i*3+1]=0.45+t*0.55; pCol[i*3+2]=0.55+t*0.45;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol,3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size:0.07, vertexColors:true, transparent:true, opacity:0.75, sizeAttenuation:true
}));
scene.add(particles);

// ─── Floating hearts ─────────────────────────────────────
const hCanvas = document.createElement('canvas');
hCanvas.width = hCanvas.height = 64;
const hCtx = hCanvas.getContext('2d');
hCtx.font = '50px serif';
hCtx.textAlign = 'center';
hCtx.textBaseline = 'middle';
hCtx.fillText('❤', 32, 36);
const heartTex = new THREE.CanvasTexture(hCanvas);

const HEARTS = 18;
const heartObjs = [];
function resetHeart(h) {
    h.sprite.position.set(
        (Math.random()-0.5)*16, -9 - Math.random()*4,
        (Math.random()-0.5)*10
    );
    h.startX  = h.sprite.position.x;
    h.speed   = 0.012 + Math.random()*0.018;
    h.wobble  = Math.random()*6;
    h.sprite.material.opacity = 0.5 + Math.random()*0.4;
    const s = 0.09 + Math.random()*0.14;
    h.sprite.scale.setScalar(s);
}
for (let i = 0; i < HEARTS; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: heartTex, transparent: true, depthWrite: false, opacity: 0
    }));
    const h = { sprite, speed:0, wobble:0, startX:0 };
    resetHeart(h);
    sprite.position.y = (Math.random()-0.5)*20; // scattered start
    scene.add(sprite);
    heartObjs.push(h);
}

// ─── Shooting stars ───────────────────────────────────────
const MAX_STARS = 5;
const starPool = [];
for (let i = 0; i < MAX_STARS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const star = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0
    }));
    scene.add(star);
    starPool.push({ mesh: star, active: false, x:0, y:0, vx:0, vy:0, life:0 });
}
let nextStarAt = 4;

function spawnStar(t) {
    const s = starPool.find(s => !s.active);
    if (!s) return;
    s.active = true; s.life = 1;
    s.x  = 18 + Math.random()*12;
    s.y  =  4 + Math.random()*14;
    s.vx = -(0.45 + Math.random()*0.45);
    s.vy = -(0.08 + Math.random()*0.14);
    s.mesh.material.opacity = 0.9;
}

// ─── Photo carousel ───────────────────────────────────────
const photoGroup = new THREE.Group();
photoGroup.rotation.x = -0.07;
scene.add(photoGroup);

const RADIUS = 5.5;
const CAPTIONS = [
    'Family Moments', 'Lakeside Sunset', 'Four Generations',
    'Celebrations',   'Special Day',     'Dinner for Two',
    'Garden Stroll',  'Love Always'
];
const IMG_PATHS = [
    'images/photo1.jpg','images/photo2.jpg','images/photo3.jpg','images/photo4.jpg',
    'images/photo5.jpg','images/photo6.jpg','images/photo7.jpg','images/photo8.jpg',
];

const photoMeshes = [], cardGroups = [];
const tmpVec = new THREE.Vector3();

const manager = new THREE.LoadingManager();
manager.onLoad = () => {
    loadingEl.classList.add('fade-out');
    setTimeout(() => { loadingEl.style.display = 'none'; animateTitle(); }, 950);
};
const texLoader = new THREE.TextureLoader(manager);

IMG_PATHS.forEach((src, i) => {
    const angle = (i / IMG_PATHS.length) * Math.PI * 2;
    const x = Math.cos(angle)*RADIUS, z = Math.sin(angle)*RADIUS;
    const y = Math.sin(i*0.85)*1.2;

    const cg = new THREE.Group();
    cg.position.set(x, y, z);
    cg.lookAt(tmpVec.set(0, y, 0));
    cg.userData.originalY = y;
    cg.userData.index     = i;

    const frameMat = new THREE.MeshStandardMaterial({
        color:    new THREE.Color(0xfff5e8),
        emissive: new THREE.Color(0xff8844),
        emissiveIntensity: 0.12,
        roughness:0.28, metalness:0.55, side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 3.2), frameMat);
    frame.position.z = -0.025;
    cg.userData.frame = frame;
    cg.add(frame);

    texLoader.load(src, (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        const asp = tex.image.width / tex.image.height;
        let pw = asp >= 1 ? 2.2 : 2.2*asp;
        let ph = asp >= 1 ? 2.2/asp : 2.2;
        if (pw > 2.2) { ph *= 2.2/pw; pw = 2.2; }
        if (ph > 2.9) { pw *= 2.9/ph; ph = 2.9; }
        frame.geometry.dispose();
        frame.geometry = new THREE.PlaneGeometry(pw+0.26, ph+0.24);
        const photo = new THREE.Mesh(
            new THREE.PlaneGeometry(pw, ph),
            new THREE.MeshStandardMaterial({
                map:tex, roughness:0.1,
                emissive: new THREE.Color(0xffffff), emissiveIntensity:0,
            })
        );
        photo.userData.isPhoto = true;
        photo.userData.src     = src;
        photo.userData.index   = i;
        cg.add(photo);
        photoMeshes.push(photo);
    });

    photoGroup.add(cg);
    cardGroups.push(cg);
});

// Decorative rings
[
    {r:7.2,  tube:0.018, color:0xff6496, opacity:0.22, rx: 0.3,  rz:0.1},
    {r:8.8,  tube:0.012, color:0x9b5de5, opacity:0.16, rx:-0.2,  rz:0.15},
    {r:10.5, tube:0.008, color:0xffd700, opacity:0.10, rx: 0.05, rz:-0.1},
].forEach(({r,tube,color,opacity,rx,rz}) => {
    const m = new THREE.Mesh(
        new THREE.TorusGeometry(r,tube,8,120),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity})
    );
    m.rotation.x=rx; m.rotation.z=rz;
    scene.add(m);
});

// ─── Interaction state ────────────────────────────────────
let isDragging = false, prevX = 0, mouseDownX = 0, mouseDownTime = 0;
let targetRotY = 0, currentRotY = 0;
const mouseNDC = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hoveredMesh = null;

function updateNDC(clientX, clientY) {
    mouseNDC.x =  (clientX / innerWidth)  * 2 - 1;
    mouseNDC.y = -(clientY / innerHeight) * 2 + 1;
    camTargetX = mouseNDC.x * 1.4;
    camTargetY = 1.5 + mouseNDC.y * 0.7;
}

window.addEventListener('mousedown', e => {
    isDragging=true; prevX=e.clientX; mouseDownX=e.clientX; mouseDownTime=Date.now();
});
window.addEventListener('mousemove', e => {
    updateNDC(e.clientX, e.clientY);
    if (isDragging) { targetRotY += (e.clientX - prevX) * 0.005; prevX = e.clientX; }
});
window.addEventListener('mouseup',   () => { isDragging=false; });

window.addEventListener('click', e => {
    if (Math.abs(e.clientX-mouseDownX) > 6) return;
    if (Date.now()-mouseDownTime > 400) return;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(photoMeshes);
    if (hits.length && hits[0].object.userData.isPhoto) {
        createBurst(e.clientX, e.clientY);
        openModal(hits[0].object.userData.src);
    } else {
        createRipple(e.clientX, e.clientY);
    }
});

window.addEventListener('touchstart', e => {
    isDragging=true;
    prevX=mouseDownX=e.touches[0].clientX; mouseDownTime=Date.now();
}, {passive:true});
window.addEventListener('touchmove', e => {
    e.preventDefault();
    updateNDC(e.touches[0].clientX, e.touches[0].clientY);
    targetRotY += (e.touches[0].clientX - prevX)*0.005;
    prevX = e.touches[0].clientX;
}, {passive:false});
window.addEventListener('touchend', e => {
    isDragging=false;
    const t=e.changedTouches[0];
    if (Math.abs(t.clientX-mouseDownX)<8 && Date.now()-mouseDownTime<400) {
        raycaster.setFromCamera(mouseNDC, camera);
        const hits=raycaster.intersectObjects(photoMeshes);
        if (hits.length && hits[0].object.userData.isPhoto) {
            createBurst(t.clientX, t.clientY);
            openModal(hits[0].object.userData.src);
        }
    }
});

// ─── Burst / Ripple ───────────────────────────────────────
const BURST_EMOJIS = ['❤️','✨','💖','🌸','💕','⭐','🌺','💫'];
function createBurst(x, y) {
    for (let i = 0; i < 20; i++) {
        const el = document.createElement('div');
        el.className = 'burst-particle';
        el.textContent = BURST_EMOJIS[i % BURST_EMOJIS.length];
        const angle = (i/20)*Math.PI*2 + Math.random()*0.3;
        const dist  = 65 + Math.random()*95;
        el.style.left = x+'px'; el.style.top = y+'px';
        el.style.setProperty('--tx', `${Math.cos(angle)*dist}px`);
        el.style.setProperty('--ty', `${Math.sin(angle)*dist}px`);
        el.style.setProperty('--rot', `${(Math.random()-0.5)*540}deg`);
        el.style.animationDelay = Math.random()*0.1+'s';
        el.style.fontSize = (0.9+Math.random()*0.7)+'rem';
        bursts.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }
}

function createRipple(x, y) {
    const el = document.createElement('div');
    el.className = 'canvas-ripple';
    el.style.left = x+'px'; el.style.top = y+'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

// ─── Easter egg ───────────────────────────────────────────
const MESSAGES = ['💗', '💗💗', '💗💗💗', '💗💗💗💗', '🎉 Surprise! 🎉'];
let eggCount = 0, eggTimer;

document.getElementById('main-title').addEventListener('click', () => {
    clearTimeout(eggTimer);
    eggCount++;
    easterHint.textContent = MESSAGES[Math.min(eggCount-1, 4)];
    eggTimer = setTimeout(() => { eggCount=0; easterHint.textContent=''; }, 2200);
    if (eggCount >= 5) {
        eggCount=0; easterHint.textContent='';
        triggerEasterEgg();
    }
});

function triggerEasterEgg() {
    const shapes = ['❤️','✨','💖','⭐','🌸','💕','🎊','🎉','🌺','💫','🥰','🌟'];
    for (let i = 0; i < 90; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'confetti-piece';
            el.textContent = shapes[Math.floor(Math.random()*shapes.length)];
            el.style.left = Math.random()*100+'vw';
            el.style.animationDuration = (1.6+Math.random()*2.2)+'s';
            el.style.animationDelay    = Math.random()*0.4+'s';
            el.style.fontSize          = (0.8+Math.random()*1.4)+'rem';
            bursts.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }, i*18);
    }
}

// ─── Modal ────────────────────────────────────────────────
function openModal(src) {
    if (modal.classList.contains('closing')) return;
    modalImg.src = src;
    modal.classList.remove('hidden');
    modalContent.style.animation = 'none';
    modalContent.offsetHeight;
    modalContent.style.animation = '';
}
function closeModal() {
    if (modal.classList.contains('hidden') || modal.classList.contains('closing')) return;
    modal.classList.add('closing');
    modalContent.addEventListener('animationend', () => {
        modal.classList.add('hidden');
        modal.classList.remove('closing');
        modalImg.src = '';
        modalImg.style.transform = '';
    }, {once:true});
}
modalBg.addEventListener('click',  closeModal);
closeBtn.addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });

// 3D tilt on modal image
modalContent.addEventListener('mousemove', e => {
    const r  = modalContent.getBoundingClientRect();
    const rx = ((e.clientY - r.top  - r.height/2) / r.height) * -18;
    const ry = ((e.clientX - r.left - r.width/2)  / r.width)  *  18;
    modalImg.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.04)`;
});
modalContent.addEventListener('mouseleave', () => {
    modalImg.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
});

// Magnetic close button
closeBtn.addEventListener('mousemove', e => {
    const r  = closeBtn.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width/2)  * 0.45;
    const dy = (e.clientY - r.top  - r.height/2) * 0.45;
    closeBtn.style.transform = `translate(${dx}px,${dy}px) scale(1.15)`;
});
closeBtn.addEventListener('mouseleave', () => { closeBtn.style.transform = ''; });

// ─── Title letter animation ───────────────────────────────
function animateTitle() {
    const el   = document.getElementById('main-title');
    const text = el.textContent;
    el.innerHTML = [...text].map((ch, i) =>
        `<span class="title-letter" style="animation-delay:${0.1+i*0.055}s">${ch===' '?'&nbsp;':ch}</span>`
    ).join('');
}

// ─── Animation loop ───────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const delta = clock.getDelta ? 0.016 : 0.016;

    // Camera parallax
    camera.position.x += (camTargetX - camera.position.x) * 0.028;
    camera.position.y += (camTargetY - camera.position.y) * 0.028;
    camera.lookAt(0, 0, 0);

    // Auto-rotate carousel
    if (!isDragging) targetRotY += 0.0027;
    currentRotY += (targetRotY - currentRotY) * 0.05;
    photoGroup.rotation.y = currentRotY;

    // Card bobbing
    cardGroups.forEach((cg, i) => {
        cg.position.y = cg.userData.originalY + Math.sin(t*0.65+i*0.92)*0.24;
    });

    // Particles
    particles.rotation.y  = t*0.016;
    particles.rotation.x  = Math.sin(t*0.04)*0.07;

    // Orbit lights + pulse
    movingLights[0].position.x = Math.cos(t*0.28)*7;
    movingLights[0].position.z = Math.sin(t*0.28)*7;
    movingLights[0].intensity  = 2.8 + Math.sin(t*1.4)*0.7;
    movingLights[1].position.x = Math.cos(t*0.35+Math.PI)*7;
    movingLights[1].position.z = Math.sin(t*0.35+Math.PI)*7;
    movingLights[1].intensity  = 2.3 + Math.sin(t*1.1+1)*0.6;

    // Floating hearts
    heartObjs.forEach(h => {
        h.sprite.position.y += h.speed;
        h.sprite.position.x  = h.startX + Math.sin(t*0.6+h.wobble)*0.35;
        h.sprite.material.opacity = Math.max(0, 0.85 - (h.sprite.position.y+9)/20);
        if (h.sprite.position.y > 10) resetHeart(h);
    });

    // Shooting stars
    if (t > nextStarAt) { spawnStar(t); nextStarAt = t + 3 + Math.random()*5; }
    starPool.forEach(s => {
        if (!s.active) return;
        s.life -= 0.013;
        if (s.life <= 0) { s.active=false; s.mesh.material.opacity=0; return; }
        s.x += s.vx; s.y += s.vy;
        const pos = s.mesh.geometry.attributes.position;
        pos.array[0]=s.x-s.vx*3; pos.array[1]=s.y-s.vy*3; pos.array[2]=-8;
        pos.array[3]=s.x;         pos.array[4]=s.y;          pos.array[5]=-8;
        pos.needsUpdate = true;
        s.mesh.material.opacity = s.life * 0.9;
    });

    // Hover detection
    raycaster.setFromCamera(mouseNDC, camera);
    const hits    = raycaster.intersectObjects(photoMeshes);
    hoveredMesh   = hits.length ? hits[0].object : null;

    photoMeshes.forEach(m => {
        const hot = m === hoveredMesh;
        m.material.emissiveIntensity += ((hot?0.14:0) - m.material.emissiveIntensity)*0.14;
        const s = m.scale.x + ((hot?1.09:1.0) - m.scale.x)*0.1;
        m.scale.setScalar(s);
        if (m.parent && m.parent.userData.frame) {
            const f = m.parent.userData.frame;
            f.material.emissiveIntensity += ((hot?0.6:0.12) - f.material.emissiveIntensity)*0.14;
        }
    });

    // Cursor state
    if (hoveredMesh) {
        cursorDot.classList.add('hovered');
        cursorRing.classList.add('hovered');
        const idx = hoveredMesh.userData.index;
        tooltip.textContent = CAPTIONS[idx];
        tooltip.style.left  = (mouseNDC.x*0.5+0.5)*innerWidth + 22 + 'px';
        tooltip.style.top   = (-mouseNDC.y*0.5+0.5)*innerHeight - 40 + 'px';
        tooltip.classList.add('visible');
    } else {
        cursorDot.classList.remove('hovered');
        cursorRing.classList.remove('hovered');
        tooltip.classList.remove('visible');
    }

    renderer.render(scene, camera);
}

animate();
