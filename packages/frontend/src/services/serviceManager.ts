import { db } from './database';
import { dataSyncer } from './dataSyncer';
import { messageScheduler } from './messageScheduler';
import { webSocketService } from './websocket';

/**
 * Configuration options for the Data Sync layer initialization
 */
export interface DataSyncConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  processingIntervalMs?: number;
}

/**
 * Status information for the Data Sync layer components
 */
export interface DataSyncStatus {
  syncer: {
    isInitialized: boolean;
    isConnected: boolean;
  };
  scheduler: {
    pending: number;
    inFlight: number;
    failed: number;
    totalRetries: number;
  };
  database: {
    info: unknown;
  };
}

/**
 * Initialize the complete Data Sync layer
 */
export async function initializeDataSync(config?: DataSyncConfig): Promise<void> {
  try {
    // Update message scheduler config if provided
    if (config) {
      const schedulerConfig = {
        maxRetries: config.maxRetries,
        baseDelayMs: config.baseDelayMs,
        maxDelayMs: config.maxDelayMs,
        processingIntervalMs: config.processingIntervalMs,
      };

      // Filter out undefined values to avoid overriding defaults with undefined
      const filteredSchedulerConfig = Object.fromEntries(
        Object.entries(schedulerConfig).filter(([, value]) => value !== undefined)
      );

      if (Object.keys(filteredSchedulerConfig).length > 0) {
        messageScheduler.updateConfig(filteredSchedulerConfig);
      }
    }

    // Connect WebSocket service
    await webSocketService.connect();

    // Initialize DataSyncer with the WebSocket adapter
    await dataSyncer.initialize(webSocketService);

    console.log('Data Sync layer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Data Sync layer:', error);
    throw error;
  }
}

/**
 * Shutdown the Data Sync layer
 */
export function shutdownDataSync(): void {
  try {
    dataSyncer.shutdown();
    console.log('Data Sync layer shutdown successfully');
  } catch (error) {
    console.error('Error during Data Sync layer shutdown:', error);
  }
}

/**
 * Get comprehensive status of the Data Sync layer
 */
export async function getDataSyncStatus(): Promise<DataSyncStatus> {
  try {
    const [syncStatus, queueStatus] = await Promise.all([
      dataSyncer.getSyncStatus(),
      messageScheduler.getQueueStatus(),
    ]);

    return {
      syncer: {
        isInitialized: syncStatus.isInitialized,
        isConnected: syncStatus.isConnected,
      },
      scheduler: {
        pending: queueStatus.pending,
        inFlight: queueStatus.inFlight,
        failed: queueStatus.failed,
        totalRetries: queueStatus.totalRetries,
      },
      database: {
        info: await db.getDatabaseInfo(),
      },
    };
  } catch (error) {
    console.error('Error getting Data Sync status:', error);
    throw error;
  }
}

/**
 * Clear all local data (useful for logout)
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    await dataSyncer.clearLocalData();
    console.log('All local data cleared successfully');
  } catch (error) {
    console.error('Error clearing local data:', error);
    throw error;
  }
}
