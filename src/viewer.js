import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const COLORS = {
  bone: new THREE.Color('#e9dfc9'),
  tooth: new THREE.Color('#f6f3ea'),
  disc: new THREE.Color('#9fc3d6'),
  cartilage: new THREE.Color('#b9d3e0'),
};
const HOVER = new THREE.Color('#ffb547');
const SELECT = new THREE.Color('#2bb3a3');
const TARGET = new THREE.Color('#ff7a1a');

// Směr "dopředu" (anterior) modelu a "doprava" (pacientova pravice)
export const ANTERIOR = new THREE.Vector3(0, 0, 1);
export const PATIENT_RIGHT = new THREE.Vector3(-1, 0, 0);

export class Viewer {
  constructor(container) {
    this.container = container;
    this.meshes = new Map(); // id -> mesh
    this.visible = new Set();
    this.hovered = null;
    this.selected = null;
    this.target = null;
    this.dimOthers = false;
    this.listeners = { hover: [], click: [] };
    this._anim = null;
    this.insetBottom = 0; // px zakryté spodní kartou (test)

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.005, 50);
    this.camera.position.set(0, 1, 4);

    const key = new THREE.DirectionalLight('#fff6e8', 1.6);
    key.position.set(1.5, 3, 3);
    const fill = new THREE.DirectionalLight('#dbe8ff', 0.6);
    fill.position.set(-3, 1, 1);
    const rim = new THREE.DirectionalLight('#ffffff', 0.8);
    rim.position.set(0, 2, -3);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#5a5040', 0.6), key, fill, rim);
    // světla se pohybují s kamerou, aby kost byla vždy dobře nasvícená
    this.lightRig = new THREE.Group();
    this.scene.add(this.lightRig);
    for (const l of [key, fill, rim]) this.lightRig.add(l);
    this.camera.add(this.lightRig);
    this.scene.add(this.camera);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.8;
    c.zoomSpeed = 1.1;
    c.screenSpacePanning = true;
    c.minDistance = 0.02;
    c.maxDistance = 8;
    c.autoRotateSpeed = 1.2;
    c.addEventListener('start', () => (this._anim = null));

    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.pointer = new THREE.Vector2();
    this._pointerDirty = false;
    this._down = null;

    const el = r.domElement;
    el.addEventListener('pointermove', (e) => this._onMove(e));
    el.addEventListener('pointerleave', () => this._setHover(null, null));
    el.addEventListener('pointerdown', (e) => (this._down = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType }));
    el.addEventListener('pointerup', (e) => this._onUp(e));

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  on(evt, fn) {
    this.listeners[evt].push(fn);
  }
  _emit(evt, ...a) {
    for (const fn of this.listeners[evt]) fn(...a);
  }

  async load(url, onProgress) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url, (e) => e.total && onProgress?.(e.loaded / e.total));
    this.root.add(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const id = o.name;
      const kind = o.userData.kind || 'bone';
      o.userData.id = id;
      o.userData.kind = kind;
      o.userData.baseColor = COLORS[kind] || COLORS.bone;
      o.material = new THREE.MeshStandardMaterial({
        color: o.userData.baseColor,
        roughness: kind === 'tooth' ? 0.35 : 0.62,
        metalness: 0,
        transparent: kind === 'disc' || kind === 'cartilage',
        opacity: kind === 'disc' || kind === 'cartilage' ? 0.85 : 1,
      });
      try {
        o.geometry.computeBoundsTree();
      } catch (err) {
        console.warn('BVH failed for', id, err);
      }
      o.geometry.computeBoundingBox();
      o.geometry.computeBoundingSphere();
      this.meshes.set(id, o);
    });
    // Mesh ve výsledném glTF může být potomkem uzlu se jménem – dohledat přes rodiče
    if (this.meshes.size && [...this.meshes.keys()].every((k) => !k.startsWith('FMA') && !k.startsWith('BP'))) {
      this.meshes.clear();
      gltf.scene.traverse((o) => {
        if (o.isMesh && o.parent) {
          o.userData.id = o.parent.name;
          this.meshes.set(o.parent.name, o);
        }
      });
    }
    this.setVisible([...this.meshes.keys()]);
  }

  setVisible(ids) {
    this.visible = new Set(ids);
    for (const [id, m] of this.meshes) m.visible = this.visible.has(id);
    this._refreshMaterials();
  }

  boxOf(ids) {
    const box = new THREE.Box3();
    for (const id of ids) {
      const m = this.meshes.get(id);
      if (!m) continue;
      const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      box.union(b);
    }
    return box;
  }

  /** Napasuje kameru na daný box z daného směru (vektor od středu ke kameře). */
  frameBox(box, dir = ANTERIOR, { animate = true, padding = 1.15, minRadius = 0 } = {}) {
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(sphere.radius, minRadius);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    // tvar boxu – pro vysoké objekty (celá kostra) použijeme výšku vůči vertikálnímu FOV
    const d = dir.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, d).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const trueUp = new THREE.Vector3().crossVectors(d, right).normalize();
    const extentX = Math.abs(right.x) * size.x + Math.abs(right.y) * size.y + Math.abs(right.z) * size.z;
    const extentY = Math.abs(trueUp.x) * size.x + Math.abs(trueUp.y) * size.y + Math.abs(trueUp.z) * size.z;
    const depth = Math.abs(d.x) * size.x + Math.abs(d.y) * size.y + Math.abs(d.z) * size.z;
    let dist = Math.max(extentY / 2 / Math.tan(vFov / 2), extentX / 2 / Math.tan(hFov / 2)) * padding + depth / 2;
    dist = Math.max(dist, (minRadius || 0) / Math.sin(Math.min(vFov, hFov) / 2));
    dist = Math.min(Math.max(dist, radius * 0.8), radius * 6 + 0.1);
    const center = sphere.center;
    const pos = center.clone().addScaledVector(d, dist);
    this.camera.near = Math.max(0.002, dist / 200);
    this.camera.far = dist * 20 + 5;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = Math.max(dist * 4, 1);
    this._animateTo(pos, center, animate ? 700 : 0);
  }

  _animateTo(pos, target, ms) {
    if (!ms) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this._anim = {
      t0: performance.now(),
      ms,
      p0: this.camera.position.clone(),
      p1: pos,
      c0: this.controls.target.clone(),
      c1: target,
    };
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this._applyInsets();
  }

  /** Spodní část plátna je zakrytá (karta testu) – střed scény posuneme nahoru. */
  setInsetBottom(px) {
    this.insetBottom = Math.max(0, px || 0);
    this._applyInsets();
  }

  _applyInsets() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const ib = Math.min(this.insetBottom, h * 0.6);
    const vh = h - ib; // viditelná výška
    // kamera "vidí" pouze viditelnou oblast; celé plátno je její rozšíření směrem dolů
    this.camera.aspect = w / vh;
    if (ib > 0) this.camera.setViewOffset(w, vh, 0, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
  }

  _onMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this._pointerClient = { x: e.clientX, y: e.clientY };
    this._pointerDirty = e.pointerType === 'mouse' && e.buttons === 0;
    if (e.buttons !== 0 && this.hovered) this._setHover(null, null);
  }

  _onUp(e) {
    const d = this._down;
    this._down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 6 || performance.now() - d.t > 600) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const id = this.pick();
    if (e.pointerType !== 'mouse') this._setHover(id, { x: e.clientX, y: e.clientY });
    this._emit('click', id, { x: e.clientX, y: e.clientY, pointerType: e.pointerType });
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objs = [...this.visible].map((id) => this.meshes.get(id)).filter(Boolean);
    const hits = this.raycaster.intersectObjects(objs, false);
    // průhledné okolí v testu: preferovat cíl
    const hit = hits.find((h) => h.object.material.opacity > 0.5) || hits[0];
    return hit ? hit.object.userData.id : null;
  }

  _setHover(id, pos) {
    if (id !== this.hovered) {
      this.hovered = id;
      this._refreshMaterials();
    }
    this._emit('hover', id, pos);
  }

  setSelected(id) {
    this.selected = id;
    this._refreshMaterials();
  }

  setHoverEnabled(on) {
    this.hoverEnabled = on;
    if (!on) this._setHover(null, null);
  }

  /** Režim testu: zvýrazní cílovou kost. */
  setTarget(id, { dim = true } = {}) {
    this.target = id;
    this.dimOthers = dim && !!id;
    this._refreshMaterials();
  }

  _refreshMaterials() {
    for (const [id, m] of this.meshes) {
      const mat = m.material;
      const base = m.userData.baseColor;
      const kind = m.userData.kind;
      let opacity = kind === 'disc' || kind === 'cartilage' ? 0.85 : 1;
      mat.emissive.setRGB(0, 0, 0);
      mat.color.copy(base);
      if (this.target) {
        if (id === this.target) {
          mat.color.copy(TARGET);
          mat.emissive.copy(TARGET).multiplyScalar(0.35);
          opacity = 1;
        } else if (this.dimOthers) {
          opacity = 0.22;
        }
      } else if (id === this.selected) {
        mat.color.copy(SELECT);
        mat.emissive.copy(SELECT).multiplyScalar(0.25);
      }
      if (id === this.hovered && this.hoverEnabled !== false) {
        mat.emissive.copy(HOVER).multiplyScalar(0.45);
        if (id !== this.selected) mat.color.copy(base).lerp(HOVER, 0.35);
      }
      mat.opacity = opacity;
      mat.transparent = opacity < 1;
      mat.depthWrite = opacity >= 0.5;
      m.renderOrder = opacity < 1 ? 1 : 0;
      mat.needsUpdate = true;
    }
  }

  /** Vybere směr pohledu, ze kterého je kost nejméně zakrytá ostatními. */
  bestViewDir(id, candidates) {
    const m = this.meshes.get(id);
    if (!m) return { dir: candidates[0], score: 1 };
    const center = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld);
    const radius = m.geometry.boundingSphere.radius;
    const pos = m.geometry.attributes.position;
    const samples = [];
    const step = Math.max(1, Math.floor(pos.count / 24));
    for (let i = 0; i < pos.count; i += step) samples.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
    samples.push(center);
    const others = [...this.visible].filter((v) => v !== id).map((v) => this.meshes.get(v));
    const rc = new THREE.Raycaster();
    rc.firstHitOnly = true;
    let best = candidates[0], bestScore = -1, bestVis = 0;
    candidates.forEach((dir, ci) => {
      const d = dir.clone().normalize();
      let visible = 0;
      for (const s of samples) {
        // pozorovatel daleko ve směru d
        const origin = s.clone().addScaledVector(d, 3);
        rc.set(origin, d.clone().negate());
        rc.far = 3 - radius * 0.02;
        const hit = rc.intersectObjects(others, false);
        if (!hit.length) visible++;
      }
      const score = visible / samples.length - ci * 0.02; // mírně preferovat první (výchozí) směry
      if (score > bestScore) {
        bestScore = score;
        bestVis = visible / samples.length;
        best = d;
      }
    });
    return { dir: best, score: bestVis };
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    if (this._anim) {
      const a = this._anim;
      let t = Math.min(1, (now - a.t0) / a.ms);
      t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(a.p0, a.p1, t);
      this.controls.target.lerpVectors(a.c0, a.c1, t);
      if (t >= 1) this._anim = null;
    }
    this.controls.update();
    if (this._pointerDirty && this.hoverEnabled !== false) {
      this._pointerDirty = false;
      this._setHover(this.pick(), this._pointerClient);
    } else if (this._pointerDirty) {
      this._pointerDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
