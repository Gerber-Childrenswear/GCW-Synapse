type LogLevel = "INFO" | "WARN" | "ERROR";

type LogContext = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(email|phone|token|secret|password|authorization|cookie|external_id)/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    for (const [childKey, childValue] of Object.entries(source)) {
      target[childKey] = sanitizeValue(childKey, childValue);
    }

    return target;
  }

  return value;
}

export function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) {
    return undefined;
  }

  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    sanitized[key] = sanitizeValue(key, value);
  }

  return sanitized;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(sanitizeContext(context) ?? {})
  };

  const line = JSON.stringify(entry);
  if (level === "ERROR") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function logInfo(message: string, context?: LogContext): void {
  emit("INFO", message, context);
}

export function logWarn(message: string, context?: LogContext): void {
  emit("WARN", message, context);
}

export function logError(message: string, context?: LogContext): void {
  emit("ERROR", message, context);
}
