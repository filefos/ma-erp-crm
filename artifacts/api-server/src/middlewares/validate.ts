import { Request, Response, NextFunction } from "express";

/**
 * Minimal structural type for any Zod schema (v3 or v4) so we don't depend
 * on zod being a direct dependency of @workspace/api-server. Any schema
 * exported from @workspace/api-zod satisfies this shape.
 */
interface SchemaIssue {
  path: (string | number)[];
  message: string;
  code: string;
}
interface SafeParseFailure {
  success: false;
  error: { issues: SchemaIssue[] };
}
interface SafeParseSuccess<T> {
  success: true;
  data: T;
}
interface SchemaLike<T = unknown> {
  safeParse: (input: unknown) => SafeParseFailure | SafeParseSuccess<T>;
}

/**
 * Express middleware that validates `req.body` against a Zod schema and
 * replaces it with the parsed value on success. On failure responds with 400
 * and a flat list of issues.
 */
export function validateBody(schema: SchemaLike) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "ValidationError",
        message: "Invalid request body",
        issues: parsed.error.issues.map((i: SchemaIssue) => ({
          path: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}
