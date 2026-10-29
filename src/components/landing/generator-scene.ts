import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const mix = THREE.MathUtils.lerp;
const ease = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

export function createGeneratorScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 70);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc4e1ff, 0x111b2a, 2));
  const key = new THREE.DirectionalLight(0xe4efff, 6);
  key.position.set(2, 6, 7);
  scene.add(key);
  const edge = new THREE.DirectionalLight(0x6c9cff, 5);
  edge.position.set(-5, 2, -4);
  scene.add(edge);
  const warm = new THREE.PointLight(0xe9b981, 24, 18);
  warm.position.set(5, 1, 2);
  scene.add(warm);

  const metal = new THREE.MeshStandardMaterial({
    color: 0xb8c4d3,
    metalness: 0.95,
    roughness: 0.28,
  });
  const machined = new THREE.MeshStandardMaterial({
    color: 0xe3e9f2,
    metalness: 0.97,
    roughness: 0.2,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x172331,
    metalness: 0.8,
    roughness: 0.34,
  });
  const casing = new THREE.MeshStandardMaterial({
    color: 0x586b68,
    metalness: 0.65,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: 0xc38a51,
    metalness: 0.88,
    roughness: 0.32,
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x101720,
    roughness: 0.6,
    metalness: 0.25,
  });
  const blue = new THREE.MeshStandardMaterial({
    color: 0x9dbdff,
    emissive: 0x456fd0,
    emissiveIntensity: 1.3,
    metalness: 0.3,
    roughness: 0.3,
    transparent: true,
  });
  const assembly = new THREE.Group();
  scene.add(assembly);

  function box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent = assembly,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function cylinder(
    radius: number,
    depth: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent = assembly,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 64),
      material,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function ring(
    radius: number,
    tube: number,
    material: THREE.Material,
    z: number,
    parent = assembly,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 12, 80),
      material,
    );
    mesh.position.z = z;
    parent.add(mesh);
    return mesh;
  }
  function gear(
    radius: number,
    teeth: number,
    thickness: number,
    material: THREE.Material,
  ) {
    const shape = new THREE.Shape();
    for (let i = 0; i < teeth * 4; i++) {
      const angle = (i / (teeth * 4)) * Math.PI * 2;
      const r = radius * (i % 4 === 1 || i % 4 === 2 ? 1 : 0.9);
      const x = Math.cos(angle) * r,
        y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const bore = new THREE.Path();
    bore.absarc(0, 0, radius * 0.18, 0, Math.PI * 2, true);
    shape.holes.push(bore);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const hole = new THREE.Path();
      hole.absarc(
        Math.cos(angle) * radius * 0.57,
        Math.sin(angle) * radius * 0.57,
        radius * 0.13,
        0,
        Math.PI * 2,
        true,
      );
      shape.holes.push(hole);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      curveSegments: 16,
    });
    geometry.translate(0, 0, -thickness / 2);
    return new THREE.Mesh(geometry, material);
  }

  // Open-sided generator study: frame, stator windings, rotor and removable drive gear.
  box(0.18, 0.24, 4.6, dark, -1.55, -1.7, -0.6);
  box(0.18, 0.24, 4.6, dark, 1.55, -1.7, -0.6);
  for (const z of [-2.4, 1.2]) {
    box(3.4, 0.2, 0.22, dark, 0, -1.7, z);
    for (const x of [-1.3, 1.3]) box(0.38, 0.2, 0.5, black, x, -1.95, z);
  }
  cylinder(1.47, 0.2, casing, 0, 0, -2.05);
  cylinder(0.97, 2.5, dark, 0, 0, -0.8);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      1.47,
      1.47,
      2.8,
      64,
      1,
      true,
      0.28,
      Math.PI * 1.55,
    ),
    casing,
  );
  shell.rotation.x = Math.PI / 2;
  shell.position.z = -0.65;
  assembly.add(shell);
  ring(1.45, 0.1, metal, 0.78);
  ring(1.45, 0.1, dark, -2.05);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const winding = box(
      0.25,
      0.25,
      2.2,
      copper,
      Math.cos(a) * 1.17,
      Math.sin(a) * 1.17,
      -0.7,
    );
    winding.rotation.z = a;
    const bolt = cylinder(
      0.055,
      0.16,
      machined,
      Math.cos(a) * 1.46,
      Math.sin(a) * 1.46,
      0.91,
    );
    bolt.geometry.dispose();
    bolt.geometry = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 6);
  }
  for (let i = 0; i < 15; i++) ring(1.05, 0.026, copper, -1.7 + i * 0.14);
  cylinder(0.155, 3, machined, 0, 0, -0.45);
  cylinder(0.34, 0.4, metal, 0, 0, -1.75);
  cylinder(0.32, 0.34, dark, 0, 0, 0.1);
  box(1.1, 0.25, 0.95, casing, 0, 1.5, -1.3);
  box(0.72, 0.08, 0.55, dark, 0, 1.67, -1.3);
  box(0.48, 0.035, 0.19, metal, 0, 1.72, -1.3);
  for (let i = 0; i < 7; i++)
    box(0.045, 0.17, 0.84, black, -0.35 + i * 0.115, 1.54, -1.3);
  for (const x of [-0.85, 0.85]) box(0.28, 0.7, 0.9, casing, x, -1.35, -0.5);

  const drive = new THREE.Group();
  drive.add(gear(1.24, 28, 0.28, machined));
  ring(0.29, 0.035, metal, 0.19, drive);
  ring(0.84, 0.012, dark, 0.17, drive);
  assembly.add(drive);
  const washer = new THREE.Group();
  ring(0.28, 0.07, metal, 0, washer);
  assembly.add(washer);
  const fastener = cylinder(0.17, 0.22, metal, 0, 0, 4.4);
  fastener.geometry.dispose();
  fastener.geometry = new THREE.CylinderGeometry(0.17, 0.17, 0.22, 6);
  const alignment = ring(1.29, 0.012, blue, 1.06);

  // A subtle contact shadow, with no external image or texture downloads.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,.65)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 7),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -2.08, -0.2);
  assembly.add(shadow);

  let width = 1,
    height = 1;
  function resize() {
    width = host.clientWidth;
    height = host.clientHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  return {
    render(progress: number, pointerX = 0, pointerY = 0) {
      const p = THREE.MathUtils.clamp(progress, 0, 1);
      const insert = ease((p - 0.2) / 0.5);
      const finish = ease((p - 0.73) / 0.25);
      const mobile = width < 720;
      drive.position.z = mix(3.2, 0.69, insert);
      drive.position.y = mix(0.12, 0, insert);
      drive.rotation.z = mix(-0.7, Math.PI * 2, insert);
      washer.position.z = mix(4, 1.0, ease((p - 0.56) / 0.32));
      fastener.position.z = mix(4.5, 1.18, ease((p - 0.69) / 0.26));
      alignment.visible = p > 0.2 && p < 0.8;
      blue.opacity = Math.sin(ease((p - 0.2) / 0.6) * Math.PI) * 0.9;
      assembly.rotation.set(
        0.05 + pointerY * 0.025,
        mix(-0.55, -0.12, finish) + pointerX * 0.035,
        0,
      );
      assembly.position.set(
        mobile ? 0 : mix(3.1, 2.5, finish),
        mobile ? -0.3 : -0.12,
        0,
      );
      const distance = mobile ? 23 : 13.3;
      camera.position.set(
        mix(6.7, 5.5, finish),
        mix(3.2, 2.6, finish),
        distance + finish * 0.3,
      );
      camera.lookAt(mobile ? 0 : 0.5, mobile ? 0.3 : 0.2, 0.1);
      renderer.render(scene, camera);
    },
    dispose() {
      resizeObserver.disconnect();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      shadowTexture.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
