/**
 * OpenTelemetry SDK bootstrap (trace 전용).
 *
 * IMPORTANT: 이 파일은 `src/main.ts`에서 CJS `require('./tracing')`로,
 * `require('reflect-metadata')`와 동적 `import('./bootstrap')` 사이에서 로드해야 한다.
 * `import './tracing'`로 바꾸지 말 것 — SWC가 정적 ES import를 컴파일된 CJS
 * 최상단으로 hoist 하면서 이 모듈이 `reflect-metadata` 위로 올라가 데코레이터
 * 메타데이터가 깨진다. CJS `require()`는 명시적 순서를 보존한다.
 *
 * SDK는 instrumented 라이브러리(http/express/NestJS/pg/redis)가 require 되기
 * 전에 초기화되어야 한다. 종료 로직은 NestJS `BeforeApplicationShutdown`
 * (OtelShutdownService)이 담당한다.
 *
 * 스타터는 trace 만 내보낸다. metrics/logs 브리지가 필요하면
 * `@opentelemetry/exporter-metrics-otlp-proto` 등을 추가해 확장한다.
 */

import { loadRuntimeEnv } from '@/common/config/runtime-env';

// FIRST executable line: OTEL_* env를 읽기 전에 .env 값을 채운다.
// tracing.ts는 ConfigModule.forRoot() 보다 먼저 실행된다.
loadRuntimeEnv();

import { type Span, trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export type TraceContext = { traceId: string; spanId: string };

let sdkInstance: NodeSDK | null = null;

/**
 * 활성 OTel trace/span id를 반환한다. 활성 span이 없거나 SDK가 비활성이면 null.
 * SDK 초기화 전에 호출해도 안전하다(null 반환).
 */
export function getTraceContext(): TraceContext | null {
  try {
    const activeSpan: Span | undefined = trace.getActiveSpan();
    if (!activeSpan) return null;
    const ctx = activeSpan.spanContext();
    if (!ctx || !ctx.traceId || ctx.traceId === '0'.repeat(32)) return null;
    return { traceId: ctx.traceId, spanId: ctx.spanId };
  } catch {
    return null;
  }
}

function parseResourceAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!raw) return attrs;
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) attrs[key] = value;
  }
  return attrs;
}

function initOtel(): NodeSDK | null {
  const enabled = process.env.OTEL_ENABLED?.toLowerCase() === 'true';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!enabled || !endpoint) {
    process.stdout.write('[otel] OTel disabled (OTEL_ENABLED !== "true" or endpoint missing). SDK not initialized.\n');
    return null;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'backend-template';
  const resourceAttrs = parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES || '');

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    ...resourceAttrs,
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
      }),
    ],
  });

  sdk.start();
  process.stdout.write(`[otel] OTel SDK initialized. service.name=${serviceName} endpoint=${endpoint}\n`);

  return sdk;
}

sdkInstance = initOtel();

export const sdk: NodeSDK | null = sdkInstance;
