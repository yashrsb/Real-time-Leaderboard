import jwt from "jsonwebtoken";
import type { Env } from "../config/env";
import type { StringValue } from "ms";

export type JwtPayload = {
  sub: string;
};

export function generateToken(payload: JwtPayload, env: Env): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as StringValue,
    algorithm: "HS256",
  });
}

export function verifyToken(token: string, env: Env): JwtPayload {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
  }) as JwtPayload;

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid token payload");
  }

  return payload;
}
