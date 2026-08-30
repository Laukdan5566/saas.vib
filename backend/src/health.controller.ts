import { Controller, Get } from "@nestjs/common";

@Controller("api")
export class HealthController {
  @Get("health")
  health() {
    return {
      ok: true,
      service: "vib-saas-platform",
      time: new Date().toISOString()
    };
  }
}
