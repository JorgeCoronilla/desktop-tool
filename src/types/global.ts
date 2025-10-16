import {
  ElectronAPI,
  OpenAIResponse,
  OpenAIConfig,
} from '../main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

// Re-export types from preload for convenience
export type { OpenAIResponse, OpenAIConfig };

export interface FileItem {
  name: string;
  isDirectory: boolean;
  path: string;
  size?: number;
  modified?: Date;
}

export enum TaskState {
  IDLE = 'idle',
  IN_PROGRESS = 'in_progress',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface TaskContext {
  state: TaskState;
  description: string;
  currentStep: string;
  totalSteps?: number;
  completedSteps: number;
  lastAction: string;
  needsConfirmation: boolean;
  confirmationMessage?: string;
  error?: string;
}

export interface AppState {
  currentFolder: string | null;
  files: FileItem[];
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  isFileLoading: boolean;
  taskContext: TaskContext;
  lastUpdate?: number;
  totalFilesCount?: number;
}
