"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Scene3D from "@/components/Scene3D";

export default function IntroPage() {
  const [sceneReady, setSceneReady] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    setReduceMotion(mediaQuery.matches);

    const handleChange = () => {
      setReduceMotion(mediaQuery.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSceneReady(true);
    }, reduceMotion ? 200 : 1000);

    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const handleLetsGo = () => {
    if (scanning) return;

    setScanning(true);

    /*
      PLACEHOLDER NAVIGATION

      Your existing TrustCart Flask application runs at:

      http://127.0.0.1:5000/

      After the 3D scan animation finishes,
      we redirect there.

      If you later deploy everything under one domain,
      you can simply change this to:

      window.location.href = "/";
    */

    setTimeout(() => {
      window.location.href = "http://127.0.0.1:5000/";
    }, reduceMotion ? 100 : 1100);
  };

  return (
    <main className="trustcart-intro">
      {/* =====================================================
          FULL SCREEN 3D BACKGROUND
          ===================================================== */}

      <div className="trustcart-canvas">
        <Scene3D
          scanning={scanning}
          buttonHovered={buttonHovered}
          reduceMotion={reduceMotion}
        />
      </div>

      {/* =====================================================
          LOADING SCREEN
          ===================================================== */}

      {!sceneReady && (
        <motion.div
          className="trustcart-loader"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
        >
          <div className="loader-ring" />

          <span>Loading TrustCart</span>
        </motion.div>
      )}

      {/* =====================================================
          CINEMATIC CENTER CONTENT
          ===================================================== */}

      <div className="trustcart-content">

        <motion.div
          initial={{
            opacity: 0,
            y: 30,
            scale: 0.96,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: scanning ? 1.08 : 1,
          }}
          transition={{
            duration: reduceMotion ? 0.2 : 1,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <h1 className="trustcart-title">
            <span>Trust</span>
            <span>Cart</span>
          </h1>
        </motion.div>

        <motion.p
          className="trustcart-tagline"
          initial={{
            opacity: 0,
            y: 18,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: reduceMotion ? 0.2 : 0.8,
            delay: reduceMotion ? 0 : 0.3,
          }}
        >
          Compare prices. Trust every deal.
        </motion.p>

        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: reduceMotion ? 0.2 : 0.8,
            delay: reduceMotion ? 0 : 0.55,
          }}
        >
          <button
            className={`lets-go-button ${
              buttonHovered ? "lets-go-hovered" : ""
            } ${scanning ? "lets-go-scanning" : ""}`}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
            onClick={handleLetsGo}
            disabled={scanning}
          >
            <span>
              {scanning ? "Scanning..." : "Let’s go"}
            </span>

            {!scanning && (
              <span className="button-arrow">→</span>
            )}
          </button>
        </motion.div>
      </div>

      {/* =====================================================
          CINEMATIC VIGNETTE
          ===================================================== */}

      <div className="trustcart-vignette" />

      {/* =====================================================
          SCAN FLASH
          ===================================================== */}

      {scanning && (
        <motion.div
          className="scan-flash"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.25, 0],
          }}
          transition={{
            duration: 1,
          }}
        />
      )}
    </main>
  );
}
