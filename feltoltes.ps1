# Feltölti (commit + push) a változásokat a GitHubra; a GitHub Pages 1-2 percen belül kiteszi az új verziót.
# Használat:  .\feltoltes.ps1 "Mit változtattunk"
# Üzenet nélkül indítva rákérdez.
# Feltöltés előtt lefuttatja a regressziós teszteket (teszt.ps1); ha valamelyik hibás, nem tölt fel.
# Ha a teljes teszt pontosan erre az állapotra 24 órán belül már sikeresen lefutott, nem futtatja újra.
# Feltöltés előtt a gépi előellenőrzés (ellenorzes.ps1) is lefut; ha HIBA-t talál, nem tölt fel.
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
  # ha pontosan erre az állapotra már van friss (24 órán belüli), teljes, hibátlan tesztfutás, nem futtatjuk újra (tests\ujjlenyomat.ps1)
  . (Join-Path $PSScriptRoot 'tests\ujjlenyomat.ps1')
  $friss = $false
  try { $friss = Test-DmFrissSiker $PSScriptRoot } catch { }
  if ($friss) { Write-Host 'A tesztek erre az állapotra már sikeresen lefutottak – nem futtatom újra.' -ForegroundColor Green }
  else {
    & (Join-Path $PSScriptRoot 'teszt.ps1')
    if ($LASTEXITCODE -ne 0) { Write-Host 'A tesztek nem mentek át, ezért NEM töltöttem fel. Javítsd a hibát, és próbáld újra.' -ForegroundColor Red; exit 1 }
  }
  Write-Host ''
}

# gépi előellenőrzés az élő változathoz képest (ellenorzes.ps1; benne a verzio.ps1 -Ellenoriz is): a FIGYELEM csak szól,
# a HIBA (privát szó a nyilvános fájlban, BOM nélküli ékezetes .ps1, be nem töltött tesztfájl) megállítja a feltöltést
# ha az előellenőrzés nem tudott lefutni (kivétel vagy 2-es kód), az is megállít: különben a privát szavak ellenőrzése csendben kimaradna
$elo = -1
try { & (Join-Path $PSScriptRoot 'ellenorzes.ps1') -Alap origin/main; $elo = $LASTEXITCODE } catch { Write-Host "Az előellenőrzés megszakadt: $_" -ForegroundColor Red }
if ($elo -eq 1) { Write-Host 'Az előellenőrzés hibát talált (a HIBA sorok fent), ezért NEM töltöttem fel. (Téves privátszó-találatnál a CLAUDE.local.md „Tiltott szavak” sorát kell javítani.)' -ForegroundColor Red; exit 1 }
if ($elo -ne 0) { Write-Host 'Az előellenőrzés nem futott le rendben, ezért NEM töltöttem fel. Próbáld újra, vagy futtasd külön: .\ellenorzes.ps1' -ForegroundColor Red; exit 1 }
Write-Host ''

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
