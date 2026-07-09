import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Branded fade overlay shown briefly after React mounts, covering the gap
 * between the pre-JS #boot-splash (in index.html) and the data-ready app.
 * Lingers ~900ms then fades out and unmounts.
 */
export function Splash() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-paper"
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: "0.01em",
            color: "var(--color-ink)",
          }}
        >
          Commonplace<span style={{ color: "var(--color-terracotta)" }}>.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
