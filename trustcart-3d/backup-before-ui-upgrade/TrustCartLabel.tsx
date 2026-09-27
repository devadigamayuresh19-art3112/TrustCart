"use client";

import { motion } from "framer-motion";

interface TrustCartLabelProps {
  scanning?: boolean;
}

export default function TrustCartLabel({
  scanning = false,
}: TrustCartLabelProps) {
  return (
    <motion.group
      scale={scanning ? 1.08 : 1}
      transition={{
        duration: 0.8,
      }}
    >
      {/* This component is kept separate so the brand can
          later be converted into actual 3D text if desired. */}
    </motion.group>
  );
}
