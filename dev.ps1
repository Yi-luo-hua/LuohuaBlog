param(
    [ValidateSet("start", "stop", "status")]
    [string]$Action = "start"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$frontendDir = Join-Path $repoRoot "main"
$backendDir = Join-Path $repoRoot "acg-api"
$runtimeDir = Join-Path $repoRoot ".dev-runtime"
$statePath = Join-Path $runtimeDir "processes.json"

function Get-ListenerPid {
    param([int]$Port)

    $connection = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($null -eq $connection) {
        return $null
    }

    return [int]$connection.OwningProcess
}

function Wait-ForListener {
    param(
        [int]$Port,
        [System.Diagnostics.Process]$Process,
        [string]$Name,
        [string]$ErrorLog
    )

    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $listenerPid = Get-ListenerPid -Port $Port
        if ($null -ne $listenerPid) {
            return $listenerPid
        }

        if ($Process.HasExited) {
            $details = if (Test-Path -LiteralPath $ErrorLog) {
                (Get-Content -LiteralPath $ErrorLog -Tail 30 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
            } else {
                "没有生成错误日志。"
            }
            throw "$Name 启动失败。`n$details"
        }

        Start-Sleep -Milliseconds 500
    }

    throw "$Name 在 30 秒内没有监听端口 $Port，请查看 $ErrorLog。"
}

function Start-DetachedService {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [int]$Port,
        [string]$LogPrefix
    )

    $stdoutLog = Join-Path $runtimeDir "$LogPrefix.log"
    $stderrLog = Join-Path $runtimeDir "$LogPrefix.error.log"
    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    $listenerPid = Wait-ForListener -Port $Port -Process $process -Name $Name -ErrorLog $stderrLog
    return [ordered]@{
        managed     = $true
        launcherPid = $process.Id
        listenerPid = $listenerPid
        port        = $Port
    }
}

function Get-ExistingState {
    if (-not (Test-Path -LiteralPath $statePath)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-ReusedServiceState {
    param(
        [string]$Name,
        [int]$Port,
        [int]$ListenerPid,
        $PreviousState
    )

    $managed = $false
    $launcherPid = $null
    if ($null -ne $PreviousState -and
        $PreviousState.PSObject.Properties.Name -contains $Name -and
        $PreviousState.$Name.listenerPid -eq $ListenerPid -and
        $PreviousState.$Name.managed) {
        $managed = $true
        $launcherPid = $PreviousState.$Name.launcherPid
    }

    return [ordered]@{
        managed     = $managed
        launcherPid = $launcherPid
        listenerPid = $ListenerPid
        port        = $Port
    }
}

function Show-Status {
    $frontendPid = Get-ListenerPid -Port 5173
    $backendPid = Get-ListenerPid -Port 8787

    if ($null -ne $frontendPid) {
        Write-Host "前端：运行中  http://127.0.0.1:5173  (PID $frontendPid)" -ForegroundColor Green
    } else {
        Write-Host "前端：未运行  (端口 5173)" -ForegroundColor Yellow
    }

    if ($null -ne $backendPid) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/v1/health" -TimeoutSec 3
            Write-Host "后端：运行中  http://127.0.0.1:8787  (PID $backendPid，健康检查正常)" -ForegroundColor Green
        } catch {
            Write-Host "后端：端口已监听，但健康检查失败  (PID $backendPid)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "后端：未运行  (端口 8787)" -ForegroundColor Yellow
    }
}

function Stop-ManagedService {
    param(
        [string]$DisplayName,
        $ServiceState
    )

    if ($null -eq $ServiceState -or -not $ServiceState.managed) {
        Write-Host "$DisplayName 不是由 dev.ps1 启动，已保留。" -ForegroundColor DarkYellow
        return
    }

    $currentListenerPid = Get-ListenerPid -Port ([int]$ServiceState.port)
    if ($null -ne $currentListenerPid -and $currentListenerPid -eq [int]$ServiceState.listenerPid) {
        Stop-Process -Id $currentListenerPid -Force -ErrorAction SilentlyContinue
    }

    if ($null -ne $ServiceState.launcherPid -and
        [int]$ServiceState.launcherPid -ne [int]$ServiceState.listenerPid) {
        Stop-Process -Id ([int]$ServiceState.launcherPid) -Force -ErrorAction SilentlyContinue
    }

    Write-Host "$DisplayName 已停止。" -ForegroundColor Green
}

switch ($Action) {
    "status" {
        Show-Status
        break
    }

    "stop" {
        $state = Get-ExistingState
        if ($null -eq $state) {
            Write-Host "没有找到 dev.ps1 创建的运行记录；不会停止其他终端启动的进程。" -ForegroundColor Yellow
            Show-Status
            break
        }

        Stop-ManagedService -DisplayName "前端" -ServiceState $state.frontend
        Stop-ManagedService -DisplayName "后端" -ServiceState $state.backend
        if (Test-Path -LiteralPath $statePath) {
            Remove-Item -LiteralPath $statePath -Force
        }
        break
    }

    "start" {
        New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
        $previousState = Get-ExistingState

        $frontendPid = Get-ListenerPid -Port 5173
        if ($null -eq $frontendPid) {
            $npm = Get-Command npm.cmd -ErrorAction Stop
            $frontendState = Start-DetachedService `
                -Name "前端" `
                -FilePath $npm.Source `
                -Arguments @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5173") `
                -WorkingDirectory $frontendDir `
                -Port 5173 `
                -LogPrefix "frontend"
            Write-Host "前端已启动。" -ForegroundColor Green
        } else {
            $frontendState = Get-ReusedServiceState -Name "frontend" -Port 5173 -ListenerPid $frontendPid -PreviousState $previousState
            Write-Host "前端端口 5173 已在使用，继续复用现有进程。" -ForegroundColor Cyan
        }

        $backendPid = Get-ListenerPid -Port 8787
        if ($null -eq $backendPid) {
            $go = Get-Command go.exe -ErrorAction Stop
            $backendState = Start-DetachedService `
                -Name "后端" `
                -FilePath $go.Source `
                -Arguments @("run", ".") `
                -WorkingDirectory $backendDir `
                -Port 8787 `
                -LogPrefix "backend"
            Write-Host "后端已启动。" -ForegroundColor Green
        } else {
            $backendState = Get-ReusedServiceState -Name "backend" -Port 8787 -ListenerPid $backendPid -PreviousState $previousState
            Write-Host "后端端口 8787 已在使用，继续复用现有进程。" -ForegroundColor Cyan
        }

        [ordered]@{
            startedAt = (Get-Date).ToString("o")
            frontend  = $frontendState
            backend   = $backendState
        } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding utf8

        Write-Host ""
        Show-Status
        Write-Host "日志目录：$runtimeDir" -ForegroundColor DarkGray
        break
    }
}
