export default function TOSPage() {
  return (
    <div className="min-h-screen bg-[#05050a] text-white p-12 lg:p-24 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Terms of Service</h1>
        <p className="text-[#8a8f98]">Last updated: April 2026</p>
        
        <div className="space-y-6 text-white/80 leading-relaxed">
          <p>
            Welcome to Apple Juice AI. By accessing or using our services, you agree to be bound by these Terms of Service.
          </p>
          
          <h2 className="text-2xl font-bold text-white pt-4">1. Acceptance of Terms</h2>
          <p>
            By using Apple Juice, you agree to these terms. If you disagree with any part of the terms, you may not access the service.
          </p>

          <h2 className="text-2xl font-bold text-white pt-4">2. Use License</h2>
          <p>
            Apple Juice is open-source software. You are free to modify and distribute it subject to its open-source license. However, access to our hosted services is provided on an "as is" basis.
          </p>

          <h2 className="text-2xl font-bold text-white pt-4">3. User Content</h2>
          <p>
            You retain all rights to the code generated through Apple Juice. We do not claim ownership of the scripts, assets, or games you build.
          </p>

          <h2 className="text-2xl font-bold text-white pt-4">4. Limitations</h2>
          <p>
            In no event shall Apple Juice or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Apple Juice.
          </p>
        </div>
        
        <div className="pt-12">
          <a href="/" className="text-[#ccff00] hover:underline font-medium">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
