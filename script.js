// --- KONFIGURASI & KONSTANTA ---
const PARTICLE_RADIUS = 0.5;
const NUCLEUS_SEPARATION_FACTOR = 2.0;
const MAX_PROTONS = 118;
const MAX_NEUTRONS = 180;
const MAX_ELECTRONS = 118;
const PERFORMANCE_THRESHOLD = 80;
const ELECTRON_SHELLS = [2, 10, 28, 60, 92, 110, Infinity];
const LATTICE_CONSTANT = 4; // Parameter 'a' untuk kisi kubik
const HCP_C_RATIO = 1.633; // c/a ratio ideal untuk HCP

// --- VARIABEL GLOBAL & STATE ---
let scene, camera, renderer, controls;
const atomGroup = new THREE.Group(); 
const latticeGroup = new THREE.Group(); 
const latticeAtomsGroup = new THREE.Group();
const latticeOutlinesGroup = new THREE.Group();
const coordinationLinesGroup = new THREE.Group();

let protons = [], neutrons = [], electronObjects = [];
let countdownInterval = null;
let unitCellOutline, multiCellOutlines;

// Definisikan clipping planes untuk mode kontribusi
const clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), LATTICE_CONSTANT),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), LATTICE_CONSTANT),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), LATTICE_CONSTANT)
];

// OPTIMISASI: Geometri & material yang dapat digunakan kembali
const protonGeometry = new THREE.SphereGeometry(PARTICLE_RADIUS, 32, 32);
const neutronGeometry = new THREE.SphereGeometry(PARTICLE_RADIUS, 32, 32);
const electronGeometry = new THREE.SphereGeometry(PARTICLE_RADIUS / 3, 16, 16);
const latticeAtomGeometry = new THREE.SphereGeometry(1, 32, 32);

const protonMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 });
const neutronMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.5 });
const electronMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff, roughness: 0.5 });
const coordinationLineMaterial = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.7 });

// Material khusus untuk atom kisi dengan clipping
const latticeAtomMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x7dd3fc, 
    roughness: 0.4, 
    metalness: 0.2,
});
const latticeAtomMaterialClipped = new THREE.MeshStandardMaterial({ 
    color: 0x7dd3fc, 
    roughness: 0.4, 
    metalness: 0.2,
    clippingPlanes: clippingPlanes,
    clipIntersection: true
});

// State utama aplikasi
const appState = {
    // State umum
    simulationMode: 'atom', 
    
    // State mode atom
    protons: 1, neutrons: 0, electrons: 1, isNucleusSeparated: false,
    isNucleusStructured: false, isNucleusExpanded: false, nucleusExpansionFactor: 1.0, is3DView: true,

    // State mode kisi
    latticeType: 'sc', // 'sc', 'bcc', 'fcc', 'hcp'
    latticeDisplayMode: 'unit-cell', // 'unit-cell', 'layer', 'coordination', 'single', 'contribution', '8-cells'
    latticeExpansion: 1.0, isUnitCellVisible: true,
};

// --- DATA STRUKTUR KISI ---
const LATTICE_DEFINITIONS = {
    sc: {
        name: "Simple Cubic", coordinationNumber: 6, apf: 0.52, relation: "a = 2R",
        unitCell: [ [0,0,0], [1,0,0], [1,1,0], [0,1,0], [0,0,1], [1,0,1], [1,1,1], [0,1,1] ],
        coordination: { center: [0, 0, 0], neighbors: [ [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1] ] },
        layer: [ [0,0,0], [1,0,0], [0,1,0], [1,1,0] ],
        contribution_calc: { corners: 8, faces: 0, body: 0, total: 1 }
    },
    bcc: {
        name: "Body-Centered Cubic", coordinationNumber: 8, apf: 0.68, relation: "a = 4R / &radic;3",
        unitCell: [ [0,0,0], [1,0,0], [1,1,0], [0,1,0], [0,0,1], [1,0,1], [1,1,1], [0,1,1], [0.5,0.5,0.5] ],
        coordination: { center: [0.5,0.5,0.5], neighbors: [ [0,0,0], [1,0,0], [1,1,0], [0,1,0], [0,0,1], [1,0,1], [1,1,1], [0,1,1] ] },
        layer: [ [0,0,0], [1,0,0], [0,1,0], [1,1,0], [0.5,0.5,1] ],
        contribution_calc: { corners: 8, faces: 0, body: 1, total: 2 }
    },
    fcc: {
        name: "Face-Centered Cubic", coordinationNumber: 12, apf: 0.74, relation: "a = 2R&radic;2",
        unitCell: [ [0,0,0], [1,0,0], [1,1,0], [0,1,0], [0,0,1], [1,0,1], [1,1,1], [0,1,1], [0.5,0.5,0], [0.5,0.5,1], [0,0.5,0.5], [1,0.5,0.5], [0.5,0,0.5], [0.5,1,0.5] ],
        coordination: { center: [0.5,0.5,0.5], neighbors: [ [1,1,0.5], [1,0,0.5], [0,1,0.5], [0,0,0.5], [0.5,1,1], [0.5,0,1], [0.5,1,0], [0.5,0,0], [1,0.5,1], [0,0.5,1], [1,0.5,0], [0,0.5,0] ] },
        layer: [ [0,0,0], [1,0,0], [0,1,0], [1,1,0], [0.5,0.5,0] ],
        contribution_calc: { corners: 8, faces: 6, body: 0, total: 4 }
    },
    hcp: {
        name: "Hexagonal Close-Packed", coordinationNumber: 12, apf: 0.74, relation: "a = 2R, c = 1.633a",
        unitCell: [ [1,0,0], [0.5,0.866,0], [-0.5,0.866,0], [-1,0,0], [-0.5,-0.866,0], [0.5,-0.866,0], [0,0,0], [0.5,0.289,0.8165], [-0.5,0.289,0.8165], [0,-0.577,0.8165], [1,0,1.633], [0.5,0.866,1.633], [-0.5,0.866,1.633], [-1,0,1.633], [-0.5,-0.866,1.633], [0.5,-0.866,1.633], [0,0,1.633] ],
        coordination: { center: [0,0,0], neighbors: [ [1,0,0], [0.5,0.866,0], [-0.5,0.866,0], [-1,0,0], [-0.5,-0.866,0], [0.5,-0.866,0], [0.5,0.289,0.8165], [-0.5,0.289,0.8165], [0,-0.577,0.8165], [0.5,0.289,-0.8165], [-0.5,0.289,-0.8165], [0,-0.577,-0.8165] ] },
        layer: [ [1,0,0], [0.5,0.866,0], [-0.5,0.866,0], [-1,0,0], [-0.5,-0.866,0], [0.5,-0.866,0], [0,0,0] ],
        contribution_calc: { total: 2 } // Perhitungan HCP lebih kompleks, jadi kita tampilkan totalnya saja.
    }
};


// Kumpulan referensi elemen DOM untuk efisiensi
const domElements = {};

// Data lengkap untuk 118 unsur (tidak diubah)
const ELEMENT_DATA = [
    null,
    {name:"Hidrogen",symbol:"H",commonNeutrons:0,stableNeutrons:[0,1],phase:"Gas",usage:"Bahan bakar bintang.",type:"nonmetal",config:"1s<sup class='-top-1'>1</sup>"},{name:"Helium",symbol:"He",commonNeutrons:2,stableNeutrons:[1,2],phase:"Gas",usage:"Mengisi balon udara.",type:"noble-gas",config:"1s<sup class='-top-1'>2</sup>"},{name:"Litium",symbol:"Li",commonNeutrons:4,stableNeutrons:[3,4],phase:"Padat",usage:"Baterai isi ulang.",type:"alkali-metal",config:"[He] 2s<sup class='-top-1'>1</sup>"},{name:"Berilium",symbol:"Be",commonNeutrons:5,stableNeutrons:[5],phase:"Padat",usage:"Komponen teleskop.",type:"alkaline-earth-metal",config:"[He] 2s<sup class='-top-1'>2</sup>"},{name:"Boron",symbol:"B",commonNeutrons:6,stableNeutrons:[5,6],phase:"Padat",usage:"Kaca tahan panas.",type:"metalloid",config:"[He] 2s<sup class='-top-1'>2</sup> 2p<sup class='-top-1'>1</sup>"},{name:"Karbon",symbol:"C",commonNeutrons:6,stableNeutrons:[6,7],phase:"Padat",usage:"Dasar kehidupan.",type:"nonmetal",config:"[He] 2s<sup class='-top-1'>2</sup> 2p<sup class='-top-1'>2</sup>"},{name:"Nitrogen",symbol:"N",commonNeutrons:7,stableNeutrons:[7,8],phase:"Gas",usage:"Pupuk, atmosfer.",type:"nonmetal",config:"[He] 2s<sup class='-top-1'>2</sup> 2p<sup class='-top-1'>3</sup>"},{name:"Oksigen",symbol:"O",commonNeutrons:8,stableNeutrons:[8,9,10],phase:"Gas",usage:"Pernapasan.",type:"nonmetal",config:"[He] 2s<sup class='-top-1'>2</sup> 2p<sup class='-top-1'>4</sup>"},{name:"Fluorin",symbol:"F",commonNeutrons:10,stableNeutrons:[10],phase:"Gas",usage:"Pasta gigi.",type:"halogen",config:"[He] 2s<sup class='-top-1'>2</sup> 2p<sup class='-top-1'>5</sup>"},{name:"Neon",symbol:"Ne",commonNeutrons:10,stableNeutrons:[10,11,12],phase:"Gas",usage:"Lampu iklan.",type:"noble-gas",config:"[He] 2s<sup class='-top-1'>2</sup> 2p<sup class='-top-1'>6</sup>"},{name:"Natrium",symbol:"Na",commonNeutrons:12,stableNeutrons:[12],phase:"Padat",usage:"Garam dapur.",type:"alkali-metal",config:"[Ne] 3s<sup class='-top-1'>1</sup>"},{name:"Magnesium",symbol:"Mg",commonNeutrons:12,stableNeutrons:[12,13,14],phase:"Padat",usage:"Kembang api.",type:"alkaline-earth-metal",config:"[Ne] 3s<sup class='-top-1'>2</sup>"},{name:"Aluminium",symbol:"Al",commonNeutrons:14,stableNeutrons:[14],phase:"Padat",usage:"Kaleng minuman.",type:"post-transition-metal",config:"[Ne] 3s<sup class='-top-1'>2</sup> 3p<sup class='-top-1'>1</sup>"},{name:"Silikon",symbol:"Si",commonNeutrons:14,stableNeutrons:[14,15,16],phase:"Padat",usage:"Chip komputer.",type:"metalloid",config:"[Ne] 3s<sup class='-top-1'>2</sup> 3p<sup class='-top-1'>2</sup>"},{name:"Fosfor",symbol:"P",commonNeutrons:16,stableNeutrons:[16],phase:"Padat",usage:"Ujung korek api.",type:"nonmetal",config:"[Ne] 3s<sup class='-top-1'>2</sup> 3p<sup class='-top-1'>3</sup>"},{name:"Belerang",symbol:"S",commonNeutrons:16,stableNeutrons:[16,17,18,20],phase:"Padat",usage:"Asam sulfat.",type:"nonmetal",config:"[Ne] 3s<sup class='-top-1'>2</sup> 3p<sup class='-top-1'>4</sup>"},{name:"Klorin",symbol:"Cl",commonNeutrons:18,stableNeutrons:[18,20],phase:"Gas",usage:"Disinfektan air.",type:"halogen",config:"[Ne] 3s<sup class='-top-1'>2</sup> 3p<sup class='-top-1'>5</sup>"},{name:"Argon",symbol:"Ar",commonNeutrons:22,stableNeutrons:[18,20,22],phase:"Gas",usage:"Pengisi bola lampu.",type:"noble-gas",config:"[Ne] 3s<sup class='-top-1'>2</sup> 3p<sup class='-top-1'>6</sup>"},{name:"Kalium",symbol:"K",commonNeutrons:20,stableNeutrons:[20,22],phase:"Padat",usage:"Fungsi saraf.",type:"alkali-metal",config:"[Ar] 4s<sup class='-top-1'>1</sup>"},{name:"Kalsium",symbol:"Ca",commonNeutrons:20,stableNeutrons:[20,22,24,26,28],phase:"Padat",usage:"Tulang dan gigi.",type:"alkaline-earth-metal",config:"[Ar] 4s<sup class='-top-1'>2</sup>"},{name:"Skandium",symbol:"Sc",commonNeutrons:24,stableNeutrons:[24],phase:"Padat",usage:"Paduan logam ringan.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>1</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Titanium",symbol:"Ti",commonNeutrons:26,stableNeutrons:[24,25,26,27,28],phase:"Padat",usage:"Implan medis, pesawat.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>2</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Vanadium",symbol:"V",commonNeutrons:28,stableNeutrons:[28],phase:"Padat",usage:"Baja tahan karat.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>3</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Kromium",symbol:"Cr",commonNeutrons:28,stableNeutrons:[26,28,29,30],phase:"Padat",usage:"Pelapisan logam.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>5</sup> 4s<sup class='-top-1'>1</sup>"},{name:"Mangan",symbol:"Mn",commonNeutrons:30,stableNeutrons:[30],phase:"Padat",usage:"Produksi baja.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>5</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Besi",symbol:"Fe",commonNeutrons:30,stableNeutrons:[28,30,31,32],phase:"Padat",usage:"Bahan bangunan utama.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>6</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Kobalt",symbol:"Co",commonNeutrons:32,stableNeutrons:[32],phase:"Padat",usage:"Magnet, baterai.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>7</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Nikel",symbol:"Ni",commonNeutrons:31,stableNeutrons:[30,32,33,34,36],phase:"Padat",usage:"Koin, baterai.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>8</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Tembaga",symbol:"Cu",commonNeutrons:35,stableNeutrons:[34,36],phase:"Padat",usage:"Kabel listrik.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>1</sup>"},{name:"Seng",symbol:"Zn",commonNeutrons:35,stableNeutrons:[34,36,37,38,40],phase:"Padat",usage:"Pelapis anti karat.",type:"transition-metal",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>2</sup>"},{name:"Galium",symbol:"Ga",commonNeutrons:39,stableNeutrons:[38,40],phase:"Padat",usage:"Semikonduktor, LED.",type:"post-transition-metal",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>2</sup> 4p<sup class='-top-1'>1</sup>"},{name:"Germanium",symbol:"Ge",commonNeutrons:41,stableNeutrons:[40,42,43,44],phase:"Padat",usage:"Serat optik.",type:"metalloid",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>2</sup> 4p<sup class='-top-1'>2</sup>"},{name:"Arsen",symbol:"As",commonNeutrons:42,stableNeutrons:[42],phase:"Padat",usage:"Racun, semikonduktor.",type:"metalloid",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>2</sup> 4p<sup class='-top-1'>3</sup>"},{name:"Selenium",symbol:"Se",commonNeutrons:45,stableNeutrons:[42,44,45,46,48],phase:"Padat",usage:"Fotosel, sampo.",type:"nonmetal",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>2</sup> 4p<sup class='-top-1'>4</sup>"},{name:"Bromin",symbol:"Br",commonNeutrons:45,stableNeutrons:[44,46],phase:"Cair",usage:"Anti api.",type:"halogen",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>2</sup> 4p<sup class='-top-1'>5</sup>"},{name:"Kripton",symbol:"Kr",commonNeutrons:48,stableNeutrons:[42,44,46,47,48,50],phase:"Gas",usage:"Lampu kilat fotografi.",type:"noble-gas",config:"[Ar] 3d<sup class='-top-1'>10</sup> 4s<sup class='-top-1'>2</sup> 4p<sup class='-top-1'>6</sup>"},{name:"Rubidium",symbol:"Rb",commonNeutrons:48,stableNeutrons:[48],phase:"Padat",usage:"Jam atom.",type:"alkali-metal",config:"[Kr] 5s<sup class='-top-1'>1</sup>"},{name:"Stronsium",symbol:"Sr",commonNeutrons:50,stableNeutrons:[46,48,49,50],phase:"Padat",usage:"Kembang api merah.",type:"alkaline-earth-metal",config:"[Kr] 5s<sup class='-top-1'>2</sup>"},{name:"Itrium",symbol:"Y",commonNeutrons:50,stableNeutrons:[50],phase:"Padat",usage:"Layar TV tabung (dulu).",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>1</sup> 5s<sup class='-top-1'>2</sup>"},{name:"Zirkonium",symbol:"Zr",commonNeutrons:51,stableNeutrons:[50,51,52,54,56],phase:"Padat",usage:"Reaktor nuklir.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>2</sup> 5s<sup class='-top-1'>2</sup>"},{name:"Niobium",symbol:"Nb",commonNeutrons:52,stableNeutrons:[52],phase:"Padat",usage:"Superkonduktor.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>4</sup> 5s<sup class='-top-1'>1</sup>"},{name:"Molibdenum",symbol:"Mo",commonNeutrons:54,stableNeutrons:[50,52,53,54,55,56,58],phase:"Padat",usage:"Paduan baja.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>5</sup> 5s<sup class='-top-1'>1</sup>"},{name:"Teknesium",symbol:"Tc",commonNeutrons:55,phase:"Padat",usage:"Diagnostik medis.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>5</sup> 5s<sup class='-top-1'>2</sup>"},{name:"Rutenium",symbol:"Ru",commonNeutrons:58,stableNeutrons:[52,54,55,56,57,58,60],phase:"Padat",usage:"Kontak listrik.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>7</sup> 5s<sup class='-top-1'>1</sup>"},{name:"Rodium",symbol:"Rh",commonNeutrons:58,stableNeutrons:[58],phase:"Padat",usage:"Katalis knalpot.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>8</sup> 5s<sup class='-top-1'>1</sup>"},{name:"Paladium",symbol:"Pd",commonNeutrons:60,stableNeutrons:[58,60,62,63,64,66],phase:"Padat",usage:"Katalis knalpot.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>10</sup>"},{name:"Perak",symbol:"Ag",commonNeutrons:61,stableNeutrons:[60,62],phase:"Padat",usage:"Perhiasan, konduktor.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>1</sup>"},{name:"Kadmium",symbol:"Cd",commonNeutrons:66,stableNeutrons:[60,62,64,65,66,68],phase:"Padat",usage:"Baterai Ni-Cd.",type:"transition-metal",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>2</sup>"},{name:"Indium",symbol:"In",commonNeutrons:66,stableNeutrons:[64,66],phase:"Padat",usage:"Layar sentuh (ITO).",type:"post-transition-metal",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>2</sup> 5p<sup class='-top-1'>1</sup>"},{name:"Timah",symbol:"Sn",commonNeutrons:70,stableNeutrons:[62,64,65,66,67,68,69,70,72,74],phase:"Padat",usage:"Solder, pelapis.",type:"post-transition-metal",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>2</sup> 5p<sup class='-top-1'>2</sup>"},{name:"Antimon",symbol:"Sb",commonNeutrons:71,stableNeutrons:[70,72],phase:"Padat",usage:"Baterai timbal.",type:"metalloid",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>2</sup> 5p<sup class='-top-1'>3</sup>"},{name:"Telurium",symbol:"Te",commonNeutrons:76,stableNeutrons:[70,72,73,74,75,76,78],phase:"Padat",usage:"Paduan logam.",type:"metalloid",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>2</sup> 5p<sup class='-top-1'>4</sup>"},{name:"Yodium",symbol:"I",commonNeutrons:74,stableNeutrons:[74],phase:"Padat",usage:"Antiseptik.",type:"halogen",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>2</sup> 5p<sup class='-top-1'>5</sup>"},{name:"Xenon",symbol:"Xe",commonNeutrons:77,stableNeutrons:[70,72,74,75,76,77,78,80,82],phase:"Gas",usage:"Lampu mobil HID.",type:"noble-gas",config:"[Kr] 4d<sup class='-top-1'>10</sup> 5s<sup class='-top-1'>2</sup> 5p<sup class='-top-1'>6</sup>"},{name:"Sesium",symbol:"Cs",commonNeutrons:78,stableNeutrons:[78],phase:"Padat",usage:"Jam atom.",type:"alkali-metal",config:"[Xe] 6s<sup class='-top-1'>1</sup>"},{name:"Barium",symbol:"Ba",commonNeutrons:81,stableNeutrons:[74,76,78,79,80,81,82],phase:"Padat",usage:"Pencitraan sinar-X.",type:"alkaline-earth-metal",config:"[Xe] 6s<sup class='-top-1'>2</sup>"},{name:"Lantanum",symbol:"La",commonNeutrons:82,stableNeutrons:[82],phase:"Padat",usage:"Lensa kamera.",type:"lanthanide",config:"[Xe] 5d<sup class='-top-1'>1</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Serium",symbol:"Ce",commonNeutrons:82,stableNeutrons:[78,80,82,84],phase:"Padat",usage:"Batu geretan.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>1</sup> 5d<sup class='-top-1'>1</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Praseodimium",symbol:"Pr",commonNeutrons:82,stableNeutrons:[82],phase:"Padat",usage:"Kacamata las.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>3</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Neodimium",symbol:"Nd",commonNeutrons:84,stableNeutrons:[82,83,84,85,86,88,90],phase:"Padat",usage:"Magnet super kuat.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>4</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Prometium",symbol:"Pm",commonNeutrons:84,phase:"Padat",usage:"Cat berpendar.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>5</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Samarium",symbol:"Sm",commonNeutrons:88,stableNeutrons:[82,86,87,88,90,92,94],phase:"Padat",usage:"Magnet suhu tinggi.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>6</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Europium",symbol:"Eu",commonNeutrons:89,stableNeutrons:[88,90],phase:"Padat",usage:"Layar TV (merah).",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>7</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Gadolinium",symbol:"Gd",commonNeutrons:94,stableNeutrons:[90,92,93,94,96,98],phase:"Padat",usage:"Agen kontras MRI.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>7</sup> 5d<sup class='-top-1'>1</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Terbium",symbol:"Tb",commonNeutrons:96,stableNeutrons:[94],phase:"Padat",usage:"Layar (hijau).",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>9</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Disprosium",symbol:"Dy",commonNeutrons:99,stableNeutrons:[94,96,97,98,99,100,102],phase:"Padat",usage:"Magnet motor hibrida.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Holmium",symbol:"Ho",commonNeutrons:98,stableNeutrons:[98],phase:"Padat",usage:"Laser bedah.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>11</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Erbium",symbol:"Er",commonNeutrons:100,stableNeutrons:[96,98,99,100,102,104],phase:"Padat",usage:"Serat optik.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>12</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Tulium",symbol:"Tm",commonNeutrons:100,stableNeutrons:[100],phase:"Padat",usage:"Mesin X-ray portabel.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>13</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Iterbium",symbol:"Yb",commonNeutrons:103,stableNeutrons:[100,102,103,104,106,108],phase:"Padat",usage:"Laser inframerah.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>14</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Lutetium",symbol:"Lu",commonNeutrons:106,stableNeutrons:[106],phase:"Padat",usage:"Detektor PET scan.",type:"lanthanide",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>1</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Hafnium",symbol:"Hf",commonNeutrons:106,stableNeutrons:[102,104,105,106,107,108],phase:"Padat",usage:"Reaktor nuklir.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>2</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Tantalum",symbol:"Ta",commonNeutrons:108,stableNeutrons:[108],phase:"Padat",usage:"Kapasitor ponsel.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>3</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Tungsten",symbol:"W",commonNeutrons:110,stableNeutrons:[108,110,111,112,114],phase:"Padat",usage:"Filamen bola lampu.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>4</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Renium",symbol:"Re",commonNeutrons:111,stableNeutrons:[110,112],phase:"Padat",usage:"Mesin jet.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>5</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Osmium",symbol:"Os",commonNeutrons:114,stableNeutrons:[110,112,113,114,116,118],phase:"Padat",usage:"Ujung pulpen.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>6</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Iridium",symbol:"Ir",commonNeutrons:115,stableNeutrons:[114,116],phase:"Padat",usage:"Busi.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>7</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Platina",symbol:"Pt",commonNeutrons:117,stableNeutrons:[114,115,116,117,118,120],phase:"Padat",usage:"Perhiasan, katalis.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>9</sup> 6s<sup class='-top-1'>1</sup>"},{name:"Emas",symbol:"Au",commonNeutrons:118,stableNeutrons:[118],phase:"Padat",usage:"Perhiasan, elektronik.",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>1</sup>"},{name:"Raksa",symbol:"Hg",commonNeutrons:122,stableNeutrons:[118,120,121,122,124,126],phase:"Cair",usage:"Termometer (dulu).",type:"transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup>"},{name:"Talium",symbol:"Tl",commonNeutrons:123,stableNeutrons:[122,124],phase:"Padat",usage:"Detektor inframerah.",type:"post-transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup> 6p<sup class='-top-1'>1</sup>"},{name:"Timbal",symbol:"Pb",commonNeutrons:126,stableNeutrons:[124,125,126,127,128],phase:"Padat",usage:"Baterai mobil (aki).",type:"post-transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup> 6p<sup class='-top-1'>2</sup>"},{name:"Bismut",symbol:"Bi",commonNeutrons:126,stableNeutrons:[126],phase:"Padat",usage:"Obat sakit perut.",type:"post-transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup> 6p<sup class='-top-1'>3</sup>"},{name:"Polonium",symbol:"Po",commonNeutrons:125,phase:"Padat",usage:"Pemanas satelit.",type:"post-transition-metal",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup> 6p<sup class='-top-1'>4</sup>"},{name:"Astatin",symbol:"At",commonNeutrons:125,phase:"Padat",usage:"Terapi kanker.",type:"halogen",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup> 6p<sup class='-top-1'>5</sup>"},{name:"Radon",symbol:"Rn",commonNeutrons:136,phase:"Gas",usage:"Terapi radiasi.",type:"noble-gas",config:"[Xe] 4f<sup class='-top-1'>14</sup> 5d<sup class='-top-1'>10</sup> 6s<sup class='-top-1'>2</sup> 6p<sup class='-top-1'>6</sup>"},{name:"Fransium",symbol:"Fr",commonNeutrons:136,phase:"Padat",usage:"Penelitian ilmiah.",type:"alkali-metal",config:"[Rn] 7s<sup class='-top-1'>1</sup>"},{name:"Radium",symbol:"Ra",commonNeutrons:138,phase:"Padat",usage:"Cat jam berpendar (dulu).",type:"alkaline-earth-metal",config:"[Rn] 7s<sup class='-top-1'>2</sup>"},{name:"Aktinium",symbol:"Ac",commonNeutrons:138,phase:"Padat",usage:"Sumber neutron.",type:"actinide",config:"[Rn] 6d<sup class='-top-1'>1</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Torium",symbol:"Th",commonNeutrons:142,phase:"Padat",usage:"Bahan bakar nuklir.",type:"actinide",config:"[Rn] 6d<sup class='-top-1'>2</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Protaktinium",symbol:"Pa",commonNeutrons:140,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>2</sup> 6d<sup class='-top-1'>1</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Uranium",symbol:"U",commonNeutrons:146,phase:"Padat",usage:"Bahan bakar nuklir.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>3</sup> 6d<sup class='-top-1'>1</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Neptunium",symbol:"Np",commonNeutrons:146,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>4</sup> 6d<sup class='-top-1'>1</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Plutonium",symbol:"Pu",commonNeutrons:150,phase:"Padat",usage:"Senjata nuklir, sumber daya.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>6</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Amerisium",symbol:"Am",commonNeutrons:152,phase:"Padat",usage:"Detektor asap.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>7</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Kurium",symbol:"Cm",commonNeutrons:153,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>7</sup> 6d<sup class='-top-1'>1</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Berkelium",symbol:"Bk",commonNeutrons:152,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>9</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Kalifornium",symbol:"Cf",commonNeutrons:153,phase:"Padat",usage:"Memulai reaktor nuklir.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Einsteinium",symbol:"Es",commonNeutrons:155,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>11</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Fermium",symbol:"Fm",commonNeutrons:158,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>12</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Mendelevium",symbol:"Md",commonNeutrons:159,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>13</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Nobelium",symbol:"No",commonNeutrons:159,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>14</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Lawrensium",symbol:"Lr",commonNeutrons:161,phase:"Padat",usage:"Penelitian ilmiah.",type:"actinide",config:"[Rn] 5f<sup class='-top-1'>14</sup> 7s<sup class='-top-1'>2</sup> 7p<sup class='-top-1'>1</sup>"},{name:"Rutherfordium",symbol:"Rf",commonNeutrons:163,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>2</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Dubnium",symbol:"Db",commonNeutrons:165,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>3</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Seaborgium",symbol:"Sg",commonNeutrons:167,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>4</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Bohrium",symbol:"Bh",commonNeutrons:165,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>5</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Hassium",symbol:"Hs",commonNeutrons:169,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>6</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Meitnerium",symbol:"Mt",commonNeutrons:170,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>7</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Darmstadtium",symbol:"Ds",commonNeutrons:172,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>8</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Roentgenium",symbol:"Rg",commonNeutrons:171,phase:"Padat",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>9</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Kopernisium",symbol:"Cn",commonNeutrons:173,phase:"Gas (diprediksi)",usage:"Penelitian ilmiah.",type:"transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup>"},{name:"Nihonium",symbol:"Nh",commonNeutrons:173,phase:"Padat (diprediksi)",usage:"Penelitian ilmiah.",type:"post-transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup> 7p<sup class='-top-1'>1</sup>"},{name:"Flerovium",symbol:"Fl",commonNeutrons:175,phase:"Padat (diprediksi)",usage:"Penelitian ilmiah.",type:"post-transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup> 7p<sup class='-top-1'>2</sup>"},{name:"Moskovium",symbol:"Mc",commonNeutrons:174,phase:"Padat (diprediksi)",usage:"Penelitian ilmiah.",type:"post-transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup> 7p<sup class='-top-1'>3</sup>"},{name:"Livermorium",symbol:"Lv",commonNeutrons:177,phase:"Padat (diprediksi)",usage:"Penelitian ilmiah.",type:"post-transition-metal",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup> 7p<sup class='-top-1'>4</sup>"},{name:"Tenesin",symbol:"Ts",commonNeutrons:177,phase:"Padat (diprediksi)",usage:"Penelitian ilmiah.",type:"halogen",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup> 7p<sup class='-top-1'>5</sup>"},{name:"Oganesson",symbol:"Og",commonNeutrons:176,phase:"Gas (diprediksi)",usage:"Penelitian ilmiah.",type:"noble-gas",config:"[Rn] 5f<sup class='-top-1'>14</sup> 6d<sup class='-top-1'>10</sup> 7s<sup class='-top-1'>2</sup> 7p<sup class='-top-1'>6</sup>"}
];

// --- FUNGSI UTAMA ---
function init() {
    // Mengisi objek referensi DOM
    cacheDOMElements();
    
    // Atur mode terang sebagai default
    document.body.classList.add('light-mode');
    updateThemeUI(true); 
    
    // Setup Scene, Camera, Renderer
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 20;
    renderer = new THREE.WebGLRenderer({ canvas: domElements.bg, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.localClippingEnabled = true; // Aktifkan clipping
    
    // Tambahkan kedua grup ke scene, visibilitas akan diatur nanti
    scene.add(atomGroup);
    scene.add(latticeGroup);
    latticeGroup.add(latticeAtomsGroup);
    latticeGroup.add(latticeOutlinesGroup);
    latticeAtomsGroup.add(coordinationLinesGroup);

    // Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 10, 15);
    scene.add(ambientLight, pointLight);

    // Setup Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Setup Event Listeners
    setupEventListeners();
    
    // Inisialisasi mode awal
    updateUIMode();

    // Tutup semua panel secara default saat pertama kali dimuat
    //toggleInfoPanel();
    toggleLatticeControlsPanel();
    toggleLatticeInfoPanel();

    // Mulai loop animasi
    animate();
}

function animate() {
    requestAnimationFrame(animate);

    if(appState.simulationMode === 'atom' && atomGroup.visible) {
        // Animasikan pergerakan elektron
        electronObjects.forEach(e => {
            e.angle += e.speed;
            const x = e.orbitRadius * Math.cos(e.angle);
            const y = e.orbitRadius * Math.sin(e.angle);
            const pos = new THREE.Vector3(x, y, 0).applyEuler(e.orbit.rotation);
            e.mesh.position.copy(pos);
        });
    }
    
    controls.update();
    renderer.render(scene, camera);
}

// --- FUNGSI MANAJEMEN MODE ---

function toggleSimulationMode() {
    appState.simulationMode = appState.simulationMode === 'atom' ? 'lattice' : 'atom';
    updateUIMode();
}

function updateUIMode() {
    const isAtomMode = appState.simulationMode === 'atom';

    // Atur visibilitas grup 3D
    atomGroup.visible = isAtomMode;
    latticeGroup.visible = !isAtomMode;

    // Atur visibilitas UI
    domElements.atomSimUi.classList.toggle('hidden', !isAtomMode);
    domElements.latticeSimUi.classList.toggle('hidden', isAtomMode);
    
    // Tampilkan/sembunyikan panel info yang sesuai
    domElements.latticeInfoPanel.classList.toggle('hidden', isAtomMode);
    domElements.infoPanel.classList.toggle('hidden', !isAtomMode);


    if(isAtomMode){
        domElements.mainTitle.textContent = "Simulasi Atom";
        domElements.mainSubtitle.textContent = "Visualisasi struktur atom.";
        domElements.modeSwitchBtn.textContent = "Mode Kisi";
        if (atomGroup.children.length === 0) {
             initAtomMode();
        }
    } else {
        domElements.mainTitle.textContent = "Simulasi Struktur Kisi";
        const latticeName = LATTICE_DEFINITIONS[appState.latticeType].name;
        domElements.mainSubtitle.textContent = `Visualisasi Kisi Kristal: ${latticeName}`;
        domElements.modeSwitchBtn.textContent = "Mode Atom";
        initLatticeMode();
    }
}

function initAtomMode() {
    populatePeriodicTable();
    buildAtomFromState();
}

function initLatticeMode() {
    const type = appState.latticeType;
    const displayMode = appState.latticeDisplayMode;

    let target = new THREE.Vector3();
    let camPos = new THREE.Vector3(10, 10, 15);

    if (displayMode === '8-cells' || displayMode === '27-cells') {
        const gridSize = displayMode === '27-cells' ? 3 : 2;
        const center = gridSize / 2 * LATTICE_CONSTANT;
        target.set(center, center, center);
        camPos.set(center * 1.5, center * 2, center * 2.5);
    } else if (type === 'hcp') {
        target.set(0, 0, LATTICE_CONSTANT * HCP_C_RATIO / 2);
        camPos.set(LATTICE_CONSTANT * 2, LATTICE_CONSTANT * 3, LATTICE_CONSTANT * 4);
    } else {
         target.set(LATTICE_CONSTANT / 2, LATTICE_CONSTANT / 2, LATTICE_CONSTANT / 2);
    }
    
    camera.position.copy(camPos);
    controls.target.copy(target);
    buildLattice();
}


// --- FUNGSI PEMBENTUKAN KISI ---

function buildLattice() {
    clearLattice();
    
    const type = appState.latticeType;
    const displayMode = appState.latticeDisplayMode;
    const definition = LATTICE_DEFINITIONS[type];
    const isContributionMode = displayMode === 'contribution';
    const isMultiCell = displayMode === '8-cells' || displayMode === '27-cells';
    
    renderer.clippingPlanes = isContributionMode && type !== 'hcp' ? clippingPlanes : [];
    domElements.toggleOutlineBtn.disabled = isContributionMode || isMultiCell;
    
    if (isMultiCell) {
        domElements.latticeTypeSelect.querySelector('option[value="hcp"]').disabled = true;
        if(type === 'hcp') {
            appState.latticeType = 'sc';
            domElements.latticeTypeSelect.value = 'sc';
            buildLattice();
            return;
        }
    } else {
         domElements.latticeTypeSelect.querySelector('option[value="hcp"]').disabled = false;
    }

    domElements.mainSubtitle.textContent = `Visualisasi Kisi Kristal: ${definition.name}`;
    
    if (isMultiCell) {
        const gridSize = displayMode === '8-cells' ? 2 : 3;
        multiCellOutlines = new THREE.Group();
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                for (let k = 0; k < gridSize; k++) {
                    const outline = createOutline(true); // true for semi-transparent
                    outline.position.set(i * LATTICE_CONSTANT, j * LATTICE_CONSTANT, k * LATTICE_CONSTANT);
                    multiCellOutlines.add(outline);
                }
            }
        }
        latticeOutlinesGroup.add(multiCellOutlines);
    } else {
         unitCellOutline = createOutline(false);
         unitCellOutline.visible = appState.isUnitCellVisible || isContributionMode;
         latticeOutlinesGroup.add(unitCellOutline);
    }

    let positions = [];
    
    switch(displayMode) {
        case 'unit-cell':
        case 'contribution':
            positions = definition.unitCell;
            break;
        case '8-cells':
            buildMultiCells(2);
            break;
        case '27-cells':
            buildMultiCells(3);
            break;
        case 'layer':
            positions = definition.layer;
            break;
        case 'coordination':
            drawCoordination(definition.coordination);
            break;
        case 'single':
             positions = type === 'hcp' ? [[0, 0, 0.8165]] : [[0.5, 0.5, 0.5]];
             break;
    }
    
    if (displayMode !== 'coordination' && !isMultiCell) {
         positions.forEach(pos => {
            const atom = createLatticeAtom(false, isContributionMode);
            let scale = (type === 'hcp') ? LATTICE_CONSTANT/2 : LATTICE_CONSTANT;
            atom.position.set(pos[0] * scale, pos[1] * scale, pos[2] * scale);
            latticeAtomsGroup.add(atom);
        });
    }
    
    updateLatticeInfoPanel();
    applyLatticeExpansion();
}

function buildMultiCells(gridSize) {
    const type = appState.latticeType;
    const definition = LATTICE_DEFINITIONS[type];
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            for (let k = 0; k < gridSize; k++) {
                definition.unitCell.forEach(pos => {
                    const newPos = new THREE.Vector3(
                        (pos[0] + i) * LATTICE_CONSTANT,
                        (pos[1] + j) * LATTICE_CONSTANT,
                        (pos[2] + k) * LATTICE_CONSTANT
                    );
                    let exists = latticeAtomsGroup.children.some(child => child.isMesh && child.position.equals(newPos));
                    if (!exists) {
                        const atom = createLatticeAtom(false, false);
                        atom.position.copy(newPos);
                        latticeAtomsGroup.add(atom);
                    }
                });
            }
        }
    }
}

function clearLattice() {
    while(latticeAtomsGroup.children.length > 0) {
        const child = latticeAtomsGroup.children[0];
        if (child.isGroup) { // Handle coordinationLinesGroup
            while(child.children.length > 0) child.remove(child.children[0]);
        }
        latticeAtomsGroup.remove(child);
    }
    while(latticeOutlinesGroup.children.length > 0) {
        latticeOutlinesGroup.remove(latticeOutlinesGroup.children[0]);
    }
    // Pastikan grup garis koordinasi bersih dan ditambahkan kembali
    latticeAtomsGroup.add(coordinationLinesGroup);
     while(coordinationLinesGroup.children.length > 0) {
         coordinationLinesGroup.remove(coordinationLinesGroup.children[0]);
    }
}


function createLatticeAtom(isCenter, isClipped) {
    let material;
    if (isCenter) {
        material = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4, metalness: 0.2 });
    } else {
        material = isClipped ? latticeAtomMaterialClipped.clone() : latticeAtomMaterial.clone();
    }

    const atomRadius = (appState.latticeType === 'hcp' && !isClipped) ? 0.5 : 1;
    const displayRadius = appState.latticeDisplayMode === 'contribution' ? 1.01 : atomRadius;
    const geometry = new THREE.SphereGeometry(displayRadius, 32, 32);
    
    const atom = new THREE.Mesh(geometry, material);
    atom.userData.isCenter = isCenter; // Tandai atom pusat
    return atom;
}

function drawCoordination(coordinationData) {
    const scale = (appState.latticeType === 'hcp') ? LATTICE_CONSTANT/2 : LATTICE_CONSTANT;

    // Create and position central atom
    const centerPosArr = coordinationData.center.map(p => p * scale);
    const centerAtom = createLatticeAtom(true, false);
    centerAtom.position.set(...centerPosArr);
    latticeAtomsGroup.add(centerAtom);

    // Create, position neighbors and draw lines
    coordinationData.neighbors.forEach(pos => {
        const neighborPosArr = pos.map(p => p * scale);
        const neighborAtom = createLatticeAtom(false, false);
        neighborAtom.position.set(...neighborPosArr);
        latticeAtomsGroup.add(neighborAtom);
        
        const points = [new THREE.Vector3(...centerPosArr), new THREE.Vector3(...neighborPosArr)];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeo, coordinationLineMaterial);
        line.userData.centerAtom = centerAtom;
        line.userData.neighborAtom = neighborAtom;
        coordinationLinesGroup.add(line);
    });
}

function createOutline(isTransparent) {
    const isLightMode = document.body.classList.contains('light-mode');
    const color = isLightMode ? 0x374151 : 0x9ca3af;
    const material = new THREE.LineBasicMaterial({ 
        color: color,
        transparent: isTransparent,
        opacity: isTransparent ? 0.3 : 1.0
    });

    if (appState.latticeType === 'hcp' && !isTransparent) { // only for single cell hcp
        const c = LATTICE_CONSTANT/2 * HCP_C_RATIO;
        const r = LATTICE_CONSTANT/2;
        const points = [];
        // bottom hexagon
        for (let i = 0; i < 6; i++) points.push(new THREE.Vector3(r*Math.cos(i/3*Math.PI), r*Math.sin(i/3*Math.PI), 0));
        // top hexagon
        for (let i = 0; i < 6; i++) points.push(new THREE.Vector3(r*Math.cos(i/3*Math.PI), r*Math.sin(i/3*Math.PI), c));
        const linesGeo = new THREE.BufferGeometry();
        const linePoints = [];
        for(let i=0; i<6; i++) { linePoints.push(points[i], points[(i+1)%6]); }
        for(let i=0; i<6; i++) { linePoints.push(points[i+6], points[((i+1)%6)+6]); }
        for(let i=0; i<6; i++) { linePoints.push(points[i], points[i+6]); }
        linesGeo.setFromPoints(linePoints);
        return new THREE.LineSegments(linesGeo, material);
    } else {
        const size = LATTICE_CONSTANT;
        const geometry = new THREE.BoxGeometry(size, size, size);
        geometry.translate(size / 2, size / 2, size / 2); 
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, material);
        return line;
    }
}

function applyLatticeExpansion() {
    const expansion = appState.latticeExpansion;
    let center;

    if (appState.latticeDisplayMode === '8-cells' || appState.latticeDisplayMode === '27-cells') {
        const gridSize = appState.latticeDisplayMode === '27-cells' ? 3 : 2;
        const centerCoord = gridSize / 2 * LATTICE_CONSTANT;
        center = new THREE.Vector3(centerCoord, centerCoord, centerCoord);
    } else if (appState.latticeType === 'hcp' && appState.latticeDisplayMode !== 'coordination') {
         center = new THREE.Vector3(0, 0, (LATTICE_CONSTANT / 2 * HCP_C_RATIO) / 2);
    } else {
        const centerAtom = latticeAtomsGroup.children.find(c => c.userData.isCenter);
        center = centerAtom ? centerAtom.position.clone() : new THREE.Vector3(LATTICE_CONSTANT / 2, LATTICE_CONSTANT / 2, LATTICE_CONSTANT / 2);
    }
    
    latticeAtomsGroup.children.forEach(child => {
        if(child.isMesh) {
            const originalPos = child.userData.originalPosition;
            if (!originalPos) {
                child.userData.originalPosition = child.position.clone();
            }
            if(!child.userData.isCenter) {
                const direction = new THREE.Vector3().subVectors(child.userData.originalPosition, center);
                child.position.copy(center).addScaledVector(direction, expansion);
            }
        }
    });
    updateCoordinationLines();
}

function updateCoordinationLines() {
    if (appState.latticeDisplayMode !== 'coordination') return;
    coordinationLinesGroup.children.forEach(line => {
        const center = line.userData.centerAtom;
        const neighbor = line.userData.neighborAtom;
        const positions = line.geometry.attributes.position;
        positions.setXYZ(0, center.position.x, center.position.y, center.position.z);
        positions.setXYZ(1, neighbor.position.x, neighbor.position.y, neighbor.position.z);
        positions.needsUpdate = true;
    });
}


// --- FUNGSI PEMBENTUKAN ATOM ---
function buildAtomFromState() {
    clearAtom(); 
    const p = appState.protons; const n = appState.neutrons; const e = appState.electrons;
    for (let i=0; i<p; i++) { const pr = createParticle('proton'); protons.push(pr); atomGroup.add(pr); }
    for (let i=0; i<n; i++) { const ne = createParticle('neutron'); neutrons.push(ne); atomGroup.add(ne); }
    for (let i=0; i<e; i++) { const el = createElectron(i); electronObjects.push(el); atomGroup.add(el.mesh, el.orbit); }
    arrangeNucleons(); updateInfoPanel();
}

function clearAtom() {
    while(atomGroup.children.length > 0) atomGroup.remove(atomGroup.children[0]);
    protons = []; neutrons = []; electronObjects = [];
}

function createParticle(type) { return type === 'proton' ? new THREE.Mesh(protonGeometry, protonMaterial) : new THREE.Mesh(neutronGeometry, neutronMaterial); }

function createElectron(index) {
    const mesh = new THREE.Mesh(electronGeometry, electronMaterial);
    const shellIndex = ELECTRON_SHELLS.findIndex(capacity => index < capacity);
    const orbitRadius = 5 + shellIndex * 2.5;
    const angle = Math.random() * Math.PI * 2; const speed = 0.01 / (shellIndex + 1);
    const orbitGeometry = new THREE.TorusGeometry(orbitRadius, 0.05, 16, 100);
    const isLightMode = document.body.classList.contains('light-mode');
    const orbitColor = isLightMode ? 0xAAAAAA : 0x444444;
    const orbitMaterial = new THREE.LineBasicMaterial({ color: orbitColor });
    const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbit.rotation.set(appState.is3DView ? Math.random()*Math.PI : Math.PI/2, appState.is3DView ? Math.random()*Math.PI : 0, appState.is3DView ? Math.random()*Math.PI : 0);
    return { mesh, orbit, orbitRadius, angle, speed };
}

function arrangeNucleons() {
    const nucleons = [...protons, ...neutrons]; if (nucleons.length === 0) return;
    if (appState.isNucleusStructured) {
        const spacing = PARTICLE_RADIUS * 2.5, n = nucleons.length, side = Math.ceil(Math.cbrt(n)), offset = -(side-1)*spacing/2;
        let i=0; for (let z=0; z<side; z++) for (let y=0; y<side; y++) for (let x=0; x<side; x++) if(i<n) nucleons[i++].position.set(offset+x*spacing, offset+y*spacing, offset+z*spacing);
    } else if (appState.isNucleusSeparated) {
        const radius = NUCLEUS_SEPARATION_FACTOR * 2;
        nucleons.forEach((nuc, i) => { const phi = Math.acos(-1+(2*i)/nucleons.length), theta = Math.sqrt(nucleons.length*Math.PI)*phi; nuc.position.set(radius*Math.cos(theta)*Math.sin(phi), radius*Math.sin(theta)*Math.sin(phi), radius*Math.cos(phi)); });
    } else {
        const d = PARTICLE_RADIUS * 2; if (nucleons.length === 1) { nucleons[0].position.set(0,0,0); return; }
        let pos = [new THREE.Vector3(0,0,0)];
        for (let i=1; i<nucleons.length; i++) { let best = null, minD=Infinity;
            for (let j=0; j<pos.length; j++) {
                for (let k=0; k<12; k++) {
                    const phi=Math.acos(1-2*(k+0.5)/12), theta=Math.PI*(1+Math.sqrt(5))*(k+0.5);
                    const dir = new THREE.Vector3(Math.cos(theta)*Math.sin(phi), Math.sin(theta)*Math.sin(phi), Math.cos(phi));
                    const test = new THREE.Vector3().addVectors(pos[j], dir.multiplyScalar(d));
                    if (pos.some(p => test.distanceToSquared(p) < (d*0.99)**2)) continue;
                    const distSq = test.lengthSq(); if (distSq < minD) { minD = distSq; best = test; }
                }
            } pos.push(best || new THREE.Vector3(i*d,0,0));
        }
        const c = new THREE.Vector3(); pos.forEach(p => c.add(p)); c.divideScalar(pos.length); pos.forEach(p => p.sub(c));
        nucleons.forEach((n,i) => n.position.copy(pos[i])); if(appState.isNucleusExpanded) nucleons.forEach(n=>n.position.multiplyScalar(appState.nucleusExpansionFactor));
    }
}


// --- FUNGSI KONTROL & INTERAKSI ---
function updateParticleCount(type, delta) {
    let val = appState[type] + delta;
    if((type==='protons'&&(val<1||val>MAX_PROTONS))||(type==='neutrons'&&(val<0||val>MAX_NEUTRONS))||(type==='electrons'&&(val<0||val>MAX_ELECTRONS))) return;
    appState[type] = val; if(type==='protons') appState.electrons = Math.min(MAX_ELECTRONS, Math.max(0, appState.electrons+delta)); buildAtomFromState();
}

function resetAtom() {
    Object.assign(appState, {protons:1, neutrons:0, electrons:1, isNucleusSeparated:false, isNucleusStructured:false, isNucleusExpanded:false, nucleusExpansionFactor:1.0, is3DView:true});
    domElements.atomExpansionSlider.value=1; domElements.viewToggleText.textContent='2D'; updateUINucleusModes(); buildAtomFromState();
}

function toggleNucleusSeparation(){const o=appState.isNucleusSeparated; setAllNucleusModesOff(); if(!o)appState.isNucleusSeparated=true; updateUINucleusModes(); arrangeNucleons();}
function toggleNucleusStructure(){const o=appState.isNucleusStructured; setAllNucleusModesOff(); if(!o)appState.isNucleusStructured=true; updateUINucleusModes(); arrangeNucleons();}
function toggleNucleusExpansion(){const o=appState.isNucleusExpanded; setAllNucleusModesOff(); if(!o)appState.isNucleusExpanded=true; updateUINucleusModes(); arrangeNucleons();}
function setAllNucleusModesOff(){appState.isNucleusSeparated=false; appState.isNucleusStructured=false; appState.isNucleusExpanded=false;}

function updateUINucleusModes() {
    domElements.toggleNucleus.textContent=appState.isNucleusSeparated?'Satukan Inti':'Pisahkan Inti'; domElements.toggleNucleus.disabled=appState.isNucleusStructured||appState.isNucleusExpanded;
    domElements.structureToggleBtn.classList.toggle('active', appState.isNucleusStructured); domElements.expansionToggleBtn.classList.toggle('active', appState.isNucleusExpanded);
    const el = domElements.atomExpansionSliderContainer;
    if(appState.isNucleusExpanded){el.classList.remove('hidden'); setTimeout(()=>el.classList.remove('opacity-0'),10);}else{el.classList.add('opacity-0'); setTimeout(()=>el.classList.add('hidden'),300);}
}

function handleAtomExpansionSlider(e){appState.nucleusExpansionFactor=parseFloat(e.target.value); arrangeNucleons();}
function toggleViewMode(){appState.is3DView=!appState.is3DView; domElements.viewToggleText.textContent=appState.is3DView?'2D':'3D'; buildAtomFromState();}
function toggleOutlineVisibility(){appState.isUnitCellVisible=!appState.isUnitCellVisible; if(unitCellOutline)unitCellOutline.visible=appState.isUnitCellVisible; domElements.toggleOutlineBtn.textContent=appState.isUnitCellVisible?'Sembunyikan Sel':'Tampilkan Sel';}
function zoom(factor){camera.position.multiplyScalar(factor);}
function toggleTheme(){document.body.classList.toggle('light-mode'); updateThemeUI();}

function updateThemeUI(isInitial = false) {
     const isLightMode = document.body.classList.contains('light-mode');
     if(!isInitial) { 
        const orbitColor = isLightMode ? 0xAAAAAA : 0x444444; const outlineColor = isLightMode ? 0x374151 : 0x9ca3af;
        atomGroup.children.forEach(c=>{if(c.material&&c.material.isLineBasicMaterial)c.material.color.setHex(orbitColor);});
        if (unitCellOutline) unitCellOutline.material.color.setHex(outlineColor);
        if (multiCellOutlines) multiCellOutlines.children.forEach(c => c.material.color.setHex(outlineColor));
     }
    domElements.sunIcon.classList.toggle('hidden', isLightMode); domElements.moonIcon.classList.toggle('hidden', !isLightMode);
}

function toggleInfoPanel(){const c=domElements.infoPanel.classList.toggle('collapsed-side-right'); domElements.showInfoBtn.classList.toggle('hidden',!c); domElements.infoArrow.classList.toggle('rotate-180');}
function toggleLatticeControlsPanel(){const c=domElements.latticeControlsPanel.classList.toggle('collapsed-side-left'); domElements.showLatticeControlsBtn.classList.toggle('hidden',!c); domElements.latticeControlsArrow.classList.toggle('rotate-180');}
function toggleLatticeInfoPanel(){const c=domElements.latticeInfoPanel.classList.toggle('collapsed-side-right'); domElements.showLatticeInfoBtn.classList.toggle('hidden',!c); domElements.latticeInfoArrow.classList.toggle('rotate-180');}
function togglePeriodicTable(){domElements.periodicTableModal.classList.toggle('hidden');}
function toggleAboutModal(){domElements.aboutModal.classList.toggle('hidden');}

function showPerformanceWarning(atomicNumber, neutronCount) {
    togglePeriodicTable(); const btn = domElements.continueWarningBtn; btn.dataset.atomicNumber=atomicNumber; btn.dataset.neutronCount=neutronCount; btn.disabled=true;
    btn.innerHTML=`Lanjutkan (<span id="countdown-timer">5</span>)`; domElements.performanceWarningModal.classList.remove('hidden'); let count=5; const timer=document.getElementById('countdown-timer');
    if(countdownInterval)clearInterval(countdownInterval);
    countdownInterval=setInterval(()=>{count--; timer.textContent=count; if(count<=0){clearInterval(countdownInterval);btn.disabled=false;btn.textContent='Lanjutkan';}},1000);
}

function cancelWarning(){if(countdownInterval)clearInterval(countdownInterval); domElements.performanceWarningModal.classList.add('hidden');}
function continueWarning(){const btn = domElements.continueWarningBtn; const p=parseInt(btn.dataset.atomicNumber),n=parseInt(btn.dataset.neutronCount); if(!isNaN(p)&&!isNaN(n)){appState.protons=p;appState.neutrons=n;appState.electrons=p;buildAtomFromState();}cancelWarning();}

// --- FUNGSI PEMBANTU & UI ---
function populatePeriodicTable(){const grid=domElements.periodicTableGrid;const layout=[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,4,0,0,0,0,0,0,0,0,0,0,5,6,7,8,9,10,11,12,0,0,0,0,0,0,0,0,0,0,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,58,59,60,61,62,63,64,65,66,67,68,69,70,71,0,0,0,0,90,91,92,93,94,95,96,97,98,99,100,101,102,103,0];grid.innerHTML='';layout.forEach(num=>{const cell=document.createElement('div');if(num>0&&ELEMENT_DATA[num]){const d=ELEMENT_DATA[num];cell.className=`element-cell p-1 rounded-md cursor-pointer cat-${d.type}`;cell.dataset.atomicNumber=num;cell.title=d.name;cell.innerHTML=`<div class="font-bold text-sm">${d.symbol}</div><div class="text-xs">${num}</div>`;cell.addEventListener('click',()=>{if(num>=PERFORMANCE_THRESHOLD){showPerformanceWarning(num,d.commonNeutrons);}else{appState.protons=num;appState.neutrons=d.commonNeutrons;appState.electrons=num;buildAtomFromState();togglePeriodicTable();}});}else if(num===57||num===89){const type=num===57?'lanthanide':'actinide';cell.className=`p-1 rounded-md cat-${type} flex items-center justify-center`;cell.innerHTML=`<div class="text-xs">${num===57?'57-71':'89-103'}</div>`;}grid.appendChild(cell);});}
function updateInfoPanel(){const p=appState.protons;if(p===0)return;const n=appState.neutrons,m=p+n,d=ELEMENT_DATA[p]||{name:`Unsur #${p}`,phase:'-',usage:'-',stableNeutrons:[]},c=p-appState.electrons;domElements.elementName.textContent=d.name;domElements.atomicNumber.textContent=p;domElements.massNumber.textContent=m;domElements.isotopeName.textContent=`${d.name}-${m}`;domElements.elementPhase.textContent=d.phase;domElements.elementUsage.textContent=d.usage;domElements.charge.textContent=c>0?`+${c}`:c;domElements.electronConfigString.innerHTML=d.config||'-';const s=domElements.coreStability;if(p>83){s.textContent='Radioaktif';s.className='font-bold stability-tidak-stabil';}else{const t=d.stableNeutrons.includes(n);s.textContent=t?'Stabil':'Tidak Stabil';s.className=`font-bold ${t?'stability-stabil':'stability-tidak-stabil'}`;}}

function updateLatticeInfoPanel() {
    const type = appState.latticeType;
    const data = LATTICE_DEFINITIONS[type];
    if (!data) return;

    domElements.latticeCoordinationNumber.textContent = data.coordinationNumber;
    domElements.latticeApf.textContent = data.apf;
    domElements.latticeParameterRelation.innerHTML = data.relation;
    
    const calc = data.contribution_calc;
    const section = domElements.latticeContributionSection;
    const isContributionMode = appState.latticeDisplayMode === 'contribution';
    section.style.display = isContributionMode ? 'block' : 'none';

    if(isContributionMode && calc) {
        if (type === 'hcp') {
             domElements.contributionCorners.textContent = 'Perhitungan HCP kompleks';
             domElements.contributionFaces.textContent = '';
             domElements.contributionBody.textContent = '';
        } else {
            domElements.contributionCorners.textContent = `Sudut: ${calc.corners} × 1/8 = ${calc.corners / 8}`;
            domElements.contributionFaces.textContent = calc.faces > 0 ? `Sisi: ${calc.faces} × 1/2 = ${calc.faces / 2}`: '';
            domElements.contributionBody.textContent = calc.body > 0 ? `Pusat: ${calc.body} × 1 = ${calc.body}`: '';
        }
        domElements.contributionTotal.textContent = `Total: ${calc.total} atom/sel`;
    }
}

function cacheDOMElements(){const ids=['bg','title-panel','main-title','main-subtitle','mode-switch-btn','atom-sim-ui','lattice-sim-ui','info-panel','show-info-btn','element-name','atomic-number','mass-number','charge','isotope-name','core-stability','element-phase','element-usage','electron-config-string','view-toggle-text','sun-icon','moon-icon','structure-toggle-btn','expansion-toggle-btn','atom-expansion-slider-container','atom-expansion-slider','toggle-nucleus','periodic-table-modal','performance-warning-modal','continue-warning-btn','periodic-table-grid','info-header','info-arrow','periodic-table-backdrop','cancel-warning-btn','add-proton','add-neutron','add-electron','remove-proton','remove-neutron','remove-electron','reset-atom','periodic-table-btn','theme-toggle-btn','view-toggle-btn','zoom-in-btn','zoom-out-btn','about-btn','about-modal','close-about-btn','about-modal-backdrop','lattice-controls-panel','lattice-type-select','lattice-display-controls','lattice-expansion-slider-container','lattice-expansion-slider','lattice-info-panel','lattice-coordination-number','lattice-apf','lattice-parameter-relation','toggle-outline-btn','lattice-controls-header','show-lattice-controls-btn','lattice-info-header','show-lattice-info-btn','lattice-controls-arrow','lattice-info-arrow','lattice-controls-content','lattice-info-content','lattice-contribution-section','contribution-corners','contribution-faces','contribution-body','contribution-total'];ids.forEach(id=>{const c=id.replace(/-([a-z])/g,g=>g[1].toUpperCase());domElements[c]=document.getElementById(id);});}
function setupEventListeners(){window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});domElements.modeSwitchBtn.addEventListener('click',toggleSimulationMode);domElements.addProton.addEventListener('click',()=>updateParticleCount('protons',1));domElements.addNeutron.addEventListener('click',()=>updateParticleCount('neutrons',1));domElements.addElectron.addEventListener('click',()=>updateParticleCount('electrons',1));domElements.removeProton.addEventListener('click',()=>updateParticleCount('protons',-1));domElements.removeNeutron.addEventListener('click',()=>updateParticleCount('neutrons',-1));domElements.removeElectron.addEventListener('click',()=>updateParticleCount('electrons',-1));domElements.toggleNucleus.addEventListener('click',toggleNucleusSeparation);domElements.resetAtom.addEventListener('click',resetAtom);domElements.periodicTableBtn.addEventListener('click',togglePeriodicTable);domElements.structureToggleBtn.addEventListener('click',toggleNucleusStructure);domElements.expansionToggleBtn.addEventListener('click',toggleNucleusExpansion);domElements.themeToggleBtn.addEventListener('click',toggleTheme);domElements.viewToggleBtn.addEventListener('click',toggleViewMode);domElements.zoomInBtn.addEventListener('click',()=>zoom(0.8));domElements.zoomOutBtn.addEventListener('click',()=>zoom(1.2));domElements.infoHeader.addEventListener('click',toggleInfoPanel);domElements.showInfoBtn.addEventListener('click',toggleInfoPanel);domElements.periodicTableBackdrop.addEventListener('click',togglePeriodicTable);domElements.cancelWarningBtn.addEventListener('click',cancelWarning);domElements.continueWarningBtn.addEventListener('click',continueWarning);domElements.atomExpansionSlider.addEventListener('input',handleAtomExpansionSlider);domElements.latticeTypeSelect.addEventListener('change',(e)=>{appState.latticeType=e.target.value;initLatticeMode();});domElements.latticeExpansionSlider.addEventListener('input',(e)=>{appState.latticeExpansion=parseFloat(e.target.value);applyLatticeExpansion();});document.querySelectorAll('input[name="lattice-display"]').forEach(r=>{r.addEventListener('change',(e)=>{appState.latticeDisplayMode=e.target.value;buildLattice();});});domElements.toggleOutlineBtn.addEventListener('click',toggleOutlineVisibility);domElements.latticeControlsHeader.addEventListener('click',toggleLatticeControlsPanel);domElements.showLatticeControlsBtn.addEventListener('click',toggleLatticeControlsPanel);domElements.latticeInfoHeader.addEventListener('click',toggleLatticeInfoPanel);domElements.showLatticeInfoBtn.addEventListener('click',toggleLatticeInfoPanel);domElements.aboutBtn.addEventListener('click',toggleAboutModal);domElements.closeAboutBtn.addEventListener('click',toggleAboutModal);domElements.aboutModalBackdrop.addEventListener('click',toggleAboutModal);}
document.addEventListener('DOMContentLoaded',init);
