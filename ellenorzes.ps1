# DM Screen – gépi előellenőrzés commit előtt (TERV-teszt-gyorsitas.md 6. lépés). Csak olvas, pár másodperc.
# Azt nézi meg, ami gépiesen eldönthető; a többi (XSS, szerződés, a teszt tényleg azt nézi-e…) az ellenorzo ügynöké.
# Használat:  .\ellenorzes.ps1                    a nem commitolt változásra (a legutóbbi commithoz, HEAD-hez képest)
#             .\ellenorzes.ps1 -Alap origin/main  az élő változathoz képest (több commitból álló lépésnél)
# Kilépési kód: 1, ha HIBA van (javítani kell); 2, ha a git nem futott le (nincs eredmény); különben 0 (a FIGYELEM-sorokat nézd át: nem mind hiba).
# Ha a megadott alap nem létezik (pl. nincs origin/main), a HEAD-hez képest néz, és ezt kiírja.
# A privát szavak listája nem itt van, hanem a git-ignorált CLAUDE.local.md „Tiltott szavak a nyilvános fájlokban:” sorában.
param([string]$Alap = 'HEAD')

$ErrorActionPreference = 'Continue'   # a git figyelmeztetései a stderr-re mennek: 'Stop' mellett hibának számítanának
$root = $PSScriptRoot
$git = 'C:\Program Files\Git\cmd\git.exe'
if (-not (Test-Path $git)) { $git = 'git' }
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

$script:hiba = 0; $script:figy = 0
function Hiba([string]$s) { Write-Host "HIBA     $s" -ForegroundColor Red; $script:hiba++ }
function Figy([string]$s) { Write-Host "FIGYELEM $s" -ForegroundColor Yellow; $script:figy++ }
function Szoveges([string]$f) { $f -match '\.(js|html|md|ps1|cmd|bat|rules|json|css|txt|cs|yml|yaml|xml|svg|csv|webmanifest|gitignore|gitattributes)$' }
function Sorok([string]$f) { $p = Join-Path $root $f; if ([IO.File]::Exists($p)) { [IO.File]::ReadAllLines($p, [Text.Encoding]::UTF8) } else { @() } }

& $git -C $root rev-parse --verify --quiet $Alap *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Nincs ilyen alap: $Alap – a legutóbbi commithoz (HEAD) képest nézem." -ForegroundColor Yellow; $Alap = 'HEAD' }

$g = @('-C', $root, '-c', 'core.quotepath=false', '-c', 'core.safecrlf=false')
$kovetett = @(& $git @g diff --name-only $Alap 2>$null | Where-Object { $_ })
if ($LASTEXITCODE -ne 0) { Write-Host 'Nem sikerült a változáslista (git diff).' -ForegroundColor Red; exit 2 }
$uj = @(& $git @g ls-files -o --exclude-standard 2>$null | Where-Object { $_ })
$valt = @($kovetett + $uj | Sort-Object -Unique)
$mind = @(& $git @g ls-files -co --exclude-standard 2>$null | Where-Object { $_ } | Sort-Object -Unique)
if ($mind.Count -lt 10) { Write-Host 'Nem sikerült a fájllista (git ls-files).' -ForegroundColor Red; exit 2 }

Write-Host "Előellenőrzés ($Alap óta): $($valt.Count) változott fájl." -ForegroundColor Cyan
if (-not $valt.Count) { Write-Host 'Nincs változás.' -ForegroundColor DarkGreen; exit 0 }

# a hozzáadott sorok (a követett fájlok diffjéből és az új fájlok teljes szövegéből): @{ Fajl; Szoveg }
$plusz = New-Object Collections.ArrayList
$akt = ''; $fejlec = $false
$diff = @(& $git @g diff $Alap -U0 --no-color 2>$null)
if ($LASTEXITCODE -ne 0) { Write-Host 'Nem sikerült a változás beolvasása (git diff).' -ForegroundColor Red; exit 2 }
foreach ($s in $diff) {
  # a „+++ b/fájl” csak a fájl fejlécében (a „diff --git” és az első „@@” között) fájlnév; lejjebb hozzáadott sor is kezdődhet így
  if ($s.StartsWith('diff --git ')) { $fejlec = $true; $akt = ''; continue }
  if ($s.StartsWith('@@')) { $fejlec = $false; continue }
  if ($fejlec) { if ($s.StartsWith('+++ ')) { $akt = $s.Substring(4) -replace '^b/', '' }; continue }
  if ($s.StartsWith('+') -and $akt) { [void]$plusz.Add(@{ Fajl = $akt; Szoveg = $s.Substring(1) }) }
}
foreach ($f in $uj) { if (Szoveges $f) { foreach ($s in (Sorok $f)) { [void]$plusz.Add(@{ Fajl = $f; Szoveg = $s }) } } }

# (a) változott közös fájl, de a száma nem (verzio.ps1 -Ellenoriz; a ⚠ sorai itt FIGYELEM-ként számítanak)
if ($valt | Where-Object { $_ -like '*.js' }) {
  try {
    foreach ($s in @(& (Join-Path $root 'verzio.ps1') -Ellenoriz -Alap $Alap 6>&1)) {
      $t = "$s"
      if ($t.StartsWith('⚠')) { Figy $t.Substring(1).Trim() } elseif ($t) { Write-Host $t }
    }
  } catch { Figy "A verzio.ps1 nem futott le: $_" }
}

# (b) ékezetes .ps1 BOM nélkül (PowerShell 5.1 elrontja az ékezeteket)
foreach ($f in ($mind | Where-Object { $_ -like '*.ps1' })) {
  if (-not [IO.File]::Exists((Join-Path $root $f))) { continue }   # törölt, de még követett fájl
  $b = [IO.File]::ReadAllBytes((Join-Path $root $f))
  $bom = $b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF
  if (-not $bom -and ($b | Where-Object { $_ -gt 127 } | Select-Object -First 1)) { Hiba "$f`: ékezetes szöveg van benne, de nincs UTF-8 BOM." }
}

# (c) e-mail-cím a változásban (a tesztek kitalált címei – x.hu, b.hu, example.com – rendben vannak)
$latott = @{}
foreach ($p in $plusz) {
  foreach ($m in [regex]::Matches($p.Szoveg, '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}')) {
    if ($m.Value -match '@(x\.hu|b\.hu|example\.com|anthropic\.com)$') { continue }
    $k = "$($p.Fajl)|$($m.Value)"; if ($latott[$k]) { continue }; $latott[$k] = 1
    Figy "$($p.Fajl): e-mail-cím a változásban: $($m.Value) – valódi cím nem kerülhet a nyilvános tárolóba."
  }
}

# (d) a CLAUDE.local.md tiltott szavai a nyilvános fájlokban (minden követett és új fájlban, nem csak a változásban)
$helyi = Join-Path $root 'CLAUDE.local.md'
$szavak = @()
if ([IO.File]::Exists($helyi)) {
  foreach ($s in [IO.File]::ReadAllLines($helyi, [Text.Encoding]::UTF8)) {
    $m = [regex]::Match($s, 'Tiltott szavak a nyilvános fájlokban:\**\s*(.+)$')
    if ($m.Success) { $szavak = @($m.Groups[1].Value.Split(',') | ForEach-Object { $_.Trim().Trim('`').Trim() } | Where-Object { $_.Length -ge 3 }) }
  }
}
if (-not $szavak.Count) { Write-Host 'ℹ Nincs tiltottszó-lista (CLAUDE.local.md „Tiltott szavak a nyilvános fájlokban:” sor) – ez a pont kimaradt.' -ForegroundColor Cyan }
else {
  foreach ($f in ($mind | Where-Object { Szoveges $_ })) {
    $i = 0
    foreach ($s in (Sorok $f)) {
      $i++
      foreach ($w in $szavak) { if ($s.IndexOf($w, [StringComparison]::Ordinal) -ge 0) { Hiba "$f`:$i`: privát szó a nyilvános fájlban: $w" } }
    }
  }
}

# (e) kódváltozás van, de teszt nem változott
$kod = @($valt | Where-Object { $_ -match '\.(js|html|rules)$' -and $_ -notlike 'tests/*' })
if ($kod.Count -and -not ($valt | Where-Object { $_ -like 'tests/*' })) { Figy "Kód változott ($($kod -join ', ')), de a tests\ alatt semmi – új funkcióhoz / javításhoz új teszt kell." }

# (f) fix várakozás az új tesztsorokban (helyette mentve() / until())
foreach ($p in $plusz) { if ($p.Fajl -like 'tests/*' -and $p.Szoveg -match '\bwait\(\d+\)') { Figy "$($p.Fajl): fix várakozás az új sorban: $($p.Szoveg.Trim())" } }

# (g) minden tesztcsoportfájl szerepel a tesztoldalon
$tesztOldal = (Sorok 'tests/index.html') -join "`n"
foreach ($f in ($mind | Where-Object { $_ -like 'tests/csoportok/*.js' })) { if ($tesztOldal.IndexOf([IO.Path]::GetFileName($f)) -lt 0) { Hiba "$f nincs betöltve a tests\index.html-ben (a tesztjei nem futnak)." } }

Write-Host ''
if ($script:hiba) { Write-Host "ELŐELLENŐRZÉS: $($script:hiba) hiba, $($script:figy) figyelmeztetés." -ForegroundColor Red }
elseif ($script:figy) { Write-Host "ELŐELLENŐRZÉS: $($script:figy) figyelmeztetés (nézd át), hiba nincs." -ForegroundColor Yellow }
else { Write-Host 'ELŐELLENŐRZÉS: rendben.' -ForegroundColor Green }
# arányosság (8. lépés): csak dokumentációnál elég ez; kódnál az ügynök is kell, a fenti kimenettel együtt
if ($valt | Where-Object { $_ -notlike '*.md' }) { Write-Host 'Ügynök: KELL (kód is változott) – az ellenorzo ügynöknek add át ezt a kimenetet.' -ForegroundColor Cyan }
else { Write-Host 'Ügynök: NEM KELL (csak dokumentáció változott).' -ForegroundColor Cyan }
if ($script:hiba) { exit 1 }
exit 0
