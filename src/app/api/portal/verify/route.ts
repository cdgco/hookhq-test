import { NextRequest, NextResponse } from "next/server";
import { verifyPortalToken } from "@/lib/portalAuth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({
      error: "No token provided"
    }, { status: 400 });
  }

  const authResult = verifyPortalToken(token, request);

  if (!authResult.success) {
    return NextResponse.json({
      error: authResult.error
    }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    payload: authResult.payload
  });
}
