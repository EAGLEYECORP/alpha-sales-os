"use client";

import confetti from "canvas-confetti";

/** Gold/green/paper confetti burst — fired on « Signé ». */
export function fireSignedConfetti() {
  const colors = ["#E8C98A", "#86C06A", "#F3EEE4", "#E0AC46"];
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors });
  setTimeout(
    () => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors }),
    180
  );
  setTimeout(
    () => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors }),
    360
  );
}
