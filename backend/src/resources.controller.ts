import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AppService } from "./app.service";
import { RequestWithUser } from "./types";

@UseGuards(AuthGuard)
@Controller("api/resources")
export class ResourcesController {
  constructor(private readonly app: AppService) {}

  @Get(":resource")
  list(
    @Param("resource") resource: string,
    @Query("companyId") companyId: string | undefined,
    @Req() req: RequestWithUser
  ) {
    return this.app.list(resource, req.user!, companyId);
  }

  @Get(":resource/:id")
  get(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Req() req: RequestWithUser
  ) {
    return this.app.get(resource, id, req.user!);
  }

  @Post(":resource")
  create(
    @Param("resource") resource: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser
  ) {
    return this.app.create(resource, body, req.user!);
  }

  @Put(":resource/:id")
  update(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: RequestWithUser
  ) {
    return this.app.update(resource, id, body, req.user!);
  }

  @Delete(":resource/:id")
  remove(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Req() req: RequestWithUser
  ) {
    return this.app.remove(resource, id, req.user!);
  }
}
