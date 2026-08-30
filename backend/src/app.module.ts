import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { BillingController, EfiWebhookController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { CompaniesController } from "./companies.controller";
import { CustomerPortalController } from "./customer-portal.controller";
import { DeliveriesController } from "./deliveries.controller";
import { HealthController } from "./health.controller";
import { IntegrationsController } from "./integrations.controller";
import { OrdersController } from "./orders.controller";
import { PrintJobsController } from "./print-jobs.controller";
import { PrismaService } from "./prisma.service";
import { PublicMenuController } from "./public-menu.controller";
import { ResourcesController } from "./resources.controller";
import { TicketzSsoController } from "./ticketz-sso.controller";
import { UploadsController } from "./uploads.controller";
import { WhatsappConnectionsController } from "./whatsapp-connections.controller";
import { NativeWhatsappService } from "./native-whatsapp.service";
import { AppService } from "./app.service";

@Module({
  controllers: [
    AuthController,
    BillingController,
    ChatController,
    CompaniesController,
    CustomerPortalController,
    DeliveriesController,
    HealthController,
    IntegrationsController,
    OrdersController,
    PrintJobsController,
    PublicMenuController,
    ResourcesController,
    TicketzSsoController,
    UploadsController,
    WhatsappConnectionsController,
    EfiWebhookController
  ],
  providers: [PrismaService, AppService, NativeWhatsappService, ChatService, BillingService]
})
export class AppModule {}
