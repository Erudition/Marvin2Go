

export enum TaskStatus {
  INBOX = 'INBOX',
  NEXT = 'NEXT',
  WAITING = 'WAITING',
  SOMEDAY = 'SOMEDAY',
  DONE = 'DONE',
}

export interface Task {
  id: string; // Mapped from _id
  title: string;
  status: TaskStatus;
  createdAt: number;
  completedAt?: number;
  timeSpent: number; // in seconds (derived from task.times + duration)
  timeEstimate?: number; // in milliseconds
  project?: string; // parentId
  context?: string; 
  // Marvin specific fields
  db: string; // 'Tasks' | 'Categories'
  type?: string; // 'project' | 'task'
  dueDate?: string;
  note?: string;
  day?: string;
  labelIds?: string[];
}

export interface Category {
  id: string; // _id
  title: string;
  type: 'project' | 'category';
  parentId: string;
  color?: string;
}

export interface Label {
  id: string;
  title: string;
  color?: string;
}

export interface TimerState {
  taskId: string | null;
  startTime: number | null;
  baseTime?: number; // The task's timeSpent value when the timer started
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export enum VoiceMode {
  VAD = 'VAD', // Voice Activity Detection (Always listening)
  PTT = 'PTT', // Push to Talk
}

export interface AudioVisualizerData {
  volume: number;
  isTalking: boolean;
}

export interface ToolCallDetails {
  functionCalls: {
    id?: string;
    name: string;
    args: any;
  }[];
  functionResponses?: {
    id?: string;
    name: string;
    response: any;
  }[];
}

export interface TranscriptItem {
  id: string;
  role: 'user' | 'model' | 'tool';
  text?: string;
  toolDetails?: ToolCallDetails;
  timestamp: number;
  isComplete?: boolean;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: number;
  actor: 'user' | 'ai';
  action: string;
  details: string;
  reason?: string;
}

export interface SyncConfig {
  server: string;
  database: string;
  user: string;
  password?: string;
}