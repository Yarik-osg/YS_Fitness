export function readProcessEnvironment(): NodeJS.ProcessEnv {
  return process.env;
}

export function writeProcessEnvironment(values: Record<string, string>): void {
  Object.assign(process.env, values);
}
