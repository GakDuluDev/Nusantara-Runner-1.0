import * as THREE from 'three';

export interface PlayerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  head: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shieldMesh: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

export type ObstacleKind =
  | 'motor'
  | 'angkot'
  | 'mobil'
  | 'bus'
  | 'truk'
  | 'portal';

export interface ObstacleInstance {
  group: THREE.Group;
  kind: ObstacleKind;
  lane: number; // 0, 1, 2
  canJump: boolean;
  mustSlide: boolean;
  speedOffset: number; // 0 = stationary, >0 = moving toward player
  halfWidth: number;
  height: number;
  halfDepth: number;
  bottomClearance: number; // > 0 for overhead portal
  honked: boolean;
  wheels: THREE.Object3D[];
}

export interface GateInstance {
  group: THREE.Group;
  z: number;
  resolved: boolean;
  laneCorrectMap: [boolean, boolean, boolean];
  disposables: { dispose: () => void }[];
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  return tex;
}

export function createRoadTextures(maxAnisotropy: number) {
  const asphaltTex = makeCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#2d333d';
      ctx.fillRect(0, 0, w, h);

      // Subtle asphalt grain
      for (let i = 0; i < 4500; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const v = 35 + Math.floor(Math.random() * 28);
        ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
        ctx.fillRect(x, y, 2, 2);
      }

      // Yellow Indonesian shoulder lines
      ctx.fillStyle = '#facc15';
      ctx.fillRect(14, 0, 12, h);
      ctx.fillRect(w - 26, 0, 12, h);

      // Dashed white lane dividers (3 lanes)
      ctx.fillStyle = '#f8fafc';
      const dashLen = 110;
      const gap = 146;
      for (let y = 18; y < h; y += dashLen + gap) {
        ctx.fillRect(Math.floor(w / 3) - 6, y, 12, dashLen);
        ctx.fillRect(Math.floor((w * 2) / 3) - 6, y, 12, dashLen);
      }
    },
    maxAnisotropy,
    1,
    12,
  );

  const sidewalkTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      const step = 64;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    },
    maxAnisotropy,
    2,
    40,
  );

  const curbTex = makeCanvasTexture(
    128,
    512,
    (ctx, w, h) => {
      const stripe = 64;
      for (let y = 0; y < h; y += stripe) {
        ctx.fillStyle = (y / stripe) % 2 === 0 ? '#dc2626' : '#f8fafc';
        ctx.fillRect(0, y, w, stripe);
      }
    },
    maxAnisotropy,
    1,
    20,
  );

  const portalTex = makeCanvasTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      for (let x = -h; x < w + h; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 32, h);
        ctx.lineTo(x + 32 + h * 0.6, 0);
        ctx.lineTo(x + h * 0.6, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(w * 0.25, h * 0.16, w * 0.5, h * 0.68);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.strokeRect(w * 0.25, h * 0.16, w * 0.5, h * 0.68);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AWAS! SLIDE ↓', w / 2, h / 2 + 2);
    },
    maxAnisotropy,
  );

  const highwaySignTex = makeCanvasTexture(
    512,
    160,
    (ctx, w, h) => {
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PANTURA  ↑  JAKARTA', w / 2, 66);
      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText('BANDUNG  ·  SURABAYA', w / 2, 118);
    },
    maxAnisotropy,
  );

  const contactShadowTex = makeCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        8,
        w / 2,
        h / 2,
        w / 2,
      );
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    1,
  );

  return {
    asphaltTex,
    sidewalkTex,
    curbTex,
    portalTex,
    highwaySignTex,
    contactShadowTex,
  };
}

export function createPlayerModel(contactShadowTex: THREE.Texture): PlayerRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe2a878,
    roughness: 0.65,
    metalness: 0.05,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.8,
    metalness: 0.02,
  });
  const tieMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.7,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.78,
    metalness: 0.05,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.1,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.15,
  });
  const packMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.6,
    metalness: 0.08,
  });

  // Torso (SMA uniform)
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.72, 0.36),
    shirtMat,
  );
  torso.position.y = 1.18;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // SMA grey pocket & tie badge
  const pocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.03),
    tieMat,
  );
  pocket.position.set(0.16, 1.28, -0.185);
  bodyGroup.add(pocket);

  // Backpack
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.56, 0.24),
    packMat,
  );
  backpack.position.set(0, 1.2, 0.27);
  backpack.castShadow = true;
  bodyGroup.add(backpack);

  // Head + Hair
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 18, 16),
    skinMat,
  );
  head.position.y = 1.78;
  head.castShadow = true;
  bodyGroup.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hairCap.position.y = 1.81;
  hairCap.rotation.x = 0.2;
  bodyGroup.add(hairCap);

  // Arms
  const makeArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.48, 0);
    const sleeve = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.28, 0.18),
      shirtMat,
    );
    sleeve.position.y = -0.14;
    sleeve.castShadow = true;
    pivot.add(sleeve);
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.06, 0.3, 10),
      skinMat,
    );
    forearm.position.y = -0.38;
    forearm.castShadow = true;
    pivot.add(forearm);
    bodyGroup.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-0.42);
  const rightArm = makeArm(0.42);

  // Legs
  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.84, 0);
    const legMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.66, 0.22),
      pantsMat,
    );
    legMesh.position.y = -0.34;
    legMesh.castShadow = true;
    pivot.add(legMesh);

    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.15, 0.34),
      shoeMat,
    );
    shoe.position.set(0, -0.74, -0.05);
    shoe.castShadow = true;
    pivot.add(shoe);

    bodyGroup.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-0.17);
  const rightLeg = makeLeg(0.17);

  // Shield Aura
  const shieldMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.18, 24, 18),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.28,
      roughness: 0.15,
      metalness: 0.4,
      depthWrite: false,
    }),
  );
  shieldMesh.position.y = 1.08;
  shieldMesh.visible = false;
  shieldMesh.renderOrder = 4;
  root.add(shieldMesh);

  // Contact shadow on ground
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    shieldMesh,
    contactShadow,
  };
}

function addWheel(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  width: number,
): THREE.Group {
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(x, y, z);

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 16),
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheelGroup.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 12),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.25,
      metalness: 0.85,
    }),
  );
  rim.rotation.z = Math.PI / 2;
  wheelGroup.add(rim);

  parent.add(wheelGroup);
  return wheelGroup;
}

export function createScooterObstacle(lane: number): ObstacleInstance {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const bodyColors = [0xef4444, 0x0f172a, 0x0ea5e9, 0xf8fafc];
  const paintColor = bodyColors[Math.floor(Math.random() * bodyColors.length)];

  const paintMat = new THREE.MeshStandardMaterial({
    color: paintColor,
    roughness: 0.25,
    metalness: 0.45,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
    metalness: 0.1,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.9,
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });

  // Lower deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 1.45), darkMat);
  deck.position.set(0, 0.36, 0);
  deck.castShadow = true;
  group.add(deck);

  // Rear body fairing
  const rearBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.4, 0.82),
    paintMat,
  );
  rearBody.position.set(0, 0.62, 0.28);
  rearBody.castShadow = true;
  group.add(rearBody);

  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.72), darkMat);
  seat.position.set(0, 0.86, 0.24);
  group.add(seat);

  // Front shield & steering column
  const frontShield = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.72, 0.26),
    paintMat,
  );
  frontShield.position.set(0, 0.74, -0.52);
  frontShield.rotation.x = 0.18;
  frontShield.castShadow = true;
  group.add(frontShield);

  // Handlebar
  const handlebar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.74, 8),
    chromeMat,
  );
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.16, -0.56);
  group.add(handlebar);

  // Headlight facing player (+Z or -Z depending on orientation; vehicles face player along +Z)
  const headlight = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.14, 0.08),
    lampMat,
  );
  headlight.position.set(0, 0.96, 0.69);
  group.add(headlight);

  // Rider helmet hint / mirror
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.62, 8),
    chromeMat,
  );
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.32, 0.34, 0.34);
  group.add(exhaust);

  wheels.push(addWheel(group, 0, 0.24, -0.58, 0.24, 0.14));
  wheels.push(addWheel(group, 0, 0.24, 0.56, 0.24, 0.16));

  // Orient facing player (+Z)
  group.rotation.y = Math.PI;

  return {
    group,
    kind: 'motor',
    lane,
    canJump: true,
    mustSlide: false,
    speedOffset: 0,
    halfWidth: 0.48,
    height: 1.25,
    halfDepth: 0.95,
    bottomClearance: 0,
    honked: false,
    wheels,
  };
}

export function createCarOrAngkotObstacle(
  kind: 'angkot' | 'mobil',
  lane: number,
): ObstacleInstance {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const isAngkot = kind === 'angkot';
  const carPalette = [0xf8fafc, 0x94a3b8, 0xdc2626, 0x1e293b];
  const bodyColor = isAngkot
    ? 0x0284c7
    : carPalette[Math.floor(Math.random() * carPalette.length)];

  const paintMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.24,
    metalness: 0.5,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: isAngkot ? 0xfacc15 : 0x1e293b,
    roughness: 0.72,
    metalness: 0.1,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.85,
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  // Main chassis
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.78, 0.72, 3.65),
    paintMat,
  );
  chassis.position.set(0, 0.62, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.66, isAngkot ? 0.72 : 0.56, isAngkot ? 2.85 : 2.05),
    paintMat,
  );
  cabin.position.set(0, isAngkot ? 1.32 : 1.24, isAngkot ? 0.15 : 0.18);
  cabin.castShadow = true;
  group.add(cabin);

  // Angkot yellow/white stripe or car bumper trim
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, 0.14, 3.68),
    trimMat,
  );
  stripe.position.set(0, 0.52, 0);
  group.add(stripe);

  // Front windshield
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, isAngkot ? 0.52 : 0.44, 0.08),
    glassMat,
  );
  windshield.position.set(0, isAngkot ? 1.32 : 1.24, isAngkot ? -1.26 : -0.84);
  group.add(windshield);

  // Side windows
  const sideWin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, isAngkot ? 0.42 : 0.36, isAngkot ? 2.2 : 1.65),
    glassMat,
  );
  sideWin.position.set(0, isAngkot ? 1.34 : 1.25, isAngkot ? 0.22 : 0.2);
  group.add(sideWin);

  // Angkot roof route board
  if (isAngkot) {
    const routeBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.2, 0.34),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        roughness: 0.4,
      }),
    );
    routeBoard.position.set(0, 1.76, -0.95);
    group.add(routeBoard);
  }

  // Headlights (front = -Z)
  [-0.6, 0.6].forEach((x) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), lampMat);
    hl.position.set(x, 0.66, -1.84);
    group.add(hl);
  });

  // 4 wheels
  const wheelZ = [-1.1, 1.1];
  const wheelX = [-0.88, 0.88];
  wheelZ.forEach((wz) =>
    wheelX.forEach((wx) =>
      wheels.push(addWheel(group, wx, 0.34, wz, 0.34, 0.22)),
    ),
  );

  return {
    group,
    kind,
    lane,
    canJump: true,
    mustSlide: false,
    speedOffset: 0,
    halfWidth: 0.94,
    height: isAngkot ? 1.72 : 1.56,
    halfDepth: 1.85,
    bottomClearance: 0,
    honked: false,
    wheels,
  };
}

export function createBusOrTruckObstacle(
  kind: 'bus' | 'truk',
  lane: number,
): ObstacleInstance {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const isBus = kind === 'bus';

  const busColors = [0xea580c, 0xdc2626, 0x1d4ed8];
  const primaryColor = isBus
    ? busColors[Math.floor(Math.random() * busColors.length)]
    : 0xf59e0b;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.3,
    metalness: 0.45,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: isBus ? 0xf8fafc : 0x16a34a,
    roughness: 0.65,
    metalness: 0.15,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.88,
  });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });

  if (isBus) {
    // Tall AKAP Bus body
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.26, 2.55, 6.2),
      primaryMat,
    );
    hull.position.set(0, 1.72, 0);
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    // White livery stripe
    const livery = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.36, 6.22),
      secondaryMat,
    );
    livery.position.set(0, 1.15, 0);
    group.add(livery);

    // Panoramic front windshield
    const frontGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.06, 1.28, 0.1),
      glassMat,
    );
    frontGlass.position.set(0, 2.02, -3.08);
    group.add(frontGlass);

    // Side passenger windows
    const sideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.85, 5.2),
      glassMat,
    );
    sideGlass.position.set(0, 2.18, 0.25);
    group.add(sideGlass);

    // Roof AC pods
    [-1.4, 0.8].forEach((zPos) => {
      const ac = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.28, 1.25),
        secondaryMat,
      );
      ac.position.set(0, 3.12, zPos);
      group.add(ac);
    });
  } else {
    // Indonesian Cargo Truck (yellow cab + tall box container)
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.8, 1.85),
      primaryMat,
    );
    cab.position.set(0, 1.32, -2.0);
    cab.castShadow = true;
    group.add(cab);

    const cabGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.72, 0.1),
      glassMat,
    );
    cabGlass.position.set(0, 1.65, -2.9);
    group.add(cabGlass);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.26, 2.48, 4.35),
      secondaryMat,
    );
    cargoBox.position.set(0, 1.78, 1.15);
    cargoBox.castShadow = true;
    cargoBox.receiveShadow = true;
    group.add(cargoBox);

    // Reflective safety bar
    const safetyStrip = new THREE.Mesh(
      new THREE.BoxGeometry(2.28, 0.22, 4.38),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.4,
        metalness: 0.3,
      }),
    );
    safetyStrip.position.set(0, 0.72, 1.15);
    group.add(safetyStrip);
  }

  // Headlights
  [-0.75, 0.75].forEach((x) => {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.2, 0.1),
      lampMat,
    );
    hl.position.set(x, 0.74, isBus ? -3.1 : -2.94);
    group.add(hl);
  });

  // 6 wheels
  [-1.95, 0.8, 2.1].forEach((wz) => {
    [-1.06, 1.06].forEach((wx) =>
      wheels.push(addWheel(group, wx, 0.44, wz, 0.44, 0.28)),
    );
  });

  return {
    group,
    kind,
    lane,
    canJump: false,
    mustSlide: false,
    speedOffset: 0,
    halfWidth: 1.16,
    height: 3.15,
    halfDepth: 3.1,
    bottomClearance: 0,
    honked: false,
    wheels,
  };
}

export function createOverheadPortalObstacle(
  lane: number,
  portalTex: THREE.Texture,
): ObstacleInstance {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.35,
    metalness: 0.75,
  });
  const signMat = new THREE.MeshStandardMaterial({
    map: portalTex,
    roughness: 0.45,
    metalness: 0.1,
  });

  // Side pillars (outside collision core, still grounded)
  [-1.32, 1.32].forEach((x) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 2.9, 10),
      steelMat,
    );
    pillar.position.set(x, 1.45, 0);
    pillar.castShadow = true;
    group.add(pillar);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.22, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }),
    );
    base.position.set(x, 0.11, 0);
    group.add(base);
  });

  // Overhead barrier beam: bottom edge at y = 1.22 (standing player hits it, sliding player passes cleanly under!)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.92, 0.36), signMat);
  beam.position.set(0, 1.68, 0);
  beam.castShadow = true;
  group.add(beam);

  // Top truss
  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.14, 0.4),
    steelMat,
  );
  topBar.position.set(0, 2.84, 0);
  group.add(topBar);

  return {
    group,
    kind: 'portal',
    lane,
    canJump: false,
    mustSlide: true,
    speedOffset: 0,
    halfWidth: 1.2,
    height: 2.85,
    halfDepth: 0.45,
    bottomClearance: 1.22,
    honked: true,
    wheels: [],
  };
}

export function createQuizGates(
  z: number,
  laneXs: [number, number, number],
  options: { label: 'A' | 'B' | 'C'; text: string; isCorrect: boolean }[],
  maxAnisotropy: number,
): GateInstance {
  const group = new THREE.Group();
  group.position.z = z;
  const disposables: { dispose: () => void }[] = [];

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.7,
  });
  disposables.push(frameMat);

  const labelColors = ['#0284c7', '#7c3aed', '#0d9488'];

  options.forEach((opt, i) => {
    const gateGroup = new THREE.Group();
    gateGroup.position.x = laneXs[i];

    // Arch posts
    const postGeo = new THREE.CylinderGeometry(0.09, 0.1, 3.2, 8);
    disposables.push(postGeo);
    [-1.28, 1.28].forEach((px) => {
      const post = new THREE.Mesh(postGeo, frameMat);
      post.position.set(px, 1.6, 0);
      gateGroup.add(post);
    });

    // Translucent glowing field
    const tex = makeCanvasTexture(
      384,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = labelColors[i];
        ctx.lineWidth = 10;
        ctx.strokeRect(6, 6, w - 12, h - 12);

        // Top label badge A / B / C
        ctx.fillStyle = labelColors[i];
        ctx.fillRect(16, 16, 74, 62);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opt.label, 53, 49);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('JALUR ' + (i === 0 ? 'KIRI' : i === 1 ? 'TENGAH' : 'KANAN'), 108, 49);

        // Wrap option text cleanly
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 24px sans-serif';
        const words = opt.text.split(' ');
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > w - 44 && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        const startY = 116;
        lines.slice(0, 4).forEach((ln, idx) => {
          ctx.fillText(ln, 22, startY + idx * 32);
        });
      },
      maxAnisotropy,
    );
    disposables.push(tex);

    const panelGeo = new THREE.PlaneGeometry(2.44, 1.75);
    const panelMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposables.push(panelGeo, panelMat);

    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 2.05, 0);
    panel.renderOrder = 5;
    gateGroup.add(panel);

    // Lower energy curtain
    const curtainGeo = new THREE.PlaneGeometry(2.44, 1.18);
    const curtainMat = new THREE.MeshBasicMaterial({
      color: labelColors[i],
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    disposables.push(curtainGeo, curtainMat);
    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.position.set(0, 0.59, 0);
    curtain.renderOrder = 4;
    gateGroup.add(curtain);

    group.add(gateGroup);
  });

  return {
    group,
    z,
    resolved: false,
    laneCorrectMap: [
      options[0].isCorrect,
      options[1].isCorrect,
      options[2].isCorrect,
    ],
    disposables,
  };
}

export function createRoadsideSegment(
  zPos: number,
  highwaySignTex: THREE.Texture,
  withSign: boolean,
): THREE.Group {
  const seg = new THREE.Group();
  seg.position.z = zPos;

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.9,
    metalness: 0.02,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.72,
    metalness: 0.04,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.35,
    metalness: 0.78,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });

  const sides = [-1, 1];
  sides.forEach((side, idx) => {
    const baseX = side * 7.8;

    // Palm / Ketapang tree
    const tree = new THREE.Group();
    tree.position.set(baseX, 0, -6 + idx * 8);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 4.2, 8),
      trunkMat,
    );
    trunk.position.y = 2.1;
    trunk.castShadow = true;
    tree.add(trunk);

    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 1.9, 6),
        leafMat,
      );
      const angle = (f / 5) * Math.PI * 2;
      frond.position.set(Math.cos(angle) * 0.55, 4.35, Math.sin(angle) * 0.55);
      frond.rotation.z = -Math.cos(angle) * 0.65;
      frond.rotation.x = Math.sin(angle) * 0.65;
      frond.castShadow = true;
      tree.add(frond);
    }
    seg.add(tree);

    // Indonesian Warung Tenda (food stall with tarp & counter)
    const warung = new THREE.Group();
    warung.position.set(side * 9.5, 0, 5 - idx * 10);
    const tarpColors = [0xea580c, 0x0284c7, 0x16a34a];
    const tarpColor = tarpColors[Math.abs(Math.round(zPos + idx)) % 3];

    const tarp = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.22, 3.8),
      new THREE.MeshStandardMaterial({ color: tarpColor, roughness: 0.78 }),
    );
    tarp.position.y = 2.65;
    tarp.rotation.z = side * 0.14;
    tarp.castShadow = true;
    warung.add(tarp);

    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.95, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 }),
    );
    counter.position.set(-side * 0.8, 0.48, 0);
    counter.castShadow = true;
    warung.add(counter);

    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      bulbMat,
    );
    lantern.position.set(-side * 0.5, 2.3, 0);
    warung.add(lantern);

    // Bamboo/steel stall poles
    [
      [-1.4, -1.6],
      [-1.4, 1.6],
      [1.4, -1.6],
      [1.4, 1.6],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6),
        poleMat,
      );
      p.position.set(px, 1.3, pz);
      warung.add(p);
    });
    seg.add(warung);

    // Street lamp
    const lamp = new THREE.Group();
    lamp.position.set(side * 6.5, 0, 0);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.11, 5.4, 8),
      poleMat,
    );
    pole.position.y = 2.7;
    lamp.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), poleMat);
    arm.position.set(-side * 0.6, 5.3, 0);
    lamp.add(arm);
    const lampHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.12, 0.25),
      bulbMat,
    );
    lampHead.position.set(-side * 1.15, 5.2, 0);
    lamp.add(lampHead);
    seg.add(lamp);

    // Colorful Ruko / Building silhouette behind sidewalk (keeps outdoor perimeter rich)
    const rukoColors = [0xfef3c7, 0xe0f2fe, 0xfce7f3, 0xdcfce7, 0xf1f5f9];
    const rukoColor = rukoColors[Math.abs(Math.round(zPos * 0.1 + idx)) % rukoColors.length];
    const rukoHeight = 6.5 + (Math.abs(Math.round(zPos + side * 7)) % 4) * 1.6;
    const ruko = new THREE.Group();
    ruko.position.set(side * 14.2, 0, idx * 4 - 2);
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, rukoHeight, 9.5),
      new THREE.MeshStandardMaterial({ color: rukoColor, roughness: 0.88 }),
    );
    building.position.y = rukoHeight / 2;
    building.receiveShadow = true;
    ruko.add(building);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, 9.2),
      new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.7 }),
    );
    awning.position.set(-side * 3.1, 3.0, 0);
    awning.rotation.z = side * 0.22;
    ruko.add(awning);
    seg.add(ruko);

    // Indonesian round traffic sign
    if (idx === 0) {
      const signPost = new THREE.Group();
      signPost.position.set(side * 6.3, 0, -9);
      const sPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
        poleMat,
      );
      sPole.position.y = 1.25;
      signPost.add(sPole);
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16),
        new THREE.MeshStandardMaterial({
          color: side < 0 ? 0xfacc15 : 0xdc2626,
          roughness: 0.4,
          metalness: 0.2,
        }),
      );
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 2.45;
      signPost.add(disc);
      seg.add(signPost);
    }
  });

  if (withSign) {
    // Overhead green Indonesian highway gantry sign
    const gantry = new THREE.Group();
    [-6.3, 6.3].forEach((gx) => {
      const gp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 6.2, 10),
        poleMat,
      );
      gp.position.set(gx, 3.1, 0);
      gantry.add(gp);
    });
    const crossbar = new THREE.Mesh(
      new THREE.BoxGeometry(13.0, 0.22, 0.22),
      poleMat,
    );
    crossbar.position.y = 5.9;
    gantry.add(crossbar);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 2.0, 0.16),
      new THREE.MeshStandardMaterial({
        map: highwaySignTex,
        roughness: 0.4,
        metalness: 0.15,
      }),
    );
    board.position.set(0, 5.2, 0.14);
    gantry.add(board);
    seg.add(gantry);
  }

  return seg;
}
