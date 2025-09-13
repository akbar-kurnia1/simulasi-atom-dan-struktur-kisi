import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Variabel global
let scene, camera, renderer, controls;
const nucleus = new THREE.Group();
const electrons = new THREE.Group();
const orbits = new THREE.Group();

let protons = [], neutrons = [], electronObjects = [];
let isNucleusSeparated = false;

const PARTICLE_RADIUS = 0.5;
const NUCLEUS_SEPARATION_FACTOR = 2.0;

const ELEMENT_DATA = [
    null, // Index 0 tidak digunakan
    { name: "Hidrogen", stableNeutrons: [0, 1], phase: "Gas", usage: "Bahan bakar roket & bintang." },
    { name: "Helium", stableNeutrons: [1, 2], phase: "Gas", usage: "Mengisi balon udara." },
    { name: "Litium", stableNeutrons: [3, 4], phase: "Padat", usage: "Baterai isi ulang." },
    { name: "Berilium", stableNeutrons: [5], phase: "Padat", usage: "Komponen teleskop luar angkasa." },
    { name: "Boron", stableNeutrons: [5, 6], phase: "Padat", usage: "Kaca tahan panas (Pyrex)." },
    { name: "Karbon", stableNeutrons: [6, 7], phase: "Padat", usage: "Dasar dari semua kehidupan." },
    { name: "Nitrogen", stableNeutrons: [7, 8], phase: "Gas", usage: "Pupuk, bagian dari atmosfer." },
    { name: "Oksigen", stableNeutrons: [8, 9, 10], phase: "Gas", usage: "Penting untuk pernapasan." },
    { name: "Fluorin", stableNeutrons: [10], phase: "Gas", usage: "Ditambahkan pada pasta gigi." },
    { name: "Neon", stableNeutrons: [10, 11, 12], phase: "Gas", usage: "Lampu dan rambu iklan." }
];

// Fungsi inisialisasi utama
function init() {
    // Setup Scene
    scene = new THREE.Scene();
    scene.add(nucleus);
    scene.add(electrons);
    scene.add(orbits);

    // Setup Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 20;

    // Setup Renderer
    const canvas = document.querySelector('#bg');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); // Latar belakang transparan
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 10, 15);
    scene.add(pointLight);

    // Setup Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.getElementById('add-proton').addEventListener('click', addProton);
    document.getElementById('add-neutron').addEventListener('click', addNeutron);
    document.getElementById('add-electron').addEventListener('click', addElectron);
    document.getElementById('remove-proton').addEventListener('click', removeProton);
    document.getElementById('remove-neutron').addEventListener('click', removeNeutron);
    document.getElementById('remove-electron').addEventListener('click', removeElectron);
    document.getElementById('toggle-nucleus').addEventListener('click', toggleNucleusSeparation);
    document.getElementById('reset-atom').addEventListener('click', resetAtom);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('zoom-in').addEventListener('click', () => zoom(0.8));
    document.getElementById('zoom-out').addEventListener('click', () => zoom(1.2));


    // Buat atom awal
    buildAtom(1, 0, 1); // Hidrogen

    // Mulai loop animasi
    animate();
}

// Fungsi untuk membangun atau membangun ulang atom
function buildAtom(numProtons, numNeutrons, numElectrons) {
    // Bersihkan objek yang ada
    protons.forEach(p => nucleus.remove(p));
    neutrons.forEach(n => nucleus.remove(n));
    electronObjects.forEach(e => {
        electrons.remove(e.mesh);
        orbits.remove(e.orbit);
    });
    protons = [];
    neutrons = [];
    electronObjects = [];

    // Buat Proton
    for (let i = 0; i < numProtons; i++) {
        const proton = createParticle('proton');
        protons.push(proton);
        nucleus.add(proton);
    }

    // Buat Neutron
    for (let i = 0; i < numNeutrons; i++) {
        const neutron = createParticle('neutron');
        neutrons.push(neutron);
        nucleus.add(neutron);
    }

    // Buat Elektron
    for (let i = 0; i < numElectrons; i++) {
        const electronData = createElectron(i);
        electronObjects.push(electronData);
        electrons.add(electronData.mesh);
        orbits.add(electronData.orbit);
    }

    arrangeNucleons();
    updateInfo();
}

function createParticle(type) {
    const geometry = new THREE.SphereGeometry(PARTICLE_RADIUS, 32, 32);
    const color = type === 'proton' ? 0xff0000 : 0x808080;
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    return new THREE.Mesh(geometry, material);
}

function createElectron(index) {
    const geometry = new THREE.SphereGeometry(PARTICLE_RADIUS / 3, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.5 });
    const mesh = new THREE.Mesh(geometry, material);

    const shellIndex = Math.floor(index / 2); // Aturan sederhana: 2 elektron per kulit
    const orbitRadius = 5 + shellIndex * 3;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.01 / (shellIndex + 1);

    const orbitGeometry = new THREE.TorusGeometry(orbitRadius, 0.05, 16, 100);
    const isLightMode = document.body.classList.contains('light-mode');
    const orbitColor = isLightMode ? 0xAAAAAA : 0x444444;
    const orbitMaterial = new THREE.LineBasicMaterial({ color: orbitColor });
    const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbit.rotation.x = Math.random() * Math.PI;
    orbit.rotation.y = Math.random() * Math.PI;

    return { mesh, orbit, orbitRadius, angle, speed };
}

// Fungsi untuk menata ulang partikel di inti
function arrangeNucleons() {
    const nucleons = [...protons, ...neutrons];
    nucleons.forEach((nucleon, i) => {
        if (nucleons.length === 0) return;
        const phi = Math.acos(-1 + (2 * i) / nucleons.length);
        const theta = Math.sqrt(nucleons.length * Math.PI) * phi;
        const radius = isNucleusSeparated ? NUCLEUS_SEPARATION_FACTOR : Math.cbrt(nucleons.length) * PARTICLE_RADIUS * 0.7;
        
        nucleon.position.set(
            radius * Math.cos(theta) * Math.sin(phi),
            radius * Math.sin(theta) * Math.sin(phi),
            radius * Math.cos(phi)
        );
    });
}

function toggleNucleusSeparation() {
    isNucleusSeparated = !isNucleusSeparated;
    const button = document.getElementById('toggle-nucleus');
    button.textContent = isNucleusSeparated ? 'Satukan Inti' : 'Pisahkan Inti';
    arrangeNucleons();
}

function zoom(factor) {
    camera.position.multiplyScalar(factor);
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLightMode = document.body.classList.contains('light-mode');
    const themeToggleBtn = document.getElementById('theme-toggle');
    themeToggleBtn.textContent = isLightMode ? 'Mode Gelap' : 'Mode Terang';

    // Perbarui warna orbit
    const orbitColor = isLightMode ? 0xAAAAAA : 0x444444;
    orbits.children.forEach(orbit => {
        if(orbit.material) {
            orbit.material.color.setHex(orbitColor);
        }
    });
}

function addProton() {
    if (protons.length >= 10) return; // Batas unsur
    buildAtom(protons.length + 1, neutrons.length, electronObjects.length + 1);
}

function addNeutron() {
     if (neutrons.length >= 15) return;
    buildAtom(protons.length, neutrons.length + 1, electronObjects.length);
}

function addElectron() {
     if (electronObjects.length >= 20) return;
    buildAtom(protons.length, neutrons.length, electronObjects.length + 1);
}

function removeProton() {
    if (protons.length <= 1) return; // Minimal 1 proton
    const newElectronCount = Math.max(0, electronObjects.length - 1);
    buildAtom(protons.length - 1, neutrons.length, newElectronCount);
}

function removeNeutron() {
    if (neutrons.length <= 0) return;
    buildAtom(protons.length, neutrons.length - 1, electronObjects.length);
}

function removeElectron() {
    if (electronObjects.length <= 0) return;
    buildAtom(protons.length, neutrons.length, electronObjects.length - 1);
}

function resetAtom() {
    isNucleusSeparated = false;
    document.getElementById('toggle-nucleus').textContent = 'Pisahkan Inti';
    buildAtom(1, 0, 1); // Kembali ke Hidrogen
}

function updateInfo() {
    const numProtons = protons.length;
    const numNeutrons = neutrons.length;
    const numElectrons = electronObjects.length;
    const massNumber = numProtons + numNeutrons;
    
    const data = ELEMENT_DATA[numProtons] || { name: `Unsur #${numProtons}`, stableNeutrons: [], phase: '-', usage: '-' };

    document.getElementById('element-name').textContent = data.name;
    document.getElementById('atomic-number').textContent = numProtons;
    document.getElementById('mass-number').textContent = massNumber;
    document.getElementById('isotope-name').textContent = `${data.name}-${massNumber}`;
    document.getElementById('element-phase').textContent = data.phase;
    document.getElementById('element-usage').textContent = data.usage;

    const stabilitySpan = document.getElementById('core-stability');
    const isStable = data.stableNeutrons.includes(numNeutrons);
    
    if (isStable) {
        stabilitySpan.textContent = 'Stabil';
        stabilitySpan.className = 'font-bold stability-stabil';
    } else {
        stabilitySpan.textContent = 'Tidak Stabil (Radioaktif)';
        stabilitySpan.className = 'font-bold stability-tidak-stabil';
    }

    const charge = numProtons - numElectrons;
    let chargeStr = charge.toString();
    if (charge > 0) chargeStr = `+${charge}`;
    document.getElementById('charge').textContent = chargeStr;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Loop Animasi
function animate() {
    requestAnimationFrame(animate);

    // Animasikan elektron
    electronObjects.forEach(e => {
        e.angle += e.speed;
        const x = e.orbitRadius * Math.cos(e.angle);
        const z = e.orbitRadius * Math.sin(e.angle);
        
        const pos = new THREE.Vector3(x, 0, z);
        pos.applyEuler(e.orbit.rotation);

        e.mesh.position.copy(pos);
    });

    controls.update();
    renderer.render(scene, camera);
}

// Menunggu hingga seluruh konten HTML dimuat sebelum menjalankan script
document.addEventListener('DOMContentLoaded', () => {
    init();
});

