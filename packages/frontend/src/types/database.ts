export interface User {
  id: string;
  email: string;
  password_hash?: string;
  name: string;
  profile_picture_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  name?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  content: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  created_at: Date;
  updated_at: Date;
  sender_id: string;
  conversation_id: string;
  tempId?: string;
}
