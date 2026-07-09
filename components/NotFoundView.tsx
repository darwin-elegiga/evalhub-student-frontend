import Image from "next/image";
import { HelpCircle, SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface NotFoundViewProps {
  title?: string;
  description?: string;
  helpText?: string;
}

export function NotFoundView({
  title = "Página no encontrada",
  description = "El enlace que abriste no existe o el examen ya no está disponible.",
  helpText = "Comprueba que copiaste el enlace completo. Si el problema continúa, contacta con tu profesor o con el administrador del sistema.",
}: NotFoundViewProps) {
  return (
    <div className="min-h-dvh bg-linear-to-b from-slate-50 to-slate-100 flex flex-col">
      <header className="w-full py-4 sm:py-6 px-4">
        <div className="max-w-lg mx-auto flex justify-center">
          <Image
            src="/logotipo.png"
            alt="Universidad de Oriente"
            width={200}
            height={50}
            className="h-10 sm:h-12 w-auto opacity-90"
            priority
          />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-6 sm:pb-8">
        <Card className="max-w-lg w-full border-slate-200/80 shadow-lg shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-5 sm:p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <SearchX className="h-7 w-7 text-slate-400" />
            </div>

            <p className="text-xs font-semibold tracking-[0.2em] text-slate-400">
              ERROR 404
            </p>
            <h1 className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900 leading-tight">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {description}
            </p>

            <div className="mt-6 sm:mt-8 rounded-xl border border-amber-200/60 bg-amber-50/80 p-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-amber-900 mb-1.5">
                    ¿Qué puedes hacer?
                  </h2>
                  <p className="text-sm leading-relaxed text-amber-800/90">
                    {helpText}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
