
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Clock,
  Activity,
  Settings,
  Trash2,
  Crown,
  Star,
} from "lucide-react";
import { useDashboard } from "./dashboard-context";

export function TeamTab() {
  const {
    teamMembers,
    setTeamMembers,
    teamInviteInput,
    setTeamInviteInput,
  } = useDashboard();

  return (
    <div className="flex-1 w-full h-full flex flex-col p-8 md:p-12 overflow-hidden">
      <div className="flex items-end justify-between mb-12 text-left">
        <div>
          <div className="flex items-center gap-3 text-[#ccff00] text-[10px] font-black uppercase tracking-[0.4em] mb-4">
            <div className="w-8 h-[1px] bg-[#ccff00]/40" />
            Collective Power
          </div>
          <h2 className="text-5xl font-black text-white uppercase tracking-tighter italic leading-none">
            Team <span className="text-white/20">Studio</span>
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#ccff00] transition-colors" />
            <input
              type="text"
              placeholder="Invite via username..."
              className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-xs font-bold text-white focus:outline-none focus:border-[#ccff00]/50 transition-all w-64"
              value={teamInviteInput}
              onChange={(e) => setTeamInviteInput(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              if (teamInviteInput) {
                setTeamMembers([
                  ...teamMembers,
                  {
                    id: Math.random().toString(),
                    username: teamInviteInput,
                    role: "developer",
                    joinedAt: Date.now(),
                    isOnline: false,
                  },
                ]);
                setTeamInviteInput("");
              }
            }}
            className="px-6 py-3 rounded-2xl bg-[#ccff00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d4ff33] transition-all shadow-[0_10px_20px_rgba(204,255,0,0.2)]"
          >
            Send Invite
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1 overflow-hidden">
        <div className="md:col-span-3 flex flex-col min-h-0">
          <div className="glossy-card-dark raycast-shine-dark rounded-[2.5rem] flex-1 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">
                  Project Contributors
                </h3>
                <div className="px-2.5 py-0.5 rounded-md bg-white/5 text-[9px] font-black text-white/40 uppercase">
                  {teamMembers.length} Members
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest">
                  {teamMembers.filter((m) => m.isOnline).length} Active Now
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <div className="space-y-4">
                <AnimatePresence>
                  {teamMembers.map((member) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={member.id}
                      className="group flex items-center gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-[#ccff00]/30 transition-all duration-500"
                    >
                      <div className="relative">
                        <div
                          className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform duration-500`}
                        >
                          <span className="text-xl font-black text-white italic">
                            {member.username[0].toUpperCase()}
                          </span>
                        </div>
                        {member.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0a0a0c] p-0.5">
                            <div className="w-full h-full rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-base font-black text-white uppercase tracking-tight">
                            {member.username}
                          </h4>
                          <div
                            className={`px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.2em] ${
                              member.role === "owner"
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : member.role === "admin"
                                ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {member.role}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-white/20 uppercase tracking-widest italic">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> Joined{" "}
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3 h-3" /> 14 Contributions
                            today
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {member.role !== "owner" && (
                          <button className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white transition-all">
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                        {member.role !== "owner" && (
                          <button
                            onClick={() =>
                              setTeamMembers(
                                teamMembers.filter((m) => m.id !== member.id)
                              )
                            }
                            className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#1e2028] border border-white/5 rounded-[2.5rem] p-8 text-left shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Crown className="w-5 h-5 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                Team Leaderboard
              </h3>
            </div>
            <div className="space-y-6">
              {teamMembers.slice(0, 3).map((member, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40">
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase tracking-tight">
                        {member.username}
                      </p>
                      <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest italic">
                        1.4k Lines AI-Refined
                      </p>
                    </div>
                  </div>
                  {i === 0 && (
                    <Star className="w-4 h-4 text-[#ccff00] fill-[#ccff00]" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[2.5rem] p-8 text-white text-left relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <h3 className="text-xl font-black uppercase tracking-tighter italic mb-4 leading-none">
              Pro Collaboration
            </h3>
            <p className="text-xs font-bold text-white/60 leading-relaxed mb-8 italic">
              Your team can now use shared prompt memory to build faster
              together.
            </p>
            <button className="w-full py-4 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-[#ccff00] transition-all">
              View Permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
