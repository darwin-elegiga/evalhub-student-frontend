'use client';

import { useCallback, useState } from 'react';
import { ImageIcon, ImageOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ImageWithSkeletonProps = Omit<React.ComponentProps<'img'>, 'src' | 'alt'> & {
  src: string;
  alt: string;
  /** Tamaño del hueco mientras carga. Debe reservar el alto esperado de la imagen. */
  skeletonClassName?: string;
};

/**
 * `<img>` que muestra un skeleton hasta que la imagen termina de cargar, y un
 * aviso si falla. Pensado para las imágenes servidas desde el storage (apoyo del
 * enunciado, imagen clicable del graph_click, foto de la respuesta).
 *
 * No admite `loading="lazy"`: hasta que carga, la imagen está en `display:none`
 * y el navegador nunca la traería.
 */
export function ImageWithSkeleton({
  src,
  alt,
  className,
  skeletonClassName,
  onLoad,
  onError,
  ...props
}: ImageWithSkeletonProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Una imagen ya cacheada puede completarse antes de que React enganche onLoad,
  // así que el skeleton se quedaría colgado. Lo comprobamos al montar el nodo.
  const checkCached = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) setLoadedSrc(src);
    },
    [src],
  );

  if (src === failedSrc) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-xs text-slate-500',
          skeletonClassName,
        )}
      >
        <ImageOff className="h-5 w-5 text-slate-400" />
        <span>No se pudo cargar la imagen</span>
      </div>
    );
  }

  const isLoaded = src === loadedSrc;

  return (
    <>
      {!isLoaded && (
        <Skeleton
          className={cn(
            'flex h-48 w-full items-center justify-center rounded-lg',
            skeletonClassName,
          )}
        >
          <ImageIcon className="h-8 w-8 text-slate-400/60" />
        </Skeleton>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...props}
        ref={checkCached}
        src={src}
        alt={alt}
        className={cn(
          className,
          isLoaded ? 'animate-image-fade-in' : 'hidden',
        )}
        onLoad={(e) => {
          setLoadedSrc(src);
          onLoad?.(e);
        }}
        onError={(e) => {
          setFailedSrc(src);
          onError?.(e);
        }}
      />
    </>
  );
}
