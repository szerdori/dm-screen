# DM Screen – regressziós tesztek futtatása (feltöltés előtt a feltoltes.ps1 is lefuttatja).
# Használat:  .\teszt.ps1              helyi tesztek, láthatatlan Chrome-ban
#             .\teszt.ps1 -Online      + az 5e.tools adatok elérhetőségének ellenőrzése (internet kell)
#             .\teszt.ps1 -Bongeszo    a teszteket látható böngészőben nyitja meg (hibakereséshez)
# Új teszteket a tests\tests.js fájlba lehet írni.
param([switch]$Online, [switch]$Bongeszo, [int]$Port = 8767)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { Write-Host 'Nem találtam Chrome-ot vagy Edge-et a tesztekhez.' -ForegroundColor Red; exit 2 }

# kis helyi webszerver a háttérben (a GitHub Pages-t utánozza)
$job = Start-Job -ArgumentList $root, $Port -ScriptBlock {
  param($root, $port)
  $types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.ico' = 'image/x-icon'; '.json' = 'application/json; charset=utf-8' }
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$port/")
  $l.Start()
  while ($l.IsListening) {
    $c = $l.GetContext()
    try {
      $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
      if (-not $p -or $p.EndsWith('/')) { $p += 'index.html' }
      $f = Join-Path $root $p
      if ((Test-Path -LiteralPath $f -PathType Leaf) -and -not $p.StartsWith('adatok')) {
        $b = [IO.File]::ReadAllBytes($f)
        $t = $types[[IO.Path]::GetExtension($f)]
        $c.Response.ContentType = if ($t) { $t } else { 'application/octet-stream' }
        $c.Response.Headers.Add('Cache-Control', 'no-store')
        $c.Response.ContentLength64 = $b.Length
        if ($c.Request.HttpMethod -ne 'HEAD') { $c.Response.OutputStream.Write($b, 0, $b.Length) }
      } else { $c.Response.StatusCode = 404 }
    } catch { }
    try { $c.Response.OutputStream.Close() } catch { }
  }
}

try {
  $url = "http://localhost:$Port/tests/index.html" + $(if ($Online) { '?online=1' } else { '' })
  $up = $false
  for ($i = 0; $i -lt 50 -and -not $up; $i++) {
    try { Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2 | Out-Null; $up = $true } catch { Start-Sleep -Milliseconds 200 }
  }
  if (-not $up) { Write-Host "Nem indult el a tesztszerver (foglalt a $Port port?)." -ForegroundColor Red; exit 2 }

  if ($Bongeszo) {
    Start-Process $url
    Read-Host 'A tesztek a böngészőben futnak. Ha végeztél, nyomj Entert (leáll a tesztszerver)'
    exit 0
  }

  Write-Host 'Tesztek futtatása…' -ForegroundColor Cyan
  $profil = Join-Path $env:TEMP 'dmscreen-teszt-profil'
  $kimenet = Join-Path $env:TEMP 'dmscreen-teszt-eredmeny.html'
  $hibak = Join-Path $env:TEMP 'dmscreen-teszt-chrome.log'
  if ([IO.File]::Exists($kimenet)) { [IO.File]::Delete($kimenet) }
  $chromeArgs = @('--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    "--user-data-dir=`"$profil`"", '--window-size=1600,1000', '--virtual-time-budget=120000', '--dump-dom', $url)
  $proc = Start-Process -FilePath $chrome -ArgumentList $chromeArgs -RedirectStandardOutput $kimenet -RedirectStandardError $hibak -NoNewWindow -PassThru
  if (-not $proc.WaitForExit(240000)) { $proc.Kill(); Write-Host 'A tesztek nem fejeződtek be 4 percen belül.' -ForegroundColor Red; exit 2 }

  $html = if (Test-Path $kimenet) { [IO.File]::ReadAllText($kimenet, [Text.Encoding]::UTF8) } else { '' }
  $m = [regex]::Match($html, '<pre id="report">([\s\S]*?)</pre>')
  $riport = [Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
  if (-not $m.Success -or $riport -notmatch 'ÖSSZESEN: (\d+) sikeres, (\d+) hibás') {
    Write-Host 'Nem sikerült kiolvasni a teszteredményt.' -ForegroundColor Red
    if ($riport) { Write-Host $riport }
    exit 2
  }
  $sikeres = [int]$Matches[1]; $hibas = [int]$Matches[2]

  foreach ($sor in $riport -split "`n") {
    if ($sor -like 'OK*') { Write-Host $sor -ForegroundColor DarkGreen }
    elseif ($sor -like 'HIBA*' -or $sor -like '*→*') { Write-Host $sor -ForegroundColor Red }
    elseif ($sor -like 'ÖSSZESEN*') { }
    elseif ($sor.Trim()) { Write-Host $sor }
  }
  Write-Host ''
  if ($hibas -eq 0) { Write-Host "MINDEN TESZT SIKERES ($sikeres db)." -ForegroundColor Green; exit 0 }
  Write-Host "$hibas TESZT HIBÁS (és $sikeres sikeres)." -ForegroundColor Red
  exit 1
}
finally {
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}
