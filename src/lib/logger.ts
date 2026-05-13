type LogLevel = "INFO" | "WARN" | "ERROR";

type LogContext = Record<string, unknown>;

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ?? {})
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
