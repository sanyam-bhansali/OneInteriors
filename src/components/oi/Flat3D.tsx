'use client';

/**
 * Their flat in 3D (the owner's option 2, 30 Sep 2026): a dollhouse of a
 * typical layout for their configuration, sized to their carpet area and
 * finished in the palette of the style they lean to — floors, low cut-away
 * walls so every room can be seen into, and simple furniture. Drag to turn
 * it; it turns slowly on its own until touched.
 *
 * `progress` (0–1) builds it: floors, then walls, then furniture, room by
 * room. The landing page drives it from the scroll; "Your home" plays it
 * once. With reduced motion it is simply built.
 *
 * A schematic, and every place it appears says so — never their floor plan.
 * Load it with next/dynamic (ssr: false) so three.js only ships where it is
 * shown.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { flatLayout, type LayoutRoom, type LayoutRoomKey } from '@/modules/brief/flat-layout';
import { STYLE_PALETTES } from '@/modules/brief/palettes';
import type { StyleTag } from '@/modules/brief/types';
import { useSiteT } from '@/components/app/i18n';
import { OI_DICT } from '@/modules/i18n/site/oi';

const WALL_H = 1.1;
const WALL_T = 0.09;
const NEUTRAL = { wall: '#E9E5DE', floor: '#CFC7BA', furniture: '#9A948A', accent: '#6F6A63', trim: '#BDB6AB' };
const OUT = { wall: '#E4E1DC', floor: '#D9D5CE' };

type Part = { obj: THREE.Object3D; room: number; phase: 0 | 1 | 2; baseY: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02 }),
  );
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function furnish(r: LayoutRoom, p: typeof NEUTRAL): THREE.Mesh[] {
  const cx = r.x + r.w / 2;
  const cz = r.z + r.d / 2;
  const out: THREE.Mesh[] = [];
  if (r.kind === 'bedroom') {
    const bw = Math.min(1.6, r.w * 0.5);
    const bd = Math.min(2.0, r.d * 0.6);
    out.push(box(bw, 0.45, bd, p.furniture, cx, 0, cz + r.d * 0.08));
    out.push(box(bw, 0.9, 0.08, p.accent, cx, 0, cz + r.d * 0.08 - bd / 2));
    const ww = Math.min(2.2, r.w * 0.7);
    out.push(box(ww, 1.5, 0.55, p.trim, r.x + r.w - ww / 2 - 0.15, 0, r.z + r.d - 0.35));
  } else if (r.kind === 'living') {
    const sw = Math.min(2.4, r.w * 0.45);
    out.push(box(sw, 0.8, 0.9, p.furniture, r.x + r.w * 0.3, 0, r.z + r.d * 0.62));
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.4, 28),
      new THREE.MeshStandardMaterial({ color: p.trim, roughness: 0.6 }),
    );
    table.position.set(r.x + r.w * 0.3, 0.2, r.z + r.d * 0.38);
    table.castShadow = true;
    out.push(table);
    out.push(box(Math.min(2.1, r.w * 0.4), 0.55, 0.4, p.accent, r.x + r.w * 0.3, 0, r.z + 0.3));
    // Dining for four, towards the kitchen.
    out.push(box(1.4, 0.75, 0.85, p.trim, r.x + r.w * 0.75, 0, r.z + r.d * 0.6));
    for (const [dx, dz] of [[-0.45, -0.6], [0.45, -0.6], [-0.45, 0.6], [0.45, 0.6]] as const) {
      out.push(box(0.42, 0.45, 0.42, p.furniture, r.x + r.w * 0.75 + dx, 0, r.z + r.d * 0.6 + dz));
    }
  } else if (r.kind === 'kitchen') {
    out.push(box(r.w - 0.3, 0.9, 0.6, p.furniture, cx, 0, r.z + r.d - 0.4));
    out.push(box(r.w - 0.3, 0.04, 0.62, p.accent, cx, 0.9, r.z + r.d - 0.4));
    out.push(box(0.6, 0.9, r.d * 0.55, p.furniture, r.x + r.w - 0.45, 0, r.z + r.d * 0.45));
  } else {
    out.push(box(Math.min(1.1, r.w * 0.5), 0.85, 0.5, p.trim, cx, 0, r.z + r.d - 0.35));
  }
  return out;
}

export function Flat3D({
  bedrooms,
  carpetAreaSqft,
  style,
  inScope = null,
  progress = null,
  autoBuild = true,
  className = '',
  label,
}: {
  bedrooms: number;
  carpetAreaSqft: number;
  style: StyleTag | null;
  /** Rooms in the work; the rest are drawn plain and empty. Null: all. */
  inScope?: LayoutRoomKey[] | null;
  /** 0–1, driven from outside (the landing page's scroll). Null: build itself. */
  progress?: number | null;
  /** When `progress` is null, play the build once on mount. */
  autoBuild?: boolean;
  className?: string;
  label: string;
}) {
  const t = useSiteT(OI_DICT);
  const host = useRef<HTMLDivElement>(null);
  const progressRef = useRef<number>(progress ?? (autoBuild ? 0 : 1));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (progress !== null) progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const layout = flatLayout(bedrooms, carpetAreaSqft);
    const pal = style ? STYLE_PALETTES[style] : NEUTRAL;
    const scope = inScope ? new Set(inScope) : null;
    const centre = new THREE.Vector3(layout.width / 2, 0, layout.depth / 2);

    scene.add(new THREE.HemisphereLight('#fffaf2', '#b3aa9f', 1.9));
    scene.add(new THREE.AmbientLight('#ffffff', 0.35));
    const sun = new THREE.DirectionalLight('#fff4e3', 2.1);
    sun.position.set(centre.x - layout.width, 12, centre.z - layout.depth * 0.6);
    sun.target.position.copy(centre);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = Math.max(layout.width, layout.depth);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 40 });
    scene.add(sun, sun.target);

    // Ground slab under the whole flat.
    const slab = box(layout.width + 0.4, 0.12, layout.depth + 0.4, '#d8d2c8', centre.x, -0.12, centre.z);
    slab.castShadow = false;
    scene.add(slab);

    const parts: Part[] = [];
    layout.rooms.forEach((r, i) => {
      const on = !scope || scope.has(r.key);
      const floor = box(r.w - 0.02, 0.04, r.d - 0.02, on ? pal.floor : OUT.floor, r.x + r.w / 2, 0, r.z + r.d / 2);
      scene.add(floor);
      parts.push({ obj: floor, room: i, phase: 0, baseY: floor.position.y });
      const wallColor = on ? pal.wall : OUT.wall;
      const walls = [
        box(r.w, WALL_H, WALL_T, wallColor, r.x + r.w / 2, 0, r.z),
        box(r.w, WALL_H, WALL_T, wallColor, r.x + r.w / 2, 0, r.z + r.d),
        box(WALL_T, WALL_H, r.d, wallColor, r.x, 0, r.z + r.d / 2),
        box(WALL_T, WALL_H, r.d, wallColor, r.x + r.w, 0, r.z + r.d / 2),
      ];
      for (const w of walls) {
        scene.add(w);
        parts.push({ obj: w, room: i, phase: 1, baseY: w.position.y });
      }
      if (on) {
        for (const f of furnish(r, pal as typeof NEUTRAL)) {
          scene.add(f);
          parts.push({ obj: f, room: i, phase: 2, baseY: f.position.y });
        }
      }
    });

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    const dist = Math.max(layout.width, layout.depth) * 1.55;
    camera.position.set(centre.x + dist * 0.55, dist * 0.85, centre.z + dist * 0.75);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(centre);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = dist * 0.5;
    controls.maxDistance = dist * 1.6;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.6;
    const stopSpin = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stopSpin);

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const n = layout.rooms.length;
    const apply = (p: number) => {
      for (const part of parts) {
        const start = [0, 0.32, 0.62][part.phase]! + (part.room / n) * 0.12;
        const t = ease(clamp01((p - start) / 0.22));
        part.obj.visible = t > 0.001;
        if (part.phase === 1) {
          part.obj.scale.y = Math.max(0.001, t);
          part.obj.position.y = part.baseY * t;
        } else if (part.phase === 2) {
          part.obj.position.y = part.baseY + (1 - t) * 1.6;
        } else {
          part.obj.scale.set(Math.max(0.001, t), 1, Math.max(0.001, t));
        }
      }
    };

    const t0 = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      if (progress === null && autoBuild) progressRef.current = reduce ? 1 : clamp01((t - t0) / 2600);
      apply(progressRef.current);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.removeEventListener('start', stopSpin);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // `progress` is read through the ref; rebuilding the scene for it would restart the build.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedrooms, carpetAreaSqft, style, inScope?.join(','), autoBuild]);

  if (failed) {
    return <p className="m-0 text-[14px] text-[var(--ink2)]">{t('flat3d.fail')}</p>;
  }
  return <div ref={host} className={className} role="img" aria-label={label} style={{ touchAction: 'pan-y' }} />;
}
