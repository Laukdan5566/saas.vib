import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const express = require("express");

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableCors({
    origin: true,
    credentials: true
  });
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true, limit: "8mb" }));
  app.use((req: any, _res: any, next: () => void) => {
    if (req.url.startsWith("/api/api/")) {
      req.url = req.url.replace(/^\/api\/api\//, "/api/");
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false
    })
  );
  await app.listen(process.env.PORT || 3000);
}

void bootstrap();
