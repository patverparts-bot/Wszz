$ErrorActionPreference='Stop'
$backupProject=Split-Path -Parent $PSScriptRoot
$backupScript=Join-Path $PSScriptRoot 'backup-application.ps1'
$backupPowerShell=(Get-Process -Id $PID).Path
$backupUser=[Security.Principal.WindowsIdentity]::GetCurrent().Name
# Verify that this Windows identity can decrypt its key before installing the task.
$backupProtected=[IO.File]::ReadAllBytes((Join-Path $backupProject 'private-data/backup-config/key.dpapi'))
$backupCheck=[Security.Cryptography.ProtectedData]::Unprotect($backupProtected,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
if($backupCheck.Length -ne 64){throw 'Backup key cannot be read by this Windows account'}
$backupAction=New-ScheduledTaskAction -Execute $backupPowerShell -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$backupScript+'"') -WorkingDirectory $backupProject
$backupTriggers=@((New-ScheduledTaskTrigger -Daily -At '20:00'),(New-ScheduledTaskTrigger -AtLogOn -User $backupUser))
$backupSettings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
$backupPrincipal=New-ScheduledTaskPrincipal -UserId $backupUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'ZZWS encrypted application backup' -Action $backupAction -Trigger $backupTriggers -Settings $backupSettings -Principal $backupPrincipal -Description 'Encrypted ZZWS application data backup. Requires this Windows user and internet access.' -Force | Out-Null
$backupTask=Get-ScheduledTask -TaskName 'ZZWS encrypted application backup'
Write-Output ('Backup task installed: '+$backupTask.TaskName+'; '+$backupTask.State)

Start-ScheduledTask -TaskName 'ZZWS encrypted application backup'
Write-Output 'Initial scheduled backup started.'
