import NextAuth, { type NextAuthConfig } from "next-auth";

type RobloxProfile = {
  sub: string;
  preferred_username: string;
  picture?: string;
};

export const authOptions: NextAuthConfig = {
  providers: [
    {
      id: "roblox",
      name: "Roblox",
      type: "oauth",
      authorization: "https://apis.roblox.com/oauth/v1/authorize",
      token: "https://apis.roblox.com/oauth/v1/token",
      userinfo: "https://apis.roblox.com/oauth/v1/userinfo",
      clientId: process.env.ROBLOX_CLIENT_ID,
      clientSecret: process.env.ROBLOX_CLIENT_SECRET,
      profile(profile) {
        const source = profile as RobloxProfile;

        return {
          id: source.sub,
          name: source.preferred_username,
          image: source.picture,
        };
      },
    },
  ],
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };