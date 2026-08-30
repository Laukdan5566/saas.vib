import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DeliveryStatus } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import { AppService } from "./app.service";
import { RequestWithUser } from "./types";

@UseGuards(AuthGuard)
@Controller("api/deliveries")
export class DeliveriesController {
  constructor(private readonly app: AppService) {}

  @Post(":id/assign")
  assign(
    @Param("id") id: string,
    @Body() body: { deliveryPersonId: string; companyId?: string },
    @Req() req: RequestWithUser
  ) {
    return this.app.assignDelivery(id, body.companyId || req.user!.companyId!, body.deliveryPersonId);
  }

  @Post(":id/status")
  status(
    @Param("id") id: string,
    @Body() body: { status: DeliveryStatus; companyId?: string },
    @Req() req: RequestWithUser
  ) {
    return this.app.updateDeliveryStatus(id, body.companyId || req.user!.companyId!, body.status);
  }
}
