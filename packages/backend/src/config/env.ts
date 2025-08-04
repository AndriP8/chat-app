export const envSchema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    PORT: {
      type: 'string',
      default: '3001'
    },
    HOST: {
      type: 'string',
      default: 'localhost'
    },
    NODE_ENV: {
      type: 'string',
      enum: ['development', 'production', 'test'],
      default: 'development'
    },
    DATABASE_URL: {
      type: 'string'
    },
    CORS_ORIGIN: {
      type: 'string',
      default: 'http://localhost:5173'
    }
  }
};

export interface EnvConfig {
  PORT: string;
  HOST: string;
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  CORS_ORIGIN: string;
}