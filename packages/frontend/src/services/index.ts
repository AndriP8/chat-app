// API services
export * from './api';
export { default as api } from './api';

// Database services
export { db } from './database';
export { dbOps, DatabaseOperations } from './databaseOperations';

// Message scheduling layer
export { messageScheduler, MessageScheduler } from './messageScheduler';

// WebSocket service layer
export { webSocketService, WebSocketService } from './websocket';

// Service management functions
export {
  initializeDataSync,
  shutdownDataSync,
  getDataSyncStatus,
  clearAllLocalData,
  type DataSyncConfig,
  type DataSyncStatus,
} from './serviceManager';

// Re-export database types for convenience
export type {
  User,
  Conversation,
  Message,
  ConversationParticipant,
  DraftMessage,
  SendMessageRequest,
  DatabaseSchema,
} from '../types/database';
