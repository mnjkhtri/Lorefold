import type { Thread } from "../models/thread";
import { projectParsedRecords } from "../parsing/parsed-thread";
import type { ParseWorkerResult } from "../parsing/worker-protocol";

export async function resultToThread(result: ParseWorkerResult): Promise<Thread> {
  return result.thread ?? projectParsedRecords(result.records, result.request);
}
