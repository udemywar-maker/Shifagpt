
export interface Character {
  id: string;
  name: string;
  role: string;
  gender: 'male' | 'female';
  avatar: string;
  description: string;
  systemPrompt: string;
  color: string;
  voiceName: string;
  isCustomized?: boolean;
  isUserAdded?: boolean;
}

export interface CharacterCustomization {
  name: string;
  role: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  voiceName?: string;
  gender?: 'male' | 'female';
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  status?: 'sent' | 'delivered' | 'seen';
  isAudioLoading?: boolean;
}

export enum ChatState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  CHATTING = 'CHATTING',
  ERROR = 'ERROR'
}
