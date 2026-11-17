// Stáhne STL modely kostí z BodyParts3D (mirror na GitHubu), zjednoduší je
// a složí do jednoho komprimovaného GLB souboru: public/models/skeleton.glb
//
// Spuštění:  npm run build:model
//
// Data: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan
// https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
// Sluchové kůstky a kostrč: Z-Anatomy, CC BY-SA 4.0, https://github.com/LluisV/Z-Anatomy

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { simplifyPrimitive, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { CATALOG } from '../src/data/catalog.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.cache', 'stl');
const OUT = path.join(ROOT, 'public', 'models', 'skeleton.glb');
const BASE = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';

// Cílový počet trojúhelníků podle typu
// (zachová se ~25 % trojúhelníků, ale v mezích MIN..MAX podle typu)
const LIMITS = { bone: [900, 6000], tooth: [500, 900], disc: [400, 1000], cartilage: [400, 1600] };

async function download(id) {
  const file = path.join(CACHE, `${id}.stl`);
  try {
    await fs.access(file);
    return file;
  } catch {}
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${BASE}/${id}.stl`);
    if (res.ok) {
      await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
      return file;
    }
    console.warn(`  ${id}: HTTP ${res.status}, pokus ${attempt}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error(`Nepodařilo se stáhnout ${id}`);
}

/** Binární STL -> pole trojúhelníků (x,y,z × 3 na trojúhelník), jednotky mm, Z nahoru. */
function stlSoup(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint32(80, true);
  if (84 + n * 50 !== buf.byteLength) throw new Error('Není binární STL');
  const out = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) {
    const off = 84 + t * 50 + 12;
    for (let k = 0; k < 9; k++) out[t * 9 + k] = dv.getFloat32(off + k * 4, true);
  }
  return out;
}

/** Spojí shodné vrcholy (indexovaná geometrie) a odstraní degenerované trojúhelníky. */
function weld(soup) {
  const n = soup.length / 9;
  const map = new Map();
  const pos = [];
  const idx = new Uint32Array(n * 3);
  const q = (v) => Math.round(v * 1e4);
  for (let v = 0; v < n * 3; v++) {
    const x = soup[v * 3], y = soup[v * 3 + 1], z = soup[v * 3 + 2];
    const key = `${q(x)},${q(y)},${q(z)}`;
    let i = map.get(key);
    if (i === undefined) {
      i = pos.length / 3;
      map.set(key, i);
      pos.push(x, y, z);
    }
    idx[v] = i;
  }
  const clean = [];
  for (let t = 0; t < n; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    if (a !== b && b !== c && a !== c) clean.push(a, b, c);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(clean) };
}

/** Těžiště povrchu (vážené plochou) – nezávislé na hustotě sítě. */
function surfaceCentroid(soup) {
  let cx = 0, cy = 0, cz = 0, A = 0;
  for (let t = 0; t < soup.length; t += 9) {
    const ux = soup[t + 3] - soup[t], uy = soup[t + 4] - soup[t + 1], uz = soup[t + 5] - soup[t + 2];
    const vx = soup[t + 6] - soup[t], vy = soup[t + 7] - soup[t + 1], vz = soup[t + 8] - soup[t + 2];
    const ar = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    cx += ((soup[t] + soup[t + 3] + soup[t + 6]) / 3) * ar;
    cy += ((soup[t + 1] + soup[t + 4] + soup[t + 7]) / 3) * ar;
    cz += ((soup[t + 2] + soup[t + 5] + soup[t + 8]) / 3) * ar;
    A += ar;
  }
  return [cx / A, cy / A, cz / A];
}

// ---------------------------------------------------------------- Z-Anatomy
// Části, které BodyParts3D nemá (sluchové kůstky, kostrč), bereme ze Z-Anatomy
// (CC BY-SA 4.0, https://github.com/LluisV/Z-Anatomy). Z-Anatomy vychází z BodyParts3D,
// liší se jen měřítkem a orientací os. Transformaci spočítáme z kostí, které jsou
// v obou zdrojích, a každou část doladíme podle sousední referenční kosti.
const ZA_URL = 'https://raw.githubusercontent.com/LluisV/Z-Anatomy/HEAD/Resources/Models/FBX/SkeletalSystem100.fbx';
const ZA_PARTS = {
  ZA_MALLEUS_R: ['Malleusr', 'FMA52738'],
  ZA_MALLEUS_L: ['Malleusl', 'FMA52739'],
  ZA_INCUS_R: ['Incusr', 'FMA52738'],
  ZA_INCUS_L: ['Incusl', 'FMA52739'],
  ZA_STAPES_R: ['Stapesr', 'FMA52738'],
  ZA_STAPES_L: ['Stapesl', 'FMA52739'],
  ZA_COCCYX: ['Coccyx', 'FMA16202'],
};
const ZA_ALIGN = [
  ['Frontal_bone', 'FMA52734'], ['Temporal_bonel', 'FMA52739'], ['Temporal_boner', 'FMA52738'],
  ['Femurl', 'FMA24475'], ['Femurr', 'FMA24474'], ['Humerusl', 'FMA23131'], ['Humerusr', 'FMA23130'],
  ['Tibial', 'FMA24478'], ['Tibiar', 'FMA24477'], ['Mandible', 'FMA52748'], ['Sacrum', 'FMA16202'],
];

async function loadZAnatomy(stlSoups) {
  const file = path.join(ROOT, '.cache', 'zanatomy-skeletal.fbx');
  try {
    await fs.access(file);
  } catch {
    console.log('Stahuji Z-Anatomy (41 MB)…');
    const res = await fetch(ZA_URL);
    if (!res.ok) throw new Error(`Z-Anatomy: HTTP ${res.status}`);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  globalThis.window ??= globalThis;
  globalThis.self ??= globalThis;
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
  const buf = await fs.readFile(file);
  const warn = console.warn;
  console.warn = () => {};
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  console.warn = warn;
  root.updateMatrixWorld(true);
  const byName = {};
  root.traverse((o) => o.isMesh && (byName[o.name] = o));

  const soupOf = (name) => {
    const o = byName[name];
    if (!o) throw new Error(`Z-Anatomy: chybí ${name}`);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position;
    const out = new Float32Array(pos.count * 3);
    const e = o.matrixWorld.elements;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      out[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      out[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      out[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
    return out;
  };

  // Podobnostní transformace (Umeyama) z těžišť společných kostí
  const P = ZA_ALIGN.map(([za]) => surfaceCentroid(soupOf(za)));
  const Q = ZA_ALIGN.map(([, bp]) => surfaceCentroid(stlSoups(bp)));
  const xf = similarity(P, Q);
  const apply = (v) => {
    const [x, y, z] = v;
    const R = xf.R;
    return [
      xf.s * (R[0] * x + R[1] * y + R[2] * z) + xf.t[0],
      xf.s * (R[3] * x + R[4] * y + R[5] * z) + xf.t[1],
      xf.s * (R[6] * x + R[7] * y + R[8] * z) + xf.t[2],
    ];
  };
  const errs = P.map((p, i) => Math.hypot(...apply(p).map((v, k) => v - Q[i][k])));
  console.log(`Z-Anatomy zarovnání: měřítko ${xf.s.toFixed(3)}, chyba ${Math.min(...errs).toFixed(1)}–${Math.max(...errs).toFixed(1)} mm`);

  const result = {};
  for (const [id, [zaName, refId]] of Object.entries(ZA_PARTS)) {
    // lokální doladění podle referenční kosti (posun)
    const refZa = ZA_ALIGN.find(([, bp]) => bp === refId)[0];
    const pr = apply(surfaceCentroid(soupOf(refZa)));
    const qr = surfaceCentroid(stlSoups(refId));
    const d = qr.map((v, k) => v - pr[k]);
    const soup = soupOf(zaName);
    for (let i = 0; i < soup.length; i += 3) {
      const v = apply([soup[i], soup[i + 1], soup[i + 2]]);
      soup[i] = v[0] + d[0];
      soup[i + 1] = v[1] + d[1];
      soup[i + 2] = v[2] + d[2];
    }
    result[id] = soup;
  }

  // Kost křížová z BodyParts3D obsahuje i kostrč. Z-Anatomy je odděluje -> odřízneme
  // z kosti křížové vše pod rozhraním (střed mezi spodkem křížové kosti a vrcholem kostrče).
  if (result.ZA_COCCYX) {
    const sac = soupOf('Sacrum');
    let sacMin = Infinity;
    for (let i = 0; i < sac.length; i += 3) sacMin = Math.min(sacMin, apply([sac[i], sac[i + 1], sac[i + 2]])[2]);
    const refZa = apply(surfaceCentroid(soupOf('Sacrum')));
    const dz = surfaceCentroid(stlSoups('FMA16202'))[2] - refZa[2];
    let coccMax = -Infinity;
    const c = result.ZA_COCCYX;
    for (let i = 2; i < c.length; i += 3) coccMax = Math.max(coccMax, c[i]);
    result.cuts = { FMA16202: (sacMin + dz + coccMax) / 2 };
    console.log(`Kostrč oddělena od kosti křížové v z = ${result.cuts.FMA16202.toFixed(1)} mm`);
  }
  return result;
}

/** Odstraní trojúhelníky, jejichž těžiště leží pod rovinou z = zCut. */
function cutBelow(soup, zCut) {
  const keep = [];
  for (let t = 0; t < soup.length; t += 9) {
    if ((soup[t + 2] + soup[t + 5] + soup[t + 8]) / 3 >= zCut) for (let k = 0; k < 9; k++) keep.push(soup[t + k]);
  }
  return new Float32Array(keep);
}

/** Umeyama: najde s, R, t minimalizující |s·R·p + t − q|. R jako 3×3 (řádkově). */
function similarity(P, Q) {
  const n = P.length;
  const mp = [0, 0, 0], mq = [0, 0, 0];
  P.forEach((p) => p.forEach((v, k) => (mp[k] += v / n)));
  Q.forEach((q) => q.forEach((v, k) => (mq[k] += v / n)));
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let varP = 0;
  for (let i = 0; i < n; i++) {
    const p = P[i].map((v, k) => v - mp[k]);
    const q = Q[i].map((v, k) => v - mq[k]);
    varP += p[0] ** 2 + p[1] ** 2 + p[2] ** 2;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r * 3 + c] += q[r] * p[c];
  }
  // rotace = polární rozklad S (iterace R = (R + R^-T)/2)
  let R = S.slice();
  for (let it = 0; it < 100; it++) {
    const inv = invert3(R);
    R = R.map((v, i) => (v + inv[(i % 3) * 3 + Math.floor(i / 3)]) / 2);
  }
  let tr = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tr += R[r * 3 + c] * S[r * 3 + c];
  const s = tr / varP;
  const Rmp = [0, 1, 2].map((r) => R[r * 3] * mp[0] + R[r * 3 + 1] * mp[1] + R[r * 3 + 2] * mp[2]);
  return { R, s, t: mq.map((v, k) => v - s * Rmp[k]) };
}

function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
}

/** Hladké normály vážené plochou trojúhelníků (geometrie zůstává indexovaná). */
function computeNormals(prim, doc, buffer) {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices().getArray();
  const nrm = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { nrm[i] += nx; nrm[i + 1] += ny; nrm[i + 2] += nz; }
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
  }
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer));
}

async function main() {
  await fs.mkdir(CACHE, { recursive: true });
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;

  const bp3d = CATALOG.filter((e) => !e.id.startsWith('ZA_'));
  console.log(`Stahuji ${bp3d.length} modelů BodyParts3D…`);
  const queue = [...bp3d];
  let done = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const e = queue.shift();
        await download(e.id);
        if (++done % 25 === 0) console.log(`  ${done}/${bp3d.length}`);
      }
    }),
  );

  // BodyParts3D: jednotky mm, osa Z nahoru. Převod do Y-up a metrů.
  // (x, y, z) -> (x, z, -y)
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('skeleton');
  const material = doc.createMaterial('bone');
  let totalIn = 0, totalOut = 0;

  const soupCache = new Map();
  const stlSoups = (id) => {
    if (!soupCache.has(id)) soupCache.set(id, stlSoup(readFileSync(path.join(CACHE, `${id}.stl`))));
    return soupCache.get(id);
  };
  const za = CATALOG.some((e) => e.id.startsWith('ZA_')) ? await loadZAnatomy(stlSoups) : {};

  const meshes = [];
  for (const e of CATALOG) {
    let soup = e.id.startsWith('ZA_') ? za[e.id] : stlSoups(e.id);
    if (za.cuts?.[e.id] !== undefined) soup = cutBelow(soup, za.cuts[e.id]);
    const { positions, indices } = weld(soup);
    const p = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      p[i] = positions[i] / 1000;
      p[i + 1] = positions[i + 2] / 1000;
      p[i + 2] = -positions[i + 1] / 1000;
    }
    meshes.push({ e, p, indices });
  }

  // vycentrovat celý model (střed X/Z, chodidla na Y=0)
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const { p } of meshes) {
    for (let i = 0; i < p.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (p[i + k] < min[k]) min[k] = p[i + k];
        if (p[i + k] > max[k]) max[k] = p[i + k];
      }
    }
  }
  const off = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  console.log('Rozměry (m):', max.map((v, k) => (v - min[k]).toFixed(3)).join(' × '));

  for (const { e, p, indices } of meshes) {
    for (let i = 0; i < p.length; i += 3) {
      p[i] -= off[0];
      p[i + 1] -= off[1];
      p[i + 2] -= off[2];
    }
    const tris = indices.length / 3;
    // sluchové kůstky jsou drobné a tvarově členité -> ponechat více detailu
    const [lo, hi] = e.group === 'ossicles' ? [3000, 4500] : LIMITS[e.kind];
    const target = Math.min(hi, Math.max(lo, tris * 0.25));
    const ratio = Math.min(1, target / tris);

    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
      .setMaterial(material);
    if (ratio < 1) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: false });
    computeNormals(prim, doc, buffer);
    const outTris = prim.getIndices().getCount() / 3;
    totalIn += tris;
    totalOut += outTris;

    const mesh = doc.createMesh(e.id).addPrimitive(prim);
    const node = doc.createNode(e.id).setMesh(mesh).setExtras({ kind: e.kind });
    scene.addChild(node);
  }
  console.log(`Trojúhelníky: ${totalIn.toLocaleString()} -> ${totalOut.toLocaleString()}`);

  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await doc.transform(
    prune({ keepLeaves: true, keepAttributes: true }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 14, quantizeNormal: 8 }),
  );

  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  await io.write(OUT, doc);
  const { size } = await fs.stat(OUT);
  console.log(`Hotovo: ${path.relative(ROOT, OUT)} (${(size / 1e6).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
