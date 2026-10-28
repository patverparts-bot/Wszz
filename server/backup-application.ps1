param([switch]$VerifyLatest)
$ErrorActionPreference='Stop'
$backupProject=Split-Path -Parent $PSScriptRoot
$backupDirectory=Join-Path $backupProject 'backups/server'
New-Item -ItemType Directory -Force $backupDirectory | Out-Null
if($VerifyLatest){
 $backupFile=Get-ChildItem -LiteralPath $backupDirectory -Filter '*.zzwsbackup' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
 if(-not $backupFile){throw 'No backup available'}
 $backupRaw=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($backupFile.FullName),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $backupData=[Text.Encoding]::UTF8.GetString($backupRaw) | ConvertFrom-Json
 if($backupData.format -ne 'zzws-application-backup-v1' -or -not $backupData.tables.PSObject.Properties['users'] -or -not $backupData.tables.PSObject.Properties['orders']){throw 'Invalid backup manifest'}
 Write-Output ('Verified: '+$backupFile.Name+'; users='+@($backupData.tables.users).Count+'; orders='+@($backupData.tables.orders).Count)
 exit
}
try{
 $backupKey=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $backupProject 'private-data/backup-config/key.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
 $backupResponse=Invoke-WebRequest -Uri 'https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/maintenance/backup' -Method Post -Headers @{Authorization=('Bearer '+$backupKey)} -TimeoutSec 180
 $backupText=$backupResponse.Content
 $backupData=$backupText|ConvertFrom-Json
 if($backupData.format -ne 'zzws-application-backup-v1'){throw 'Unexpected backup response'}
 $backupBytes=[Text.Encoding]::UTF8.GetBytes($backupText)
 $backupEncrypted=[Security.Cryptography.ProtectedData]::Protect($backupBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $backupName='ZZWS-'+(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')+'.zzwsbackup'
 $backupDestination=Join-Path $backupDirectory $backupName
 [IO.File]::WriteAllBytes($backupDestination,$backupEncrypted)
 $backupMetadata=@{status='ok';created=(Get-Date).ToString('o');file=$backupName;bytes=$backupEncrypted.Length;sha256=(Get-FileHash -LiteralPath $backupDestination -Algorithm SHA256).Hash;note='Application data only; Supabase Auth passwords and MFA secrets excluded'}
 $backupMetadata|ConvertTo-Json|Set-Content -Encoding utf8 (Join-Path $backupDirectory 'last-status.json')
 Write-Output ('Saved encrypted application backup: '+$backupName)
} catch {
 @{status='error';created=(Get-Date).ToString('o');message='Backup failed; run backup-application.ps1 manually to diagnose'}|ConvertTo-Json|Set-Content -Encoding utf8 (Join-Path $backupDirectory 'last-status.json')
 throw
} finally {$backupKey=$null;$backupText=$null;$backupResponse=$null;$backupData=$null;$backupBytes=$null}
