# === generate-tree.ps1 的完整内容：可直接粘贴执行 ===
$ErrorActionPreference = 'Stop'

# 想忽略的目录名（按需增减）
$IgnoreDirs = @('node_modules','dist','build','.git','.cache','coverage')

# 是否列出文件（$true=列出文件，$false=只显示文件夹）
$ShowFiles  = $true

# 最大深度（[int]::MaxValue 为不限制深度）
$MaxDepth   = [int]::MaxValue

function Write-Tree {
    param(
        [Parameter(Mandatory)]
        [string]$Path,
        [int]$Depth = 0,
        [string]$Indent = ''
    )

    if ($Depth -gt $MaxDepth) { return }

    # 目录优先、名称排序
    $dirs  = Get-ChildItem -LiteralPath $Path -Force -Directory -ErrorAction SilentlyContinue |
             Where-Object { $IgnoreDirs -notcontains $_.Name } |
             Sort-Object Name

    foreach ($d in $dirs) {
        # 打印当前目录
        "$Indent+-- $($d.Name)"
        # 递归其子节点（缩进层级加深）
        Write-Tree -Path $d.FullName -Depth ($Depth + 1) -Indent ("$Indent|   ")
    }

    if ($ShowFiles) {
        $files = Get-ChildItem -LiteralPath $Path -Force -File -ErrorAction SilentlyContinue |
                 Sort-Object Name
        foreach ($f in $files) {
            "$Indent|   $($f.Name)"
        }
    }
}

# 生成 backend 的目录树
Write-Output ("{0} 生成 backend 目录树..." -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Tree -Path ".\apps\backend" | Out-File -FilePath "backend-tree.txt" -Encoding utf8

# 生成 web 的目录树
Write-Output ("{0} 生成 web 目录树..." -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Tree -Path ".\apps\web" | Out-File -FilePath "web-tree.txt" -Encoding utf8

Write-Output ("{0} 完成，输出文件：backend-tree.txt, web-tree.txt" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
