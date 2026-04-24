# 🧃 Apple Juice

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19+-blue?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0+-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

**The first AI Code Tool for Roblox developers.** Turn dream ideas into working Luau prototypes — with instant Studio sync.

Apple Juice bridges the gap between powerful LLMs and Roblox Studio, providing a premium, developer-centric interface for generating, refining, and deploying scripts directly into your games.

![Apple Juice Preview](https://via.placeholder.com/1200x600/0a0c14/ccff00?text=Apple+Juice+Dashboard+Preview) *(Replace with actual screenshot)*

## ✨ Key Features

- **🚀 Instant Studio Sync**: Pair your session with the Roblox Studio plugin. Generate a script in the dashboard, and it appears in your game instantly.
- **🛡️ BYOK (Bring Your Own Key)**: Privacy first. Your API keys are stored strictly in your browser's local storage. They never touch our servers.
- **🤖 Multi-Provider Support**: Switch seamlessly between **OpenAI (GPT-4o)** and **Google (Gemini 1.5 Pro/Flash)**.
- **🧠 Conversation Memory**: The AI remembers your full conversation context, allowing for iterative refinement of complex systems.
- **⚡ Prototyping Speed**: Describe what you want in natural language (e.g., *"Create a round-based matchmaking system with a 30s lobby"*) and get functional Luau code in seconds.
- **🎨 Premium UX**: Built with Next.js 15, React 19, Framer Motion, and Shadcn UI for a fast, beautiful, and responsive experience.

## 🛠️ How It Works

1. **Connect**: Sign in with your Roblox account and get your unique **Pairing Session Code**.
2. **Configure**: Add your OpenAI or Gemini API key in the dashboard settings.
3. **Generate**: Describe your script. Once generated, the Roblox Studio plugin polls the server and injects the code directly into your project.

## 🚀 Getting Started

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/inetixus/apple-juice.git
   cd apple-juice
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   # Next Auth (Roblox Provider)
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_secret_here
   ROBLOX_CLIENT_ID=your_roblox_client_id
   ROBLOX_CLIENT_SECRET=your_roblox_client_secret

   # Redis (Upstash) for session management
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the dashboard**:
   Navigate to [http://localhost:3000](http://localhost:3000).

### Studio Plugin
*Installation instructions for the Roblox Studio plugin coming soon...*

## 🧰 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 4.0](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/)
- **Database**: [Upstash Redis](https://upstash.com/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)

## 🤝 Contributing

Contributions are welcome! Whether it's fixing bugs, adding new features, or improving documentation, feel free to open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with 🧃 by [inetixus](https://github.com/inetixus)
