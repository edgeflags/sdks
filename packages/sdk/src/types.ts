export type FlagValue = boolean | string | number | Record<string, unknown>;

export interface EvaluationContext {
  user_id?: string;
  email?: string;
  phone?: string;
  plan?: string;
  segments?: string[];
  environment?: string;
  custom: Record<string, unknown>;
}

export interface EvaluationResponse {
  flags: Record<string, FlagValue>;
  configs: Record<string, unknown>;
}

export interface ChangeEvent {
  flags: { key: string; previous: FlagValue | undefined; current: FlagValue }[];
  configs: { key: string; previous: unknown; current: unknown }[];
}

export interface EdgeFlagsOptions {
  token: string;
  baseUrl: string;
  context?: EvaluationContext;
  pollingInterval?: number;
  bootstrap?: {
    flags?: Record<string, FlagValue>;
    configs?: Record<string, unknown>;
  };
  debug?: boolean;
}

export type EdgeFlagsEvent = 'ready' | 'change' | 'error';

export type EventPayloadMap = {
  ready: undefined;
  change: ChangeEvent;
  error: Error;
};
