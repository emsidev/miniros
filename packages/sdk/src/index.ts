import {
  healthResponseSchema,
  workflowPreviewRequestSchema,
  workflowPreviewResponseSchema,
  type HealthResponse,
  type WorkflowPreviewRequest,
  type WorkflowPreviewResponse,
} from "@miniros/contracts";

type FetchLike = typeof fetch;

type ApiClientOptions = {
  baseUrl?: string;
  fetcher?: FetchLike;
};

export class MinirosApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: FetchLike;

  constructor({
    baseUrl = "http://localhost:4000",
    fetcher = fetch,
  }: ApiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetcher = fetcher;
  }

  async getHealth(): Promise<HealthResponse> {
    const response = await this.fetcher(`${this.baseUrl}/health`);
    const payload = await response.json();

    return healthResponseSchema.parse(payload);
  }

  async previewWorkflow(
    input: WorkflowPreviewRequest,
  ): Promise<WorkflowPreviewResponse> {
    const requestBody = workflowPreviewRequestSchema.parse(input);
    const response = await this.fetcher(`${this.baseUrl}/workflows/preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json();

    return workflowPreviewResponseSchema.parse(payload);
  }
}

export function createApiClient(options?: ApiClientOptions) {
  return new MinirosApiClient(options);
}
