import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { signIn } from "next-auth/react";

type SessionUser = {
  name?: string | null;
  image?: string | null;
};

type SessionResponse = {
  user?: SessionUser;
};

async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/session", { credentials: "include" });
  if (!response.ok) return null;

  const data = (await response.json()) as SessionResponse | null;
  if (!data?.user) return null;
  return data.user;
}

async function signOut(callbackUrl: string) {
  const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
  if (!csrfResponse.ok) {
    window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    return;
  }

  const csrfData = (await csrfResponse.json()) as { csrfToken?: string };
  const token = csrfData.csrfToken;
  if (!token) {
    window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    return;
  }

  const response = await fetch("/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    credentials: "include",
    body: new URLSearchParams({ csrfToken: token, callbackUrl, json: "true" }),
  });

  if (!response.ok) {
    window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    return;
  }

  const result = (await response.json()) as { url?: string };
  window.location.href = result.url ?? callbackUrl;
}

export default function AuthControls({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSession().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const username = useMemo(() => user?.name || "Roblox User", [user]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signIn("roblox")}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
      >
        <User size={14} className="text-zinc-400" />
        Log in with Roblox
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((open) => !open)}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 hover:bg-zinc-800"
      >
        {user.image ? (
          <img src={user.image} alt={username} className="h-6 w-6 rounded-full border border-zinc-700 object-cover" />
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300">
            <User size={12} />
          </span>
        )}
        <span className="max-w-28 truncate">{username}</span>
        <ChevronDown size={14} className="text-zinc-500" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-md border border-zinc-800 bg-zinc-950 p-1">
          <button
            onClick={() => signOut(callbackUrl)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900"
          >
            <LogOut size={14} className="text-zinc-400" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}