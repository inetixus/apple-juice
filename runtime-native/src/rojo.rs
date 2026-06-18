//! Apple Juice Runtime — `rojo serve` supervisor.
//!
//! Manages the real Rojo file-sync server as a child process so the user never
//! touches a terminal. The Runtime owns the project folder (see project.rs);
//! this spawns `rojo serve <project> --port <port>` against it. The official
//! Rojo Studio plugin (installed separately) connects to that port and applies
//! file changes into Studio. We do NOT modify our own plugin — Rojo's sync is
//! handled by Rojo's first-party plugin.
//!
//! Binary resolution order: AJ_ROJO_PATH env → a `rojo` next to our exe →
//! `rojo` on PATH. This lets the distribution bundle a pinned rojo while still
//! working for devs who have it installed.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

/// Rojo's default serve port.
pub const DEFAULT_ROJO_PORT: u16 = 34_872;

pub struct RojoManager {
    root: PathBuf,
    port: u16,
    child: Mutex<Option<Child>>,
}

impl RojoManager {
    pub fn new(root: PathBuf) -> Self {
        let port = std::env::var("AJ_ROJO_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(DEFAULT_ROJO_PORT);
        RojoManager { root, port, child: Mutex::new(None) }
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// Resolve the rojo executable to launch.
    pub fn resolve() -> PathBuf {
        if let Ok(p) = std::env::var("AJ_ROJO_PATH") {
            let pb = PathBuf::from(&p);
            if pb.exists() {
                return pb;
            }
        }
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let name = if cfg!(windows) { "rojo.exe" } else { "rojo" };
                let local = dir.join(name);
                if local.exists() {
                    return local;
                }
            }
        }
        PathBuf::from("rojo") // fall back to PATH
    }

    /// Whether rojo can be located + responds to `--version`. Returns the
    /// version string when found.
    pub fn version() -> Option<String> {
        let out = Command::new(Self::resolve()).arg("--version").output().ok()?;
        if out.status.success() {
            Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
        } else {
            None
        }
    }

    pub fn is_running(&self) -> bool {
        let mut guard = self.child.lock().unwrap();
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(Some(_)) => {
                    *guard = None; // exited
                    false
                }
                Ok(None) => true, // still running
                Err(_) => false,
            },
            None => false,
        }
    }

    /// Start `rojo serve` against the project. Idempotent: a no-op if already
    /// running. Returns the serve port on success.
    pub fn start(&self) -> Result<u16, String> {
        if self.is_running() {
            return Ok(self.port);
        }
        let rojo = Self::resolve();
        let mut child = Command::new(&rojo)
            .arg("serve")
            .arg(&self.root)
            .arg("--port")
            .arg(self.port.to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("could not launch rojo ({}): {e}", rojo.display()))?;

        // Quick liveness check — if rojo bails immediately (port taken, bad
        // project, missing binary semantics), surface it instead of pretending
        // it's serving.
        std::thread::sleep(Duration::from_millis(500));
        match child.try_wait() {
            Ok(Some(status)) => {
                return Err(format!(
                    "rojo serve exited immediately (status {status}). Is the port {} free?",
                    self.port
                ));
            }
            Ok(None) => {}
            Err(e) => return Err(format!("rojo serve check failed: {e}")),
        }

        *self.child.lock().unwrap() = Some(child);
        Ok(self.port)
    }

    /// Stop the rojo serve child if running.
    pub fn stop(&self) {
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
