param(
  [switch]$SkipTests,
  [switch]$SkipTypecheck
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$desktop = Join-Path $repoRoot 'apps\desktop'
$manifest = Join-Path $desktop 'src-tauri\Cargo.toml'
$installerDirectory = Join-Path $desktop 'src-tauri\target\release\bundle\nsis'
$portable = Join-Path $desktop 'src-tauri\target\release\gitmd.exe'
$configPath = Join-Path ([System.IO.Path]::GetTempPath()) "gitmd-tauri-test-$PID.json"

Push-Location $repoRoot
try {
  if (-not $SkipTypecheck) {
    & pnpm --filter @gitmd/desktop typecheck
    if ($LASTEXITCODE -ne 0) { throw "Desktop typecheck failed with exit code $LASTEXITCODE" }
  }

  if (-not $SkipTests) {
    & pnpm test -- --run
    if ($LASTEXITCODE -ne 0) { throw "Unit tests failed with exit code $LASTEXITCODE" }
  }

  & cargo check --manifest-path $manifest
  if ($LASTEXITCODE -ne 0) { throw "Rust check failed with exit code $LASTEXITCODE" }

  Set-Content -LiteralPath $configPath -Value '{"bundle":{"createUpdaterArtifacts":false}}' -Encoding utf8
  & pnpm --filter @gitmd/desktop tauri build -- --bundles nsis --no-sign --config $configPath
  if ($LASTEXITCODE -ne 0) { throw "Tauri Windows build failed with exit code $LASTEXITCODE" }

  $installer = Get-ChildItem -LiteralPath $installerDirectory -Filter 'GitMD_*_x64-setup.exe' -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $installer) {
    throw "Expected NSIS installer was not found in $installerDirectory"
  }

  foreach ($artifact in @($installer, $portable)) {
    if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) {
      throw "Expected build artifact was not found: $artifact"
    }
    $file = Get-Item -LiteralPath $artifact
    $hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash
    Write-Output "ARTIFACT=$($file.FullName)"
    Write-Output "SIZE_BYTES=$($file.Length)"
    Write-Output "SHA256=$hash"
  }
}
finally {
  if (Test-Path -LiteralPath $configPath) {
    Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
