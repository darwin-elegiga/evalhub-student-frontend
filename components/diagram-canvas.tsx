'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import dynamic from 'next/dynamic';
import {
  Loader2,
  Check,
  Upload,
  AlertCircle,
  Maximize2,
  Minimize2,
  RotateCw,
} from 'lucide-react';
import { uploadDiagramAnswer } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  beginManagedFullscreen,
  endManagedFullscreen,
} from '@/lib/fullscreen-guard';
import { ImageWithSkeleton } from '@/components/image-with-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnswerFile } from '@/types/exam';

const ExcalidrawBoard = dynamic(() => import('@/components/excalidraw-board'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-50 text-slate-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando lienzo…
    </div>
  ),
});

// La API imperativa de Excalidraw y sus objetos de escena son opacos aquí.
/* eslint-disable @typescript-eslint/no-explicit-any */
type ExcalidrawApi = any;
type SceneElement = any;
type SceneSnapshot = {
  elements: readonly SceneElement[];
  appState: any;
  files: any;
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type SceneStatus = 'loading' | 'restored' | 'blank';

const REFERENCE_FILE_ID = 'reference-image';
const SAVE_DEBOUNCE_MS = 1500;
const MIN_CANVAS_HEIGHT = 280;
const DEFAULT_CANVAS_HEIGHT = 480;

// Las escenas viven en memoria mientras dura el examen: al cambiar de pregunta el
// lienzo se desmonta y el autoguardado (con debounce) puede no haber llegado aún
// al servidor, así que esta copia es la que garantiza no perder el dibujo.
const sceneCache = new Map<string, SceneSnapshot>();

interface DiagramCanvasProps {
  assignmentId: string;
  questionId: string;
  referenceImageUrl?: string | null;
  allowCanvas?: boolean;
  allowUpload?: boolean;
  canvasHeight?: number;
  initialFiles?: AnswerFile[] | null;
  onSaved?: (files: AnswerFile[]) => void;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

// La figura base va bloqueada, así que todo lo desbloqueado lo puso el alumno.
function hasStudentDrawing(elements: readonly SceneElement[]): boolean {
  return elements.some((el) => !el.locked && !el.isDeleted);
}

function isReferenceElement(el: SceneElement): boolean {
  return el.type === 'image' && el.fileId === REFERENCE_FILE_ID;
}

function sanitizeAppState(appState: any): any {
  if (!appState) return {};
  // `collaborators` es un Map y no sobrevive a la serialización ni al restore.
  const { collaborators, ...rest } = appState;
  void collaborators;
  return rest;
}

type OrientationApi = {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

function getOrientation(): OrientationApi | undefined {
  return (window.screen as unknown as { orientation?: OrientationApi })
    .orientation;
}

export function DiagramCanvas({
  assignmentId,
  questionId,
  referenceImageUrl,
  allowCanvas = true,
  allowUpload = true,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  initialFiles,
  onSaved,
}: DiagramCanvasProps) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshFrame = useRef<number | null>(null);
  const referenceLoaded = useRef(false);
  const lastVersion = useRef<number | null>(null);
  const latestScene = useRef<SceneSnapshot | null>(null);
  const savedOnce = useRef(Boolean(initialFiles?.length));
  const nativeFullscreen = useRef(false);

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [apiReady, setApiReady] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>('loading');
  // Hasta que la escena inicial esté puesta tapamos el lienzo: updateScene()
  // reemplaza los elementos, así que cualquier trazo previo se perdería.
  const [canvasReady, setCanvasReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitTouch, setIsPortraitTouch] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(
    () => initialFiles?.find((f) => f.kind === 'image')?.url ?? null,
  );

  const cacheKey = `${assignmentId}:${questionId}`;
  const savedSceneUrl = useMemo(
    () => initialFiles?.find((f) => f.kind === 'scene')?.url ?? null,
    [initialFiles],
  );

  // -------------------------------------------------------- escena inicial

  const readSavedScene = useCallback(async (): Promise<SceneSnapshot | null> => {
    const cached = sceneCache.get(cacheKey);
    if (cached) return cached;
    if (!savedSceneUrl) return null;
    try {
      const res = await fetch(savedSceneUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.elements) || data.elements.length === 0) {
        return null;
      }
      return {
        elements: data.elements,
        appState: sanitizeAppState(data.appState),
        files: data.files ?? {},
      };
    } catch (err) {
      console.error('No se pudo restaurar el dibujo guardado:', err);
      return null;
    }
  }, [cacheKey, savedSceneUrl]);

  const initialData = useCallback(async () => {
    const scene = await readSavedScene();
    if (!scene) {
      setSceneStatus('blank');
      return null;
    }
    // La escena guardada ya lleva dentro la figura base bloqueada.
    referenceLoaded.current = true;
    const { getSceneVersion } = await import('@excalidraw/excalidraw');
    lastVersion.current = getSceneVersion(scene.elements);
    setSceneStatus('restored');
    return { ...scene, scrollToContent: true };
  }, [readSavedScene]);

  // Carga la imagen base como fondo bloqueado (una sola vez)
  const loadReference = useCallback(
    async (api: ExcalidrawApi) => {
      if (!referenceImageUrl || referenceLoaded.current) return;
      referenceLoaded.current = true;
      try {
        const { convertToExcalidrawElements } = await import(
          '@excalidraw/excalidraw'
        );
        const res = await fetch(referenceImageUrl);
        const blob = await res.blob();
        const dataURL = await blobToDataURL(blob);
        const { width, height } = await loadImageSize(dataURL);
        const maxW = 800;
        const scale = width > maxW ? maxW / width : 1;
        api.addFiles([
          {
            id: REFERENCE_FILE_ID,
            dataURL,
            mimeType: blob.type || 'image/png',
            created: Date.now(),
          },
        ]);
        const skeleton = [
          {
            type: 'image',
            fileId: REFERENCE_FILE_ID,
            x: 0,
            y: 0,
            width: Math.round(width * scale),
            height: Math.round(height * scale),
            locked: true,
          },
        ];
        const reference = convertToExcalidrawElements(
          // fileId es un string branded en los tipos; en runtime acepta el string tal cual
          skeleton as unknown as Parameters<typeof convertToExcalidrawElements>[0],
        );
        const elements = [...reference, ...api.getSceneElements()];
        api.updateScene({ elements });
        api.scrollToContent(elements, { fitToContent: true });
      } catch (err) {
        console.error('No se pudo cargar la imagen base:', err);
      } finally {
        setCanvasReady(true);
      }
    },
    [referenceImageUrl],
  );

  const handleApiReady = useCallback((api: ExcalidrawApi) => {
    apiRef.current = api;
    setApiReady(true);
  }, []);

  // La figura base sólo se añade cuando no hubo escena que restaurar; si no,
  // `updateScene()` borraría el dibujo recién recuperado.
  useEffect(() => {
    if (sceneStatus === 'restored') {
      setCanvasReady(true);
      return;
    }
    if (sceneStatus !== 'blank' || !apiReady || !apiRef.current) return;
    if (!referenceImageUrl) {
      setCanvasReady(true);
      return;
    }
    void loadReference(apiRef.current);
  }, [apiReady, sceneStatus, referenceImageUrl, loadReference]);

  // ---------------------------------------------------------- autoguardado

  const persist = useCallback(async () => {
    const snapshot = latestScene.current;
    if (!snapshot) return;
    const { elements, appState, files } = snapshot;
    if (!hasStudentDrawing(elements) && !savedOnce.current) return;

    setStatus('saving');
    try {
      const { exportToBlob, serializeAsJSON } = await import(
        '@excalidraw/excalidraw'
      );
      const blob = await exportToBlob({
        elements,
        files,
        mimeType: 'image/png',
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: '#ffffff',
        },
      });
      const scene = serializeAsJSON(elements, appState, files, 'local');
      const res = await uploadDiagramAnswer({
        assignmentId,
        questionId,
        image: blob,
        scene,
      });
      savedOnce.current = true;
      setStatus('saved');
      onSaved?.((res.answer.answerFiles as AnswerFile[]) ?? []);
    } catch (err) {
      console.error('Error guardando el dibujo:', err);
      setStatus('error');
    }
  }, [assignmentId, questionId, onSaved]);

  // `onSaved` llega como lambda inline, así que `persist` cambia en cada render.
  // El ref evita que el efecto de desmontaje dependa de su identidad.
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);

  const handleChange = useCallback(
    (
      elements: readonly SceneElement[],
      appState: any,
      files: any,
      sceneVersion: number,
    ) => {
      latestScene.current = { elements, appState, files };
      sceneCache.set(cacheKey, {
        elements,
        appState: sanitizeAppState(appState),
        files,
      });

      // Excalidraw también notifica desplazamientos y zoom: sin dibujo nuevo no
      // hay nada que subir.
      if (sceneVersion === lastVersion.current) return;
      lastVersion.current = sceneVersion;
      if (!hasStudentDrawing(elements) && !savedOnce.current) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void persistRef.current();
      }, SAVE_DEBOUNCE_MS);
    },
    [cacheKey],
  );

  const clearDrawing = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    api.updateScene({
      elements: api.getSceneElements().filter(isReferenceElement),
    });
  }, []);

  // Si el alumno cambia de pregunta antes de que salte el autoguardado, sube el
  // último trazo desde el snapshot (la API ya no es fiable al desmontar).
  useEffect(
    () => () => {
      if (refreshFrame.current !== null) {
        cancelAnimationFrame(refreshFrame.current);
      }
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void persistRef.current();
      }
    },
    [],
  );

  // ----------------------------------------- posición real del contenedor

  // Excalidraw cachea la posición de su contenedor y sólo la recalcula ante
  // resize o scroll. Cualquier otro reflujo (la imagen del enunciado al cargar,
  // el LaTeX al renderizar, entrar en pantalla completa) la deja obsoleta, y
  // entonces el trazo aparece desplazado respecto al puntero.
  const refreshOffsets = useCallback(() => {
    if (refreshFrame.current !== null) return;
    refreshFrame.current = requestAnimationFrame(() => {
      refreshFrame.current = null;
      apiRef.current?.refresh();
    });
  }, []);

  useEffect(() => {
    if (!allowCanvas) return;

    const observer = new ResizeObserver(refreshOffsets);
    observer.observe(document.body);
    if (wrapperRef.current) observer.observe(wrapperRef.current);

    const viewport = window.visualViewport;
    window.addEventListener('scroll', refreshOffsets, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', refreshOffsets);
    window.addEventListener('orientationchange', refreshOffsets);
    viewport?.addEventListener('resize', refreshOffsets);
    viewport?.addEventListener('scroll', refreshOffsets);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', refreshOffsets, { capture: true });
      window.removeEventListener('resize', refreshOffsets);
      window.removeEventListener('orientationchange', refreshOffsets);
      viewport?.removeEventListener('resize', refreshOffsets);
      viewport?.removeEventListener('scroll', refreshOffsets);
    };
  }, [allowCanvas, refreshOffsets]);

  useEffect(() => {
    refreshOffsets();
  }, [isFullscreen, apiReady, refreshOffsets]);

  // ------------------------------------------------------ pantalla completa

  useEffect(() => {
    const query = window.matchMedia(
      '(orientation: portrait) and (pointer: coarse)',
    );
    const update = () => setIsPortraitTouch(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const enterFullscreen = useCallback(async () => {
    setIsFullscreen(true);

    const el = wrapperRef.current;
    if (el?.requestFullscreen) {
      beginManagedFullscreen();
      try {
        await el.requestFullscreen({ navigationUI: 'hide' });
        nativeFullscreen.current = true;
      } catch {
        // iPhone y algún navegador embebido: nos quedamos con la capa CSS.
        endManagedFullscreen();
      }
    }

    // La orientación sólo se puede bloquear desde pantalla completa nativa, e
    // iOS no lo soporta en ningún caso: allí queda el aviso de girar el móvil.
    if (nativeFullscreen.current && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await getOrientation()?.lock?.('landscape');
      } catch {
        /* no soportado */
      }
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    getOrientation()?.unlock?.();
    if (nativeFullscreen.current && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ya estaba fuera */
      }
    }
    nativeFullscreen.current = false;
    endManagedFullscreen();
    setIsFullscreen(false);
  }, []);

  // Sincroniza cuando el alumno sale con Escape o con el gesto del navegador.
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!nativeFullscreen.current) return;
      if (document.fullscreenElement === wrapperRef.current) return;
      nativeFullscreen.current = false;
      endManagedFullscreen();
      getOrientation()?.unlock?.();
      setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(
    () => () => {
      if (nativeFullscreen.current && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    },
    [],
  );

  // En el respaldo CSS (iPhone) la página sigue viva detrás de la capa.
  useEffect(() => {
    if (!isFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen]);

  // ------------------------------------------------------------------ foto

  const handlePhotoUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setStatus('saving');
      try {
        const res = await uploadDiagramAnswer({
          assignmentId,
          questionId,
          image: file,
        });
        setUploadPreview(URL.createObjectURL(file));
        savedOnce.current = true;
        setStatus('saved');
        onSaved?.((res.answer.answerFiles as AnswerFile[]) ?? []);
      } catch (err) {
        console.error('Error subiendo la foto:', err);
        setStatus('error');
      } finally {
        e.target.value = '';
      }
    },
    [assignmentId, questionId, onSaved],
  );

  const boxHeight = Math.max(canvasHeight, MIN_CANVAS_HEIGHT);

  return (
    <div className="space-y-3">
      {allowCanvas && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {referenceImageUrl
                ? 'Dibuja o marca sobre la figura'
                : 'Dibuja tu respuesta'}
            </p>
            <div className="flex items-center gap-3">
              <SaveIndicator status={status} />
              {!isFullscreen && (
                <button
                  type="button"
                  onClick={() => void enterFullscreen()}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Pantalla completa
                </button>
              )}
            </div>
          </div>

          <div
            ref={wrapperRef}
            className={cn(
              'flex w-full flex-col bg-white',
              isFullscreen
                ? 'fixed inset-0 z-[60]'
                : 'overflow-hidden rounded-lg border border-slate-200',
            )}
            style={
              isFullscreen
                ? undefined
                : {
                    height: `clamp(${MIN_CANVAS_HEIGHT}px, 70dvh, ${boxHeight}px)`,
                  }
            }
          >
            {isFullscreen && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                {isPortraitTouch ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <RotateCw className="h-3.5 w-3.5 shrink-0" />
                    Gira el móvil para dibujar con más espacio
                  </span>
                ) : (
                  <SaveIndicator status={status} />
                )}
                <button
                  type="button"
                  onClick={() => void exitFullscreen()}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  Salir
                </button>
              </div>
            )}

            <div className="relative min-h-0 flex-1">
              <ExcalidrawBoard
                excalidrawAPI={handleApiReady}
                initialData={initialData}
                onChange={handleChange}
                onClearDrawing={clearDrawing}
              />
              {!canvasReady && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white p-6">
                  <Skeleton className="h-full w-full max-w-2xl" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {allowUpload && (
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600">
            <Upload className="h-5 w-5 shrink-0 text-slate-400" />
            <span>
              ¿Lo hiciste en papel?{' '}
              <span className="font-medium text-slate-800">Sube una foto</span>
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </label>
          {uploadPreview && (
            <ImageWithSkeleton
              src={uploadPreview}
              alt="Respuesta subida"
              className="mt-3 max-h-48 rounded-md border border-slate-200"
              skeletonClassName="mt-3 h-48 w-full max-w-xs rounded-md"
            />
          )}
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving')
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
      </span>
    );
  if (status === 'saved')
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600">
        <Check className="h-3 w-3" /> Guardado
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <AlertCircle className="h-3 w-3" /> Error al guardar
      </span>
    );
  return null;
}
