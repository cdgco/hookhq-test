import { initAuth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/auth.schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// POST /api/setup/create-admin - Create first admin user (no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      email: string;
      name: string;
      password: string;
    };
    const { email, name, password } = body;

    if (!email || !name || !password) {
      return NextResponse.json({ error: "Email, name, and password are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    const db = await getDb();

    // Check if any users already exist
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);

    if (existingUsers.length > 0) {
      return NextResponse.json({
        error: "Users already exist. This endpoint is only for first-time setup."
      }, { status: 400 });
    }

    // Check if user with this email already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // Initialize auth and create user
    const authInstance = await initAuth();

    const result = await authInstance.api.createUser({
      body: {
        email: email,
        password: password,
        name: name,
        role: "admin",
      },
    });

    const newUser = result.user;

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      }
    });

  } catch (error) {
    console.error("Error creating first admin user:", error);
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 });
  }
}
