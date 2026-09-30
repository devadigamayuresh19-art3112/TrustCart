"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Float,
  RoundedBox,
  Sparkles,
  Torus,
} from "@react-three/drei";
import { ReactNode, useRef } from "react";
import * as THREE from "three";

const COLORS = {
  green: "#20d6a3",
  greenBright: "#49f5c1",
  cyan: "#46e7ff",
  dark: "#071311",
  cart: "#101c1a",
  metal: "#24332f",
  white: "#f5fffb",
};

/* =========================================================
   CURSOR INTERACTION
   ========================================================= */

function InteractiveGroup({
  position,
  children,
  strength = 1,
  depth = 0.15,
  reduceMotion = false,
}: {
  position: [number, number, number];
  children: ReactNode;
  strength?: number;
  depth?: number;
  reduceMotion?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame(() => {
    if (!group.current) return;

    if (reduceMotion) {
      group.current.position.set(
        position[0],
        position[1],
        position[2]
      );

      group.current.rotation.x = 0;
      group.current.rotation.y = 0;
      group.current.rotation.z = 0;

      return;
    }

    /*
     * Cursor movement.
     *
     * pointer.x / pointer.y range approximately
     * from -1 to +1.
     */

    const targetX =
      position[0] + pointer.x * 0.65 * strength;

    const targetY =
      position[1] + pointer.y * 0.45 * strength;

    const targetZ =
      position[2] +
      pointer.x * pointer.y * depth;

    group.current.position.x = THREE.MathUtils.lerp(
      group.current.position.x,
      targetX,
      0.055
    );

    group.current.position.y = THREE.MathUtils.lerp(
      group.current.position.y,
      targetY,
      0.055
    );

    group.current.position.z = THREE.MathUtils.lerp(
      group.current.position.z,
      targetZ,
      0.045
    );

    /*
     * Subtle 3D tilt toward cursor.
     */

    const targetRotationX =
      -pointer.y * 0.08 * strength;

    const targetRotationY =
      pointer.x * 0.1 * strength;

    group.current.rotation.x =
      THREE.MathUtils.lerp(
        group.current.rotation.x,
        targetRotationX,
        0.05
      );

    group.current.rotation.y =
      THREE.MathUtils.lerp(
        group.current.rotation.y,
        targetRotationY,
        0.05
      );
  });

  return <group ref={group}>{children}</group>;
}

/* =========================================================
   CAMERA
   ========================================================= */
/* eslint-disable react-hooks/immutability */
function CameraController({
  scanning,
  reduceMotion,
}: {
  scanning: boolean;
  reduceMotion: boolean;
}) {
  const { camera: rawCamera, pointer } = useThree();
const camera = rawCamera as THREE.PerspectiveCamera;

  useFrame(() => {
    if (reduceMotion) {
      camera.position.set(
        0,
        0,
        scanning ? 5.6 : 8
      );

      camera.lookAt(0, 0, 0);
      return;
    }

    const targetX = pointer.x * 0.3;
    const targetY = pointer.y * 0.16;
    const targetZ = scanning ? 5.5 : 8;

    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      targetX,
      0.035
    );

    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      targetY,
      0.035
    );

    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      targetZ,
      scanning ? 0.045 : 0.025
    );

    camera.lookAt(0, 0, 0);
  });

  return null;
}
/* eslint-enable react-hooks/immutability */
/* =========================================================
   CURSOR LIGHT
   ========================================================= */

function CursorLight({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  const light = useRef<THREE.PointLight>(null);
  const { pointer } = useThree();

  useFrame(() => {
    if (!light.current) return;

    if (reduceMotion) {
      light.current.position.set(0, 2, 4);
      return;
    }

    const targetX = pointer.x * 5;
    const targetY = pointer.y * 3;
    const targetZ = 4;

    light.current.position.x = THREE.MathUtils.lerp(
      light.current.position.x,
      targetX,
      0.06
    );

    light.current.position.y = THREE.MathUtils.lerp(
      light.current.position.y,
      targetY,
      0.06
    );

    light.current.position.z = THREE.MathUtils.lerp(
      light.current.position.z,
      targetZ,
      0.06
    );
  });

  return (
    <pointLight
      ref={light}
      color={COLORS.greenBright}
      intensity={8}
      distance={9}
    />
  );
}

/* =========================================================
   CART
   ========================================================= */

function ShoppingCart({
  scanning,
  reduceMotion,
}: {
  scanning: boolean;
  reduceMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current || reduceMotion) return;

    const t = state.clock.elapsedTime;

    group.current.rotation.y =
      Math.sin(t * 0.35) * 0.1;

    group.current.rotation.x =
      Math.sin(t * 0.25) * 0.025;

    group.current.position.y =
      Math.sin(t * 0.8) * 0.07;
  });

  return (
    <InteractiveGroup
      position={[0, 0, 0]}
      strength={0.35}
      depth={0.25}
      reduceMotion={reduceMotion}
    >
      <group
        ref={group}
        scale={scanning ? 1.08 : 1}
      >
        <RoundedBox
          args={[3.4, 1.5, 1.65]}
          radius={0.16}
          smoothness={4}
          position={[0, 0.45, 0]}
        >
          <meshPhysicalMaterial
            color={COLORS.cart}
            metalness={0.72}
            roughness={0.2}
            clearcoat={1}
            clearcoatRoughness={0.08}
          />
        </RoundedBox>

        {[-1.15, -0.58, 0, 0.58, 1.15].map(
          (x) => (
            <mesh
              key={`v-${x}`}
              position={[x, 0.45, 0.84]}
            >
              <boxGeometry
                args={[0.035, 1.05, 0.045]}
              />
              <meshStandardMaterial
                color={COLORS.greenBright}
                emissive={COLORS.green}
                emissiveIntensity={1.4}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          )
        )}

        {[-0.05, 0.3, 0.65, 1].map((y) => (
          <mesh
            key={`h-${y}`}
            position={[0, y, 0.85]}
          >
            <boxGeometry
              args={[2.8, 0.035, 0.045]}
            />
            <meshStandardMaterial
              color={COLORS.greenBright}
              emissive={COLORS.green}
              emissiveIntensity={1.1}
              metalness={0.8}
            />
          </mesh>
        ))}

        <mesh
          position={[-1.9, 1.12, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[0.11, 0.11, 1.2, 16]}
          />
          <meshStandardMaterial
            color={COLORS.greenBright}
            emissive={COLORS.green}
            emissiveIntensity={1.8}
            metalness={0.85}
            roughness={0.18}
          />
        </mesh>

        <mesh
          position={[-1.65, 1.35, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[0.09, 0.09, 1.1, 16]}
          />
          <meshPhysicalMaterial
            color={COLORS.metal}
            metalness={0.9}
            roughness={0.16}
          />
        </mesh>

        {[-1.1, 1.1].map((x) => (
          <Torus
            key={x}
            args={[0.31, 0.11, 12, 32]}
            position={[x, -0.55, 0.72]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshPhysicalMaterial
              color={COLORS.metal}
              metalness={0.92}
              roughness={0.15}
            />
          </Torus>
        ))}

        <mesh position={[0, -0.29, 0.86]}>
          <boxGeometry
            args={[2.7, 0.035, 0.04]}
          />
          <meshStandardMaterial
            color={COLORS.greenBright}
            emissive={COLORS.green}
            emissiveIntensity={4}
          />
        </mesh>
      </group>
    </InteractiveGroup>
  );
}

/* =========================================================
   PRICE TAG
   ========================================================= */

function PriceTag({
  price,
  position,
  rotation,
  scanning,
  hovered,
  reduceMotion,
}: {
  price: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scanning: boolean;
  hovered: boolean;
  reduceMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;

    if (!reduceMotion) {
      const t = state.clock.elapsedTime;

      group.current.position.y =
        Math.sin(
          t * 0.8 + position[0]
        ) * 0.11;

      group.current.rotation.z =
        Math.sin(
          t * 0.6 + position[1]
        ) * 0.06;
    }

    const targetScale = scanning
      ? 1.25
      : hovered
      ? 1.12
      : 1;

    group.current.scale.lerp(
      new THREE.Vector3(
        targetScale,
        targetScale,
        targetScale
      ),
      0.08
    );
  });

  return (
    <InteractiveGroup
      position={position}
      strength={0.75}
      depth={0.35}
      reduceMotion={reduceMotion}
    >
      <group
        ref={group}
        rotation={rotation}
      >
        <RoundedBox
          args={[1.4, 0.72, 0.09]}
          radius={0.12}
          smoothness={4}
        >
          <meshPhysicalMaterial
            color={
              hovered
                ? "#153d32"
                : "#0e211c"
            }
            metalness={0.5}
            roughness={0.18}
            clearcoat={1}
            emissive={
              hovered
                ? COLORS.green
                : "#03100c"
            }
            emissiveIntensity={
              hovered ? 0.8 : 0.12
            }
          />
        </RoundedBox>

        <mesh position={[0, 0, 0.055]}>
          <planeGeometry
            args={[1.05, 0.42]}
          />
          <meshBasicMaterial
            color={COLORS.greenBright}
            transparent
            opacity={0.08}
          />
        </mesh>

        <mesh
          position={[-0.48, 0, 0.07]}
        >
          <sphereGeometry
            args={[0.055, 10, 10]}
          />
          <meshStandardMaterial
            color={COLORS.greenBright}
            emissive={COLORS.green}
            emissiveIntensity={3}
          />
        </mesh>

        <PriceDisplay price={price} />
      </group>
    </InteractiveGroup>
  );
}

function PriceDisplay({
  price,
}: {
  price: string;
}) {
  return (
    <group position={[0.08, 0, 0.075]}>
      {price.split("").map((char, index) => {
        const isSymbol = char === "₹";

        return (
          <mesh
            key={`${char}-${index}`}
            position={[
              (index -
                (price.length - 1) / 2) *
                0.16,
              0,
              0,
            ]}
          >
            <boxGeometry
              args={[
                isSymbol ? 0.1 : 0.075,
                0.2,
                0.018,
              ]}
            />

            <meshBasicMaterial
              color={COLORS.white}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* =========================================================
   PRODUCTS
   ========================================================= */

function Phone() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    const t = state.clock.elapsedTime;

    ref.current.rotation.y = t * 0.35;
    ref.current.rotation.x =
      Math.sin(t * 0.5) * 0.08;
  });

  return (
    <group ref={ref}>
      <RoundedBox
        args={[0.65, 1.25, 0.12]}
        radius={0.08}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color="#111b18"
          metalness={0.75}
          roughness={0.18}
          clearcoat={1}
        />
      </RoundedBox>

      <mesh position={[0, 0, 0.075]}>
        <boxGeometry
          args={[0.47, 0.92, 0.018]}
        />
        <meshStandardMaterial
          color="#092b22"
          emissive={COLORS.green}
          emissiveIntensity={0.55}
        />
      </mesh>
    </group>
  );
}

function Headphones() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    ref.current.rotation.y =
      Math.sin(
        state.clock.elapsedTime * 0.5
      ) * 0.35;
  });

  return (
    <group ref={ref}>
      <Torus
        args={[
          0.48,
          0.07,
          10,
          32,
          Math.PI,
        ]}
        rotation={[0, 0, Math.PI]}
      >
        <meshStandardMaterial
          color={COLORS.greenBright}
          emissive={COLORS.green}
          emissiveIntensity={0.6}
          metalness={0.7}
          roughness={0.2}
        />
      </Torus>

      {[-0.48, 0.48].map((x) => (
        <mesh
          key={x}
          position={[x, -0.05, 0]}
        >
          <sphereGeometry
            args={[0.17, 12, 12]}
          />
          <meshPhysicalMaterial
            color="#16241f"
            metalness={0.7}
            roughness={0.18}
            clearcoat={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function Laptop() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    const t = state.clock.elapsedTime;

    ref.current.rotation.y =
      -t * 0.25;

    ref.current.position.y =
      Math.sin(t * 0.7) * 0.08;
  });

  return (
    <group ref={ref}>
      <RoundedBox
        args={[1.2, 0.7, 0.08]}
        radius={0.05}
        smoothness={3}
        rotation={[-0.25, 0, 0]}
      >
        <meshPhysicalMaterial
          color="#17211e"
          metalness={0.82}
          roughness={0.18}
          clearcoat={1}
        />
      </RoundedBox>

      <mesh
        position={[0, 0, 0.05]}
        rotation={[-0.25, 0, 0]}
      >
        <planeGeometry
          args={[0.9, 0.48]}
        />

        <meshStandardMaterial
          color="#092d24"
          emissive={COLORS.green}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

function Shoe() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    const t = state.clock.elapsedTime;

    ref.current.rotation.y =
      Math.sin(t * 0.4) * 0.45;

    ref.current.rotation.z =
      Math.sin(t * 0.55) * 0.06;
  });

  return (
    <group ref={ref}>
      <RoundedBox
        args={[1.2, 0.45, 0.5]}
        radius={0.12}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color="#202925"
          metalness={0.3}
          roughness={0.3}
          clearcoat={0.8}
        />
      </RoundedBox>

      <mesh
        position={[0.28, 0.05, 0.26]}
      >
        <boxGeometry
          args={[0.45, 0.18, 0.03]}
        />

        <meshStandardMaterial
          color={COLORS.green}
          emissive={COLORS.green}
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   PRODUCT ORBIT
   ========================================================= */

function ProductOrbit({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current || reduceMotion) return;

    group.current.rotation.y =
      state.clock.elapsedTime * 0.06;
  });

  return (
    <group ref={group}>
      <Float
        speed={0.8}
        rotationIntensity={0.2}
        floatIntensity={0.3}
      >
        <InteractiveGroup
          position={[-4, 1.7, -1]}
          strength={1.15}
          depth={0.45}
          reduceMotion={reduceMotion}
        >
          <Phone />
        </InteractiveGroup>
      </Float>

      <Float
        speed={1}
        rotationIntensity={0.25}
        floatIntensity={0.35}
      >
        <InteractiveGroup
          position={[3.8, 1.5, -0.5]}
          strength={1.1}
          depth={0.4}
          reduceMotion={reduceMotion}
        >
          <Headphones />
        </InteractiveGroup>
      </Float>

      <Float
        speed={0.8}
        rotationIntensity={0.2}
        floatIntensity={0.3}
      >
        <InteractiveGroup
          position={[3.7, -1.7, -1]}
          strength={0.95}
          depth={0.5}
          reduceMotion={reduceMotion}
        >
          <Laptop />
        </InteractiveGroup>
      </Float>

      <Float
        speed={0.9}
        rotationIntensity={0.3}
        floatIntensity={0.4}
      >
        <InteractiveGroup
          position={[-3.7, -1.6, -0.5]}
          strength={1.1}
          depth={0.4}
          reduceMotion={reduceMotion}
        >
          <Shoe />
        </InteractiveGroup>
      </Float>
    </group>
  );
}

/* =========================================================
   SCANNER RINGS
   ========================================================= */

function ScannerRings({
  reduceMotion,
  scanning,
}: {
  reduceMotion: boolean;
  scanning: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current || reduceMotion) return;

    const t = state.clock.elapsedTime;

    group.current.rotation.z =
      t * 0.08;

    group.current.rotation.x =
      Math.sin(t * 0.25) * 0.08;
  });

  return (
    <group
      ref={group}
      position={[0, -0.5, 0]}
      scale={scanning ? 1.18 : 1}
    >
      <Torus
        args={[2.5, 0.018, 8, 128]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial
          color={COLORS.greenBright}
          transparent
          opacity={0.35}
        />
      </Torus>

      <Torus
        args={[3.15, 0.012, 8, 128]}
        rotation={[Math.PI / 2.2, 0.2, 0]}
      >
        <meshBasicMaterial
          color={COLORS.cyan}
          transparent
          opacity={0.18}
        />
      </Torus>

      <Torus
        args={[3.8, 0.008, 8, 128]}
        rotation={[Math.PI / 1.9, -0.1, 0]}
      >
        <meshBasicMaterial
          color={COLORS.green}
          transparent
          opacity={0.12}
        />
      </Torus>
    </group>
  );
}

/* =========================================================
   MAIN SCENE
   ========================================================= */

export default function Scene3D({
  scanning,
  buttonHovered,
  reduceMotion,
}: {
  scanning: boolean;
  buttonHovered: boolean;
  reduceMotion: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.35]}
      camera={{
        position: [0, 0, 8],
        fov: 48,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
    >
      <color
        attach="background"
        args={["#040c0a"]}
      />

      <fog
        attach="fog"
        args={["#040c0a", 7, 19]}
      />

      <CameraController
        scanning={scanning}
        reduceMotion={reduceMotion}
      />

      <CursorLight
        reduceMotion={reduceMotion}
      />

      <ambientLight intensity={0.5} />

      <directionalLight
        position={[4, 6, 7]}
        intensity={2}
      />

      <pointLight
        position={[3, 2, 4]}
        color={COLORS.green}
        intensity={18}
        distance={11}
      />

      <pointLight
        position={[-4, -2, 3]}
        color={COLORS.cyan}
        intensity={9}
        distance={10}
      />

      <pointLight
        position={[0, 4, -2]}
        color={COLORS.greenBright}
        intensity={7}
        distance={8}
      />

      <InteractiveGroup
        position={[0, 0, 0]}
        strength={0.55}
        depth={0.18}
        reduceMotion={reduceMotion}
      >
        <ShoppingCart
          scanning={scanning}
          reduceMotion={reduceMotion}
        />
      </InteractiveGroup>

      <PriceTag
        price="₹699"
        position={[-3.2, 2.1, -0.5]}
        rotation={[0.05, 0.2, -0.15]}
        scanning={scanning}
        hovered={buttonHovered}
        reduceMotion={reduceMotion}
      />

      <PriceTag
        price="₹749"
        position={[3.2, 1.9, -0.3]}
        rotation={[-0.05, -0.15, 0.18]}
        scanning={scanning}
        hovered={buttonHovered}
        reduceMotion={reduceMotion}
      />

      <PriceTag
        price="₹679"
        position={[3.4, -1.3, 0]}
        rotation={[0.1, 0.15, -0.2]}
        scanning={scanning}
        hovered={buttonHovered}
        reduceMotion={reduceMotion}
      />

      <PriceTag
        price="₹799"
        position={[-3.3, -1.1, -0.2]}
        rotation={[-0.1, -0.15, 0.2]}
        scanning={scanning}
        hovered={buttonHovered}
        reduceMotion={reduceMotion}
      />

      <ProductOrbit
        reduceMotion={reduceMotion}
      />

      <ScannerRings
        reduceMotion={reduceMotion}
        scanning={scanning}
      />

      <ContactShadows
        position={[0, -1.15, 0]}
        opacity={0.45}
        scale={10}
        blur={2.5}
        far={4}
      />

      <Sparkles
        count={reduceMotion ? 45 : 110}
        scale={[12, 8, 10]}
        size={1.8}
        speed={reduceMotion ? 0 : 0.2}
        opacity={
          buttonHovered ? 0.85 : 0.42
        }
        color={COLORS.greenBright}
      />

      <Sparkles
        count={reduceMotion ? 20 : 55}
        scale={[10, 6, 8]}
        size={1.2}
        speed={reduceMotion ? 0 : 0.12}
        opacity={0.28}
        color={COLORS.cyan}
      />
    </Canvas>
  );
}