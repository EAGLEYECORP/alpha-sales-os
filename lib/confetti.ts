"use client";

import confetti from "canvas-confetti";

/** Bronze/paper confetti burst — fired on « Signé ». */
export function fireSignedConfetti() {
  const colors = ["#b08d57", "#d9bc8c", "#e8e2d9", "#8f6f42"];
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
