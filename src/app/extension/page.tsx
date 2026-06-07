import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apple Juice Browser Extension — Auto-unlock Roblox purchases",
  description:
    "Install the Apple Juice browser extension to automatically unlock your plan or refill the moment your Roblox purchase completes.",
};

const STEPS = [
  {
    title: "Sign in with Roblox",
    body: "Log into apple-juice.online with your Roblox account so purchases can be matched to you.",
  },
  {
    title: "Install the extension",
    body: "Add it from the Chrome Web Store, or load the unpacked build (download below) via chrome://extensions → Developer mode → Load unpacked.",
  },
  {
    title: "Buy on Roblox as usual",
    body: "Purchase a plan or refill from the Apple Juice Shop on Roblox. The extension detects the completed purchase.",
  },
  {
    title: "Unlocked automatically",
    body: "Your plan or refill activates on apple-juice.online instantly — no codes, no waiting.",
  },
];

export default function ExtensionPage() {
  return (
    <div className="min-h-screen bg-[#05050a] text-white p-12 lg:p-24 font-sans">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3">
          <div className="text-4xl">🧃</div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Apple Juice Browser Extension
          </h1>
          <p className="text-white/50 text-lg leading-relaxed">
            Buy on Roblox like normal — the extension detects your completed
            purchase and unlocks the plan or refill on your Apple Juice account
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/apple-juice-extension.zip"
            download
            className="bg-[#ccff00] hover:bg-[#d4ff33] text-black font-bold py-3 px-6 rounded-xl text-sm transition-all"
          >
            Download Extension (.zip)
          </a>
          <a
            href="https://github.com/inetixus/apple-juice/tree/main/extension"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all"
          >
            View Source
          </a>
        </div>

        <div className="space-y-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="flex gap-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5"
            >
              <div className="flex-none w-7 h-7 rounded-full bg-[#ccff00] text-black font-black text-sm flex items-center justify-center">
                {i + 1}
              </div>
              <div>
                <h3 className="font-bold text-white">{s.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed mt-1">
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-3">
          <h2 className="text-lg font-bold">How it stays secure</h2>
          <ul className="text-sm text-white/55 leading-relaxed space-y-2 list-disc pl-5">
            <li>
              The extension only <strong className="text-white/80">detects</strong>{" "}
              purchases — it never makes them. Roblox processes every transaction
              normally.
            </li>
            <li>
              Plans are granted to the Roblox account you signed in with, so a
              purchase can only ever unlock your own account.
            </li>
            <li>
              The server independently re-verifies each purchase with Roblox
              before unlocking anything.
            </li>
          </ul>
        </div>

        <div className="pt-4">
          <a href="/" className="text-[#ccff00] hover:underline font-medium">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
