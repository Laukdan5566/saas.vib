import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { RequestWithUser } from "./types";

@Injectable()
export class AgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    const authHeader = Array.isArray(header) ? header[0] : header;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : request.headers["x-print-agent-token"];

    if (!process.env.PRINT_AGENT_TOKEN || token !== process.env.PRINT_AGENT_TOKEN) {
      throw new UnauthorizedException("Agente de impressao nao autorizado.");
    }

    return true;
  }
}
