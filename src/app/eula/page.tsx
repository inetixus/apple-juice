export default function EULAPage() {
  return (
    <div className="min-h-screen bg-[#05050a] text-white p-12 lg:p-24 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-extrabold tracking-tight">End-User License Agreement (EULA)</h1>
        <p className="text-[#8a8f98]">Last updated: April 2026</p>
        
        <div className="space-y-6 text-white/80 leading-relaxed">
          <p>
            This End-User License Agreement ("EULA") is a legal agreement between you and Apple Juice AI.
          </p>
          
          <h2 className="text-2xl font-bold text-white pt-4">1. Grant of License</h2>
          <p>
            Apple Juice AI grants you a revocable, non-exclusive, non-transferable, limited license to download, install and use the application strictly in accordance with the terms of this Agreement.
          </p>

          <h2 className="text-2xl font-bold text-white pt-4">2. Roblox Studio Integration</h2>
          <p>
            The Apple Juice plugin interfaces with Roblox Studio. You agree that Apple Juice AI is not affiliated with Roblox Corporation, and you will use the tool in compliance with Roblox's Terms of Use.
          </p>

          <h2 className="text-2xl font-bold text-white pt-4">3. Disclaimer of Warranty</h2>
          <p>
            The Application is provided to you "AS IS" and "AS AVAILABLE" and with all faults and defects without warranty of any kind. To the maximum extent permitted under applicable law, Apple Juice AI expressly disclaims all warranties.
          </p>
        </div>
        
        <div className="pt-12">
          <a href="/" className="text-[#ccff00] hover:underline font-medium">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
