declare module "pagedjs" {
  export class Previewer {
    constructor();
    preview(
      content: string | HTMLElement,
      stylesheets: Array<{ _href?: string } | string>,
      renderTo: HTMLElement,
    ): Promise<{ total?: number } | null>;
  }
  export class Handler {
    constructor(chunker?: unknown, polisher?: unknown, caller?: unknown);
  }
  export function registerHandlers(...handlers: unknown[]): void;
}
