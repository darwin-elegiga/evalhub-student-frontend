'use client';

import Image from 'next/image';
import { CheckCircle, Clock, FileText, User } from 'lucide-react';
import type { ExamTokenResponse } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';

interface ExamCompletedProps {
  data: ExamTokenResponse;
}

export function ExamCompleted({ data }: ExamCompletedProps) {
  const { assignment, exam, student, questions, answers } = data;

  const answeredCount = questions.filter((q) =>
    answers.some(
      (a) =>
        a.questionId === q.id &&
        (a.selectedOptionId || a.answerText || a.answerNumeric !== null || a.answerPoint)
    )
  ).length;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div className="min-h-dvh bg-linear-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Header con logo */}
      <header className="w-full py-4 sm:py-6 px-4">
        <div className="max-w-md mx-auto flex justify-center">
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
        <Card className="max-w-md w-full border-slate-200/80 shadow-lg shadow-slate-200/50 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-5 sm:p-8">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600" />
              </div>
            </div>

            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-1">
                {assignment.status === 'graded' ? 'Examen calificado' : 'Examen entregado'}
              </h1>
              <p className="text-slate-500 text-sm sm:text-base">
                {assignment.status === 'graded'
                  ? 'Tu examen ha sido revisado'
                  : 'Tu examen ha sido entregado correctamente'}
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-0 mb-6 bg-slate-50/80 rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60">
                <span className="flex items-center gap-2.5 text-slate-600 text-sm">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Examen
                </span>
                <span className="font-medium text-slate-900 text-sm text-right max-w-[55%] truncate">{exam.title}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60">
                <span className="flex items-center gap-2.5 text-slate-600 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  Estudiante
                </span>
                <span className="font-medium text-slate-900 text-sm text-right max-w-[55%] truncate">{student.fullName}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60">
                <span className="text-slate-600 text-sm">Respondidas</span>
                <span className="font-medium text-slate-900 text-sm">
                  {answeredCount} de {questions.length}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-slate-200/60">
                <span className="flex items-center gap-2.5 text-slate-600 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Iniciado
                </span>
                <span className="font-medium text-slate-900 text-sm">{formatDate(assignment.startedAt)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2.5 text-slate-600 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Entregado
                </span>
                <span className="font-medium text-slate-900 text-sm">{formatDate(assignment.submittedAt)}</span>
              </div>
            </div>

            {/* Status Message */}
            {assignment.status === 'submitted' && (
              <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4 text-center">
                <p className="text-sm text-blue-800">
                  Tu profesor revisará tu examen y recibirás tu calificación pronto.
                </p>
              </div>
            )}

            {assignment.status === 'graded' && (
              <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-4 text-center">
                <p className="text-sm text-emerald-800 font-medium">Calificación disponible</p>
                <p className="text-sm text-emerald-700 mt-1">
                  Consulta con tu profesor para ver los resultados.
                </p>
              </div>
            )}

            <p className="text-center text-xs text-slate-400 mt-6">
              Ya puedes cerrar esta ventana
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
