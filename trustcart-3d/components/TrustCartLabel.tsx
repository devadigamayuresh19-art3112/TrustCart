"use client";

import { motion } from "framer-motion";

interface TrustCartLabelProps {
  scanning?: boolean;
  reduceMotion?: boolean;
}

export default function TrustCartLabel({
  scanning = false,
  reduceMotion = false,
}: TrustCartLabelProps) {
  return (
    <div className="trustcart-brand">
      <motion.h1
        className="trustcart-title"
        animate={{
          letterSpacing: scanning ? "0.08em" : "0.015em",
        }}
        transition={{
          duration: reduceMotion ? 0 : 0.7,
        }}
      >
        <span className="trust-word">Trust</span>
        <span className="cart-word">Cart</span>
      </motion.h1>

      <motion.div
        className="brand-glow"
        animate={{
          opacity: scanning ? 1 : 0.65,
          scaleX: scanning ? 1.25 : 1,
        }}
        transition={{
          duration: reduceMotion ? 0 : 0.7,
        }}
      />
    </div>
  );
}
