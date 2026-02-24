import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      batches: string[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    batches: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    batches: string[];
  }
}
