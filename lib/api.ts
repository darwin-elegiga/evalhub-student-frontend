import type {
  ExamTokenResponse,
  StartExamResponse,
  AnswerRequest,
  AnswerResponse,
  SubmitExamResponse,
  FraudEventRequest,
  FraudEventResponse,
} from '@/types/exam';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://evalhub-backend.onrender.com';

// Conserva el status HTTP para poder distinguir "no existe" (404) de un fallo del
// servidor o de red, que se le presentan al estudiante de forma muy distinta.
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({ message: response.statusText }));
  return new ApiError(body.message || `Error ${response.status}`, response.status);
}

// API Endpoints
export const API_ENDPOINTS = {
  ASSIGNMENT_BY_TOKEN: (token: string) => `/assignments/token/${token}`,
  EXAM_START: '/assignments/start',
  EXAM_ANSWER: '/assignments/answer',
  EXAM_ANSWER_UPLOAD: '/assignments/answer/upload',
  EXAM_SUBMIT: '/assignments/submit',
  FRAUD_EVENTS: '/fraud-events',
};

// Generic fetch wrapper
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.json();
}

// Get exam data by magic token
export async function getExamByToken(token: string): Promise<ExamTokenResponse> {
  return apiFetch<ExamTokenResponse>(API_ENDPOINTS.ASSIGNMENT_BY_TOKEN(token));
}

// Start the exam
export async function startExam(assignmentId: string): Promise<StartExamResponse> {
  return apiFetch<StartExamResponse>(API_ENDPOINTS.EXAM_START, {
    method: 'POST',
    body: JSON.stringify({ assignmentId }),
  });
}

// Save answer
export async function saveAnswer(data: AnswerRequest): Promise<AnswerResponse> {
  return apiFetch<AnswerResponse>(API_ENDPOINTS.EXAM_ANSWER, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Subir el dibujo de una respuesta de tipo diagram (imagen PNG + escena Excalidraw opcional).
// Usa FormData (multipart) — no reutiliza apiFetch porque ese fuerza Content-Type: application/json.
export async function uploadDiagramAnswer(data: {
  assignmentId: string;
  questionId: string;
  image: Blob;
  scene?: string;
}): Promise<AnswerResponse> {
  const form = new FormData();
  form.append('image', data.image, 'diagram.png');
  form.append('assignmentId', data.assignmentId);
  form.append('questionId', data.questionId);
  if (data.scene) form.append('scene', data.scene);

  const response = await fetch(`${API_URL}${API_ENDPOINTS.EXAM_ANSWER_UPLOAD}`, {
    method: 'POST',
    body: form, // el navegador pone el Content-Type multipart con boundary
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.json();
}

// Submit exam
export async function submitExam(assignmentId: string): Promise<SubmitExamResponse> {
  return apiFetch<SubmitExamResponse>(API_ENDPOINTS.EXAM_SUBMIT, {
    method: 'POST',
    body: JSON.stringify({ assignmentId }),
  });
}

// Report fraud event (public endpoint - no auth required)
export async function reportFraudEvent(data: FraudEventRequest): Promise<FraudEventResponse | null> {
  try {
    return await apiFetch<FraudEventResponse>(API_ENDPOINTS.FRAUD_EVENTS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Silently fail - don't interrupt the exam for logging errors
    console.error('Failed to report fraud event:', error);
    return null;
  }
}
