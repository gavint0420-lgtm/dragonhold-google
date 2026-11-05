# Starts the Dragonhold co-op server and a Cloudflare tunnel, then prints the link to send to friends.
# Close this window (or press Enter) to stop both. Starting it again replaces an old server.
$ErrorActionPreference = 'Stop'
$game = Split-Path $PSScriptRoot -Parent
Set-Location $game
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$port = 8080
$env:PORT = "$port"
$logDir = Join-Path $env:TEMP 'dragonhold-coop'
New-Item -ItemType Directory -Force $logDir | Out-Null
$tunnelLog = Join-Path $logDir 'tunnel.log'
$serverLog = Join-Path $logDir 'server.log'
Remove-Item $tunnelLog, $serverLog -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '  DRAGONHOLD CO-OP' -ForegroundColor Yellow
Write-Host ''

# A Windows "job" ties the server and tunnel to this window: when the window closes for any reason
# (Enter, the X button, shutting down), Windows stops them too, so nothing is left running in the background.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DhJob {
  [StructLayout(LayoutKind.Sequential)] struct BASIC { public long a; public long b; public uint LimitFlags; public UIntPtr c; public UIntPtr d; public uint e; public UIntPtr f; public uint g; public uint h; }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong a, b, c, d, e, f; }
  [StructLayout(LayoutKind.Sequential)] struct EXT { public BASIC Basic; public IO Io; public UIntPtr p1, p2, p3, p4; }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr a, string name);
  [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int cls, ref EXT info, uint len);
  [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr proc);
  static IntPtr job = IntPtr.Zero;
  public static void Add(IntPtr proc) {
    if (job == IntPtr.Zero) {
      job = CreateJobObject(IntPtr.Zero, null);
      EXT info = new EXT(); info.Basic.LimitFlags = 0x2000; // kill everything in the job when it closes
      SetInformationJobObject(job, 9, ref info, (uint)Marshal.SizeOf(typeof(EXT)));
    }
    AssignProcessToJobObject(job, proc);
  }
}
'@ -ErrorAction SilentlyContinue

# If an earlier Dragonhold server or tunnel is still running (for example the window was closed
# before this fix), stop it so we can start fresh. Anything else using the port is left alone.
function Stop-OldDragonhold {
  $stopped = $false
  foreach ($c in @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" -ErrorAction SilentlyContinue
    if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'server[\\/]+server\.js') { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; $stopped = $true }
  }
  foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue)) {
    if ($p.CommandLine -match "localhost:$port") { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; $stopped = $true }
  }
  if ($stopped) { Write-Host '  Closed an older Dragonhold server that was still running.' -ForegroundColor DarkYellow; Start-Sleep -Milliseconds 800 }
}
Stop-OldDragonhold

if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "  Another program (not Dragonhold) is using port $port, so the game server can't start." -ForegroundColor Red
  Write-Host '  Close that program, or restart your computer, then try again.'
  Read-Host '  Press Enter to close'
  exit 1
}

# Fresh download of the game for friends: download\Dragonhold.zip (rebuilt each start so it has the latest version)
function Update-DownloadZip {
  try {
    $dl = Join-Path $game 'download'
    New-Item -ItemType Directory -Force $dl | Out-Null
    $zipPath = Join-Path $dl 'Dragonhold.zip'
    $tmp = "$zipPath.tmp"
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $fs = [IO.File]::Open($tmp, 'Create')
    $za = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
    try {
      $root = (Resolve-Path $game).Path.TrimEnd('\')
      foreach ($f in Get-ChildItem $root -Recurse -File -Force) {
        $rel = $f.FullName.Substring($root.Length + 1)
        if ($rel -like 'download\*' -or $rel -eq 'server\dev.key') { continue } # never share the developer key
        if ($rel -like '.git\*' -or $rel -like '.claude\*') { continue } # git history and tool settings aren't part of the game
        # forward slashes so the folders unzip correctly on every computer
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($za, $f.FullName, 'Dragonhold/' + $rel.Replace('\', '/'), [IO.Compression.CompressionLevel]::Optimal)
      }
    } finally { $za.Dispose(); $fs.Dispose() }
    Move-Item $tmp $zipPath -Force
    return $true
  } catch { Write-Host "  (Could not build the download zip: $($_.Exception.Message))" -ForegroundColor DarkYellow; return $false }
}
$zipOk = Update-DownloadZip

$server = $null; $tunnel = $null
try {
  $server = Start-Process node -ArgumentList 'server\server.js' -WorkingDirectory $game -WindowStyle Hidden -PassThru -RedirectStandardOutput $serverLog -RedirectStandardError "$serverLog.err"
  try { [DhJob]::Add($server.Handle) } catch {}
  Start-Sleep -Milliseconds 800
  if ($server.HasExited) { throw "The game server stopped right away. Details: $serverLog.err" }
  Write-Host "  Game server is running on this computer." -ForegroundColor Green

  Write-Host '  Opening the internet tunnel (this takes a few seconds)...'
  $tunnel = Start-Process cloudflared -ArgumentList "tunnel --no-autoupdate --url http://localhost:$port" -WindowStyle Hidden -PassThru -RedirectStandardError $tunnelLog -RedirectStandardOutput "$tunnelLog.out"
  try { [DhJob]::Add($tunnel.Handle) } catch {}
  $url = $null
  for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $tunnelLog) {
      $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value }
    }
    if ($tunnel.HasExited) { break }
  }

  Write-Host ''
  Write-Host "  You play at:           http://localhost:$port" -ForegroundColor Cyan
  if ($url) {
    Write-Host "  Send friends this link: $url" -ForegroundColor Yellow
    try { Set-Clipboard -Value $url; Write-Host '  (The friend link is copied to your clipboard.)' } catch {}
    if ($zipOk) { Write-Host "  Download the game:      $url/download/Dragonhold.zip" -ForegroundColor Yellow }
  } else {
    Write-Host '  The internet tunnel did not start, so only people on your Wi-Fi can join.' -ForegroundColor Red
    Write-Host "  Details: $tunnelLog"
  }
  Write-Host ''
  Write-Host '  In the game: Play together > Host game, then tell friends the room code.'
  Write-Host '  The friend link changes every time you start this, so send the new one each time.'
  Write-Host ''
  Start-Process "http://localhost:$port"
  Read-Host '  Press Enter here to stop the server'
}
finally {
  foreach ($p in @($tunnel, $server)) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } }
}
