import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

function install() {
  const home = os.homedir();
  const installDir = path.join(home, '.apple-juice', 'bin');
  const destExe = path.join(installDir, 'aj.exe');
  const destBgExe = path.join(installDir, 'aj-bg.exe');

  console.log('\n\x1b[96m┌────────────────────────────────────────────────────────┐\x1b[0m');
  console.log('\x1b[96m│      🥤 APPLE JUICE CLI WINDOWS GLOBAL INSTALLER       │\x1b[0m');
  console.log('\x1b[96m│                                                        │\x1b[0m');
  console.log('\x1b[96m│  This standalone installer will configure the global   │\x1b[0m');
  console.log('\x1b[96m│  "aj" command and setup your Windows environment.       │\x1b[0m');
  console.log('\x1b[96m└────────────────────────────────────────────────────────┘\x1b[0m\n');

  console.log('\x1b[36mCreating installation directory...\x1b[0m');
  if (!fs.existsSync(installDir)) {
    fs.mkdirSync(installDir, { recursive: true });
    console.log(`  Created: ${installDir}`);
  }

  console.log('\x1b[36mExtracting and copying binaries...\x1b[0m');
  // Ultra-robust virtual-asset-finder to locate the bundled binary under any pkg layout
  let assetPath = '';
  const possiblePaths = [
    path.join(__dirname, '../dist/aj.bin'),
    path.join(__dirname, 'aj.bin'),
    path.join(__dirname, '../aj.bin'),
    path.join('/snapshot', 'apple-juice-source-files', 'dist', 'aj.bin'),
    path.join('/snapshot', 'dist', 'aj.bin'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      assetPath = p;
      break;
    }
  }

  if (!assetPath) {
    // Try searching up the directory tree from __dirname
    let currentDir = __dirname;
    for (let depth = 0; depth < 5; depth++) {
      const checkPath = path.join(currentDir, 'aj.bin');
      if (fs.existsSync(checkPath)) {
        assetPath = checkPath;
        break;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }
  }

  if (!assetPath) {
    // If still not found, search virtual snapshot drives recursively
    const snapshotRoots = ['C:\\snapshot', 'c:\\snapshot', '/snapshot'];
    for (const root of snapshotRoots) {
      if (fs.existsSync(root)) {
        const findInDir = (dir: string): string | null => {
          try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const fullPath = path.join(dir, file);
              if (file === 'aj.bin') return fullPath;
              try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                  const found = findInDir(fullPath);
                  if (found) return found;
                }
              } catch (_) {}
            }
          } catch (_) {}
          return null;
        };
        const foundPath = findInDir(root);
        if (foundPath) {
          assetPath = foundPath;
          break;
        }
      }
    }
  }

  if (!assetPath) {
    // Fallback to symmetrical default path
    assetPath = path.join(__dirname, '../dist/aj.bin');
  }

  try {
    const binaryBuffer = fs.readFileSync(assetPath);
    fs.writeFileSync(destExe, binaryBuffer);
    fs.writeFileSync(destBgExe, binaryBuffer);
    console.log(`  Binary copied successfully.`);
  } catch (err: any) {
    console.error(`\x1b[31mError writing binary files: ${err.message}\x1b[0m`);
    console.log(`  Tried virtual path: ${assetPath}`);
    console.log('\nPress any key to close the installer...');
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => process.exit(1));
    } else {
      setTimeout(() => process.exit(1), 5000);
    }
    return;
  }

  console.log('\x1b[36mRegistering global environment PATH...\x1b[0m');
  
  // Update Windows User PATH using PowerShell command (which is extremely safe and robust)
  try {
    const psCommand = `
      $InstallDir = "${installDir}"
      $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
      if ($null -eq $UserPath) { $UserPath = "" }
      $PathList = $UserPath -split ";" | Where-Object { $_ -ne "" }
      if ($PathList -notcontains $InstallDir) {
          $NewPath = ($PathList + $InstallDir) -join ";"
          [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
          write-output "PATH_UPDATED"
      } else {
          write-output "PATH_ALREADY_SET"
      }
    `;
    const result = execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, { encoding: 'utf8' }).trim();
    if (result.includes("PATH_UPDATED")) {
      console.log('  \x1b[32mSuccess! Added directory to user PATH environment variable.\x1b[0m');
    } else {
      console.log('  PATH is already configured correctly.');
    }
  } catch (err: any) {
    console.warn('\x1b[33mWarning: Failed to auto-register PATH via PowerShell. Attempting fallback...\x1b[0m');
    try {
      execSync(`setx PATH "%PATH%;${installDir}"`);
      console.log('  \x1b[32mPATH registered via setx fallback.\x1b[0m');
    } catch (_) {
      console.log(`\n\x1b[33mPlease manually add this directory to your PATH:\x1b[0m\n  \x1b[1m${installDir}\x1b[0m\n`);
    }
  }

  console.log('\n\x1b[92m┌────────────────────────────────────────────────────────┐\x1b[0m');
  console.log('\x1b[92m│ 🎉 APPLE JUICE CLI INSTALLED SUCCESSFULLY!             │\x1b[0m');
  console.log('\x1b[92m└────────────────────────────────────────────────────────┘\x1b[0m\n');
  console.log('  \x1b[1mType "aj" from ANY folder or command prompt!\x1b[0m');
  console.log('  \x1b[36m(Please open a NEW terminal window/prompt to refresh PATH).\x1b[0m\n');
  
  console.log('Press any key to close the installer...');
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => process.exit(0));
  } else {
    setTimeout(() => process.exit(0), 4000);
  }
}

install();
