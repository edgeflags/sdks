import type { EvaluationContext, EvaluationResponse } from './types.js';
import { EdgeFlagsError } from './errors.js';

export class Fetcher {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  async fetchAll(context: EvaluationContext): Promise<EvaluationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/evaluate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context }),
    });

    if (!res.ok) {
      throw new EdgeFlagsError(
        `Evaluation request failed: ${res.status} ${res.statusText}`,
        res.status,
      );
    }

    return (await res.json()) as EvaluationResponse;
  }
}
