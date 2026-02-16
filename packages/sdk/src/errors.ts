export class EdgeFlagsError extends Error {
  readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'EdgeFlagsError';
    this.statusCode = statusCode;
  }
}
