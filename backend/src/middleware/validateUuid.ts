import { type Request, type Response, type NextFunction } from 'express';
import { ValidationError } from '../utils/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuidParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (value && !UUID_REGEX.test(value)) {
      throw new ValidationError(`Formato inválido para ${paramName}`);
    }
    next();
  };
}
