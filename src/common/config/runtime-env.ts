import { existsSync, readFileSync } from 'node:fs';

import { parse } from 'dotenv';

export const APP_ENV_VALUES = ['dev', 'stage', 'prod'] as const;
export const NODE_ENV_VALUES = ['development', 'production'] as const;
export const ENV_FILE_PATH = '.env' as const;

export type AppEnv = (typeof APP_ENV_VALUES)[number];
export type RuntimeNodeEnv = (typeof NODE_ENV_VALUES)[number];

export const DEFAULT_APP_ENV: AppEnv = 'dev';
export const DEFAULT_NODE_ENV: RuntimeNodeEnv = 'development';

function normalizeEnvValue<T extends string>(value: string | undefined, allowedValues: readonly T[], fallback: T): T {
  if (value && allowedValues.includes(value as T)) {
    return value as T;
  }

  return fallback;
}

export function getAppEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return normalizeEnvValue(env.APP_ENV, APP_ENV_VALUES, DEFAULT_APP_ENV);
}

export function getNodeEnv(env: NodeJS.ProcessEnv = process.env): RuntimeNodeEnv {
  if (!env.NODE_ENV) {
    return getAppEnv(env) === 'dev' ? 'development' : 'production';
  }

  return normalizeEnvValue(env.NODE_ENV, NODE_ENV_VALUES, DEFAULT_NODE_ENV);
}

export function getEnvFilePath(): string {
  return ENV_FILE_PATH;
}

export function loadRuntimeEnv(env: NodeJS.ProcessEnv = process.env): string {
  if (!existsSync(ENV_FILE_PATH)) {
    return ENV_FILE_PATH;
  }

  const parsedEnv = parse(readFileSync(ENV_FILE_PATH));

  for (const [key, value] of Object.entries(parsedEnv)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }

  return ENV_FILE_PATH;
}

export function isDevAppEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAppEnv(env) === 'dev';
}

export function isStageAppEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAppEnv(env) === 'stage';
}

export function isProdAppEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAppEnv(env) === 'prod';
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return getNodeEnv(env) === 'production';
}
