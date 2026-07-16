// In-memory progress store for active analyses
const progressStore = new Map<string, { step: number; message: string; timestamp: number }[]>();

export function updateProgress(analysisId: string, step: number, message: string) {
  if (!progressStore.has(analysisId)) {
    progressStore.set(analysisId, []);
  }
  progressStore.get(analysisId)!.push({ step, message, timestamp: Date.now() });
}

export function getProgress(analysisId: string) {
  return progressStore.get(analysisId) || [];
}

export function clearProgress(analysisId: string) {
  progressStore.delete(analysisId);
}
