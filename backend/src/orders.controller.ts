import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import { AppService } from "./app.service";
import { RequestWithUser } from "./types";

@UseGuards(AuthGuard)
@Controller("api/orders")
export class OrdersController {
  constructor(private readonly app: AppService) {}

  @Get("financial-summary")
  financialSummary(
    @Query("companyId") companyId: string | undefined,
    @Req() req: RequestWithUser
  ) {
    return this.app.orderFinancialSummary(companyId, req.user!);
  }

  @Post()
  createOrUpdate(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    return this.app.createOrUpdateOrder(body, req.user);
  }

  @Post(":id/confirm")
  confirm(
    @Param("id") id: string,
    @Body() body: { companyId?: string },
    @Req() req: RequestWithUser
  ) {
    return this.app.confirmOrder(id, body.companyId || req.user!.companyId!);
  }

  @Post(":id/reprint")
  async reprint(
    @Param("id") id: string,
    @Body() body: { companyId?: string; printerId?: string },
    @Req() req: RequestWithUser
  ) {
    const companyId = body.companyId || req.user!.companyId!;
    const order = await this.app.createPrintJobsForOrder(id, companyId);
    return order;
  }

  @Post(":id/status")
  status(
    @Param("id") id: string,
    @Body() body: { companyId?: string; status: OrderStatus },
    @Req() req: RequestWithUser
  ) {
    return this.app.updateOrderStatus(id, body.companyId || req.user!.companyId!, body.status);
  }
}
