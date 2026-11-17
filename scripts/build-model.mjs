// Stáhne STL modely kostí z BodyParts3D (mirror na GitHubu), zjednoduší je
// a složí do jednoho komprimovaného GLB souboru: public/models/skeleton.glb
//
// Spuštění:  npm run build:model
//
// Data: BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 Japan
// https://github.com/Kevin-Mattheus-Moerman/BodyParts3D

import fs from 'node:fs/promises';
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

/** Načte binární STL a rovnou spojí shodné vrcholy (indexovaná geometrie). */
function parseSTL(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint32(80, true);
  if (84 + n * 50 !== buf.byteLength) throw new Error('Není binární STL');
  const map = new Map();
  const pos = [];
  const idx = new Uint32Array(n * 3);
  const q = (v) => Math.round(v * 1e4);
  for (let t = 0; t < n; t++) {
    const off = 84 + t * 50 + 12;
    for (let k = 0; k < 3; k++) {
      const x = dv.getFloat32(off + k * 12, true);
      const y = dv.getFloat32(off + k * 12 + 4, true);
      const z = dv.getFloat32(off + k * 12 + 8, true);
      const key = `${q(x)},${q(y)},${q(z)}`;
      let i = map.get(key);
      if (i === undefined) {
        i = pos.length / 3;
        map.set(key, i);
        pos.push(x, y, z);
      }
      idx[t * 3 + k] = i;
    }
  }
  // odstranit degenerované trojúhelníky
  const clean = [];
  for (let t = 0; t < n; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    if (a !== b && b !== c && a !== c) clean.push(a, b, c);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(clean) };
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

  console.log(`Stahuji ${CATALOG.length} modelů…`);
  const queue = [...CATALOG];
  let done = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const e = queue.shift();
        await download(e.id);
        if (++done % 25 === 0) console.log(`  ${done}/${CATALOG.length}`);
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

  const meshes = [];
  for (const e of CATALOG) {
    const buf = await fs.readFile(path.join(CACHE, `${e.id}.stl`));
    const { positions, indices } = parseSTL(buf);
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
    const [lo, hi] = LIMITS[e.kind];
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
