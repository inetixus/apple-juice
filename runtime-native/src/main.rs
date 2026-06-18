//! Apple Juice Runtime — entrypoint (native).
//!
//! Starts the loopback bridge that wraps the OFFICIAL Roblox Studio MCP server
//! and exposes it (securely, loopback-only) to the Apple Juice web dashboard.
//! Prints the pair code for the user to enter on the dashboard.
//!
//! This is the small, dependency-free native build (no embedded Node runtime).

mod mcp;
mod project;
mod rojo;
mod security;
mod server;

use std::env;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tiny_http::Server;

use crate::mcp::{official_installed, official_launch, McpClient};
use crate::project::ProjectManager;
use crate::rojo::RojoManager;
use crate::security::PairingManager;
use crate::server::{serve, AppState};

/// Default port the dashboard probes first (see src/lib/runtime-client.ts
/// DEFAULT_CANDIDATE_PORTS: 48321, 48322, 48323).
const DEFAULT_PORT: u16 = 48_321;
const FALLBACK_PORTS: [u16; 2] = [48_322, 48_323];
/// Max concurrent in-flight requests before fast-rejecting with 503. Far above
/// any realistic local load; exists only to bound pathological bursts.
const MAX_INFLIGHT: usize = 256;

fn main() {
    let allowed_origins: Vec<String> = env::var("AJ_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "https://apple-juice.online".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let preferred = env::var("AJ_RUNTIME_PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(DEFAULT_PORT);

    // Spawn + handshake the official MCP server (best-effort; the bridge still
    // serves /health so the dashboard can detect us and show install guidance).
    let mcp = McpClient::new(official_launch(), Duration::from_secs(30));
    match mcp.start() {
        Ok(()) => log("Official Roblox Studio MCP connected over stdio."),
        Err(e) => log(&format!(
            "WARNING: official Roblox Studio MCP not started ({e}). Ensure Studio \
             is installed and MCP is enabled (https://create.roblox.com/docs/studio/mcp).",
        )),
    }
    if !official_installed() {
        log("NOTE: official MCP binary not found on disk yet.");
    }

    // Bind STRICTLY to loopback. Try the preferred port, then the known fallback
    // ports the dashboard also probes.
    let mut candidates = vec![preferred];
    for p in FALLBACK_PORTS {
        if !candidates.contains(&p) {
            candidates.push(p);
        }
    }

    let mut bound: Option<(Server, u16)> = None;
    for p in &candidates {
        match Server::http(format!("127.0.0.1:{p}")) {
            Ok(s) => {
                bound = Some((s, *p));
                break;
            }
            Err(_) => continue, // port in use — try next
        }
    }

    let (server, port) = match bound {
        Some(b) => b,
        None => {
            log("FATAL: could not bind any loopback port (48321-48323 all in use).");
            std::process::exit(1);
        }
    };

    // Now that we know the port, set the expected Host values (anti DNS-rebind).
    let mut pairing = PairingManager::new(
        allowed_origins.clone(),
        vec![format!("127.0.0.1:{port}"), format!("localhost:{port}")],
    );
    let pair_code = pairing.new_pair_code();

    // Durable project ("personal space"): scaffold folders + Rojo project.json +
    // git on disk. Best-effort — the bridge still serves if this fails.
    let project_root = ProjectManager::default_root();
    let project = ProjectManager::new(project_root.clone());
    match project.open_or_create() {
        Ok(()) => log(&format!("Project ready at {}", project.root().display())),
        Err(e) => log(&format!("WARNING: could not init project: {e}")),
    }

    // Rojo serve supervisor (not auto-started; the dashboard starts it on demand).
    let rojo = RojoManager::new(project_root);
    match RojoManager::version() {
        Some(v) => log(&format!("Rojo available: {v}")),
        None => log("NOTE: rojo not found yet (file sync will be unavailable until installed/bundled)."),
    }

    // Human-facing banner (stdout) with the pair code.
    println!();
    println!("  🍎 Apple Juice Runtime");
    println!("  Local bridge: http://127.0.0.1:{port}");
    println!("  Pair code:    {pair_code}");
    println!("  Enter this code at https://apple-juice.online/connect");
    println!();

    let state = Arc::new(AppState {
        pairing: Mutex::new(pairing),
        mcp,
        allowed_origins,
        project: Mutex::new(project),
        rojo,
    });

    // Periodic sweep of expired codes/tokens.
    {
        let st = state.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(60));
            st.pairing.lock().unwrap().sweep();
        });
    }

    serve(Arc::new(server), state, MAX_INFLIGHT);
}

fn log(msg: &str) {
    eprintln!("[apple-juice-runtime] {msg}");
}
