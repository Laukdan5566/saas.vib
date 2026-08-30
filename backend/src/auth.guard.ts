import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { verify } from "jsonwebtoken";
import { AuthUser, RequestWithUser } from "./types";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    const authHeader = Array.isArray(header) ? header[0] : header;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Token ausente.");
    }

    try {
      request.user = verify(
        authHeader.replace("Bearer ", ""),
        process.env.JWT_SECRET || "dev-secret"
      ) as AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException("Token invalido.");
    }
  }
}
