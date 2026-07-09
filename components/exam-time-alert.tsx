'use client';

import { AlarmClock, Hourglass, Timer, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TimeAlert, TimeAlertLevel, TimerTone } from '@/hooks/useTimeAlerts';

/** Reloj de la cabecera: parpadea cada vez más rápido según aprieta el tiempo. */
export const TIMER_TONE_STYLES: Record<TimerTone, string> = {
  normal: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-50 text-amber-600 animate-exam-timer-amber',
  danger: 'bg-red-50 text-red-600 animate-exam-timer-red',
  urgent: 'bg-red-600 text-white animate-exam-timer-urgent',
};

interface LevelStyle {
  Icon: LucideIcon;
  card: string;
  iconBox: string;
  title: string;
  message: string;
  pending: string;
  close: string;
  flash: string | null;
  pulse: string | null;
}

const LEVEL_STYLES: Record<TimeAlertLevel, LevelStyle> = {
  info: {
    Icon: Hourglass,
    card: 'bg-white border-slate-200 text-slate-900',
    iconBox: 'bg-slate-900 text-white',
    title: 'text-slate-900',
    message: 'text-slate-500',
    pending: 'text-slate-600 bg-slate-100',
    close: 'text-slate-400 hover:bg-slate-100',
    flash: null,
    pulse: null,
  },
  warning: {
    Icon: Timer,
    card: 'bg-amber-500 border-amber-400 text-white',
    iconBox: 'bg-white/20 text-white',
    title: 'text-white',
    message: 'text-amber-50/90',
    pending: 'text-white bg-black/15',
    close: 'text-amber-50 hover:bg-white/15',
    flash: 'rgb(245 158 11 / 0.4)',
    pulse: 'animate-exam-card-pulse-amber',
  },
  critical: {
    Icon: AlarmClock,
    card: 'bg-red-600 border-red-500 text-white',
    iconBox: 'bg-white/20 text-white',
    title: 'text-white',
    message: 'text-red-50/90',
    pending: 'text-white bg-black/20',
    close: 'text-red-50 hover:bg-white/15',
    flash: 'rgb(220 38 38 / 0.45)',
    pulse: 'animate-exam-card-pulse-red',
  },
};

interface ExamTimeAlertProps {
  alert: TimeAlert;
  pendingCount: number;
  onDismiss: () => void;
}

export function ExamTimeAlert({
  alert,
  pendingCount,
  onDismiss,
}: ExamTimeAlertProps) {
  const style = LEVEL_STYLES[alert.level];
  const { Icon } = style;

  return (
    <>
      {/* Destello a pantalla completa; no intercepta clics ni bloquea el examen. */}
      {style.flash && (
        <div
          aria-hidden
          className="fixed inset-0 z-55 pointer-events-none opacity-0 animate-exam-flash"
          style={{ boxShadow: `inset 0 0 140px 24px ${style.flash}` }}
        />
      )}

      <div
        role="alert"
        aria-live="assertive"
        className="fixed inset-x-3 top-3 z-60 mx-auto max-w-md animate-exam-alert-in sm:inset-x-0"
      >
        <div
          className={cn(
            'flex items-start gap-3 rounded-2xl border p-4 shadow-xl',
            style.card,
            style.pulse
          )}
        >
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              style.iconBox
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5',
                alert.level !== 'info' && 'animate-exam-icon-shake'
              )}
            />
          </span>

          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-semibold sm:text-base', style.title)}>
              {alert.title}
            </p>
            <p className={cn('mt-0.5 text-xs sm:text-sm', style.message)}>
              {alert.message}
            </p>
            {pendingCount > 0 && (
              <p
                className={cn(
                  'mt-2 inline-block rounded-md px-2 py-1 text-xs font-medium',
                  style.pending
                )}
              >
                {pendingCount === 1
                  ? 'Te queda 1 pregunta sin responder'
                  : `Te quedan ${pendingCount} preguntas sin responder`}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar aviso"
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
              style.close
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
