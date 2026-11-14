# A munkafa ujjlenyomata es a legutobbi teszteredmeny helye (a teszt.ps1 es a feltoltes.ps1 kozos resze).
# Csak ASCII (BOM nelkul is jo a PowerShell 5.1-ben). Hasznalat:  . (Join-Path $PSScriptRoot 'tests\ujjlenyomat.ps1')

function Get-DmGit {
  $g = 'C:\Program Files\Git\cmd\git.exe'
  if (Test-Path $g) { $g } else { 'git' }
}

# Minden kovetett es uj (nem ignoralt) fajl tartalmabol; a *.md kimarad (a tesztek nem olvassak, igy a dokumentacio
# irasa nem ervenytelenit egy sikeres futast). Ket azonos ujjlenyomat = a tesztek ugyanazt a kodot lattak.
function Get-DmUjjlenyomat([string]$Root) {
  $git = Get-DmGit
  $fajlok = @(& $git -C $Root -c core.quotepath=false ls-files -co --exclude-standard) | Where-Object { $_ -and $_ -notlike '*.md' } | Sort-Object -Unique
  # ures lista (pl. a git nem futott le) allando ujjlenyomatot adna, es a feltoltes tevesen kihagyna a tesztet: inkabb hiba
  if ($LASTEXITCODE -ne 0 -or @($fajlok).Count -lt 10) { throw 'Nem sikerult a fajllista (git ls-files) - nincs ujjlenyomat.' }
  $sha = [Security.Cryptography.SHA256]::Create()
  $sb = New-Object Text.StringBuilder
  foreach ($f in $fajlok) {
    $p = Join-Path $Root $f
    $h = if ([IO.File]::Exists($p)) { [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($p))) } else { 'nincs' }
    [void]$sb.Append($f).Append('|').Append($h).Append("`n")
  }
  [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($sb.ToString()))).Replace('-', '')
}

# A .git mappaban van, igy sosem kerul a taroloba (worktree-ben annak a sajat git-mappajaban).
function Get-DmEredmenyFajl([string]$Root) {
  $git = Get-DmGit
  $d = (& $git -C $Root rev-parse --git-dir | Select-Object -First 1)
  if (-not $d) { return $null }
  if (-not [IO.Path]::IsPathRooted($d)) { $d = Join-Path $Root $d }
  Join-Path $d 'dmscreen-teszt-eredmeny.txt'
}

function Write-DmEredmeny([string]$Root, [string]$Ujjlenyomat, [bool]$Teljes, [int]$Sikeres, [int]$Hibas) {
  $f = Get-DmEredmenyFajl $Root
  if (-not $f) { return }
  $sorok = @("ujjlenyomat=$Ujjlenyomat", "teljes=$([int]$Teljes)", "sikeres=$Sikeres", "hibas=$Hibas", "ido=$((Get-Date).ToUniversalTime().ToString('o'))")
  try { [IO.File]::WriteAllLines($f, $sorok) } catch { }
}

# $true, ha erre az allapotra van friss (24 oran beluli), teljes, hibatlan futas.
function Test-DmFrissSiker([string]$Root) {
  $f = Get-DmEredmenyFajl $Root
  if (-not $f -or -not [IO.File]::Exists($f)) { return $false }
  $e = @{}
  foreach ($s in [IO.File]::ReadAllLines($f)) { $i = $s.IndexOf('='); if ($i -gt 0) { $e[$s.Substring(0, $i)] = $s.Substring($i + 1) } }
  if ($e.teljes -ne '1' -or $e.hibas -ne '0' -or -not ([int]$e.sikeres -gt 0)) { return $false }
  $ido = [DateTime]::MinValue
  if (-not [DateTime]::TryParse($e.ido, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind, [ref]$ido)) { return $false }
  if (((Get-Date).ToUniversalTime() - $ido.ToUniversalTime()).TotalHours -gt 24) { return $false }
  $e.ujjlenyomat -eq (Get-DmUjjlenyomat $Root)
}
