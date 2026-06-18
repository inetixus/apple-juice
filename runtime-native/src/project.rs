//! Apple Juice Runtime — durable project layer (the "personal space").
//!
//! This is the Rojo half of the combo: a real on-disk project the AI edits as
//! FILES (scripts / modules), tracked in git. The Runtime owns the folder and
//! git; `rojo serve` (managed separately) syncs the files into Studio. The MCP
//! handles the live half (playtests, building, inspect) — never script edits.
//!
//! Source-of-truth rule: only the subtrees declared in the Rojo `project.json`
//! `tree` are file-owned. Everything else stays Studio-owned via the MCP.
//!
//! Everything here is local + filesystem + git, so it is fully testable without
//! Studio. The file<->Studio sync (rojo) is a separate concern layered on top.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

/// Default Rojo project file name (Rojo's own convention).
const PROJECT_FILE: &str = "default.project.json";
/// Inline git identity used ONLY for Runtime-made commits. Passed via `-c` so it
/// never mutates the user's global or repo git config.
const GIT_NAME: &str = "Apple Juice";
const GIT_EMAIL: &str = "runtime@apple-juice.local";

pub struct ProjectManager {
    root: PathBuf,
}

/// A file entry in the project's source tree.
pub struct FileEntry {
    pub path: String, // forward-slash relative path under the project root
    pub bytes: u64,
}

impl ProjectManager {
    pub fn new(root: PathBuf) -> Self {
        ProjectManager { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Default per-user project location: <home>/AppleJuice/project.
    pub fn default_root() -> PathBuf {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join("AppleJuice").join("project")
    }

    /// Create the project on disk if missing: folders, a default Rojo
    /// `project.json`, and a git repo. Idempotent.
    pub fn open_or_create(&self) -> Result<(), String> {
        // Source folders that map into Studio (kept in sync with the tree below).
        for sub in ["src/server", "src/client", "src/shared"] {
            fs::create_dir_all(self.root.join(sub))
                .map_err(|e| format!("mkdir {sub}: {e}"))?;
        }

        let proj = self.root.join(PROJECT_FILE);
        if !proj.exists() {
            fs::write(&proj, default_project_json())
                .map_err(|e| format!("write {PROJECT_FILE}: {e}"))?;
        }

        let gitignore = self.root.join(".gitignore");
        if !gitignore.exists() {
            let _ = fs::write(&gitignore, "# Apple Juice project\n*.rbxl\n*.rbxlx\n");
        }

        if !self.root.join(".git").exists() {
            self.git(&["init", "-q"])?;
        }
        Ok(())
    }

    /// Resolve a caller-supplied relative path safely under the project root.
    /// Rejects absolute paths and any `..` traversal.
    fn resolve(&self, rel: &str) -> Result<PathBuf, String> {
        let rel = rel.replace('\\', "/");
        let p = Path::new(&rel);
        if p.is_absolute() {
            return Err("absolute paths are not allowed".to_string());
        }
        for comp in p.components() {
            match comp {
                Component::Normal(_) => {}
                Component::CurDir => {}
                _ => return Err("path traversal is not allowed".to_string()),
            }
        }
        Ok(self.root.join(p))
    }

    /// List source files (recursively) under the project's `src` tree.
    pub fn list_files(&self) -> Result<Vec<FileEntry>, String> {
        let mut out = Vec::new();
        let base = self.root.join("src");
        if base.exists() {
            walk(&base, &self.root, &mut out)?;
        }
        out.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(out)
    }

    pub fn read_file(&self, rel: &str) -> Result<String, String> {
        let path = self.resolve(rel)?;
        fs::read_to_string(&path).map_err(|e| format!("read {rel}: {e}"))
    }

    pub fn write_file(&self, rel: &str, content: &str) -> Result<(), String> {
        let path = self.resolve(rel)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("mkdir: {e}"))?;
        }
        fs::write(&path, content).map_err(|e| format!("write {rel}: {e}"))
    }

    pub fn delete_file(&self, rel: &str) -> Result<(), String> {
        let path = self.resolve(rel)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("delete {rel}: {e}"))?;
        }
        Ok(())
    }

    /// Porcelain git status (empty string = clean tree).
    pub fn status(&self) -> Result<String, String> {
        self.git(&["status", "--porcelain"])
    }

    /// Stage everything and commit. Uses inline `-c` identity so no git config
    /// (global or repo) is ever modified. Returns the short commit summary.
    pub fn commit(&self, message: &str) -> Result<String, String> {
        self.git(&["add", "-A"])?;
        // If nothing is staged, `commit` exits non-zero; treat that as a no-op.
        let staged = self.git(&["diff", "--cached", "--name-only"])?;
        if staged.trim().is_empty() {
            return Ok("nothing to commit".to_string());
        }
        self.git(&[
            "-c",
            &format!("user.name={GIT_NAME}"),
            "-c",
            &format!("user.email={GIT_EMAIL}"),
            "commit",
            "-q",
            "-m",
            message,
        ])?;
        self.git(&["rev-parse", "--short", "HEAD"])
    }

    fn git(&self, args: &[&str]) -> Result<String, String> {
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .output()
            .map_err(|e| format!("git not available: {e}"))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }
}

fn walk(dir: &Path, root: &Path, out: &mut Vec<FileEntry>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("readdir: {e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk(&path, root, out)?;
        } else if path.is_file() {
            let rel = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(FileEntry { path: rel, bytes });
        }
    }
    Ok(())
}

/// The default Rojo project. The `tree` here is the single source of truth for
/// which Studio subtrees are file-owned (Rojo) vs Studio-owned (MCP).
///
/// NOTE: each service entry carries an explicit `$className`. Without it, older
/// Rojo (6.x) creates NEW Folder instances named after the services instead of
/// binding to the real ones. The className makes Rojo reconcile against the
/// existing services so scripts land in the actual ServerScriptService etc.
/// Verified on Rojo 6.2.
fn default_project_json() -> String {
    r#"{
  "name": "apple-juice-project",
  "tree": {
    "$className": "DataModel",
    "ServerScriptService": {
      "$className": "ServerScriptService",
      "$path": "src/server"
    },
    "ReplicatedStorage": {
      "$className": "ReplicatedStorage",
      "$path": "src/shared"
    },
    "StarterPlayer": {
      "$className": "StarterPlayer",
      "StarterPlayerScripts": {
        "$className": "StarterPlayerScripts",
        "$path": "src/client"
      }
    }
  }
}
"#
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn temp_root() -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let p = std::env::temp_dir().join(format!("aj-proj-test-{}-{}", std::process::id(), n));
        let _ = fs::remove_dir_all(&p);
        p
    }

    #[test]
    fn scaffolds_project_and_is_idempotent() {
        let root = temp_root();
        let pm = ProjectManager::new(root.clone());
        pm.open_or_create().unwrap();
        assert!(root.join("default.project.json").exists());
        assert!(root.join("src/server").exists());
        assert!(root.join(".git").exists());
        // Second call must not error.
        pm.open_or_create().unwrap();
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writes_lists_and_reads_files() {
        let root = temp_root();
        let pm = ProjectManager::new(root.clone());
        pm.open_or_create().unwrap();
        pm.write_file("src/server/Main.server.luau", "print('hi')").unwrap();
        let files = pm.list_files().unwrap();
        assert!(files.iter().any(|f| f.path == "src/server/Main.server.luau"));
        assert_eq!(pm.read_file("src/server/Main.server.luau").unwrap(), "print('hi')");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_path_traversal() {
        let root = temp_root();
        let pm = ProjectManager::new(root.clone());
        pm.open_or_create().unwrap();
        assert!(pm.write_file("../escape.luau", "x").is_err());
        assert!(pm.read_file("../../etc/passwd").is_err());
        assert!(pm.write_file("/abs.luau", "x").is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn commits_changes_without_touching_global_config() {
        let root = temp_root();
        let pm = ProjectManager::new(root.clone());
        pm.open_or_create().unwrap();
        pm.write_file("src/shared/Mod.luau", "return {}").unwrap();
        assert!(!pm.status().unwrap().is_empty()); // dirty
        let head = pm.commit("initial").unwrap();
        assert!(!head.is_empty() && head != "nothing to commit");
        assert!(pm.status().unwrap().is_empty()); // clean after commit
        // Second commit with no changes is a no-op, not an error.
        assert_eq!(pm.commit("noop").unwrap(), "nothing to commit");
        let _ = fs::remove_dir_all(&root);
    }
}
