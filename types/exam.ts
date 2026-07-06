// Assignment and Exam Status
export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'graded';
export type QuestionType = 'multiple_choice' | 'numeric' | 'graph_click' | 'image_hotspot' | 'open_text' | 'diagram';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

// Fraud Event Types - matching backend enum
export type FraudEventType =
  | 'tab_change'
  | 'window_blur'
  | 'copy_attempt'
  | 'paste_attempt'
  | 'right_click'
  | 'screenshot_attempt'
  | 'devtools_open'
  | 'fullscreen_exit'
  | 'multiple_monitors'
  | 'face_not_detected'
  | 'multiple_faces'
  | 'browser_resize'
  | 'idle_timeout'
  | 'suspicious_navigation'
  | 'other';

export type EventSeverity = 'info' | 'warning' | 'critical';

// Graph Types
export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphLinePoint {
  x: number;
  y: number;
}

export interface GraphLine {
  id: string;
  type?: string;
  color: string;
  points?: GraphLinePoint[];
  // Legacy format
  start?: GraphPoint;
  end?: GraphPoint;
  label?: string;
}

export interface GraphFunction {
  id: string;
  expression: string;
  color: string;
  label?: string;
}

export interface GraphArea {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

// Question Configuration Types
export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  order: number;
}

export interface MultipleChoiceConfig {
  options: MultipleChoiceOption[];
  allowMultiple?: boolean;
  shuffleOptions?: boolean;
}

export interface NumericConfig {
  correctValue?: number;
  tolerance?: number;
  toleranceType?: 'percentage' | 'absolute';
  unit?: string | null;
}

export interface GraphClickConfig {
  graphType: 'cartesian' | 'image';
  xRange: [number, number];
  yRange: [number, number];
  xLabel?: string;
  yLabel?: string;
  correctPoint?: GraphPoint;
  correctArea?: GraphArea;
  answerType?: 'point' | 'area';
  toleranceRadius?: number;
  showGrid?: boolean;
  gridStep?: number;
  lines?: GraphLine[];
  functions?: GraphFunction[];
  isInteractive?: boolean;
  imageUrl?: string | null;
}

export interface ImageHotspotConfig {
  imageUrl: string;
  correctPoint: GraphPoint;
  toleranceRadius: number;
}

// Pregunta de dibujo/marcado: el alumno dibuja con Excalidraw sobre una imagen base
// (opcional) o sube una foto de su respuesta hecha a mano.
export interface DiagramConfig {
  referenceImageUrl?: string | null;
  allowCanvas?: boolean;
  allowUpload?: boolean;
  canvasHeight?: number;
}

// Archivo de una respuesta de tipo diagram (imagen exportada y/o escena Excalidraw)
export interface AnswerFile {
  url: string;
  kind: 'image' | 'scene';
  mime?: string;
}

export type QuestionTypeConfig =
  | MultipleChoiceConfig
  | NumericConfig
  | GraphClickConfig
  | ImageHotspotConfig
  | DiagramConfig
  | Record<string, unknown>;

// Exam Configuration
export interface ExamConfig {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResults?: boolean;
  showResultsImmediately?: boolean;
  allowReview?: boolean;
  allowBackNavigation?: boolean;
  passingPercentage?: number;
  penaltyPerWrongAnswer?: number;
}

// Core Entities - Backend Response Format (camelCase)
export interface Assignment {
  id: string;
  status: AssignmentStatus;
  startedAt: string | null;
  submittedAt: string | null;
}

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  config: ExamConfig;
}

export interface Student {
  id: string;
  fullName: string;
}

export interface Question {
  id: string;
  title: string;
  content: string;
  questionType: QuestionType;
  typeConfig: QuestionTypeConfig;
  questionOrder: number;
  weight: number;
  difficulty?: QuestionDifficulty;
  imageUrl?: string;
}

export interface StudentAnswer {
  id: string;
  assignmentId: string;
  questionId: string;
  selectedOptionId?: string | null;
  answerText?: string | null;
  answerNumeric?: number | null;
  answerPoint?: GraphPoint | null;
  answerFiles?: AnswerFile[] | null;
  isCorrect?: boolean | null;
  score?: number | null;
  feedback?: string | null;
  answeredAt?: string;
}

// API Response Types - Matching actual backend response
export interface ExamTokenResponse {
  assignment: Assignment;
  exam: Exam;
  student: Student;
  questions: Question[];
  answers: StudentAnswer[];
}

export interface StartExamResponse {
  assignment: Assignment;
}

export interface AnswerRequest {
  assignmentId: string;
  questionId: string;
  selectedOptionId?: string;
  answerText?: string;
  answerNumeric?: number;
  answerPoint?: GraphPoint;
}

export interface AnswerResponse {
  answer: StudentAnswer;
}

export interface SubmitExamResponse {
  assignment: Assignment;
}

// Fraud Event Request - matching backend endpoint
export interface FraudEventRequest {
  assignmentId: string;
  eventType: FraudEventType;
  severity?: EventSeverity;
  details?: Record<string, unknown>;
}

// Fraud Event Response from backend
export interface FraudEventResponse {
  id: string;
  assignmentId: string;
  eventType: FraudEventType;
  severity: EventSeverity;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Local fraud event for UI tracking
export interface LocalFraudEvent {
  type: FraudEventType;
  timestamp: Date;
  severity: EventSeverity;
  details?: Record<string, unknown>;
}
