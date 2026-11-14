# DM Screen – a közös fájlok változatának emelése és ellenőrzése (verzióőr, docs/dontesek/0005).
# Használat:  .\verzio.ps1 harc                 a harc.js változatát emeli: modul('harc', N) a fájlban, harc.js?v=N és a VART_MODULOK az oldalakon
#             .\verzio.ps1 harc lapszinkron     több modul egyszerre
#             .\verzio.ps1 -Ellenoriz           szól, ha egy modulfájl változott az élő változathoz (origin/main) képest, de a száma nem
#             .\verzio.ps1 -Ellenoriz -Alap HEAD  ugyanez a legutóbbi commithoz képest
# Mikor kell emelni: ha a fájl olyan nevet kap vagy úgy változik, amire más fájl támaszkodik (CLAUDE.md, „Közös fájlok változata”).
# Az -Ellenoriz csak figyelmeztet (nem minden változás kíván emelést), a kilépési kódja 0.
param([Parameter(Position = 0, ValueFromRemainingArguments = $true)][string[]]$Modulok, [switch]$Ellenoriz, [string]$Alap = 'origin/main')

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$git = 'C:\Program Files\Git\cmd\git.exe'
if (-not (Test-Path $git)) { $git = 'git' }
$OLDALAK = 'index.html', 'karakter.html', 'player.html'

# a modulfájlok: a gyökér .js fájljai (a beállításon kívül) és a js\ alatt minden; a modulnév = a fájlnév .js nélkül
function ModulFajlok {
  $f = @(Get-ChildItem -Path $root -Filter *.js -File | Where-Object { $_.Name -ne 'firebase-config.js' }) + @(Get-ChildItem -Path (Join-Path $root 'js') -Filter *.js -File -Recurse)
  $m = [ordered]@{}
  foreach ($x in $f) {
    $n = [IO.Path]::GetFileNameWithoutExtension($x.Name); $ut = $x.FullName.Substring($root.Length + 1).Replace('\', '/')
    if ($m.Contains($n)) { Write-Host "⚠ Két modulfájl azonos névvel: $($m[$n]) és $ut (a modulnév a fájlnév – nevezd át az egyiket)." -ForegroundColor Yellow }
    $m[$n] = $ut
  }
  $m
}
# a fájlban bejelentett szám: modul('név', N), a sheet.js-ben const VERSION = N
function Bejelentett([string]$szoveg, [string]$nev) {
  if ($null -eq $szoveg) { return $null }
  $m = [regex]::Match($szoveg, "modul\('" + [regex]::Escape($nev) + "',\s*(\d+)\)")
  if ($m.Success) { return [int]$m.Groups[1].Value }
  if ([regex]::IsMatch($szoveg, "modul\('" + [regex]::Escape($nev) + "',\s*VERSION\)")) { $v = [regex]::Match($szoveg, 'const VERSION = (\d+);'); if ($v.Success) { return [int]$v.Groups[1].Value } }
  $null
}
# fájl olvasása / írása a BOM és a sorvégek megtartásával
function Olvas([string]$p) { $b = [IO.File]::ReadAllBytes($p); $bom = $b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF; @{ Bom = $bom; Szoveg = (New-Object Text.UTF8Encoding $false).GetString($b, $(if ($bom) { 3 } else { 0 }), $b.Length - $(if ($bom) { 3 } else { 0 })) } }
function Ir([string]$p, $o, [string]$szoveg) { [IO.File]::WriteAllText($p, $szoveg, (New-Object Text.UTF8Encoding $o.Bom)) }
$vartMinta = { param($nev) "([{,]\s*)(?:'" + [regex]::Escape($nev) + "'|" + [regex]::Escape($nev) + ")(\s*:\s*)(\d+)" }
$srcMinta = { param($nev) '((?:^|["/])' + [regex]::Escape($nev) + '\.js\?v=)(\d+)' }

$fajlok = ModulFajlok

if ($Ellenoriz) {
  & $git -C $root rev-parse --verify --quiet $Alap *> $null
  if ($LASTEXITCODE -ne 0) { Write-Host "Nincs ilyen alap: $Alap (a változatellenőrzés kimaradt)." -ForegroundColor Yellow; exit 0 }
  # a git figyelmeztetései (pl. sorvég) a stderr-re mennek: PowerShell 5.1-ben 'Stop' mellett ez hibának számítana
  $ErrorActionPreference = 'Continue'
  $valtozott = @(& $git -C $root -c core.quotepath=false -c core.safecrlf=false diff --name-only $Alap -- '*.js' 2>$null) + @(& $git -C $root -c core.quotepath=false ls-files -o --exclude-standard -- '*.js' 2>$null)
  $figy = 0
  foreach ($nev in $fajlok.Keys) {
    $ut = $fajlok[$nev]
    if ($valtozott -notcontains $ut) { continue }
    $most = Bejelentett (Olvas (Join-Path $root $ut)).Szoveg $nev
    # az alapban megvan-e a fájl (ls-tree: hiányzó fájlnál üres kimenet, hiba nélkül); új fájlnál nincs régi szám
    $regi = $null
    if (@(& $git -C $root ls-tree --name-only $Alap -- $ut 2>$null).Count) { $regi = Bejelentett ((& $git -C $root show "${Alap}:$ut" 2>$null) -join "`n") $nev }
    if ($null -eq $most) { Write-Host "⚠ $ut`: nincs benne modul('$nev', N) bejelentés." -ForegroundColor Yellow; $figy++ }
    elseif ($null -eq $regi) { Write-Host "ℹ $ut`: új modulfájl ($nev = $most) – szerepel-e a <script src>-ben és a VART_MODULOK-ban?" -ForegroundColor Cyan }
    elseif ($most -eq $regi) { Write-Host "⚠ $ut változott ($Alap óta), de a száma nem ($nev = $most). Ha más fájl támaszkodik a változásra: .\verzio.ps1 $nev" -ForegroundColor Yellow; $figy++ }
  }
  if (-not $figy) { Write-Host "Változatok: rendben ($Alap óta)." -ForegroundColor DarkGreen }
  exit 0
}

if (-not $Modulok) { Write-Host 'Add meg a modul nevét (pl. .\verzio.ps1 harc), vagy: .\verzio.ps1 -Ellenoriz' -ForegroundColor Yellow; exit 2 }
# előbb minden modult ellenőrzünk és a memóriában emelünk (az oldalak szövegén egymás után), és csak ha mind rendben, akkor írunk
$lapok = [ordered]@{}; foreach ($lap in $OLDALAK) { $lapok[$lap] = Olvas (Join-Path $root $lap) }
$modulIras = @(); $jelentes = @()
foreach ($nev in @($Modulok | Select-Object -Unique)) {
  if (-not $fajlok.Contains($nev)) { Write-Host "Nincs ilyen modul: $nev (a modulnév a fájlnév .js nélkül). Semmi nem változott." -ForegroundColor Red; exit 2 }
  $ut = Join-Path $root $fajlok[$nev]
  $o = Olvas $ut
  $n = Bejelentett $o.Szoveg $nev
  if ($null -eq $n) { Write-Host "$($fajlok[$nev]): nincs benne modul('$nev', N). Semmi nem változott." -ForegroundColor Red; exit 2 }
  $iras = @()
  foreach ($lap in $OLDALAK) {
    $lo = $lapok[$lap]; $t = $lo.Szoveg
    $src = [regex]::Matches($t, (& $srcMinta $nev), 'Multiline')
    $vart = [regex]::Match($t, 'const\s+VART_MODULOK\s*=\s*\{[^}]*\}')
    $v = if ($vart.Success) { [regex]::Match($vart.Value, (& $vartMinta $nev)) } else { $null }
    if (-not $src.Count -and -not ($v -and $v.Success)) { continue }
    foreach ($s in $src) { if ([int]$s.Groups[2].Value -ne $n) { Write-Host "$lap`: $nev.js?v=$($s.Groups[2].Value), a fájlban $n – előbb egyeztesd. Semmi nem változott." -ForegroundColor Red; exit 2 } }
    if ($v -and $v.Success -and [int]$v.Groups[3].Value -ne $n) { Write-Host "$lap`: VART_MODULOK.$nev = $($v.Groups[3].Value), a fájlban $n – előbb egyeztesd. Semmi nem változott." -ForegroundColor Red; exit 2 }
    # a player.html-ben szándékosan nincs VART_MODULOK; máshol a betöltött közös fájlnak benne kell lennie
    if ($src.Count -and -not ($v -and $v.Success) -and ($vart.Success -or $lap -ne 'player.html')) { Write-Host "$lap`: a $nev.js betöltődik, de nincs a VART_MODULOK-ban. Semmi nem változott." -ForegroundColor Red; exit 2 }
    $uj = [regex]::Replace($t, (& $srcMinta $nev), { param($m) $m.Groups[1].Value + ($n + 1) }, 'Multiline')
    if ($vart.Success) { $ujVart = [regex]::Replace($vart.Value, (& $vartMinta $nev), { param($m) $m.Groups[0].Value.Substring(0, $m.Groups[0].Length - $m.Groups[3].Length) + ($n + 1) }); $uj = $uj.Replace($vart.Value, $ujVart) }
    $lo.Szoveg = $uj; $iras += $lap
  }
  if (-not $iras.Count) { Write-Host "$nev`: egyik oldal sem tölti be. Semmi nem változott." -ForegroundColor Red; exit 2 }
  $ujFajl = if ([regex]::IsMatch($o.Szoveg, "modul\('" + [regex]::Escape($nev) + "',\s*VERSION\)")) { [regex]::Replace($o.Szoveg, 'const VERSION = \d+;', "const VERSION = $($n + 1);") } else { [regex]::Replace($o.Szoveg, "modul\('" + [regex]::Escape($nev) + "',\s*\d+\)", "modul('$nev', $($n + 1))") }
  $modulIras += ,@($ut, $o, $ujFajl)
  $jelentes += "$nev`: $n → $($n + 1)  ($($fajlok[$nev]), $($iras -join ', '))"
}
foreach ($w in $modulIras) { Ir $w[0] $w[1] $w[2] }
foreach ($lap in $lapok.Keys) { Ir (Join-Path $root $lap) $lapok[$lap] $lapok[$lap].Szoveg }
$jelentes | ForEach-Object { Write-Host $_ -ForegroundColor Green }
