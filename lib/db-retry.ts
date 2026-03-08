import { prisma } from "./prisma";

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 10,
  delayMs = 2000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
