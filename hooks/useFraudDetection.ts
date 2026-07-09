'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { FraudEventType, EventSeverity, LocalFraudEvent } from '@/types/exam';
import { reportFraudEvent } from '@/lib/api';
import { isFullscreenExitManaged } from '@/lib/fullscreen-guard';

interface UseFraudDetectionOptions {
  enabled: boolean;
  assignmentId: string;
  onFraudEvent?: (event: LocalFraudEvent) => void;
}

export function useFraudDetection({
  enabled,
  assignmentId,
  onFraudEvent,
}: UseFraudDetectionOptions) {
  const [events, setEvents] = useState<LocalFraudEvent[]>([]);
  const [warningCount, setWarningCount] = useState(0);
  const devToolsCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastResizeTime = useRef<number>(0);

  const reportEvent = useCallback(
    async (
      eventType: FraudEventType,
      severity: EventSeverity = 'warning',
      details?: Record<string, unknown>
    ) => {
      const localEvent: LocalFraudEvent = {
        type: eventType,
        severity,
        timestamp: new Date(),
        details,
      };

      setEvents((prev) => [...prev, localEvent]);

      // Count warnings and critical events
      if (severity === 'warning' || severity === 'critical') {
        setWarningCount((prev) => prev + 1);
      }

      // Send to backend
      await reportFraudEvent({
        assignmentId,
        eventType,
        severity,
        details,
      });

      onFraudEvent?.(localEvent);
    },
    [assignmentId, onFraudEvent]
  );

  useEffect(() => {
    if (!enabled) return;

    // Tab visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportEvent('tab_change', 'warning');
      }
    };

    // Window focus/blur
    const handleWindowBlur = () => {
      reportEvent('window_blur', 'warning');
    };

    // Fullscreen change
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return;
      // El lienzo de diagramas entra y sale de pantalla completa a propósito.
      if (isFullscreenExitManaged()) return;
      reportEvent('fullscreen_exit', 'warning');
    };

    // Copy event
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportEvent('copy_attempt', 'warning');
    };

    // Paste event
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportEvent('paste_attempt', 'warning');
    };

    // Right click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportEvent('right_click', 'info');
    };

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 - DevTools
      if (e.key === 'F12') {
        e.preventDefault();
        reportEvent('devtools_open', 'critical', { method: 'F12' });
      }

      // Ctrl+Shift+I / Cmd+Option+I - DevTools
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        reportEvent('devtools_open', 'critical', { method: 'Ctrl+Shift+I' });
      }

      // Ctrl+Shift+J / Cmd+Option+J - DevTools Console
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        reportEvent('devtools_open', 'critical', { method: 'Ctrl+Shift+J' });
      }

      // Ctrl+Shift+C / Cmd+Option+C - DevTools Elements
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        reportEvent('devtools_open', 'critical', { method: 'Ctrl+Shift+C' });
      }

      // Ctrl+U / Cmd+U - View source
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        reportEvent('devtools_open', 'critical', { method: 'Ctrl+U' });
      }

      // Ctrl+C / Cmd+C - Copy (allow in text inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          reportEvent('copy_attempt', 'warning', { method: 'keyboard' });
        }
      }

      // Ctrl+V / Cmd+V - Paste (allow in text inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          reportEvent('paste_attempt', 'warning', { method: 'keyboard' });
        }
      }

      // PrintScreen
      if (e.key === 'PrintScreen') {
        reportEvent('screenshot_attempt', 'critical', { method: 'PrintScreen' });
      }
    };

    // Browser resize (debounced)
    const handleResize = () => {
      const now = Date.now();
      // Debounce resize events - only report once every 5 seconds
      if (now - lastResizeTime.current > 5000) {
        lastResizeTime.current = now;
        reportEvent('browser_resize', 'info', {
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    };

    // DevTools detection via window size
    const checkDevTools = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;

      if (widthDiff > threshold || heightDiff > threshold) {
        reportEvent('devtools_open', 'critical', {
          method: 'window_size',
          widthDiff,
          heightDiff,
        });
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    // Start DevTools check interval
    devToolsCheckInterval.current = setInterval(checkDevTools, 2000);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);

      if (devToolsCheckInterval.current) {
        clearInterval(devToolsCheckInterval.current);
      }
    };
  }, [enabled, reportEvent]);

  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      console.warn('Could not enter fullscreen mode');
    }
  }, []);

  const logCustomEvent = useCallback(
    (
      eventType: FraudEventType,
      severity: EventSeverity = 'warning',
      details?: Record<string, unknown>
    ) => {
      reportEvent(eventType, severity, details);
    },
    [reportEvent]
  );

  return {
    events,
    warningCount,
    requestFullscreen,
    reportEvent: logCustomEvent,
  };
}
