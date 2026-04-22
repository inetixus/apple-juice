import type { NextAuthOptions } from "next-auth";

type RobloxProfile = {
  sub?: string;
  preferred_username?: string;
  name?: string;
};

export const authOptions: NextAuthOptions = {
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    {
      id: "roblox",
      name: "Roblox",
      type: "oauth",
      issuer: "https://apis.roblox.com/oauth/",
      wellKnown: "https://apis.roblox.com/oauth/.well-known/openid-configuration",
      authorization: {
        url: "https://apis.roblox.com/oauth/v1/authorize",
        params: { scope: "openid profile", response_type: "code" },
      },
      token: "https://apis.roblox.com/oauth/v1/token",
      userinfo: "https://apis.roblox.com/oauth/v1/userinfo",
      checks: ["pkce", "state"],
      clientId: process.env.ROBLOX_CLIENT_ID,
      clientSecret: process.env.ROBLOX_CLIENT_SECRET,
      client: {
        token_endpoint_auth_method: "client_secret_post",
        id_token_signed_response_alg: "ES256",
      },
      profile(profile: RobloxProfile) {
        const id = profile.sub?.toString();
        if (!id) throw new Error("Roblox profile missing sub");
        return {
          id,
          name: profile.preferred_username ?? profile.name ?? "Roblox User",
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "roblox" && profile) {
        const p = profile as RobloxProfile;
        token.sub = p.sub ?? token.sub;
        (token as { username?: string }).username =
          p.preferred_username ?? p.name ?? (token as { username?: string }).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub ?? "";
        session.user.name =
          (token as { username?: string }).username ?? session.user.name ?? "Roblox User";
      }
      return session;
    },
    async redirect({ baseUrl }) {
      return `${baseUrl}/dashboard`;
    },
  },
};