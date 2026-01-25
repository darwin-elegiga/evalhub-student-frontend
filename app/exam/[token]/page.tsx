'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type { ExamTokenResponse } from '@/types/exam';
import { getExamByToken, startExam } from '@/lib/api';
import { ExamWelcome } from '@/components/ExamWelcome';
import { ExamTakingInterface } from '@/components/ExamTakingInterface';
import { ExamCompleted } from '@/components/ExamCompleted';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ExamPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ExamTokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const fetchExamData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const examData = await getExamByToken(token);
      setData(examData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  const handleStartExam = async () => {
    if (!data) return;

    setIsStarting(true);
    try {
      const response = await startExam(data.assignment.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              assignment: response.assignment,
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el examen');
    } finally {
      setIsStarting(false);
    }
  };

  const handleExamSubmitted = () => {
    fetchExamData();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Cargando examen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={fetchExamData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-muted-foreground">No se encontró el examen</p>
      </div>
    );
  }

  // Exam already submitted or graded
  if (data.assignment.status === 'submitted' || data.assignment.status === 'graded') {
    return <ExamCompleted data={data} />;
  }

  // Exam pending - show welcome
  if (data.assignment.status === 'pending') {
    return (
      <ExamWelcome
        data={data}
        onStart={handleStartExam}
        isStarting={isStarting}
      />
    );
  }

  // Exam in progress
  if (data.assignment.status === 'in_progress') {
    return (
      <ExamTakingInterface
        data={data}
        onSubmit={handleExamSubmitted}
      />
    );
  }

  return null;
}
