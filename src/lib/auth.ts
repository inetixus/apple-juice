import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getAntigravityMapping } from "@/lib/antigravity";

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
          image: null,
        };
      },
    },
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET_OAUTH || "",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "roblox" && profile) {
        const p = profile as RobloxProfile;
        token.sub = p.sub ?? token.sub;
        (token as { username?: string }).username =
          p.preferred_username ?? p.name ?? (token as { username?: string }).username;
        (token as { provider?: string }).provider = "roblox";
      }
      if (account?.provider === "google") {
        token.sub = account.providerAccountId ?? token.sub;
        (token as { username?: string }).username =
          (profile as { name?: string })?.name ?? token.name ?? "Google User";
        (token as { provider?: string }).provider = "google";
        (token as { email?: string }).email = (profile as { email?: string })?.email ?? "";
        (token as { picture?: string }).picture = (profile as { picture?: string })?.picture ?? "";

        // ── Antigravity identity mapping ──
        // Look up whether this Google email is linked to an Antigravity account
        const email = (profile as { email?: string })?.email;
        if (email) {
          try {
            const agMapping = await getAntigravityMapping(email);
            if (agMapping) {
              (token as { antigravityId?: string }).antigravityId = agMapping.antigravityUserId;
            }
          } catch (err) {
            console.warn("Antigravity mapping lookup failed:", err instanceof Error ? err.message : String(err));
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub ?? "";
        session.user.name =
          (token as { username?: string }).username ?? session.user.name ?? "User";
        (session.user as { provider?: string }).provider =
          (token as { provider?: string }).provider ?? "roblox";
        (session.user as { image?: string | null }).image =
          (token as { picture?: string }).picture ?? null;
        // Expose Antigravity link status to the frontend
        (session.user as { antigravityId?: string | null }).antigravityId =
          (token as { antigravityId?: string }).antigravityId ?? null;
      }
      return session;
    },
    async redirect({ baseUrl }) {
      return `${baseUrl}/dashboard`;
    },
  },
};