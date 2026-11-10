# scripts/paypal-plans-einmalig.ps1
#
# Legt die PayPal-Pläne ohne automatische Verlängerung an (`total_cycles: 1`),
# wie es AGB 4.3 zusagt: „Es gibt keine automatische Verlängerung."
#
# WARUM EIN SKRIPT UND KEIN KLICK IM PANEL
# PayPal lässt `billing_cycles` eines bestehenden Plans nicht ändern — weder
# über die Oberfläche noch per PATCH (erlaubt sind nur `description`,
# `payment_preferences.*` und `taxes.percentage`). Die einzige Möglichkeit ist,
# jeden Plan neu anzulegen und den alten zu deaktivieren. Da es acht Pläne sind
# (vier Größen × netto/brutto) und in jedem ein Preis steht, übernimmt das
# Skript die Werte aus dem alten Plan, statt sie von Hand abzutippen.
#
# NICHT das Feld „Subscriptions" unter Payment capabilities abschalten: das
# nimmt dem Konto die Abo-Fähigkeit insgesamt — niemand könnte dann überhaupt
# noch zahlen. Gewollt ist „einmal zahlen", nicht „nicht zahlen können".
#
# VERWENDUNG
#   doppler run -- pwsh -File scripts/paypal-plans-einmalig.ps1
#       zeigt nur, was geschehen würde
#   doppler run -- pwsh -File scripts/paypal-plans-einmalig.ps1 -Apply -Deactivate
#       legt die Pläne an und deaktiviert die alten
#
# Für die Produktion werden die PayPal-Zugangsdaten gebraucht, die auf Render
# liegen (nicht in Doppler `prd`). Entweder vorher als Umgebungsvariablen
# setzen oder die acht Pläne im Panel von Hand anlegen.
#
# NACH DEM LAUF: die ausgegebenen IDs in Doppler (Entwicklung) bzw. auf Render
# (Produktion) eintragen — das Skript schreibt sie nirgends selbst hin.
#
# ZUSAMMENHANG: Der Webhook darf `BILLING.SUBSCRIPTION.EXPIRED` nicht als
# Grund nehmen, `premium_until` zu leeren. Mit `total_cycles: 1` kommt dieses
# Ereignis bei jedem Partner nach dem bezahlten Jahr, und es würde den Monat
# Karenz (PREMIUM_MONTHS = 13) wegnehmen, der für die Verlängerung von Hand
# gedacht ist. Siehe app/api/paypal/subscription-webhook/route.ts.

param(
  # Ohne diesen Schalter wird nichts angelegt — nur angezeigt.
  [switch]$Apply,
  # Deaktiviert die alten Pläne, sobald der neue steht. Laufende Abos bleiben
  # davon unberührt; es kann sich nur niemand Neues mehr darauf anmelden.
  [switch]$Deactivate
)

$ErrorActionPreference = "Stop"

$mode = $env:PAYPAL_MODE
$base = if ($mode -eq "production") { "https://api-m.paypal.com" } else { "https://api-m.sandbox.paypal.com" }

Write-Host "=== PAYPAL_MODE=$mode -> $base ===" -ForegroundColor Cyan
if ($mode -eq "production") {
  Write-Host "ACHTUNG: Produktion. Hier laufen echte Zahlungen." -ForegroundColor Red
}
if (-not $Apply) {
  Write-Host "Vorschau — es wird nichts angelegt. Mit -Apply ausführen.`n" -ForegroundColor Yellow
}

if (-not $env:PAYPAL_CLIENT_ID -or -not $env:PAYPAL_CLIENT_SECRET) {
  throw "PAYPAL_CLIENT_ID/SECRET fehlen. Über `doppler run --` starten."
}

$pair = "$($env:PAYPAL_CLIENT_ID):$($env:PAYPAL_CLIENT_SECRET)"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))
$tok = Invoke-RestMethod -Method Post -Uri "$base/v1/oauth2/token" `
  -Headers @{ Authorization = "Basic $b64" } `
  -ContentType "application/x-www-form-urlencoded" -Body "grant_type=client_credentials"
$auth = @{ Authorization = "Bearer $($tok.access_token)"; Accept = "application/json" }

$names = @("NONPROFIT", "MICRO", "SMALL", "MEDIUM",
  "NONPROFIT_BRUTTO", "MICRO_BRUTTO", "SMALL_BRUTTO", "MEDIUM_BRUTTO")

$results = @()

foreach ($n in $names) {
  $envName = "PAYPAL_PLAN_ID_$n"
  $oldId = [Environment]::GetEnvironmentVariable($envName)
  if (-not $oldId) {
    Write-Host "$n : $envName fehlt — übersprungen" -ForegroundColor Red
    continue
  }

  $old = Invoke-RestMethod -Method Get -Uri "$base/v1/billing/plans/$oldId" -Headers $auth
  $reg = $old.billing_cycles | Where-Object { $_.tenure_type -eq "REGULAR" }

  # Schon erledigt — etwa wenn das Skript ein zweites Mal läuft.
  if ($reg.total_cycles -eq 1) {
    Write-Host "$n : hat bereits total_cycles=1 — übersprungen" -ForegroundColor Green
    $results += [pscustomobject]@{ Name = $n; Old = $oldId; New = $oldId; Note = "unverändert" }
    continue
  }

  # PayPal begrenzt den Namen auf 127 Zeichen, und die bestehenden Namen sind
  # lang („… brutto inkl MwSt"), deshalb vor dem Anhängen kürzen.
  $suffix = " (einmalig)"
  $newName = $old.name
  if (($newName.Length + $suffix.Length) -gt 127) {
    $newName = $newName.Substring(0, 127 - $suffix.Length)
  }
  $newName = "$newName$suffix"

  $body = @{
    product_id     = $old.product_id
    name           = $newName
    description    = $old.description
    status         = "ACTIVE"
    billing_cycles = @(
      @{
        frequency      = @{
          interval_unit  = $reg.frequency.interval_unit
          interval_count = $reg.frequency.interval_count
        }
        tenure_type    = "REGULAR"
        sequence       = 1
        # Die einzige inhaltliche Änderung: ein Abrechnungszeitraum, dann Ende.
        total_cycles   = 1
        pricing_scheme = @{
          fixed_price = @{
            value         = $reg.pricing_scheme.fixed_price.value
            currency_code = $reg.pricing_scheme.fixed_price.currency_code
          }
        }
      }
    )
    # Übernommen, nicht neu gesetzt: netto und brutto unterscheiden sich in
    # `setup_fee_failure_action` (CANCEL bzw. CONTINUE). Das bleibt, wie es war.
    payment_preferences = @{
      auto_bill_outstanding     = $old.payment_preferences.auto_bill_outstanding
      setup_fee_failure_action  = $old.payment_preferences.setup_fee_failure_action
      payment_failure_threshold = $old.payment_preferences.payment_failure_threshold
    }
  }

  if ($old.taxes) {
    $body.taxes = @{
      percentage = $old.taxes.percentage
      inclusive  = $old.taxes.inclusive
    }
  }

  $json = $body | ConvertTo-Json -Depth 10

  Write-Host ""
  Write-Host "$n" -ForegroundColor Cyan
  Write-Host "  alt   : $oldId (total_cycles=$($reg.total_cycles))"
  Write-Host "  Preis : $($reg.pricing_scheme.fixed_price.value) $($reg.pricing_scheme.fixed_price.currency_code) / $($reg.frequency.interval_count) $($reg.frequency.interval_unit)"
  Write-Host "  Name  : $newName"

  if (-not $Apply) {
    $results += [pscustomobject]@{ Name = $n; Old = $oldId; New = "(Vorschau)"; Note = "anzulegen" }
    continue
  }

  $created = Invoke-RestMethod -Method Post -Uri "$base/v1/billing/plans" `
    -Headers ($auth + @{
      "PayPal-Request-Id" = "ff-einmalig-$n-$(Get-Date -Format yyyyMMddHHmmss)"
      "Prefer"            = "return=representation"
    }) `
    -ContentType "application/json" -Body $json

  $newReg = $created.billing_cycles | Where-Object { $_.tenure_type -eq "REGULAR" }
  Write-Host "  NEU   : $($created.id) (total_cycles=$($newReg.total_cycles), status=$($created.status))" -ForegroundColor Green

  # Gegenprüfung an der Antwort von PayPal, nicht an der eigenen Absicht: ein
  # falscher Preis wäre hier das Teuerste, was schiefgehen kann.
  $note = "ok"
  if ($newReg.total_cycles -ne 1) {
    $note = "ACHTUNG: total_cycles=$($newReg.total_cycles)"
  }
  if ([decimal]$newReg.pricing_scheme.fixed_price.value -ne [decimal]$reg.pricing_scheme.fixed_price.value) {
    $note += " ACHTUNG: Preis weicht ab"
  }

  $results += [pscustomobject]@{ Name = $n; Old = $oldId; New = $created.id; Note = $note }

  if ($Deactivate) {
    Invoke-RestMethod -Method Post -Uri "$base/v1/billing/plans/$oldId/deactivate" -Headers $auth | Out-Null
    Write-Host "  alter Plan deaktiviert" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== ÜBERSICHT ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

if ($Apply) {
  Write-Host "=== In Doppler bzw. auf Render eintragen ===" -ForegroundColor Cyan
  foreach ($r in $results) {
    if ($r.New -ne "(Vorschau)") { Write-Output "PAYPAL_PLAN_ID_$($r.Name)=$($r.New)" }
  }
}
