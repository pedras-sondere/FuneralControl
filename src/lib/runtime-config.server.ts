export type DatabaseConfig = {
  connectionString: string;
  ssl?: { rejectUnauthorized: true };
};

export type AdminConfig = {
  email: string;
  password: string;
};

export type InitialAdminConfig = {
  email: string;
  password: string;
};

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`A variável ${name} é obrigatória para iniciar a aplicação.`);
  }
  return value;
}

export function readDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const connectionString = required(env, "DATABASE_URL");
  return {
    connectionString,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  };
}

export function readAdminConfig(env: NodeJS.ProcessEnv): AdminConfig {
  return {
    email: required(env, "ADMIN_EMAIL").toLowerCase(),
    password: required(env, "ADMIN_PASSWORD"),
  };
}

export function readInitialAdminConfig(env: NodeJS.ProcessEnv): InitialAdminConfig {
  return {
    email: required(env, "INITIAL_ADMIN_EMAIL").toLowerCase(),
    password: required(env, "INITIAL_ADMIN_PASSWORD"),
  };
}
