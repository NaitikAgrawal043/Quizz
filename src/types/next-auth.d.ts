// src/lib/auth.ts

import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import dbConnect from "@/lib/db/connect";
import { User } from "@/lib/db/models";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {},
        password: {},
        role: {},
      },

      async authorize(credentials) {
        await dbConnect();

        const user = await User.findOne({ email: credentials?.email });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials!.password,
          user.passwordHash
        );

        if (!valid) return null;

        if (credentials?.role !== user.role) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          batches: user.batches?.map((b: any) => b.toString()) || [],
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.batches = (user as any).batches;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.batches = token.batches as string[];
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};
