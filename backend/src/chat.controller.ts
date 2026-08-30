import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { ChatService } from "./chat.service";
import { RequestWithUser } from "./types";

@Controller("api/chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("messages")
  receive(
    @Headers("x-webhook-secret") secret: string | undefined,
    @Body() body: Record<string, unknown>
  ) {
    return this.chat.receiveMessage(body, secret);
  }

  @UseGuards(AuthGuard)
  @Get("tickets")
  tickets(
    @Query("companyId") companyId: string | undefined,
    @Query("status") status: string | undefined,
    @Req() req: RequestWithUser
  ) {
    return this.chat.listTickets(req.user!, companyId, status || "active");
  }

  @UseGuards(AuthGuard)
  @Get("ticketz/search")
  searchTicketz(
    @Query("companyId") companyId: string | undefined,
    @Query("q") q: string | undefined,
    @Query("status") status: string | undefined,
    @Req() req: RequestWithUser
  ) {
    return this.chat.searchTicketzTickets(req.user!, companyId, q || "", status || "all");
  }

  @UseGuards(AuthGuard)
  @Post("ticketz/sync")
  syncTicketz(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    return this.chat.syncTicketzTicket(body, req.user!);
  }

  @UseGuards(AuthGuard)
  @Get("tickets/:id/messages")
  messages(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.chat.listMessages(id, req.user!);
  }

  @UseGuards(AuthGuard)
  @Post("tickets/:id/handoff")
  handoff(
    @Param("id") id: string,
    @Body() body: { enabled?: boolean },
    @Req() req: RequestWithUser
  ) {
    return this.chat.handoff(id, req.user!, body.enabled ?? true);
  }

  @UseGuards(AuthGuard)
  @Post("tickets/:id/bot")
  bot(
    @Param("id") id: string,
    @Body() body: { enabled: boolean },
    @Req() req: RequestWithUser
  ) {
    return this.chat.setBot(id, req.user!, body.enabled);
  }

  @UseGuards(AuthGuard)
  @Post("tickets/:id/close")
  close(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.chat.closeTicket(id, req.user!);
  }

  @UseGuards(AuthGuard)
  @Post("send-message")
  send(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    return this.chat.sendOutbound(body, req.user!);
  }
}
