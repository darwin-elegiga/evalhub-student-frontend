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

// API Endpoints
export const API_ENDPOINTS = {
  ASSIGNMENT_BY_TOKEN: (token: string) => `/assignments/token/${token}`,
  EXAM_START: '/assignments/start',
  EXAM_ANSWER: '/assignments/answer',
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
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Error ${response.status}`);
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
