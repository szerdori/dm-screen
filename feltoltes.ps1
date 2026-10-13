# Feltölti (commit + push) a változásokat a GitHubra; a GitHub Pages 1-2 percen belül kiteszi az új verziót.
# Használat:  .\feltoltes.ps1 "Mit változtattunk"
# Üzenet nélkül indítva rákérdez.
# Feltöltés előtt lefuttatja a regressziós teszteket (teszt.ps1); ha valamelyik hibás, nem tölt fel.
# Végszükség esetén:  .\feltoltes.ps1 "Üzenet" -TesztNelkul
param([string]$Uzenet, [switch]$TesztNelkul)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$git = 'C:\Program Files\Git\cmd\git.exe'
if (-not (Test-Path $git)) { $git = 'git' }

$valtozasok = & $git status --porcelain
if (-not $valtozasok) {
  Write-Host 'Nincs feltöltendő változás.' -ForegroundColor Yellow
  exit 0
}

if (-not $TesztNelkul) {
  & (Join-Path $PSScriptRoot 'teszt.ps1')
  if ($LASTEXITCODE -ne 0) { Write-Host 'A tesztek nem mentek át, ezért NEM töltöttem fel. Javítsd a hibát, és próbáld újra.' -ForegroundColor Red; exit 1 }
  Write-Host ''
}

Write-Host 'Ezek a fájlok változtak:' -ForegroundColor Cyan
& $git status --short

if (-not $Uzenet) { $Uzenet = Read-Host 'Röviden: mit változtattunk? (Enter = "Frissítés")' }
if (-not $Uzenet) { $Uzenet = 'Frissítés' }

& $git add -A
& $git commit -q -m $Uzenet
if ($LASTEXITCODE -ne 0) { Write-Host 'A commit nem sikerült.' -ForegroundColor Red; exit 1 }
& $git push
if ($LASTEXITCODE -ne 0) { Write-Host 'A feltöltés nem sikerült. A változás helyben el van mentve, később újrapróbálható.' -ForegroundColor Red; exit 1 }

Write-Host 'Kész. 1-2 perc múlva él: https://szerdori.github.io/dm-screen/' -ForegroundColor Green
