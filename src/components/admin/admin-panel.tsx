"use client";

import { useState, useCallback, useEffect } from "react";

type Snapshot = {
  userId: string;
  plan: string;
  usage: { usedMl: number; totalMl: number; remainingMl: number; bonusMl: number };
  ban: {
    reason: string;
    bannedBy: string;
    bannedAt: number;
    expiresAt?: number;
    appealable?: boolean;
    ipBan?: boolean;
    bannedIp?: string;
    appeal?: { text: string; submittedAt: number };
  } | null;
  warnings: { id: string; reason: string; warnedBy: string; warnedAt: number }[];
  record?: { firstSeen: number; lastSeen: number; lastIp?: string; username?: string } | null;
  registered?: boolean;
};

type AuditEntry = {
  id: string;
  action: string;
  targetUserId: string;
  adminUserId: string;
  detail?: string;
  at: number;
};

type SubRequest = {
  id: string;
  userId: string;
  robloxUsername: string;
  plan: string;
  cancelled: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedBy?: string;
  reviewNote?: string;
  purchaseProof?: string;
  ownershipProof?: string;
};

const PLANS = ["free", "partner", "fresh_pro", "pure_ultra"] as const;
const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  partner: "Partner",
  fresh_pro: "Fresh Pro",
  pure_ultra: "Pure Ultra",
};

export function AdminPanel({ adminName }: { adminName: string }) {
  const [userId, setUserId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  // Subscription verification queue
  const [subRequests, setSubRequests] = useState<SubRequest[]>([]);
  const [subFilter, setSubFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [activeSub, setActiveSub] = useState<SubRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [subUserCheck, setSubUserCheck] = useState<{ registered: boolean; userId?: string } | null>(null);

  // Action inputs
  const [banReason, setBanReason] = useState("");
  const [banDays, setBanDays] = useState("");
  const [banAppealable, setBanAppealable] = useState(true);
  const [banIp, setBanIp] = useState(false);
  const [warnReason, setWarnReason] = useState("");
  const [mlAmount, setMlAmount] = useState("");
  const [users, setUsers] = useState<{ userId: string; username?: string; firstSeen: number; lastSeen: number; lastIp?: string }[]>([]);

  const flash = (msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/admin?audit=1", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAudit(data.audit || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadSubs = useCallback(async (status: "pending" | "approved" | "rejected") => {
    try {
      const res = await fetch(`/api/admin/subscriptions?status=${status}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSubRequests(data.requests || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openSub = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/subscriptions?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSub(data.request);
        setReviewNote("");
        setSubUserCheck(null);
        // Cross-check the claimed Roblox username against our registry.
        if (data.request?.robloxUsername) {
          try {
            const ur = await fetch(
              `/api/admin?username=${encodeURIComponent(data.request.robloxUsername)}`,
              { cache: "no-store" },
            );
            if (ur.ok) {
              const ud = await ur.json();
              setSubUserCheck({ registered: !!ud.registered, userId: ud.record?.userId });
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const reviewSub = useCallback(
    async (id: string, action: "approve" | "reject") => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, note: reviewNote.trim() || undefined }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          flash(data.message || "Done");
          setActiveSub(null);
          await loadSubs(subFilter);
          await loadAudit();
        } else {
          flash(data.error || "Action failed", "err");
        }
      } catch {
        flash("Network error", "err");
      } finally {
        setLoading(false);
      }
    },
    [reviewNote, subFilter, loadSubs, loadAudit],
  );

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin?users=1", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadAudit();
    void loadUsers();
  }, [loadAudit, loadUsers]);

  useEffect(() => {
    void loadSubs(subFilter);
  }, [loadSubs, subFilter]);

  const lookup = useCallback(async (id?: string) => {
    const target = (id ?? userId).trim();
    if (!target) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?userId=${encodeURIComponent(target)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setSnapshot(data);
      } else {
        flash(data.error || "Lookup failed", "err");
      }
    } catch {
      flash("Network error", "err");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const doAction = useCallback(
    async (payload: Record<string, unknown>) => {
      const target = userId.trim();
      if (!target) {
        flash("Enter a user ID first", "err");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, userId: target }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          flash(data.message || "Done");
          await lookup(target);
          await loadAudit();
        } else {
          flash(data.error || "Action failed", "err");
        }
      } catch {
        flash("Network error", "err");
      } finally {
        setLoading(false);
      }
    },
    [userId, lookup, loadAudit],
  );

  const fmt = (ts: number) => new Date(ts).toLocaleString();

  return (
    <div className="min-h-screen bg-[#05050a] text-white p-6 md:p-12 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">🛡️ Admin Panel</h1>
            <p className="text-white/40 text-sm mt-1">
              Signed in as {adminName}
            </p>
          </div>
          <a href="/dashboard" className="text-[#ccff00] text-sm hover:underline">
            ← Dashboard
          </a>
        </div>

        {/* Lookup */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <label className="text-xs font-bold uppercase tracking-wider text-white/40 block mb-2">
            User Lookup (Roblox userId)
          </label>
          <div className="flex gap-2">
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="e.g. 3762792455"
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#ccff00]/50"
            />
            <button
              onClick={() => lookup()}
              disabled={loading}
              className="bg-[#ccff00] text-black font-bold px-6 rounded-lg text-sm hover:bg-[#d4ff33] transition-all disabled:opacity-50"
            >
              {loading ? "..." : "Look up"}
            </button>
          </div>
        </div>

        {/* Snapshot + actions */}
        {snapshot && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* State */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4">
              <h2 className="font-bold text-lg">Account</h2>
              <div className="text-sm space-y-2 text-white/70">
                <Row label="User ID" value={snapshot.userId} />
                <Row
                  label="Registered"
                  value={
                    snapshot.registered ? (
                      <span className="text-emerald-400">✓ Signed up</span>
                    ) : (
                      <span className="text-white/40">Never signed in</span>
                    )
                  }
                />
                {snapshot.record?.username && (
                  <Row label="Username" value={`@${snapshot.record.username}`} />
                )}
                {snapshot.record?.firstSeen && (
                  <Row label="Joined" value={fmt(snapshot.record.firstSeen)} />
                )}
                <Row label="Plan" value={PLAN_LABELS[snapshot.plan] || snapshot.plan} />
                <Row
                  label="Juice"
                  value={`${snapshot.usage.remainingMl.toLocaleString()} / ${snapshot.usage.totalMl.toLocaleString()} mL`}
                />
                <Row label="Bonus mL" value={snapshot.usage.bonusMl.toLocaleString()} />
                <Row
                  label="Status"
                  value={
                    snapshot.ban ? (
                      <span className="text-red-400 font-bold">
                        BANNED{snapshot.ban.expiresAt ? ` until ${fmt(snapshot.ban.expiresAt)}` : " (permanent)"}
                      </span>
                    ) : (
                      <span className="text-emerald-400">Active</span>
                    )
                  }
                />
                {snapshot.ban && (
                  <div className="text-xs text-red-300/70 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 space-y-1">
                    <div>Reason: {snapshot.ban.reason}</div>
                    <div className="flex gap-2 text-[10px] text-white/40">
                      {snapshot.ban.appealable === false && <span>No appeal</span>}
                      {snapshot.ban.ipBan && <span>IP banned: {snapshot.ban.bannedIp}</span>}
                    </div>
                    {snapshot.ban.appeal && (
                      <div className="mt-1.5 pt-1.5 border-t border-red-500/20">
                        <span className="text-amber-300 font-bold">Appeal:</span>{" "}
                        <span className="text-white/70">{snapshot.ban.appeal.text}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Warnings */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
                  Warnings ({snapshot.warnings.length})
                </h3>
                {snapshot.warnings.length === 0 ? (
                  <p className="text-xs text-white/30">None</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {snapshot.warnings.map((w) => (
                      <div
                        key={w.id}
                        className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-amber-200/80"
                      >
                        {w.reason}
                        <span className="block text-white/30 mt-0.5">{fmt(w.warnedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-5">
              <h2 className="font-bold text-lg">Actions</h2>

              {/* Plan */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/40 block mb-2">
                  Grant Plan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PLANS.map((p) => (
                    <button
                      key={p}
                      onClick={() => doAction({ action: "grantPlan", plan: p })}
                      disabled={loading}
                      className="text-xs font-bold py-2 rounded-lg bg-white/5 hover:bg-[#ccff00]/15 border border-white/10 hover:border-[#ccff00]/40 transition-all disabled:opacity-50"
                    >
                      {PLAN_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grant mL */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/40 block mb-2">
                  Grant Bonus mL
                </label>
                <div className="flex gap-2">
                  <input
                    value={mlAmount}
                    onChange={(e) => setMlAmount(e.target.value)}
                    placeholder="20000"
                    inputMode="numeric"
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ccff00]/50"
                  />
                  <button
                    onClick={() => {
                      const ml = Number(mlAmount);
                      if (ml > 0) doAction({ action: "grantMl", ml });
                    }}
                    disabled={loading}
                    className="bg-white/5 border border-white/10 px-4 rounded-lg text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                  >
                    Grant
                  </button>
                </div>
              </div>

              {/* Warn */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/40 block mb-2">
                  Issue Warning
                </label>
                <div className="flex gap-2">
                  <input
                    value={warnReason}
                    onChange={(e) => setWarnReason(e.target.value)}
                    placeholder="Reason..."
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400/50"
                  />
                  <button
                    onClick={() => {
                      if (warnReason.trim()) {
                        doAction({ action: "warn", reason: warnReason.trim() });
                        setWarnReason("");
                      }
                    }}
                    disabled={loading}
                    className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-4 rounded-lg text-sm font-bold hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    Warn
                  </button>
                </div>
                {snapshot.warnings.length > 0 && (
                  <button
                    onClick={() => doAction({ action: "clearWarnings" })}
                    disabled={loading}
                    className="text-[11px] text-white/40 hover:text-white/70 mt-2"
                  >
                    Clear all warnings
                  </button>
                )}
              </div>

              {/* Ban / Unban */}
              <div className="pt-2 border-t border-white/[0.06]">
                <label className="text-xs font-bold uppercase tracking-wider text-white/40 block mb-2">
                  Ban
                </label>
                {snapshot.ban ? (
                  <button
                    onClick={() => doAction({ action: "unban" })}
                    disabled={loading}
                    className="w-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    Unban User
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Ban reason..."
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400/50"
                    />
                    <div className="flex gap-4 px-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-white/60">
                        <input
                          type="checkbox"
                          checked={banAppealable}
                          onChange={(e) => setBanAppealable(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#ccff00]"
                        />
                        Appealable
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-white/60">
                        <input
                          type="checkbox"
                          checked={banIp}
                          onChange={(e) => setBanIp(e.target.checked)}
                          className="w-3.5 h-3.5 accent-red-500"
                        />
                        IP ban {snapshot.record?.lastIp ? `(${snapshot.record.lastIp})` : "(no IP on file)"}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={banDays}
                        onChange={(e) => setBanDays(e.target.value)}
                        placeholder="Days (blank = permanent)"
                        inputMode="numeric"
                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400/50"
                      />
                      <button
                        onClick={() => {
                          if (!banReason.trim()) {
                            flash("Enter a ban reason", "err");
                            return;
                          }
                          const days = Number(banDays);
                          doAction({
                            action: "ban",
                            reason: banReason.trim(),
                            durationDays: days > 0 ? days : undefined,
                            appealable: banAppealable,
                            ipBan: banIp,
                          });
                          setBanReason("");
                          setBanDays("");
                          setBanIp(false);
                        }}
                        disabled={loading}
                        className="bg-red-500/15 border border-red-500/30 text-red-300 px-5 rounded-lg text-sm font-bold hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Ban
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subscription verification queue */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">
              🧾 Subscription Verification
              {subFilter === "pending" && subRequests.length > 0 && (
                <span className="ml-2 text-xs bg-[#ccff00] text-black font-black px-2 py-0.5 rounded-full">
                  {subRequests.length}
                </span>
              )}
            </h2>
            <div className="flex gap-1 bg-black/30 rounded-lg p-1">
              {(["pending", "approved", "rejected"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSubFilter(s)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-md capitalize transition-all ${
                    subFilter === s
                      ? "bg-[#ccff00] text-black"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {subRequests.length === 0 ? (
            <p className="text-sm text-white/30">No {subFilter} requests.</p>
          ) : (
            <div className="space-y-2">
              {subRequests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openSub(r.id)}
                  className="w-full flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-lg px-4 py-3 text-left transition-all"
                >
                  <span className="font-bold text-sm text-white">@{r.robloxUsername}</span>
                  <span className="text-xs font-mono text-[#ccff00]">
                    {PLAN_LABELS[r.plan] || r.plan}
                  </span>
                  {r.cancelled && (
                    <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                      cancelled
                    </span>
                  )}
                  <span className="text-xs text-white/30 ml-auto">{fmt(r.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User roster */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">
              👥 Users <span className="text-white/30 text-sm font-normal">({users.length})</span>
            </h2>
            <button onClick={loadUsers} className="text-xs text-white/40 hover:text-white/70">
              Refresh
            </button>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-white/30">No users recorded yet.</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto text-xs">
              <div className="flex items-center gap-3 px-3 py-1.5 text-white/30 font-bold uppercase tracking-wider text-[10px] sticky top-0 bg-[#0d0e12]">
                <span className="w-32 shrink-0">User</span>
                <span className="flex-1">Joined</span>
                <span className="w-32 shrink-0">Last seen</span>
              </div>
              {users.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => {
                    setUserId(u.userId);
                    void lookup(u.userId);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-lg px-3 py-2 text-left transition-all"
                >
                  <span className="w-32 shrink-0 truncate">
                    <span className="text-white/80 font-medium">
                      {u.username || u.userId}
                    </span>
                  </span>
                  <span className="flex-1 text-white/40">{fmt(u.firstSeen)}</span>
                  <span className="w-32 shrink-0 text-white/30">{fmt(u.lastSeen)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Audit log */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Audit Log</h2>
            <button onClick={loadAudit} className="text-xs text-white/40 hover:text-white/70">
              Refresh
            </button>
          </div>
          {audit.length === 0 ? (
            <p className="text-sm text-white/30">No actions recorded yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto text-xs">
              {audit.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 bg-white/[0.02] rounded-lg px-3 py-2"
                >
                  <span className="font-mono font-bold text-[#ccff00] w-28 shrink-0">
                    {e.action}
                  </span>
                  <button
                    onClick={() => {
                      setUserId(e.targetUserId);
                      void lookup(e.targetUserId);
                    }}
                    className="text-white/70 hover:text-white underline-offset-2 hover:underline"
                  >
                    {e.targetUserId}
                  </button>
                  <span className="text-white/40 flex-1 truncate">{e.detail || ""}</span>
                  <span className="text-white/25 shrink-0">{fmt(e.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subscription detail modal */}
      {activeSub && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setActiveSub(null)}
        >
          <div className="relative w-full max-w-2xl bg-[#0d0e12] border border-white/10 rounded-3xl p-8 my-8">
            <button
              onClick={() => setActiveSub(null)}
              className="absolute top-5 right-5 text-white/40 hover:text-white text-xl"
            >
              ✕
            </button>
            <h2 className="text-xl font-black mb-1">
              @{activeSub.robloxUsername} — {PLAN_LABELS[activeSub.plan] || activeSub.plan}
            </h2>
            <p className="text-xs text-white/40 mb-5">
              Account: {activeSub.userId} · Submitted {fmt(activeSub.createdAt)} ·{" "}
              {activeSub.cancelled ? "Says cancelled ✓" : "Not cancelled"}
              {activeSub.status !== "pending" && (
                <span className="ml-2 capitalize text-white/60">[{activeSub.status}]</span>
              )}
            </p>

            {/* Username verification against our registry */}
            {subUserCheck && (
              <div
                className={`text-xs rounded-lg px-3 py-2 mb-4 border ${
                  subUserCheck.registered
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                }`}
              >
                {subUserCheck.registered
                  ? `✓ @${activeSub.robloxUsername} is a signed-up account${
                      subUserCheck.userId === activeSub.userId
                        ? " and matches the submitter."
                        : " (note: differs from the submitting account)."
                    }`
                  : `⚠ No signed-up account found with the username @${activeSub.robloxUsername}. They may have typed it differently, or not signed in yet.`}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Purchase confirmation
                </p>
                {activeSub.purchaseProof ? (
                  <a href={activeSub.purchaseProof} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSub.purchaseProof}
                      alt="purchase proof"
                      className="w-full rounded-lg border border-white/10 hover:border-[#ccff00]/50 transition-all"
                    />
                  </a>
                ) : (
                  <p className="text-xs text-white/30">No image</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  Active subscription
                </p>
                {activeSub.ownershipProof ? (
                  <a href={activeSub.ownershipProof} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSub.ownershipProof}
                      alt="ownership proof"
                      className="w-full rounded-lg border border-white/10 hover:border-[#ccff00]/50 transition-all"
                    />
                  </a>
                ) : (
                  <p className="text-xs text-white/30">No image</p>
                )}
              </div>
            </div>

            {activeSub.status === "pending" ? (
              <>
                <input
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional review note..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-[#ccff00]/50"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => reviewSub(activeSub.id, "approve")}
                    disabled={loading}
                    className="flex-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 py-3 rounded-xl font-bold text-sm hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    ✓ Approve & Grant {PLAN_LABELS[activeSub.plan] || activeSub.plan}
                  </button>
                  <button
                    onClick={() => reviewSub(activeSub.id, "reject")}
                    disabled={loading}
                    className="flex-1 bg-red-500/15 border border-red-500/30 text-red-300 py-3 rounded-xl font-bold text-sm hover:bg-red-500/25 disabled:opacity-50"
                  >
                    ✕ Reject
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-white/50">
                Reviewed by {activeSub.reviewedBy}
                {activeSub.reviewNote && ` — "${activeSub.reviewNote}"`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-bold shadow-2xl z-50 ${
            toast.kind === "ok"
              ? "bg-[#ccff00] text-black"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
