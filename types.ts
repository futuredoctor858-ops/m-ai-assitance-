
export type AppMode = 'chat' | 'voice' | 'image' | 'video';

export interface GroundingLink {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  groundingLinks?: GroundingLink[];
  timestamp: Date;
}

export interface VoiceState {
  isActive: boolean;
  isInterrupted: boolean;
  transcription: string;
}
