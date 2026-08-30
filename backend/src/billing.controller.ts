import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { BillingService } from "./billing.service";
import { RequestWithUser } from "./types";

@UseGuards(AuthGuard)
@Controller("api/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("plans")
  listPlans() {
    return this.billing.listPlans();
  }

  @Post("plans")
  createPlan(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    return this.billing.createPlan(body, req.user!);
  }

  @Put("plans/:id")
  updatePlan(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser
  ) {
    return this.billing.updatePlan(id, body, req.user!);
  }

  @Get("subscriptions")
  listSubscriptions(@Query("companyId") companyId: string | undefined, @Req() req: RequestWithUser) {
    return this.billing.listSubscriptions(req.user!, companyId);
  }

  @Get("config")
  config(@Req() req: RequestWithUser) {
    return this.billing.billingConfig(req.user!);
  }

  @Put("config")
  saveConfig(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    return this.billing.saveBillingConfig(body, req.user!);
  }

  @Post("run-cycle")
  runCycle(@Req() req: RequestWithUser) {
    return this.billing.runBillingCycle(req.user!);
  }

  @Post("subscriptions")
  upsertSubscription(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    return this.billing.upsertSubscription(body, req.user!);
  }

  @Post("subscriptions/:companyId/release")
  releaseSubscription(
    @Param("companyId") companyId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser
  ) {
    return this.billing.releaseSubscription(companyId, body, req.user!);
  }

  @Get("invoices")
  listInvoices(@Query("companyId") companyId: string | undefined, @Req() req: RequestWithUser) {
    return this.billing.listInvoices(req.user!, companyId);
  }

  @Post("invoices")
  createInvoice(@Body() body: Record<string, unknown>, @Req() req: RequestWithUser) {
    return this.billing.createInvoice(body, req.user!);
  }

  @Put("invoices/:id")
  updateInvoice(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser
  ) {
    return this.billing.updateInvoice(id, body, req.user!);
  }

  @Post("invoices/:id/mark-paid")
  markPaid(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.billing.markPaid(id, req.user!);
  }

  @Post("invoices/:id/generate-pix")
  generatePix(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.billing.generatePix(id, req.user!);
  }

  @Post("invoices/:id/generate-boleto")
  generateBoleto(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.billing.generateBoleto(id, req.user!);
  }

  @Post("invoices/:id/refresh-boleto")
  refreshBoleto(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.billing.refreshBoleto(id, req.user!);
  }

  @Post("invoices/:id/cancel-boleto")
  cancelBoleto(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.billing.cancelBoleto(id, req.user!);
  }

  @Get("my-subscription")
  mySubscription(@Query("companyId") companyId: string | undefined, @Req() req: RequestWithUser) {
    return this.billing.mySubscription(req.user!, companyId);
  }

  @Get("my-invoices")
  myInvoices(@Query("companyId") companyId: string | undefined, @Req() req: RequestWithUser) {
    return this.billing.listInvoices(req.user!, companyId);
  }

  @Post("my-invoices/:id/pay-pix")
  payPix(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.billing.generatePix(id, req.user!);
  }

  @Post("my-invoices/:id/pay-boleto")
  payBoleto(@Param("id") id: string, @Req() req: RequestWithUser) {
    return this.billing.generateBoleto(id, req.user!);
  }
}

@Controller("api/webhooks/efi")
export class EfiWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post("pix")
  pix(@Body() body: Record<string, unknown>) {
    return this.billing.processPixWebhook(body);
  }

  @Post("charges")
  charges(@Body() body: Record<string, unknown>) {
    return this.billing.processChargesWebhook(body);
  }
}
