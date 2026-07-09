'use client';

// El detector de fraude reporta cualquier salida de pantalla completa. El lienzo
// de diagramas también usa la Fullscreen API, así que marca sus propias
// transiciones para que no cuenten como intento de fraude.
//
// La ventana de gracia existe porque ambos escuchan `fullscreenchange` sobre
// `document` y el orden de los listeners depende del orden de montaje.

const GRACE_MS = 2000;

let ownedByCanvas = false;
let graceUntil = 0;

export function beginManagedFullscreen(): void {
  ownedByCanvas = true;
  graceUntil = Date.now() + GRACE_MS;
}

export function endManagedFullscreen(): void {
  ownedByCanvas = false;
  graceUntil = Date.now() + GRACE_MS;
}

export function isFullscreenExitManaged(): boolean {
  return ownedByCanvas || Date.now() < graceUntil;
}
