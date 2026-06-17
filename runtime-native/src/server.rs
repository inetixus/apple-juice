//! Apple Juice Runtime — loopback HTTP bridge (port of runtime/src/bridge-server.ts).
//!
//! Binds STRICTLY to 127.0.0.1 and exposes a tiny JSON API the Apple Juice web
//! dashboard calls to drive the OFFICIAL Roblox Studio MCP server running
//! locally as a child process. Every mutating request is gated by the
//! PairingManager (Origin + Host + per-session token).
//!
//! Endpoints:
//!   GET  /health   — liveness + whether the official MCP child is up. (open)
//!   POST /pair     — body {code}; exchange a pair code for a session token.
//!   GET  /tools    — list official MCP tools. (auth)
//!   POST /call     — body {tool,args}; call a tool. (auth)

use std::io::{Cursor, Read};
use std::sync::{Arc, Mutex};
use std::thread;

use serde_json::{json, Value};
use tiny_http::{Header, Method, Request, Response, Server};

use crate::mcp::{official_installed, McpClient};
use crate::security::{extract_bearer, PairingManager};

const MAX_BODY_BYTES: u64 = 256 * 1024;

pub struct AppState {
    pub pairing: Mutex<PairingManager>,
    pub mcp: McpClient,
    pub allowed_origins: Vec<String>,
}

fn header(name: &[u8], value: &[u8]) -> Header {
    // Inputs are static ASCII; unwrap is safe.
    Header::from_bytes(name, value).expect("valid header")
}

fn cors_headers(origin: Option<&str>, allowed: &[String]) -> Vec<Header> {
    let mut h = Vec::with_capacity(4);
    if let Some(o) = origin {
        if allowed.iter().any(|a| a == o) {
            h.push(header(b"Access-Control-Allow-Origin", o.as_bytes()));
            h.push(header(b"Vary", b"Origin"));
        }
    }
    h.push(header(b"Access-Control-Allow-Methods", b"GET, POST, OPTIONS"));
    h.push(header(b"Access-Control-Allow-Headers", b"Content-Type, Authorization"));
    // Private Network Access preflight (certless fast path). The TLS-on-loopback
    // path is a deployment concern layered on top (see MCP_PARITY_PLAN D.2 §4a).
    h.push(header(b"Access-Control-Allow-Private-Network", b"true"));
    h
}

fn json_response(
    status: u16,
    body: Value,
    origin: Option<&str>,
    allowed: &[String],
) -> Response<Cursor<Vec<u8>>> {
    let bytes = body.to_string().into_bytes();
    let mut resp = Response::from_data(bytes).with_status_code(status);
    resp.add_header(header(b"Content-Type", b"application/json"));
    for hh in cors_headers(origin, allowed) {
        resp.add_header(hh);
    }
    resp
}

fn read_body(req: &mut Request) -> String {
    let mut s = String::new();
    let _ = req.as_reader().take(MAX_BODY_BYTES).read_to_string(&mut s);
    s
}

/// Spawn `workers` threads each pulling requests off the shared server.
pub fn serve(server: Arc<Server>, state: Arc<AppState>, workers: usize) {
    let mut handles = Vec::with_capacity(workers);
    for _ in 0..workers {
        let s = server.clone();
        let st = state.clone();
        handles.push(thread::spawn(move || loop {
            match s.recv() {
                Ok(req) => handle(req, &st),
                Err(_) => break,
            }
        }));
    }
    for h in handles {
        let _ = h.join();
    }
}

fn handle(mut req: Request, state: &AppState) {
    let method = req.method().clone();
    let raw_url = req.url().to_string();
    let path = raw_url.split('?').next().unwrap_or("/").to_string();

    // Extract the headers we care about up front (immutable borrow).
    let (mut origin, mut host, mut auth): (Option<String>, Option<String>, Option<String>) =
        (None, None, None);
    for h in req.headers() {
        let field = h.field.as_str().as_str().to_ascii_lowercase();
        match field.as_str() {
            "origin" => origin = Some(h.value.as_str().to_string()),
            "host" => host = Some(h.value.as_str().to_string()),
            "authorization" => auth = Some(h.value.as_str().to_string()),
            _ => {}
        }
    }
    let allowed = &state.allowed_origins;

    // CORS preflight.
    if method == Method::Options {
        let mut resp = Response::empty(204);
        for hh in cors_headers(origin.as_deref(), allowed) {
            resp.add_header(hh);
        }
        let _ = req.respond(resp);
        return;
    }

    // ── open: health ────────────────────────────────────────────────────
    if method == Method::Get && path == "/health" {
        let body = json!({
            "ok": true,
            "mcpRunning": state.mcp.is_running(),
            "mcpInstalled": official_installed(),
        });
        let _ = req.respond(json_response(200, body, origin.as_deref(), allowed));
        return;
    }

    // ── pair: exchange a pair code for a token ───────────────────────────
    if method == Method::Post && path == "/pair" {
        let body_str = read_body(&mut req);
        let code = serde_json::from_str::<Value>(&body_str)
            .ok()
            .and_then(|v| v.get("code").and_then(|c| c.as_str()).map(str::to_string))
            .unwrap_or_default();

        let mut mgr = state.pairing.lock().unwrap();
        if !mgr.check_origin(origin.as_deref()) || !mgr.check_host(host.as_deref()) {
            drop(mgr);
            let _ = req.respond(json_response(
                403,
                json!({ "error": "Forbidden" }),
                origin.as_deref(),
                allowed,
            ));
            return;
        }
        let result = mgr.pair(&code);
        drop(mgr);
        let resp = if result.ok {
            // Confirm in the Runtime's console window so the user sees the link
            // land (previously the window said nothing after the site connected).
            println!("  \u{2713} Paired with the dashboard \u{2014} running locally. You can minimize this window.");
            json_response(
                200,
                json!({ "token": result.token }),
                origin.as_deref(),
                allowed,
            )
        } else {
            json_response(
                401,
                json!({ "error": "Pairing failed", "reason": result.reason }),
                origin.as_deref(),
                allowed,
            )
        };
        let _ = req.respond(resp);
        return;
    }

    // ── auth gate for everything below ───────────────────────────────────
    let token = extract_bearer(auth.as_deref());
    let auth_ok = {
        let mut mgr = state.pairing.lock().unwrap();
        mgr.authorize(origin.as_deref(), host.as_deref(), token.as_deref())
    };
    if !auth_ok.ok {
        let _ = req.respond(json_response(
            401,
            json!({ "error": "Unauthorized", "reason": auth_ok.reason }),
            origin.as_deref(),
            allowed,
        ));
        return;
    }

    // ── tools/list ───────────────────────────────────────────────────────
    if method == Method::Get && path == "/tools" {
        let resp = match state.mcp.list_tools() {
            Ok(tools) => json_response(200, json!({ "tools": tools }), origin.as_deref(), allowed),
            Err(e) => json_response(500, json!({ "error": e }), origin.as_deref(), allowed),
        };
        let _ = req.respond(resp);
        return;
    }

    // ── tools/call ─────────────────────────────────────────────────────────
    if method == Method::Post && path == "/call" {
        let body_str = read_body(&mut req);
        let parsed: Value = serde_json::from_str(&body_str).unwrap_or(Value::Null);
        let tool = parsed.get("tool").and_then(|t| t.as_str()).unwrap_or("");
        let args = parsed.get("args").cloned().unwrap_or_else(|| json!({}));
        if tool.is_empty() {
            let _ = req.respond(json_response(
                400,
                json!({ "error": "Missing tool" }),
                origin.as_deref(),
                allowed,
            ));
            return;
        }
        let resp = match state.mcp.call_tool(tool, args) {
            Ok(result) => json_response(200, json!({ "result": result }), origin.as_deref(), allowed),
            Err(e) => json_response(500, json!({ "error": e }), origin.as_deref(), allowed),
        };
        let _ = req.respond(resp);
        return;
    }

    let _ = req.respond(json_response(
        404,
        json!({ "error": "Not found" }),
        origin.as_deref(),
        allowed,
    ));
}
