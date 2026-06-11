import confetti from "canvas-confetti";

/**
 * Pequeno efeito de confete para reforçar a sensação de conclusão.
 * Usa cores derivadas dos tokens semânticos (primary + success).
 */
export function fireSuccessConfetti() {
  const defaults = {
    startVelocity: 28,
    spread: 70,
    ticks: 60,
    zIndex: 9999,
    disableForReducedMotion: true,
    colors: ["#4D41F3", "#22c55e", "#10b981", "#a78bfa", "#fbbf24"],
  };

  // Disparo central
  confetti({
    ...defaults,
    particleCount: 80,
    origin: { x: 0.5, y: 0.5 },
  });

  // Pequenos disparos laterais para dar profundidade
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 40,
      angle: 60,
      origin: { x: 0.1, y: 0.6 },
    });
    confetti({
      ...defaults,
      particleCount: 40,
      angle: 120,
      origin: { x: 0.9, y: 0.6 },
    });
  }, 150);
}
