"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Float,
  RoundedBox,
  Sparkles,
  Text,
  Torus,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

/* =========================================================
   TRUSTCART COLOR SYSTEM

   Change these colors to modify the entire visual identity.
   ========================================================= */

const COLORS = {
  background: "#050b12",

  blue: "#19bfff",
  teal: "#16e0c2",
  purple: "#8b5cf6",

  cart: "#12212d",
  cartHighlight: "#24d6e8",

  white: "#ffffff",
};

/* =========================================================
   CAMERA PARALLAX
   ========================================================= */

function CameraController({
  scanning,
  reduceMotion,
}: {
  scanning: boolean;
  reduceMotion: boolean;
}) {
  const { camera, pointer } = useThree();

  useFrame((state) => {
    if (reduceMotion) {
      camera.position.x = 0;
      camera.position.y = 0;
      camera.position.z = scanning ? 5.7 : 8;

      camera.lookAt(0, 0, 0);
      return;
    }

    const targetX = pointer.x * 0.35;
    const targetY = pointer.y * 0.2;

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

    const targetZ = scanning ? 5.5 : 8;

    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      targetZ,
      scanning ? 0.035 : 0.025
    );

    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* =========================================================
   CART BODY
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

    const time = state.clock.elapsedTime;

    group.current.rotation.y =
      Math.sin(time * 0.35) * 0.12;

    group.current.rotation.x =
      Math.sin(time * 0.25) * 0.035;

    group.current.position.y =
      Math.sin(time * 0.8) * 0.08;

    if (scanning) {
      group.current.rotation.y += 0.015;
    }
  });

  return (
    <group
      ref={group}
      scale={scanning ? 1.08 : 1}
    >

      {/* =====================================================
          CART BASKET
          ===================================================== */}

      <RoundedBox
        args={[3.3, 1.55, 1.65]}
        radius={0.16}
        smoothness={4}
        position={[0, 0.45, 0]}
      >
        <meshPhysicalMaterial
          color={COLORS.cart}
          metalness={0.72}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </RoundedBox>

      {/* =====================================================
          BASKET GRID
          ===================================================== */}

      {[-0.55, -0.18, 0.18, 0.55].map(
        (x, index) => (
          <mesh
            key={`vertical-${index}`}
            position={[x, 0.45, 0.84]}
          >
            <boxGeometry args={[0.035, 1.1, 0.04]} />
            <meshStandardMaterial
              color={COLORS.cartHighlight}
              emissive={COLORS.blue}
              emissiveIntensity={0.8}
              metalness={0.7}
            />
          </mesh>
        )
      )}

      {[-0.25, 0.1, 0.45].map(
        (y, index) => (
          <mesh
            key={`horizontal-${index}`}
            position={[0, y, 0.85]}
          >
            <boxGeometry args={[2.8, 0.035, 0.04]} />
            <meshStandardMaterial
              color={COLORS.cartHighlight}
              emissive={COLORS.teal}
              emissiveIntensity={0.7}
              metalness={0.7}
            />
          </mesh>
        )
      )}

      {/* =====================================================
          CART HANDLE
          ===================================================== */}

      <mesh
        position={[-1.95, 1.15, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.11, 0.11, 1.2, 12]} />

        <meshStandardMaterial
          color={COLORS.cartHighlight}
          emissive={COLORS.blue}
          emissiveIntensity={1}
          metalness={0.8}
          roughness={0.18}
        />
      </mesh>

      {/* =====================================================
          CART SUPPORT
          ===================================================== */}

      <mesh
        position={[-1.7, -0.25, 0]}
        rotation={[0, 0, -0.18]}
      >
        <boxGeometry args={[0.18, 1.1, 0.18]} />

        <meshStandardMaterial
          color={COLORS.cartHighlight}
          emissive={COLORS.blue}
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* =====================================================
          WHEELS
          ===================================================== */}

      <Torus
        args={[0.3, 0.11, 12, 32]}
        position={[-1.15, -0.55, 0.7]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#172d3b"
          metalness={0.9}
          roughness={0.15}
        />
      </Torus>

      <Torus
        args={[0.3, 0.11, 12, 32]}
        position={[1.15, -0.55, 0.7]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#172d3b"
          metalness={0.9}
          roughness={0.15}
        />
      </Torus>

      {/* =====================================================
          GLOWING CART STRIP
          ===================================================== */}

      <mesh position={[0, -0.27, 0.86]}>
        <boxGeometry args={[2.6, 0.035, 0.04]} />

        <meshStandardMaterial
          color={COLORS.teal}
          emissive={COLORS.teal}
          emissiveIntensity={3}
        />
      </mesh>
    </group>
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
}: {
  price: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scanning: boolean;
  hovered: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;

    const time = state.clock.elapsedTime;

    group.current.position.y =
      position[1] + Math.sin(time * 0.8 + position[0]) * 0.12;

    group.current.rotation.z =
      rotation[2] +
      Math.sin(time * 0.6 + position[1]) * 0.08;

    if (scanning) {
      group.current.scale.lerp(
        new THREE.Vector3(1.25, 1.25, 1.25),
        0.08
      );
    } else if (hovered) {
      group.current.scale.lerp(
        new THREE.Vector3(1.12, 1.12, 1.12),
        0.08
      );
    } else {
      group.current.scale.lerp(
        new THREE.Vector3(1, 1, 1),
        0.08
      );
    }
  });

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
    >
      <RoundedBox
        args={[1.35, 0.75, 0.08]}
        radius={0.12}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color={hovered ? "#183b4c" : "#101e2a"}
          metalness={0.55}
          roughness={0.18}
          clearcoat={1}
          emissive={
            hovered
              ? COLORS.blue
              : "#06131d"
          }
          emissiveIntensity={
            hovered ? 0.65 : 0.15
          }
        />
      </RoundedBox>

      <Text
        position={[0, 0, 0.07]}
        fontSize={0.29}
        color={COLORS.white}
        anchorX="center"
        anchorY="middle"
      >
        {price}
      </Text>

      <mesh position={[-0.48, 0, 0.075]}>
        <sphereGeometry args={[0.055, 8, 8]} />

        <meshStandardMaterial
          color={COLORS.teal}
          emissive={COLORS.teal}
          emissiveIntensity={3}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   3D PHONE
   ========================================================= */

function Phone({
  position,
}: {
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    ref.current.rotation.y =
      state.clock.elapsedTime * 0.45;

    ref.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.6) * 0.1;
  });

  return (
    <group ref={ref} position={position}>
      <RoundedBox
        args={[0.65, 1.25, 0.12]}
        radius={0.08}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color="#111b28"
          metalness={0.7}
          roughness={0.18}
          clearcoat={1}
        />
      </RoundedBox>

      <mesh position={[0, 0, 0.075]}>
        <boxGeometry args={[0.48, 0.92, 0.015]} />

        <meshStandardMaterial
          color="#0a2638"
          emissive={COLORS.blue}
          emissiveIntensity={0.55}
        />
      </mesh>

      <mesh position={[0, 0.49, 0.09]}>
        <sphereGeometry args={[0.035, 8, 8]} />

        <meshStandardMaterial
          color={COLORS.white}
          emissive={COLORS.white}
          emissiveIntensity={1}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   HEADPHONES
   ========================================================= */

function Headphones({
  position,
}: {
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    ref.current.rotation.y =
      Math.sin(state.clock.elapsedTime * 0.5) * 0.4;
  });

  return (
    <group ref={ref} position={position}>
      <Torus
        args={[0.48, 0.07, 10, 32, Math.PI]}
        rotation={[0, 0, Math.PI]}
      >
        <meshStandardMaterial
          color={COLORS.blue}
          metalness={0.7}
          roughness={0.2}
          emissive={COLORS.blue}
          emissiveIntensity={0.5}
        />
      </Torus>

      <mesh position={[-0.48, -0.05, 0]}>
        <sphereGeometry args={[0.17, 12, 12]} />

        <meshPhysicalMaterial
          color="#162738"
          metalness={0.65}
          roughness={0.18}
          clearcoat={1}
        />
      </mesh>

      <mesh position={[0.48, -0.05, 0]}>
        <sphereGeometry args={[0.17, 12, 12]} />

        <meshPhysicalMaterial
          color="#162738"
          metalness={0.65}
          roughness={0.18}
          clearcoat={1}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   LAPTOP
   ========================================================= */

function Laptop({
  position,
}: {
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    ref.current.rotation.y =
      state.clock.elapsedTime * -0.3;

    ref.current.position.y =
      position[1] +
      Math.sin(state.clock.elapsedTime * 0.7) * 0.08;
  });

  return (
    <group ref={ref} position={position}>
      <RoundedBox
        args={[1.15, 0.7, 0.08]}
        radius={0.05}
        smoothness={3}
        rotation={[-0.25, 0, 0]}
      >
        <meshPhysicalMaterial
          color="#172433"
          metalness={0.8}
          roughness={0.18}
          clearcoat={1}
        />
      </RoundedBox>

      <mesh
        position={[0, 0, 0.05]}
        rotation={[-0.25, 0, 0]}
      >
        <planeGeometry args={[0.88, 0.48]} />

        <meshStandardMaterial
          color="#0b3143"
          emissive={COLORS.teal}
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   SHOE
   ========================================================= */

function Shoe({
  position,
}: {
  position: [number, number, number];
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;

    ref.current.rotation.y =
      Math.sin(state.clock.elapsedTime * 0.4) * 0.5;

    ref.current.rotation.z =
      Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
  });

  return (
    <group ref={ref} position={position}>
      <RoundedBox
        args={[1.2, 0.45, 0.5]}
        radius={0.12}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color="#20283a"
          metalness={0.35}
          roughness={0.3}
          clearcoat={0.8}
        />
      </RoundedBox>

      <mesh position={[0.28, 0.05, 0.26]}>
        <boxGeometry args={[0.45, 0.18, 0.03]} />

        <meshStandardMaterial
          color={COLORS.purple}
          emissive={COLORS.purple}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   ORBITING PRODUCTS
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
      state.clock.elapsedTime * 0.08;
  });

  return (
    <group ref={group}>
      <Float
        speed={1}
        rotationIntensity={0.25}
        floatIntensity={0.35}
      >
        <Phone position={[-4, 1.8, -1]} />
      </Float>

      <Float
        speed={1.2}
        rotationIntensity={0.3}
        floatIntensity={0.4}
      >
        <Headphones position={[3.8, 1.6, -0.5]} />
      </Float>

      <Float
        speed={0.9}
        rotationIntensity={0.2}
        floatIntensity={0.35}
      >
        <Laptop position={[3.7, -1.8, -1]} />
      </Float>

      <Float
        speed={1.1}
        rotationIntensity={0.4}
        floatIntensity={0.45}
      >
        <Shoe position={[-3.7, -1.7, -0.5]} />
      </Float>
    </group>
  );
}

/* =========================================================
   DATA RINGS
   ========================================================= */

function DataRings({
  reduceMotion,
}: {
  reduceMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current || reduceMotion) return;

    group.current.rotation.x =
      state.clock.elapsedTime * 0.08;

    group.current.rotation.z =
      state.clock.elapsedTime * 0.05;
  });

  return (
    <group ref={group}>
      <Torus
        args={[2.8, 0.012, 8, 128]}
        rotation={[Math.PI / 2.3, 0.2, 0]}
      >
        <meshBasicMaterial
          color={COLORS.blue}
          transparent
          opacity={0.28}
        />
      </Torus>

      <Torus
        args={[3.5, 0.009, 8, 128]}
        rotation={[Math.PI / 2.1, -0.2, 0]}
      >
        <meshBasicMaterial
          color={COLORS.purple}
          transparent
          opacity={0.2}
        />
      </Torus>

      <Torus
        args={[4.2, 0.007, 8, 128]}
        rotation={[Math.PI / 1.8, 0.1, 0]}
      >
        <meshBasicMaterial
          color={COLORS.teal}
          transparent
          opacity={0.16}
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
      dpr={[1, 1.5]}
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
        args={[COLORS.background]}
      />

      <fog
        attach="fog"
        args={[COLORS.background, 7, 18]}
      />

      {/* CAMERA */}
      <CameraController
        scanning={scanning}
        reduceMotion={reduceMotion}
      />

      {/* =====================================================
          LIGHTING
          ===================================================== */}

      <ambientLight intensity={0.45} />

      <directionalLight
        position={[4, 5, 6]}
        intensity={2}
      />

      <pointLight
        position={[3, 2, 4]}
        color={COLORS.blue}
        intensity={18}
        distance={10}
      />

      <pointLight
        position={[-4, -2, 3]}
        color={COLORS.purple}
        intensity={12}
        distance={10}
      />

      <pointLight
        position={[0, 4, -2]}
        color={COLORS.teal}
        intensity={8}
        distance={8}
      />

      {/* =====================================================
          CENTRAL CART
          ===================================================== */}

      <ShoppingCart
        scanning={scanning}
        reduceMotion={reduceMotion}
      />

      {/* =====================================================
          PRICE TAGS
          ===================================================== */}

      <PriceTag
        price="$49"
        position={[-3.2, 2.1, -0.5]}
        rotation={[0.05, 0.2, -0.15]}
        scanning={scanning}
        hovered={buttonHovered}
      />

      <PriceTag
        price="$39"
        position={[3.2, 1.9, -0.3]}
        rotation={[-0.05, -0.15, 0.18]}
        scanning={scanning}
        hovered={buttonHovered}
      />

      <PriceTag
        price="$45"
        position={[3.4, -1.3, 0]}
        rotation={[0.1, 0.15, -0.2]}
        scanning={scanning}
        hovered={buttonHovered}
      />

      <PriceTag
        price="$29"
        position={[-3.3, -1.1, -0.2]}
        rotation={[-0.1, -0.15, 0.2]}
        scanning={scanning}
        hovered={buttonHovered}
      />

      {/* =====================================================
          PRODUCTS
          ===================================================== */}

      <ProductOrbit reduceMotion={reduceMotion} />

      {/* =====================================================
          DATA RINGS
          ===================================================== */}

      <DataRings reduceMotion={reduceMotion} />

      {/* =====================================================
          PARTICLES
          ===================================================== */}

      <Sparkles
        count={reduceMotion ? 60 : 180}
        scale={[12, 8, 10]}
        size={2}
        speed={reduceMotion ? 0 : 0.25}
        opacity={buttonHovered ? 0.95 : 0.55}
        color={COLORS.blue}
      />

      <Sparkles
        count={reduceMotion ? 30 : 90}
        scale={[10, 6, 8]}
        size={1.5}
        speed={reduceMotion ? 0 : 0.18}
        opacity={0.5}
        color={COLORS.teal}
      />

      <Sparkles
        count={reduceMotion ? 20 : 50}
        scale={[9, 5, 7]}
        size={1.2}
        speed={reduceMotion ? 0 : 0.12}
        opacity={0.35}
        color={COLORS.purple}
      />
    </Canvas>
  );
}
