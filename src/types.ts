export interface Project {
  id: string;
  name: string;
  createdAt: number;
  userId: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  priority: 'low' | 'medium' | 'high';
  userId: string;
  projectId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  userId: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  userId: string;
  sessionId: string;
}
