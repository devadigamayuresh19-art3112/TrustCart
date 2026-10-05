"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Scene3D from "@/components/Scene3D";
import TrustCartLabel from "@/components/TrustCartLabel";
import Tagline from "@/components/Tagline";
import LetsGoButton from "@/components/LetsGoButton";

export default function IntroPage() {
  const [sceneReady, setSceneReady] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const handleChange = () => {
      setReduceMotion(mediaQuery.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSceneReady(true),
      reduceMotion ? 100 : 800
    );

    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  const handleLetsGo = () => {
    if (scanning) return;

    setScanning(true);

    window.setTimeout(() => {
      window.location.href = "/app";
    }, reduceMotion ? 100 : 1150);
  };

  return (
    <main className="trustcart-intro">
      <div className="trustcart-canvas">
        <Scene3D
          scanning={scanning}
          buttonHovered={buttonHovered}
          reduceMotion={reduceMotion}
        />
      </div>

      {!sceneReady && (
        <motion.div
          className="trustcart-loader"
          initial={{ opacity: 1 }}
          animate={{ opacity: sceneReady ? 0 : 1 }}
          transition={{ duration: 0.35 }}
          aria-label="Loading TrustCart"
        >
          <div className="loader-mark">
            <span />
            <span />
            <span />
          </div>

          <span className="loader-text">
            Loading TrustCart
          </span>
        </motion.div>
      )}

      <section
        className={`trustcart-content ${
          scanning ? "trustcart-content-scanning" : ""
        }`}
      >
        <motion.div
          initial={{
            opacity: 0,
            y: 28,
            scale: 0.96,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: scanning ? 1.06 : 1,
          }}
          transition={{
            duration: reduceMotion ? 0.2 : 0.9,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <TrustCartLabel
            scanning={scanning}
            reduceMotion={reduceMotion}
          />
        </motion.div>

        <motion.div
          className="trustcart-tagline-wrap"
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: reduceMotion ? 0.2 : 0.75,
            delay: reduceMotion ? 0 : 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Tagline />
        </motion.div>

        <motion.div
          className="trustcart-button-wrap"
          initial={{
            opacity: 0,
            y: 18,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: reduceMotion ? 0.2 : 0.75,
            delay: reduceMotion ? 0 : 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <LetsGoButton
            scanning={scanning}
            hovered={buttonHovered}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
            onClick={handleLetsGo}
          />
        </motion.div>
      </section>

      <div className="trustcart-vignette" />

      {scanning && (
        <>
          <motion.div
            className="scan-flash"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.18, 0],
            }}
            transition={{
              duration: 1.05,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="scan-line"
            initial={{
              opacity: 0,
              scaleY: 0,
            }}
            animate={{
              opacity: [0, 1, 0],
              scaleY: [0, 1, 1],
            }}
            transition={{
              duration: 0.9,
              ease: "easeOut",
            }}
          />
        </>
      )}
    </main>
  );
}
