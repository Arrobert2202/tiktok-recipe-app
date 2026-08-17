"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
}

interface CookModeProps {
  steps: string[];
  ingredients: Ingredient[];
  title: string;
  onClose: () => void;
}

export function CookMode({ steps, ingredients, title, onClose }: CookModeProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [dragX, setDragX] = useState(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const acquireWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator)) {
      setWakeLockSupported(false);
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
    } catch {
      // Wake lock request can fail (e.g., low battery)
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  // Acquire wake-lock on mount, release on unmount
  useEffect(() => {
    acquireWakeLock();
    return () => {
      releaseWakeLock();
    };
  }, [acquireWakeLock, releaseWakeLock]);

  // Re-acquire wake-lock on visibility change
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        acquireWakeLock();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [acquireWakeLock]);

  const goToPreviousStep = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNextStep = () => {
    setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -80 && currentStepIndex < steps.length - 1) {
      goToNextStep();
    } else if (info.offset.x > 80 && currentStepIndex > 0) {
      goToPreviousStep();
    }
    setDragX(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white overflow-hidden"
    >
      {/* Exit pill - top right */}
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-sm font-medium"
          aria-label="Exit Cook Mode"
        >
          <X className="w-4 h-4" />
          Exit
        </button>
      </div>

      {/* Wake-lock unsupported notice */}
      {!wakeLockSupported && (
        <div className="absolute top-6 left-6 px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-200 text-xs">
          Screen sleep prevention unavailable
        </div>
      )}

      {/* Main swipeable content area */}
      <div ref={constraintsRef} className="flex-1 flex flex-col items-center justify-center px-8 relative">
        {/* Touch zones (left 40% = prev, right 40% = next) */}
        <div
          className="absolute inset-y-0 left-0 w-[40%] z-10 cursor-pointer"
          onClick={goToPreviousStep}
          aria-label="Previous step"
        />
        <div
          className="absolute inset-y-0 right-0 w-[40%] z-10 cursor-pointer"
          onClick={goToNextStep}
          aria-label="Next step"
        />

        {/* Step counter - glowing */}
        <motion.div
          key={`counter-${currentStepIndex}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <span className="text-7xl sm:text-8xl font-black bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
            {currentStepIndex + 1}
          </span>
        </motion.div>

        {/* Step text - massive, draggable */}
        <motion.div
          key={`step-${currentStepIndex}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="max-w-3xl text-center z-20 cursor-grab active:cursor-grabbing"
        >
          <p className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-snug">
            {steps[currentStepIndex]}
          </p>
        </motion.div>
      </div>

      {/* Step indicator dots */}
      <div className="flex items-center justify-center gap-2 py-8">
        {steps.map((_, index) => (
          <div key={index} className="relative">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                index === currentStepIndex
                  ? "bg-white scale-125"
                  : index < currentStepIndex
                    ? "bg-white/50"
                    : "bg-white/20"
              }`}
            />
            {/* Pulsing dot on current */}
            {index === currentStepIndex && (
              <motion.div
                className="absolute inset-0 rounded-full bg-white/50"
                animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, type: "tween", ease: "easeInOut" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom hint */}
      <div className="text-center pb-6 text-sm text-white/30">
        Tap sides or swipe to navigate
      </div>
    </motion.div>
  );
}
