'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { GraphClickConfig, GraphPoint, GraphFunction } from '@/types/exam';
import { ImageWithSkeleton } from '@/components/image-with-skeleton';
import { cn } from '@/lib/utils';

interface GraphEditorProps {
  config: GraphClickConfig;
  mode: 'edit' | 'preview' | 'answer';
  selectedPoint?: GraphPoint | null;
  onPointSelected?: (point: GraphPoint) => void;
  className?: string;
}

export function GraphEditor({
  config,
  mode,
  selectedPoint,
  onPointSelected,
  className,
}: GraphEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });

  // Las preguntas con imagen de fondo no guardan ejes en su typeConfig, así que
  // xRange/yRange llegan undefined; los defaults evitan que el cálculo de escalas
  // de abajo (que corre antes del render con imagen) reviente.
  const {
    xRange = [0, 10],
    yRange = [0, 10],
    showGrid,
    gridStep,
    lines,
    functions,
    isInteractive,
    imageUrl,
  } = config;

  // Calculate scale factors
  const xScale = canvasSize.width / (xRange[1] - xRange[0]);
  const yScale = canvasSize.height / (yRange[1] - yRange[0]);

  // Convert math coordinates to canvas coordinates
  const toCanvasX = useCallback(
    (x: number) => (x - xRange[0]) * xScale,
    [xRange, xScale]
  );

  const toCanvasY = useCallback(
    (y: number) => canvasSize.height - (y - yRange[0]) * yScale,
    [yRange, yScale, canvasSize.height]
  );

  // Convert canvas coordinates to math coordinates
  const toMathX = useCallback(
    (canvasX: number) => canvasX / xScale + xRange[0],
    [xRange, xScale]
  );

  const toMathY = useCallback(
    (canvasY: number) => (canvasSize.height - canvasY) / yScale + yRange[0],
    [yRange, yScale, canvasSize.height]
  );

  // Evaluate mathematical expression
  const evaluateExpression = useCallback((expr: string, x: number): number | null => {
    try {
      const sanitized = expr
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/log/g, 'Math.log')
        .replace(/exp/g, 'Math.exp')
        .replace(/pi/g, 'Math.PI')
        .replace(/e(?![xp])/g, 'Math.E')
        .replace(/\^/g, '**');

      const fn = new Function('x', `return ${sanitized}`);
      const result = fn(x);
      return isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }, []);

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Enable smooth rendering
    ctx.imageSmoothingEnabled = true;

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw grid
    if (showGrid && gridStep) {
      ctx.strokeStyle = '#e5e5e5';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = Math.ceil(xRange[0] / gridStep) * gridStep; x <= xRange[1]; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(x), 0);
        ctx.lineTo(toCanvasX(x), canvasSize.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = Math.ceil(yRange[0] / gridStep) * gridStep; y <= yRange[1]; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, toCanvasY(y));
        ctx.lineTo(canvasSize.width, toCanvasY(y));
        ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;

    // X axis
    if (yRange[0] <= 0 && yRange[1] >= 0) {
      ctx.beginPath();
      ctx.moveTo(0, toCanvasY(0));
      ctx.lineTo(canvasSize.width, toCanvasY(0));
      ctx.stroke();

      // Arrow
      ctx.beginPath();
      ctx.moveTo(canvasSize.width - 8, toCanvasY(0) - 4);
      ctx.lineTo(canvasSize.width, toCanvasY(0));
      ctx.lineTo(canvasSize.width - 8, toCanvasY(0) + 4);
      ctx.stroke();
    }

    // Y axis
    if (xRange[0] <= 0 && xRange[1] >= 0) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), 0);
      ctx.lineTo(toCanvasX(0), canvasSize.height);
      ctx.stroke();

      // Arrow
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0) - 4, 8);
      ctx.lineTo(toCanvasX(0), 0);
      ctx.lineTo(toCanvasX(0) + 4, 8);
      ctx.stroke();
    }

    // Draw axis labels (only major ticks)
    ctx.fillStyle = '#64748b';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (gridStep) {
      const labelStep = gridStep >= 1 ? gridStep : Math.ceil(1 / gridStep) * gridStep;
      const majorStep = labelStep * Math.max(1, Math.floor((xRange[1] - xRange[0]) / 20));

      // X axis labels
      for (let x = Math.ceil(xRange[0] / majorStep) * majorStep; x <= xRange[1]; x += majorStep) {
        if (x !== 0 && Math.abs(x) > 0.001) {
          const label = Number.isInteger(x) ? x.toString() : x.toFixed(1);
          ctx.fillText(label, toCanvasX(x), toCanvasY(0) + 6);
        }
      }

      // Y axis labels
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = Math.ceil(yRange[0] / majorStep) * majorStep; y <= yRange[1]; y += majorStep) {
        if (y !== 0 && Math.abs(y) > 0.001) {
          const label = Number.isInteger(y) ? y.toString() : y.toFixed(1);
          ctx.fillText(label, toCanvasX(0) - 6, toCanvasY(y));
        }
      }
    }

    // Draw lines
    lines?.forEach((line) => {
      ctx.strokeStyle = line.color || '#3b82f6';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      // Support both formats: points array or start/end
      if (line.points && line.points.length > 0) {
        ctx.moveTo(toCanvasX(line.points[0].x), toCanvasY(line.points[0].y));
        for (let i = 1; i < line.points.length; i++) {
          ctx.lineTo(toCanvasX(line.points[i].x), toCanvasY(line.points[i].y));
        }
      } else if (line.start && line.end) {
        ctx.moveTo(toCanvasX(line.start.x), toCanvasY(line.start.y));
        ctx.lineTo(toCanvasX(line.end.x), toCanvasY(line.end.y));
      }
      ctx.stroke();

      // Draw label if exists
      if (line.label) {
        let labelX = 0, labelY = 0;
        if (line.points && line.points.length > 0) {
          labelX = line.points[0].x;
          labelY = line.points[0].y;
        } else if (line.start && line.end) {
          labelX = (line.start.x + line.end.x) / 2;
          labelY = (line.start.y + line.end.y) / 2;
        }

        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = line.color || '#3b82f6';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(line.label, toCanvasX(labelX) + 4, toCanvasY(labelY) - 4);
      }
    });

    // Draw functions
    functions?.forEach((func: GraphFunction) => {
      ctx.strokeStyle = func.color || '#ef4444';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      let started = false;
      const step = (xRange[1] - xRange[0]) / canvasSize.width;

      for (let x = xRange[0]; x <= xRange[1]; x += step) {
        const y = evaluateExpression(func.expression, x);
        if (y !== null && y >= yRange[0] && y <= yRange[1]) {
          if (!started) {
            ctx.moveTo(toCanvasX(x), toCanvasY(y));
            started = true;
          } else {
            ctx.lineTo(toCanvasX(x), toCanvasY(y));
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();

      // Draw function label
      if (func.label) {
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = func.color || '#ef4444';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Position label at a visible point on the function
        const labelX = xRange[0] + (xRange[1] - xRange[0]) * 0.7;
        const labelY = evaluateExpression(func.expression, labelX);
        if (labelY !== null && labelY >= yRange[0] && labelY <= yRange[1]) {
          ctx.fillText(func.label, toCanvasX(labelX) + 4, toCanvasY(labelY) - 16);
        } else {
          ctx.fillText(func.label, 12, 12);
        }
      }
    });

    // Draw selected point
    if (selectedPoint) {
      // Outer circle
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(toCanvasX(selectedPoint.x), toCanvasY(selectedPoint.y), 10, 0, Math.PI * 2);
      ctx.fill();

      // Inner circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(toCanvasX(selectedPoint.x), toCanvasY(selectedPoint.y), 5, 0, Math.PI * 2);
      ctx.fill();

      // Coordinates label with background
      const coordText = `(${selectedPoint.x.toFixed(1)}, ${selectedPoint.y.toFixed(1)})`;
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      const textWidth = ctx.measureText(coordText).width;

      const labelPosX = toCanvasX(selectedPoint.x) + 14;
      const labelPosY = toCanvasY(selectedPoint.y) - 8;

      // Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(labelPosX - 4, labelPosY - 12, textWidth + 8, 18);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(labelPosX - 4, labelPosY - 12, textWidth + 8, 18);

      // Text
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(coordText, labelPosX, labelPosY);
    }
  }, [
    canvasSize,
    xRange,
    yRange,
    showGrid,
    gridStep,
    lines,
    functions,
    selectedPoint,
    toCanvasX,
    toCanvasY,
    evaluateExpression,
  ]);

  // Handle canvas click
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (mode !== 'answer' || !isInteractive) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;

      const mathX = Math.round(toMathX(canvasX) * 10) / 10;
      const mathY = Math.round(toMathY(canvasY) * 10) / 10;

      onPointSelected?.({ x: mathX, y: mathY });
    },
    [mode, isInteractive, toMathX, toMathY, onPointSelected]
  );

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const height = Math.min(width * 0.65, 450);
        setCanvasSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Basta con que haya imagen: image_hotspot no guarda graphType, y graph_click
  // puede traer 'image' o 'custom_image'. El modo cartesiano guarda imageUrl: null.
  if (imageUrl) {
    return (
      <div ref={containerRef} className={cn('relative bg-slate-50', className)}>
        <ImageWithSkeleton
          src={imageUrl}
          alt="Graph"
          className="w-full h-auto"
          skeletonClassName="h-72 w-full rounded-none"
          onClick={(e) => {
            if (mode !== 'answer' || !isInteractive) return;

            const rect = e.currentTarget.getBoundingClientRect();
            // Coordenadas normalizadas 0-1 (fracción de la imagen) para que la
            // corrección sea independiente del tamaño en pantalla.
            const x = Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 10000;
            const y = Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 10000;

            onPointSelected?.({ x, y });
          }}
          style={{ cursor: mode === 'answer' && isInteractive ? 'crosshair' : 'default' }}
        />
        {selectedPoint && (
          <div
            className="absolute w-5 h-5 bg-emerald-500 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${selectedPoint.x * 100}%`, top: `${selectedPoint.y * 100}%` }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('w-full bg-slate-50', className)}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onClick={handleClick}
        className={cn(
          'w-full h-auto block',
          mode === 'answer' && isInteractive && 'cursor-crosshair'
        )}
      />
    </div>
  );
}
