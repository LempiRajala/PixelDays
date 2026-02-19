// src/@types/express/index.d.ts
import * as express from 'express';
import type { TTag } from 'ttag';

declare global {
  namespace Express {
    interface Request {
      tickRateLimiter: (deltaTime: number) => void;
      csrfPossible: boolean;
      ttag: TTag;
    }
  }
}