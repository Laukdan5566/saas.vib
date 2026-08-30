import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { PrismaService } from "./prisma.service";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("login")
  async login(@Body() body: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      include: { company: true }
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Credenciais invalidas.");
    }

    const valid = await compare(body.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Credenciais invalidas.");
    }

    const token = sign(
      {
        id: user.id,
        companyId: user.companyId,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "8h" }
    );

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        company: user.company
      }
    };
  }
}
