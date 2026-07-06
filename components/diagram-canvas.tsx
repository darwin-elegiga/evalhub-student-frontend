'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Check, Upload, AlertCircle } from 'lucide-react';
import '@excalidraw/excalidraw/index.css';
import { uploadDiagramAnswer } from '@/lib/api';
import type { AnswerFile } from '@/types/exam';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando lienzo…
      </div>
    ),
  }
);

// La API imperativa de Excalidraw es un objeto opaco; lo tipamos laxo a propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawApi = any;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

export function DiagramCanvas({
  assignmentId,
  questionId,
  referenceImageUrl,
  allowCanvas = true,
  allowUpload = true,
  canvasHeight = 480,
  initialFiles,
  onSaved,
}: DiagramCanvasProps) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const referenceLoaded = useRef(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [uploadPreview, setUploadPreview] = useState<string | null>(
    () => initialFiles?.find((f) => f.kind === 'image')?.url ?? null,
  );

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
        const fileId = 'reference-image';
        api.addFiles([
          {
            id: fileId,
            dataURL,
            mimeType: blob.type || 'image/png',
            created: Date.now(),
          },
        ]);
        const skeleton = [
          {
            type: 'image',
            fileId,
            x: 0,
            y: 0,
            width: Math.round(width * scale),
            height: Math.round(height * scale),
            locked: true,
          },
        ];
        const elements = convertToExcalidrawElements(
          // fileId es un string branded en los tipos; en runtime acepta el string tal cual
          skeleton as unknown as Parameters<typeof convertToExcalidrawElements>[0],
        );
        api.updateScene({ elements });
        api.scrollToContent(elements, { fitToContent: true });
      } catch (err) {
        console.error('No se pudo cargar la imagen base:', err);
      }
    },
    [referenceImageUrl],
  );

  const handleApiReady = useCallback(
    (api: ExcalidrawApi) => {
      apiRef.current = api;
      void loadReference(api);
    },
    [loadReference],
  );

  const persist = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    // Solo guarda si el alumno dibujó algo (elementos no bloqueados = no son la base)
    const hasDrawing = elements.some(
      (el: { locked?: boolean; isDeleted?: boolean }) =>
        !el.locked && !el.isDeleted,
    );
    if (!hasDrawing) return;

    setStatus('saving');
    try {
      const { exportToBlob, serializeAsJSON } = await import(
        '@excalidraw/excalidraw'
      );
      const files = api.getFiles();
      const appState = api.getAppState();
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
      setStatus('saved');
      onSaved?.((res.answer.answerFiles as AnswerFile[]) ?? []);
    } catch (err) {
      console.error('Error guardando el dibujo:', err);
      setStatus('error');
    }
  }, [assignmentId, questionId, onSaved]);

  const handleChange = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(), 1500);
  }, [persist]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

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

  return (
    <div className="space-y-3">
      {allowCanvas && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {referenceImageUrl
                ? 'Dibuja o marca sobre la figura'
                : 'Dibuja tu respuesta'}
            </p>
            <SaveIndicator status={status} />
          </div>
          <div
            className="overflow-hidden rounded-lg border border-slate-200"
            style={{ height: canvasHeight }}
          >
            <Excalidraw
              excalidrawAPI={handleApiReady}
              onChange={handleChange}
            />
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadPreview}
              alt="Respuesta subida"
              className="mt-3 max-h-48 rounded-md border border-slate-200"
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
