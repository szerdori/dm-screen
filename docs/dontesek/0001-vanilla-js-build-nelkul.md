# 0001 – Vanilla JS, build nélkül

*Állapot: elfogadva (a projekt kezdete óta; leírva 2026-10-29).*

## Háttér
A felhasználó nem fejlesztő, a gépén nincs Node és Python, csak PowerShell 5.1, Git és Chrome. Az app GitHub Pages-en fut, és asztali ikonról (Chrome `--app=`) indul.

## Döntés
Sima HTML + klasszikus `<script>` (nem ES-modul), keretrendszer és build-lépés nélkül. Külső könyvtár csak CDN-ről (Firebase). A tesztek és a lefedettségmérés is Node nélkül futnak (`teszt.ps1`: PowerShell-webszerver + fej nélküli Chrome; `tests/lefedettseg.cs`).

## Következmények
- Amit a tárolóba írunk, az fut élesben – nincs fordítás, nincs elrontható build.
- A fájlok közös globális térben futnak: a betöltési sorrend számít, a fájlok legfelső szintjén csak deklaráció legyen (az indítás a végén).
- Kivétel: a Firebase-réteg `<script type="module">` (a CDN-es Firebase ES-modulként töltődik). Ez halasztva fut, a többi szkript után, és csak a `window`-on át (`DMApp.setAuth`, `DMAuth`; a `karakter.html`-ben `KAuth`, `KDB`) érintkezik az appal – a refaktorban is így marad.
- A böngésző-gyorsítótár miatt a közös fájlokat `?v=N`-nel töltjük, és verzióőr kell (lásd 0005).
- A szétbontás (lásd 0006) több `<script src>` sorral történik, nem bundlerrel.
