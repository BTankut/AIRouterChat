import { motion } from "framer-motion";
import { StopCircle } from "lucide-react";

export function StopAnimation() {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: [1, 1.2, 1],
        opacity: 1,
      }}
      transition={{
        duration: 0.5,
        times: [0, 0.5, 1],
        ease: "easeOut"
      }}
      className="flex items-center gap-2 text-muted-foreground text-sm my-2"
    >
      <motion.div
        animate={{ 
          rotate: [0, 10, -10, 0],
        }}
        transition={{
          duration: 0.5,
          times: [0, 0.25, 0.75, 1],
          ease: "easeInOut",
        }}
      >
        <StopCircle className="h-4 w-4" />
      </motion.div>
      <span>Message generation stopped</span>
    </motion.div>
  );
}
