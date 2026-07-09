'use client';

import { Excalidraw, MainMenu, getSceneVersion } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Trash2 } from 'lucide-react';

// Los objetos de escena de Excalidraw sólo se transportan de aquí al padre.
/* eslint-disable @typescript-eslint/no-explicit-any */

interface ExcalidrawBoardProps {
  excalidrawAPI: (api: any) => void;
  initialData: () => Promise<any>;
  onChange: (
    elements: readonly any[],
    appState: any,
    files: any,
    sceneVersion: number,
  ) => void;
  onClearDrawing: () => void;
}

// Se importa dinámicamente (sin SSR) desde diagram-canvas. Al estar en su propio
// módulo, `MainMenu` conserva sus subcomponentes estáticos (`DefaultItems`).
export default function ExcalidrawBoard({
  excalidrawAPI,
  initialData,
  onChange,
  onClearDrawing,
}: ExcalidrawBoardProps) {
  return (
    <Excalidraw
      excalidrawAPI={excalidrawAPI}
      initialData={initialData}
      onChange={(elements, appState, files) =>
        onChange(elements, appState, files, getSceneVersion(elements))
      }
      langCode="es-ES"
      UIOptions={{
        canvasActions: {
          clearCanvas: false,
          export: false,
          loadScene: false,
          saveAsImage: false,
          saveToActiveFile: false,
          // El tema oscuro invierte los trazos y el PNG se exporta sobre blanco.
          toggleTheme: false,
        },
      }}
    >
      {/* Sustituye al menú por defecto, que incluye los enlaces a GitHub,
          X y Discord de Excalidraw. */}
      <MainMenu>
        <MainMenu.Item
          icon={<Trash2 className="h-4 w-4" />}
          onSelect={onClearDrawing}
        >
          Borrar mi dibujo
        </MainMenu.Item>
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
    </Excalidraw>
  );
}
