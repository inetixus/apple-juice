const fs = require('fs');
const path = 'src/components/dashboard-client.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Remove clock icon and replace avatar with profile dropdown
const oldHeader = `              Store Purchases
              </div>
              <div className="text-white/50 hover:text-white cursor-pointer transition-colors">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              {avatarUrl ? (
                 <img src={avatarUrl} className="w-8 h-8 rounded-full ring-2 ring-white/10" />
              ) : (
                 <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold ring-2 ring-white/10">{username.charAt(0)}</div>
              )}
           </div>
        </header>`;

const newHeader = `              Store Purchases
              </div>
              {/* Profile avatar with dropdown */}
              <div className="relative">
                <button onClick={() => setShowProfileMenu(p => !p)} className="focus:outline-none">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-8 h-8 rounded-full ring-2 ring-white/10 hover:ring-[#ccff00]/40 transition-all cursor-pointer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold ring-2 ring-white/10 hover:ring-[#ccff00]/40 transition-all cursor-pointer">{username.charAt(0)}</div>
                  )}
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 top-11 w-48 bg-[#111113] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-[100]">
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-sm font-semibold text-white truncate">{username}</p>
                      <p className="text-[10px] text-white/30">Roblox Developer</p>
                    </div>
                    <button
                      onClick={() => { setShowProfileMenu(false); setShowSettings(s => !s); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                      Settings
                    </button>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors flex items-center gap-2 border-t border-white/5"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
           </div>
        </header>`;

if (c.includes(oldHeader)) {
  c = c.replace(oldHeader, newHeader);
  fs.writeFileSync(path, c);
  console.log('Header replaced successfully');
} else {
  console.log('Header target NOT found - checking with normalized line endings');
  const norm = s => s.replace(/\r\n/g, '\n');
  if (norm(c).includes(norm(oldHeader))) {
    c = c.replace(norm(oldHeader).replace(/\n/g, '\r\n'), newHeader.replace(/\n/g, '\r\n'));
    fs.writeFileSync(path, c);
    console.log('Header replaced with CRLF normalization');
  } else {
    console.log('FAILED - could not find target');
  }
}
