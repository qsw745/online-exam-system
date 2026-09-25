type DatabaseEnvironment = Record<string, string | undefined>

export function buildDatabaseConnectionOptions(env: DatabaseEnvironment) {
  return {
    host: env.DB_HOST as string,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER as string,
    password: env.DB_PASSWORD as string,
    database: env.DB_NAME as string,
  }
}
