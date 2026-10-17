import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";

export function getConvexHttp(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

export async function getAuthedConvex(): Promise<ConvexHttpClient | null> {
  const { getToken, userId } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: "convex" }).catch(() => null);
  if (!token) return null;
  const client = getConvexHttp();
  client.setAuth(token);
  return client;
}
