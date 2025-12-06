export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface Participant {
  id: string;
  peerId?: string;
  name: string;
  isLocal: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isScreenSharing?: boolean;
  avatarUrl?: string; // For when video is off
}

export enum AppState {
  LOBBY = 'LOBBY',
  MEETING = 'MEETING',
}

export type LayoutMode = 'GRID' | 'SPOTLIGHT';

export type BackgroundMode = 'NONE' | 'BLUR' | 'IMAGE';