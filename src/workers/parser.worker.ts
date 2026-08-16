import { runParseRequest } from "../parsing/worker-runner";
import type { ParserWorkerRequest } from "../parsing/worker-protocol";

const cancelledRequests = new Set<string>();

self.onmessage = (event: MessageEvent<ParserWorkerRequest>) => {
  const request = event.data;
  if (request.type === "cancel") {
    cancelledRequests.add(request.requestId);
    return;
  }

  void runParseRequest(
    request,
    (response) => self.postMessage(response),
    () => cancelledRequests.has(request.requestId),
  );
};
