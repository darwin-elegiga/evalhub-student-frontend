'use client';

import Image from 'next/image';
import { Clock, FileText, User, AlertTriangle, Play, Loader2 } from 'lucide-react';
import type { ExamTokenResponse } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ExamWelcomeProps {
  data: ExamTokenResponse;
  onStart: () => void;
  isStarting: boolean;
}

export function ExamWelcome({ data, onStart, isStarting }: ExamWelcomeProps) {
  const { exam, student, questions } = data;

  return (
    <div className="min-h-dvh bg-linear-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Header con logo */}
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

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-6 sm:pb-8">
        <Card className="max-w-lg w-full border-slate-200/80 shadow-lg shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-5 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-2 leading-tight">
                {exam.title}
              </h1>
              {exam.description && (
                <p className="text-slate-500 text-sm leading-relaxed">{exam.description}</p>
              )}
            </div>

            {/* Exam Info */}
            <div className="space-y-0 mb-6 sm:mb-8 bg-slate-50/80 rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between py-3 border-b border-slate-200/60">
                <span className="flex items-center gap-2.5 text-slate-600 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  Estudiante
                </span>
                <span className="font-medium text-slate-900 text-sm sm:text-base text-right max-w-[60%] truncate">
                  {student.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-200/60">
                <span className="flex items-center gap-2.5 text-slate-600 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Duración
                </span>
                <span className="font-medium text-slate-900 text-sm sm:text-base">
                  {exam.durationMinutes} minutos
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2.5 text-slate-600 text-sm">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Preguntas
                </span>
                <span className="font-medium text-slate-900 text-sm sm:text-base">
                  {questions.length}
                </span>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-4 mb-6 sm:mb-8">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-amber-900 mb-2">
                    Antes de comenzar
                  </h2>
                  <ul className="space-y-1.5 text-sm text-amber-800/90">
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                      <span>El examen no se puede pausar una vez iniciado</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                      <span>Tus respuestas se guardan automáticamente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                      <span>No cambies de pestaña ni minimices la ventana</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                      <span>Se recomienda usar pantalla completa</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={onStart}
              disabled={isStarting}
              size="lg"
              className="w-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white h-12 sm:h-14 text-base font-medium rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Iniciar examen
                </>
              )}
            </Button>

            <p className="text-center text-xs text-slate-400 mt-4 px-4">
              Al hacer clic, aceptas las condiciones y comenzará el tiempo
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 px-4">
        <p className="text-center text-xs text-slate-400">
          EvalHub — Sistema de Evaluación en Línea
        </p>
      </footer>
    </div>
  );
}
