Set-Location -LiteralPath $PSScriptRoot
Write-Host 'Otwórz w przeglądarce: http://127.0.0.1:4173'
Write-Host 'Bez UAC. Aby zakończyć, zamknij to okno.'
node server.mjs
