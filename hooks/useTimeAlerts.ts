'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type TimeAlertLevel = 'info' | 'warning' | 'critical';

export interface TimeAlert {
  id: string;
  /** Segundos restantes en los que salta el aviso. */
  at: number;
  level: TimeAlertLevel;
  title: string;
  message: string;
  /** Gana el mayor cuando dos avisos caen en el mismo segundo. */
  priority: number;
}

export type TimerTone = 'normal' | 'warning' | 'danger' | 'urgent';

/**
 * Umbrales del reloj de cabecera. Se escalan con la duración para que un examen
 * de 10 minutos no arranque ya en ámbar y uno de 3 horas avise con margen.
 */
export function getTimerThresholds(totalSeconds: number) {
  const warning = Math.min(Math.max(600, totalSeconds * 0.1), totalSeconds / 2);
  const danger = Math.min(300, warning / 2);
  const urgent = Math.min(60, danger / 2);
  return { warning, danger, urgent };
}

export function getTimerTone(
  timeRemaining: number | null,
  totalSeconds: number
): TimerTone {
  if (timeRemaining === null || totalSeconds <= 0) return 'normal';
  const { warning, danger, urgent } = getTimerThresholds(totalSeconds);
  if (timeRemaining <= urgent) return 'urgent';
  if (timeRemaining <= danger) return 'danger';
  if (timeRemaining <= warning) return 'warning';
  return 'normal';
}

function buildAlerts(totalSeconds: number): TimeAlert[] {
  const candidates: TimeAlert[] = [
    {
      id: 'half',
      at: Math.round(totalSeconds / 2),
      priority: 1,
      level: 'info',
      title: 'Ha pasado la mitad del tiempo',
      message: 'Comprueba tu ritmo: deberías llevar más o menos medio examen.',
    },
    {
      id: 'ten-percent',
      at: Math.round(totalSeconds * 0.1),
      priority: 2,
      level: 'critical',
      title: 'Solo queda el 10% del tiempo',
      message: 'Ve cerrando tus respuestas y repasa lo que dejaste en blanco.',
    },
    {
      id: 'ten-minutes',
      at: 10 * 60,
      priority: 3,
      level: 'warning',
      title: 'Quedan 10 minutos',
      message: 'Aprovecha para volver sobre las preguntas pendientes.',
    },
    {
      id: 'five-minutes',
      at: 5 * 60,
      priority: 4,
      level: 'critical',
      title: 'Quedan 5 minutos',
      message: 'Termina lo que estés escribiendo y revisa tus respuestas.',
    },
    {
      id: 'one-minute',
      at: 60,
      priority: 5,
      level: 'critical',
      title: '¡Queda 1 minuto!',
      message: 'El examen se entregará automáticamente al llegar el reloj a cero.',
    },
  ];

  // Dos umbrales pueden caer en el mismo segundo (en un examen de 20 min la
  // mitad son justo los 10 minutos): se queda el más concreto.
  const bySecond = new Map<number, TimeAlert>();
  for (const candidate of candidates) {
    // `at >= totalSeconds` saltaría nada más empezar; `at <= 0` no se cruza nunca.
    if (candidate.at <= 0 || candidate.at >= totalSeconds) continue;
    const existing = bySecond.get(candidate.at);
    if (!existing || candidate.priority > existing.priority) {
      bySecond.set(candidate.at, candidate);
    }
  }

  return [...bySecond.values()].sort((a, b) => b.at - a.at);
}

/** Pitido corto sintetizado: evita tener que servir un audio como asset. */
function playAlarm(level: TimeAlertLevel) {
  if (typeof window === 'undefined') return;

  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) return;

  try {
    const ctx = new AudioCtor();
    void ctx.resume();

    const beeps = level === 'critical' ? 3 : level === 'warning' ? 2 : 1;
    const frequency = level === 'critical' ? 880 : 660;

    for (let i = 0; i < beeps; i++) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = ctx.currentTime + i * 0.22;

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.08, startAt + 0.02);
      gain.gain.linearRampToValueAtTime(0, startAt + 0.18);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.2);
    }

    setTimeout(() => void ctx.close().catch(() => {}), beeps * 250 + 400);
  } catch {
    // El navegador puede bloquear el audio: el aviso visual ya cumple.
  }
}

const DISMISS_MS: Record<TimeAlertLevel, number> = {
  info: 7000,
  warning: 8000,
  critical: 10000,
};

/**
 * Dispara un aviso cada vez que el tiempo restante cruza un umbral.
 * Los umbrales ya rebasados al montar (recarga a mitad de examen) no suenan.
 */
export function useTimeAlerts(timeRemaining: number | null, totalSeconds: number) {
  const [activeAlert, setActiveAlert] = useState<TimeAlert | null>(null);
  const firedIds = useRef<Set<string> | null>(null);
  const dismissTimer = useRef<NodeJS.Timeout | null>(null);

  const alerts = useMemo(() => buildAlerts(totalSeconds), [totalSeconds]);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
    setActiveAlert(null);
  }, []);

  useEffect(() => {
    if (timeRemaining === null) return;

    if (firedIds.current === null) {
      firedIds.current = new Set(
        alerts.filter((a) => a.at >= timeRemaining).map((a) => a.id)
      );
      return;
    }

    const fired = firedIds.current;
    const pending = alerts.filter((a) => !fired.has(a.id) && timeRemaining <= a.at);
    if (pending.length === 0) return;

    pending.forEach((a) => fired.add(a.id));

    // Con la pestaña en segundo plano el reloj salta y puede cruzar varios
    // umbrales de golpe: mostramos solo el más urgente.
    const alert = pending.reduce((most, a) => (a.at < most.at ? a : most));

    playAlarm(alert.level);
    setActiveAlert(alert);

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(
      () => setActiveAlert(null),
      DISMISS_MS[alert.level]
    );
  }, [timeRemaining, alerts]);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  return { activeAlert, dismiss };
}
