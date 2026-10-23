import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Animated launch screen. It starts pixel-identical to the iOS launch image
 * and the HTML boot splash, so the hand-off is invisible; then the icon
 * catches the light and the whole screen opens into the app.
 */
export function Splash() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 720);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden="true"
          className="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="splash-icon"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 0.94, 1.02, 1] }}
            exit={{ scale: 1.7, filter: "blur(6px)" }}
            transition={{ duration: 0.6, ease: [0.3, 0.7, 0.4, 1] }}
          >
            <img src="/icons/icon.svg" alt="" draggable={false} />
            <span className="splash-shine" />
          </motion.div>
          <motion.p
            className="splash-word"
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24 }}
          >
            Commonplace<span>.</span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
