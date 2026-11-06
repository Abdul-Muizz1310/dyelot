"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Plane,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { gamutSolid, PALETTE_NAMES, type SolidGamut } from "@/engine";
import { type Camera, cameraOf, cameraPosition, type ScenePoint } from "./scene";

// The explorer's 3D view (spec R5-35 to R5-39, 8.2, 8.3): the one file that imports three and R3F,
// loaded by `ExploreClient` through `next/dynamic` inside an error boundary. It draws the design's
// steps as instanced spheres, each scale as a tube and the gamut's solid cut at the slice, and
// renders a frame only when something changes (`frameloop="demand"`).

/** What the view drew, for the panel's attributes (8.3). */
export type Drawn = {
  readonly points: number;
  readonly tubes: number;
  readonly solidVertices: number;
};

export type Explorer3DProps = {
  points: readonly ScenePoint[];
  gamut: SolidGamut;
  slice: number;
  camera: Camera;
  damping: boolean;
  /** A pointer gesture moved the camera: the new values, rounded as the sliders hold them. */
  onCamera(camera: Camera): void;
  onDrawn(drawn: Drawn): void;
  /** The renderer is made and the scene exists. */
  onReady(): void;
  /** The canvas lost its WebGL context. */
  onLost(): void;
};

const SOLID_STEPS = 32;
const POINT_RADIUS = 0.02;
const SEED_RADIUS = 0.035;
const TUBE_RADIUS = 0.006;
const TUBE_SEGMENTS = 64;
const TUBE_SIDES = 8;
const SOLID_OPACITY = 0.35;
const TUBE_STEP = 500;
const ORIGIN: [number, number, number] = [0, 0, 0];

/** Each step as a sphere at its place, the palette's seed step larger (R5-36). */
function stepSpheres(
  points: readonly ScenePoint[],
  sphere: SphereGeometry,
  material: MeshBasicMaterial,
): InstancedMesh {
  const mesh = new InstancedMesh(sphere, material, points.length);
  const matrix = new Matrix4();
  const color = new Color();
  points.forEach((point, index) => {
    const radius = point.seed ? SEED_RADIUS : POINT_RADIUS;
    const [x, y, z] = point.position;
    mesh.setMatrixAt(index, matrix.makeScale(radius, radius, radius).setPosition(x, y, z));
    mesh.setColorAt(index, color.set(point.hex));
  });
  return mesh;
}

type Tube = { readonly palette: string; geometry: TubeGeometry; material: MeshBasicMaterial };

/** Each palette's scale as a tube through its 11 steps, in its step 500 color (R5-36). */
function scaleTubes(points: readonly ScenePoint[]): Tube[] {
  return PALETTE_NAMES.map((palette) => {
    const scale = points.filter((point) => point.palette === palette);
    const curve = new CatmullRomCurve3(
      scale.map(({ position: [x, y, z] }) => new Vector3(x, y, z)),
    );
    const middle = scale.find((point) => point.step === TUBE_STEP);
    if (middle === undefined) {
      throw new RangeError(`scaleTubes: the ${palette} scale has no step ${TUBE_STEP}`);
    }
    return {
      palette,
      geometry: new TubeGeometry(curve, TUBE_SEGMENTS, TUBE_RADIUS, TUBE_SIDES, false),
      material: new MeshBasicMaterial({ color: new Color(middle.hex) }),
    };
  });
}

/**
 * The gamut's solid (R5-36): `gamutSolid`'s mesh, with its sRGB display colors made linear, since
 * three reads vertex colors as linear and encodes its output as sRGB.
 */
function solidGeometry(gamut: SolidGamut): BufferGeometry {
  const solid = gamutSolid(gamut, SOLID_STEPS);
  const linear = new Float32Array(solid.colors.length);
  const color = new Color();
  for (let i = 0; i < linear.length; i += 3) {
    color
      .setRGB(solid.colors[i] ?? 0, solid.colors[i + 1] ?? 0, solid.colors[i + 2] ?? 0)
      .convertSRGBToLinear();
    linear.set([color.r, color.g, color.b], i);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(solid.positions, 3));
  geometry.setAttribute("color", new BufferAttribute(linear, 3));
  geometry.setIndex(new BufferAttribute(solid.indices, 1));
  return geometry;
}

/** The lightness slice: everything of the solid above `l` is cut away (R5-36). */
const slicePlane = (l: number): Plane => new Plane(new Vector3(0, -1, 0), l - 0.5);

function Scene({
  points,
  gamut,
  slice,
  onDrawn,
}: Pick<Explorer3DProps, "points" | "gamut" | "slice" | "onDrawn">) {
  const invalidate = useThree((state) => state.invalidate);
  const [sphere] = useState(() => new SphereGeometry(1, 16, 12));
  const [pointMaterial] = useState(() => new MeshBasicMaterial());
  const spheres = useMemo(
    () => stepSpheres(points, sphere, pointMaterial),
    [points, sphere, pointMaterial],
  );
  const tubes = useMemo(() => scaleTubes(points), [points]);
  const solid = useMemo(() => solidGeometry(gamut), [gamut]);
  const [material] = useState(
    () =>
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: SOLID_OPACITY,
        depthWrite: false,
        side: DoubleSide,
      }),
  );

  useEffect(() => () => spheres.dispose(), [spheres]);
  useEffect(
    () => () => {
      for (const tube of tubes) {
        tube.geometry.dispose();
        tube.material.dispose();
      }
    },
    [tubes],
  );
  useEffect(() => () => solid.dispose(), [solid]);
  useEffect(
    () => () => {
      sphere.dispose();
      pointMaterial.dispose();
      material.dispose();
    },
    [sphere, pointMaterial, material],
  );

  // Every control change draws one new frame.
  useLayoutEffect(() => {
    material.clippingPlanes = [slicePlane(slice)];
    invalidate();
  }, [material, slice, invalidate]);
  useLayoutEffect(() => {
    onDrawn({
      points: spheres.count,
      tubes: tubes.length,
      solidVertices: solid.getAttribute("position").count,
    });
    invalidate();
  }, [spheres, tubes, solid, onDrawn, invalidate]);

  return (
    <>
      <primitive object={spheres} />
      {tubes.map((tube) => (
        <mesh key={tube.palette} geometry={tube.geometry} material={tube.material} />
      ))}
      <mesh geometry={solid} material={material} renderOrder={1} />
    </>
  );
}

/**
 * The camera and its pointer controls (R5-38, 8.2). A slider change moves the camera; a pointer
 * gesture moves it and writes the rounded values back. A value the pointer wrote is not applied
 * again, so rounding never pulls the camera back during a drag.
 */
function Rig({
  camera,
  damping,
  onCamera,
}: Pick<Explorer3DProps, "camera" | "damping" | "onCamera">) {
  const view = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const fromPointer = useRef(new WeakSet<Camera>());
  const latest = useRef(camera);

  useLayoutEffect(() => {
    latest.current = camera;
    if (fromPointer.current.has(camera)) return;
    const [x, y, z] = cameraPosition(camera);
    view.position.set(x, y, z);
    view.lookAt(0, 0, 0);
    invalidate();
  }, [camera, view, invalidate]);

  const onChange = () => {
    const { x, y, z } = view.position;
    // At the pole a position names no turn: the slider's turn stays.
    const next = cameraOf([x, y, z], latest.current.turn);
    const now = latest.current;
    if (next.turn !== now.turn || next.tilt !== now.tilt || next.zoom !== now.zoom) {
      fromPointer.current.add(next);
      latest.current = next;
      onCamera(next);
    }
    invalidate();
  };

  return (
    <OrbitControls
      target={ORIGIN}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2}
      minDistance={1.6}
      maxDistance={6.4}
      enablePan={false}
      enableDamping={damping}
      dampingFactor={0.1}
      onChange={onChange}
    />
  );
}

export function Explorer3D({
  points,
  gamut,
  slice,
  camera,
  damping,
  onCamera,
  onDrawn,
  onReady,
  onLost,
}: Explorer3DProps) {
  // R3F makes its camera once from these; the rig moves it from then on.
  const [start] = useState(() => ({
    fov: 40,
    near: 0.1,
    far: 20,
    position: [...cameraPosition(camera)] as [number, number, number],
  }));
  const live = useRef(true);
  const detach = useRef<(() => void) | null>(null);
  const lost = useRef(onLost);

  useLayoutEffect(() => {
    lost.current = onLost;
  }, [onLost]);
  // Unmounting releases the context, which must not read as a loss.
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      detach.current?.();
    };
  }, []);

  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        camera={start}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
          const canvas = gl.domElement;
          const onContextLost = () => {
            if (live.current) lost.current();
          };
          canvas.addEventListener("webglcontextlost", onContextLost);
          detach.current = () => canvas.removeEventListener("webglcontextlost", onContextLost);
          onReady();
        }}
      >
        <Scene points={points} gamut={gamut} slice={slice} onDrawn={onDrawn} />
        <Rig camera={camera} damping={damping} onCamera={onCamera} />
      </Canvas>
    </div>
  );
}
