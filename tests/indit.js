// DM Screen – regressziós tesztek: indítás (az utolsó betöltött fájl; a keret: tests/keret.js).
'use strict';
run().catch(e => { document.getElementById('summary').textContent = 'A TESZTFUTTATÁS ELAKADT: ' + (e.message || e); document.getElementById('report').textContent += '\nHIBA  a tesztfuttatás elakadt: ' + (e.message || e) + (appErrors.length ? ' – az app hibái: ' + appErrors.join(' | ') : '') + '\nÖSSZESEN: 0 sikeres, 1 hibás'; document.body.dataset.done = '1'; });
