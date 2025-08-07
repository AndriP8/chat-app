export interface EnvConfig {
  PORT: string;
  HOST: string;
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_ROUNDS: string;
}

const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET"] as const;

export function getEnvConfig(): EnvConfig {
  const missingVars = REQUIRED_ENV_VARS.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(
        ", ",
      )}\nPlease check your .env file or environment configuration.`,
    );
  }

  // Validate NODE_ENV if provided
  const nodeEnv = process.env.NODE_ENV as EnvConfig["NODE_ENV"];
  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV: ${nodeEnv}. Must be one of: development, production, test`,
    );
  }

  return {
    PORT: process.env.PORT!,
    HOST: process.env.HOST!,
    NODE_ENV: nodeEnv,
    DATABASE_URL: process.env.DATABASE_URL!,
    CORS_ORIGIN: process.env.CORS_ORIGIN!,
    JWT_SECRET: process.env.JWT_SECRET!,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN!,
    BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS!,
  };
}

// Export the validated config
export const envConfig = getEnvConfig();
