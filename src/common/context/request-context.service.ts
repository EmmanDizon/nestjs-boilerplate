import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
}

@Injectable()
export class RequestContextService {
  private static asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  static getContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  static getRequestId(): string | undefined {
    return this.getContext()?.requestId;
  }

  static getUserId(): string | undefined {
    return this.getContext()?.userId;
  }

  static run<T>(context: RequestContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  static setUserId(userId: string): void {
    const context = this.getContext();
    if (context) {
      context.userId = userId;
    }
  }
}
