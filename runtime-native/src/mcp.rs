//! Apple Juice Runtime — official Roblox Studio MCP stdio client (port of
//! runtime/src/mcp-stdio.ts + official-mcp.ts).
//!
//! Spawns the OFFICIAL Roblox Studio MCP server as a child process and speaks
//! JSON-RPC over its stdin/stdout (newline-delimited JSON, per the MCP stdio
//! transport). We RELAY the dashboard's tool calls into this child — we do not
//! reimplement tools (R1.1: wrap, don't reimplement).

use std::collections::HashMap;
use std::env;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::{json, Value};

/// How the official server is launched on this platform.
pub struct McpLaunch {
    pub command: String,
    pub args: Vec<String>,
}

/// Resolve the official Studio MCP path for this platform.
///   Windows : %LOCALAPPDATA%\Roblox\mcp.bat
///   macOS   : /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP
/// Docs: https://create.roblox.com/docs/studio/mcp
pub fn official_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let local = env::var("LOCALAPPDATA").unwrap_or_else(|_| {
            let home = env::var("USERPROFILE").unwrap_or_default();
            format!("{home}\\AppData\\Local")
        });
        PathBuf::from(local).join("Roblox").join("mcp.bat")
    }
    #[cfg(target_os = "macos")]
    {
        PathBuf::from("/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        PathBuf::from("studio-mcp")
    }
}

pub fn official_launch() -> McpLaunch {
    let target = official_path();
    #[cfg(target_os = "windows")]
    {
        McpLaunch {
            command: "cmd.exe".to_string(),
            args: vec!["/c".to_string(), target.to_string_lossy().to_string()],
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        McpLaunch { command: target.to_string_lossy().to_string(), args: vec![] }
    }
}

/// Whether the official server appears to be installed on disk.
pub fn official_installed() -> bool {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    {
        official_path().exists()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        false
    }
}

type Pending = Arc<Mutex<HashMap<u64, Sender<Result<Value, String>>>>>;

pub struct McpClient {
    launch: McpLaunch,
    timeout: Duration,
    stdin: Mutex<Option<ChildStdin>>,
    child: Mutex<Option<Child>>,
    pending: Pending,
    next_id: AtomicU64,
    running: Arc<AtomicBool>,
}

impl McpClient {
    pub fn new(launch: McpLaunch, timeout: Duration) -> Self {
        McpClient {
            launch,
            timeout,
            stdin: Mutex::new(None),
            child: Mutex::new(None),
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: AtomicU64::new(1),
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Spawn the child and perform the MCP `initialize` handshake.
    pub fn start(&self) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Ok(());
        }
        let mut cmd = Command::new(&self.launch.command);
        cmd.args(&self.launch.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;

        let stdout = child.stdout.take().ok_or("no stdout")?;
        let stdin = child.stdin.take().ok_or("no stdin")?;
        let stderr = child.stderr.take();

        *self.stdin.lock().unwrap() = Some(stdin);
        self.running.store(true, Ordering::SeqCst);

        // Reader thread: parse newline-delimited JSON-RPC and dispatch by id.
        let pending = self.pending.clone();
        let running = self.running.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => break,
                };
                let t = line.trim();
                if t.is_empty() {
                    continue;
                }
                let v: Value = match serde_json::from_str(t) {
                    Ok(v) => v,
                    Err(_) => continue, // ignore non-JSON noise
                };
                if let Some(id) = v.get("id").and_then(|x| x.as_u64()) {
                    let sender = pending.lock().unwrap().remove(&id);
                    if let Some(s) = sender {
                        if let Some(err) = v.get("error") {
                            let msg = err
                                .get("message")
                                .and_then(|m| m.as_str())
                                .unwrap_or("MCP error")
                                .to_string();
                            let _ = s.send(Err(msg));
                        } else {
                            let _ = s.send(Ok(v.get("result").cloned().unwrap_or(Value::Null)));
                        }
                    }
                }
            }
            // Child stream closed: mark down and fail everything in flight.
            running.store(false, Ordering::SeqCst);
            let mut p = pending.lock().unwrap();
            for (_, s) in p.drain() {
                let _ = s.send(Err("MCP server exited".to_string()));
            }
        });

        // Drain stderr so the child never blocks on a full pipe.
        if let Some(stderr) = stderr {
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for _line in reader.lines().map_while(Result::ok) {
                    // Intentionally quiet; stderr is noisy and not needed for the bridge.
                }
            });
        }

        *self.child.lock().unwrap() = Some(child);

        // MCP handshake.
        self.request(
            "initialize",
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "apple-juice-runtime", "version": "1.0.0" }
            }),
        )?;
        self.notify("notifications/initialized", json!({}));
        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    pub fn list_tools(&self) -> Result<Value, String> {
        self.request("tools/list", json!({}))
    }

    pub fn call_tool(&self, name: &str, args: Value) -> Result<Value, String> {
        self.request("tools/call", json!({ "name": name, "arguments": args }))
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
        }
        *self.stdin.lock().unwrap() = None;
    }

    // ── internals ──────────────────────────────────────────────────────────

    fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        if !self.running.load(Ordering::SeqCst) {
            return Err("MCP server not started".to_string());
        }
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = channel::<Result<Value, String>>();
        self.pending.lock().unwrap().insert(id, tx);

        let msg = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        if let Err(e) = self.write_line(&msg) {
            self.pending.lock().unwrap().remove(&id);
            return Err(e);
        }

        match rx.recv_timeout(self.timeout) {
            Ok(result) => result,
            Err(_) => {
                self.pending.lock().unwrap().remove(&id);
                Err(format!("MCP request '{method}' timed out"))
            }
        }
    }

    fn notify(&self, method: &str, params: Value) {
        let msg = json!({ "jsonrpc": "2.0", "method": method, "params": params });
        let _ = self.write_line(&msg);
    }

    fn write_line(&self, msg: &Value) -> Result<(), String> {
        let mut guard = self.stdin.lock().unwrap();
        match guard.as_mut() {
            Some(stdin) => {
                let line = msg.to_string();
                stdin
                    .write_all(line.as_bytes())
                    .and_then(|_| stdin.write_all(b"\n"))
                    .and_then(|_| stdin.flush())
                    .map_err(|e| format!("write failed: {e}"))
            }
            None => Err("MCP server not started".to_string()),
        }
    }
}
