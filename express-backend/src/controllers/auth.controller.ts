import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { signupSchema, loginSchema } from "../utils/schemas";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "secret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "refresh_secret";

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    // Create initial organization
    const orgSlug = (name || email.split("@")[0])
      .toLowerCase()
      .replace(/ /g, "-");
    // this will look if name is jack like -> jack@gmail.com -> will look like
    const org = await prisma.organization.create({
      data: {
        name: `${name || email.split("@")[0]}'s Org`,
        slug: `${orgSlug}-${Math.random().toString(36).substring(7)}`,
        ownerId: user.id,
      },
    });

    res.status(201).json({ success: true, userId: user.id, orgId: org.id });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organizations: true },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, {
      expiresIn: "7d",
    });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        orgId: user.organizations[0]?.id || null,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        organizations: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { tokenHash: refreshToken },
      });
    }
    res.clearCookie("refreshToken");
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    let payload: { userId: string };
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET) as { userId: string };
    } catch {
      return res
        .status(401)
        .json({ error: "Invalid or expired refresh token" });
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: refreshToken },
    });
    if (!tokenRecord || tokenRecord.userId !== payload.userId) {
      return res.status(401).json({ error: "Refresh token not recognised" });
    }

    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { tokenHash: refreshToken } });
      return res.status(401).json({ error: "Refresh token has expired" });
    }

    const accessToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ accessToken });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatarUrl } = req.body as {
      name?: string;
      avatarUrl?: string;
    };

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    res.json({ user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "currentPassword and newPassword are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "newPassword must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid)
      return res.status(401).json({ error: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
