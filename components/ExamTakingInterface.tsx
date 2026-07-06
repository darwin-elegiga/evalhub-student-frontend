'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Clock,
  Send,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Grid3X3,
  X,
} from 'lucide-react';
import type {
  ExamTokenResponse,
  Question,
  GraphPoint,
  MultipleChoiceConfig,
  GraphClickConfig,
  NumericConfig,
  DiagramConfig,
  AnswerFile,
} from '@/types/exam';
import { saveAnswer, submitExam } from '@/lib/api';
import { useFraudDetection } from '@/hooks/useFraudDetection';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { QuestionContent, OptionContent } from '@/components/latex-preview';
import { GraphEditor } from '@/components/graph-editor';
import { DiagramCanvas } from '@/components/diagram-canvas';

interface ExamTakingInterfaceProps {
  data: ExamTokenResponse;
  onSubmit: () => void;
}

type AnswerValue = {
  selectedOptionId?: string;
  answerText?: string;
  answerNumeric?: number;
  answerPoint?: GraphPoint;
  answerFiles?: AnswerFile[];
};

export function ExamTakingInterface({ data, onSubmit }: ExamTakingInterfaceProps) {
  const { assignment, exam, questions, answers: existingAnswers } = data;

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    const initial: Record<string, AnswerValue> = {};
    existingAnswers.forEach((answer) => {
      initial[answer.questionId] = {
        selectedOptionId: answer.selectedOptionId ?? undefined,
        answerText: answer.answerText ?? undefined,
        answerNumeric: answer.answerNumeric ?? undefined,
        answerPoint: answer.answerPoint ?? undefined,
        answerFiles: answer.answerFiles ?? undefined,
      };
    });
    return initial;
  });
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Fraud detection
  const { warningCount, requestFullscreen } = useFraudDetection({
    enabled: true,
    assignmentId: assignment.id,
    onFraudEvent: (event) => {
      if (event.severity === 'warning' || event.severity === 'critical') {
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 3000);
      }
    },
  });

  // Calculate initial time on client only to avoid hydration mismatch
  useEffect(() => {
    const duration = exam.durationMinutes ?? 60;
    if (!assignment.startedAt) {
      setTimeRemaining(duration * 60);
    } else {
      const startTime = new Date(assignment.startedAt).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeRemaining(Math.max(0, duration * 60 - elapsed));
    }
  }, [exam.durationMinutes, assignment.startedAt]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining !== null]);

  // Request fullscreen on mount
  useEffect(() => {
    requestFullscreen();
  }, [requestFullscreen]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];

  // Save answer with debounce
  const saveAnswerDebounced = useCallback(
    async (questionId: string, answerValue: AnswerValue) => {
      const existingTimer = debounceTimers.current.get(questionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(async () => {
        setIsSaving(true);
        try {
          await saveAnswer({
            assignmentId: assignment.id,
            questionId,
            selectedOptionId: answerValue.selectedOptionId,
            answerText: answerValue.answerText,
            answerNumeric: answerValue.answerNumeric,
            answerPoint: answerValue.answerPoint,
          });
        } catch (error) {
          console.error('Error saving answer:', error);
        } finally {
          setIsSaving(false);
        }
      }, 500);

      debounceTimers.current.set(questionId, timer);
    },
    [assignment.id]
  );

  const handleAnswerChange = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...value },
    }));
    saveAnswerDebounced(questionId, { ...answers[questionId], ...value });
  };

  // Los diagramas se suben aparte (multipart) desde DiagramCanvas; aquí solo
  // actualizamos el estado local para marcar la pregunta como respondida.
  const handleDiagramSaved = (questionId: string, files: AnswerFile[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], answerFiles: files },
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setShowSubmitDialog(false);

    try {
      await submitExam(assignment.id);
      onSubmit();
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Error al entregar el examen. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
      setShowMobileNav(false);
    }
  };

  const getAnsweredCount = (): number => {
    return questions.filter((q) => {
      const answer = answers[q.id];
      if (!answer) return false;
      return (
        answer.selectedOptionId ||
        answer.answerText ||
        answer.answerNumeric !== undefined ||
        answer.answerPoint ||
        (answer.answerFiles && answer.answerFiles.length > 0)
      );
    }).length;
  };

  const isQuestionAnswered = (questionId: string): boolean => {
    const answer = answers[questionId];
    if (!answer) return false;
    return !!(
      answer.selectedOptionId ||
      answer.answerText ||
      answer.answerNumeric !== undefined ||
      answer.answerPoint ||
      (answer.answerFiles && answer.answerFiles.length > 0)
    );
  };

  const answeredCount = getAnsweredCount();
  const progressPercent = (answeredCount / questions.length) * 100;

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-slate-50 flex flex-col">
        {/* Warning overlay */}
        {showWarning && (
          <div className="fixed inset-0 bg-red-600/95 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="text-white text-center p-6 sm:p-8 max-w-md">
              <AlertCircle className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 opacity-90" />
              <h2 className="text-xl sm:text-2xl font-semibold mb-2">Advertencia</h2>
              <p className="text-base sm:text-lg opacity-90">
                Se ha detectado una acción sospechosa.
              </p>
              <p className="mt-2 opacity-75 text-sm sm:text-base">
                Mantente en esta ventana durante el examen.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm">
                <span className="opacity-75">Advertencias:</span>
                <span className="font-semibold">{warningCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              {/* Left section: Logo + Title */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <Image
                  src="/isotipo.png"
                  alt="Logo"
                  width={36}
                  height={36}
                  className="w-8 h-8 sm:w-9 sm:h-9 shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-lg font-medium text-slate-900 truncate">
                    {exam.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Pregunta {currentQuestionIndex + 1} de {questions.length}
                  </p>
                </div>
              </div>

              {/* Saving indicator - hidden on small screens */}
              {isSaving && (
                <span className="hidden sm:flex text-xs text-slate-400 items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Guardando
                </span>
              )}

              {/* Right section: Timer + Actions */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {/* Timer */}
                <div
                  className={cn(
                    'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-sm sm:text-lg font-medium',
                    timeRemaining !== null && timeRemaining < 300
                      ? 'bg-red-50 text-red-600'
                      : timeRemaining !== null && timeRemaining < 600
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-slate-100 text-slate-700'
                  )}
                >
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
                </div>

                {/* Mobile nav toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileNav(true)}
                  className="lg:hidden h-9 w-9 p-0"
                >
                  <Grid3X3 className="w-5 h-5 text-slate-600" />
                </Button>

                {/* Submit button */}
                <Button
                  onClick={() => setShowSubmitDialog(true)}
                  disabled={isSubmitting}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white h-9 px-3 sm:px-4"
                >
                  <Send className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Entregar</span>
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2.5 sm:mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Progreso</span>
                <span>{answeredCount}/{questions.length} respondidas</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {showMobileNav && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowMobileNav(false)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[70vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div>
                  <h3 className="font-medium text-slate-900">Navegación</h3>
                  <p className="text-xs text-slate-500">{answeredCount} de {questions.length} respondidas</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileNav(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(70vh-60px)]">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, index) => (
                    <button
                      key={q.id}
                      onClick={() => goToQuestion(index)}
                      className={cn(
                        'aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center',
                        index === currentQuestionIndex
                          ? 'bg-slate-900 text-white shadow-sm'
                          : isQuestionAnswered(q.id)
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      )}
                    >
                      {isQuestionAnswered(q.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex">
          {/* Question navigation sidebar - Desktop only */}
          <aside className="hidden lg:block w-16 xl:w-20 bg-white border-r border-slate-200/80 p-2 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              {questions.map((q, index) => (
                <Tooltip key={q.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => goToQuestion(index)}
                      className={cn(
                        'w-full h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center',
                        index === currentQuestionIndex
                          ? 'bg-slate-900 text-white shadow-sm'
                          : isQuestionAnswered(q.id)
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      {isQuestionAnswered(q.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <p className="font-medium">Pregunta {index + 1}</p>
                    <p className="text-slate-400">
                      {isQuestionAnswered(q.id) ? 'Respondida' : 'Sin responder'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-4 sm:p-6 pb-24 overflow-y-auto">
            <div className="max-w-3xl mx-auto">
              <QuestionRenderer
                question={currentQuestion}
                answer={answers[currentQuestion.id]}
                assignmentId={assignment.id}
                onAnswerChange={(value) =>
                  handleAnswerChange(currentQuestion.id, value)
                }
                onDiagramSaved={(files) =>
                  handleDiagramSaved(currentQuestion.id, files)
                }
              />
            </div>
          </main>
        </div>

        {/* Fixed bottom navigation */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200/80 z-30 lg:pl-16 xl:pl-20">
          <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => goToQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="text-slate-600 h-11 px-4"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>

            <span className="text-sm text-slate-500 hidden sm:block">
              {currentQuestionIndex + 1} / {questions.length}
            </span>

            <Button
              variant="ghost"
              onClick={() => goToQuestion(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex === questions.length - 1}
              className="text-slate-600 h-11 px-4"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </footer>

        {/* Submit confirmation dialog */}
        <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <AlertDialogContent className="max-w-md mx-4 sm:mx-auto rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg">Entregar examen</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Has respondido <span className="font-medium text-slate-700">{answeredCount}</span> de{' '}
                    <span className="font-medium text-slate-700">{questions.length}</span> preguntas.
                  </p>
                  {answeredCount < questions.length && (
                    <p className="text-amber-600 bg-amber-50 px-3 py-2.5 rounded-lg text-sm">
                      Tienes {questions.length - answeredCount} preguntas sin responder.
                    </p>
                  )}
                  <p className="text-sm text-slate-500">
                    Una vez entregado, no podrás modificar tus respuestas.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel className="text-slate-600 h-11 sm:h-10">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 h-11 sm:h-10"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entregando...
                  </>
                ) : (
                  'Confirmar entrega'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

interface QuestionRendererProps {
  question: Question;
  answer?: AnswerValue;
  assignmentId: string;
  onAnswerChange: (value: AnswerValue) => void;
  onDiagramSaved: (files: AnswerFile[]) => void;
}

function QuestionRenderer({
  question,
  answer,
  assignmentId,
  onAnswerChange,
  onDiagramSaved,
}: QuestionRendererProps) {
  return (
    <Card className="border-slate-200/80 shadow-sm bg-white/80 backdrop-blur-sm">
      <CardContent className="p-4 sm:p-6">
        {/* Question header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-medium text-slate-900">{question.title}</h2>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md shrink-0">
            {question.weight} {question.weight === 1 ? 'pto' : 'ptos'}
          </span>
        </div>

        {/* Question content with LaTeX support */}
        <QuestionContent
          html={question.content}
          className="text-slate-700 mb-6"
        />

        {/* Question image if exists */}
        {question.imageUrl && (
          <div className="mb-6">
            <img
              src={question.imageUrl}
              alt="Imagen de la pregunta"
              className="max-w-full rounded-lg border border-slate-200"
            />
          </div>
        )}

        {/* Answer input based on question type */}
        {question.questionType === 'multiple_choice' && (
          <MultipleChoiceAnswer
            config={question.typeConfig as MultipleChoiceConfig}
            value={answer?.selectedOptionId}
            onChange={(selectedOptionId) =>
              onAnswerChange({ selectedOptionId })
            }
          />
        )}

        {question.questionType === 'open_text' && (
          <div className="space-y-2">
            <Label className="text-sm text-slate-600">Tu respuesta</Label>
            <Textarea
              value={answer?.answerText || ''}
              onChange={(e) => onAnswerChange({ answerText: e.target.value })}
              placeholder="Escribe tu respuesta aquí..."
              className="min-h-40 resize-none border-slate-200 focus:border-slate-400 focus:ring-slate-400 text-base"
            />
          </div>
        )}

        {question.questionType === 'numeric' && (
          <NumericAnswer
            config={question.typeConfig as NumericConfig}
            value={answer?.answerNumeric}
            onChange={(answerNumeric) => onAnswerChange({ answerNumeric })}
          />
        )}

        {(question.questionType === 'graph_click' ||
          question.questionType === 'image_hotspot') && (
          <div className="space-y-3">
            <Label className="text-sm text-slate-600">Selecciona un punto en el gráfico</Label>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <GraphEditor
                config={question.typeConfig as GraphClickConfig}
                mode="answer"
                selectedPoint={answer?.answerPoint}
                onPointSelected={(answerPoint) =>
                  onAnswerChange({ answerPoint })
                }
              />
            </div>
            {answer?.answerPoint && (
              <p className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg inline-block">
                Punto seleccionado: ({answer.answerPoint.x.toFixed(1)}, {answer.answerPoint.y.toFixed(1)})
              </p>
            )}
          </div>
        )}

        {question.questionType === 'diagram' && (
          <DiagramCanvas
            assignmentId={assignmentId}
            questionId={question.id}
            referenceImageUrl={
              (question.typeConfig as DiagramConfig).referenceImageUrl ??
              question.imageUrl ??
              null
            }
            allowCanvas={
              (question.typeConfig as DiagramConfig).allowCanvas ?? true
            }
            allowUpload={
              (question.typeConfig as DiagramConfig).allowUpload ?? true
            }
            canvasHeight={(question.typeConfig as DiagramConfig).canvasHeight}
            initialFiles={answer?.answerFiles ?? null}
            onSaved={onDiagramSaved}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface MultipleChoiceAnswerProps {
  config: MultipleChoiceConfig;
  value?: string;
  onChange: (value: string) => void;
}

function MultipleChoiceAnswer({
  config,
  value,
  onChange,
}: MultipleChoiceAnswerProps) {
  const sortedOptions = [...config.options].sort((a, b) => a.order - b.order);

  if (config.allowMultiple) {
    return (
      <div className="space-y-2.5">
        {sortedOptions.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-[0.99]',
              value === option.id
                ? 'border-slate-900 bg-slate-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            )}
          >
            <Checkbox
              checked={value === option.id}
              onCheckedChange={() => onChange(option.id)}
              className="border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 mt-0.5 shrink-0"
            />
            <OptionContent html={option.text} className="text-slate-700 text-sm sm:text-base" />
          </label>
        ))}
      </div>
    );
  }

  return (
    <RadioGroup value={value || ''} onValueChange={onChange}>
      <div className="space-y-2.5">
        {sortedOptions.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer active:scale-[0.99]',
              value === option.id
                ? 'border-slate-900 bg-slate-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
            )}
          >
            <RadioGroupItem
              value={option.id}
              className="border-slate-300 text-slate-900 mt-0.5 shrink-0"
            />
            <OptionContent html={option.text} className="text-slate-700 text-sm sm:text-base" />
          </label>
        ))}
      </div>
    </RadioGroup>
  );
}

interface NumericAnswerProps {
  config: NumericConfig;
  value?: number;
  onChange: (value: number) => void;
}

function NumericAnswer({ config, value, onChange }: NumericAnswerProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-slate-600">Tu respuesta</Label>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="Ingresa un número"
          className="max-w-48 sm:max-w-52 border-slate-200 focus:border-slate-400 focus:ring-slate-400 text-base h-11"
        />
        {config.unit && (
          <span className="text-slate-500 text-sm">{config.unit}</span>
        )}
      </div>
    </div>
  );
}
