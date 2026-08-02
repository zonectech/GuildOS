# Recreates the user's navy/gold "Certificate of Achievement" template (name area left
# blank — GuildOS draws each leader's name onto it) for testing the CUSTOM dissolve flow.
Add-Type -AssemblyName System.Drawing

$W = 1600; $H = 1131
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

$navy = [System.Drawing.Color]::FromArgb(255, 27, 58, 92)
$gold = [System.Drawing.Color]::FromArgb(255, 244, 180, 41)
$grayBg = [System.Drawing.Color]::FromArgb(255, 226, 228, 232)
$ink = [System.Drawing.Color]::FromArgb(255, 40, 44, 52)
$subInk = [System.Drawing.Color]::FromArgb(255, 110, 116, 128)

# Outer gray mat + white card
$g.Clear($grayBg)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillRectangle($white, 70, 60, $W - 140, $H - 120)
$navyPen = New-Object System.Drawing.Pen($navy, 6)
$g.DrawRectangle($navyPen, 88, 78, $W - 176, $H - 156)

# Corner diagonals (navy + gold) — clipped to the mat area
$navyBrush = New-Object System.Drawing.SolidBrush($navy)
$goldBrush = New-Object System.Drawing.SolidBrush($gold)
function Tri($brush, $pts) { $g.FillPolygon($brush, $pts) }
# top-left
Tri $navyBrush @([System.Drawing.Point]::new(0,0), [System.Drawing.Point]::new(320,0), [System.Drawing.Point]::new(0,220))
Tri $goldBrush @([System.Drawing.Point]::new(120,0), [System.Drawing.Point]::new(260,0), [System.Drawing.Point]::new(0,290), [System.Drawing.Point]::new(0,190))
# top-right
Tri $goldBrush @([System.Drawing.Point]::new($W-360,0), [System.Drawing.Point]::new($W,0), [System.Drawing.Point]::new($W,60))
Tri $navyBrush @([System.Drawing.Point]::new($W-260,0), [System.Drawing.Point]::new($W,0), [System.Drawing.Point]::new($W,190))
# bottom-left
Tri $navyBrush @([System.Drawing.Point]::new(0,$H), [System.Drawing.Point]::new(0,$H-190), [System.Drawing.Point]::new(260,$H))
Tri $goldBrush @([System.Drawing.Point]::new(0,$H-60), [System.Drawing.Point]::new(0,$H), [System.Drawing.Point]::new(360,$H))
# bottom-right
Tri $navyBrush @([System.Drawing.Point]::new($W,$H), [System.Drawing.Point]::new($W-320,$H), [System.Drawing.Point]::new($W,$H-220))
Tri $goldBrush @([System.Drawing.Point]::new($W-120,$H), [System.Drawing.Point]::new($W-260,$H), [System.Drawing.Point]::new($W,$H-290), [System.Drawing.Point]::new($W,$H-190))

$center = New-Object System.Drawing.StringFormat
$center.Alignment = 'Center'

# Title
$titleFont = New-Object System.Drawing.Font('Georgia', 64, [System.Drawing.FontStyle]::Regular)
$inkBrush = New-Object System.Drawing.SolidBrush($ink)
$g.DrawString('C E R T I F I C A T E', $titleFont, $inkBrush, [System.Drawing.RectangleF]::new(0, 150, $W, 100), $center)
$subFont = New-Object System.Drawing.Font('Georgia', 26, [System.Drawing.FontStyle]::Regular)
$g.DrawString('OF ACHIEVEMENT', $subFont, $inkBrush, [System.Drawing.RectangleF]::new(0, 258, $W, 50), $center)

# Diamonds divider
$g.FillPolygon($navyBrush, @([System.Drawing.Point]::new(770,335), [System.Drawing.Point]::new(782,347), [System.Drawing.Point]::new(770,359), [System.Drawing.Point]::new(758,347)))
$g.FillPolygon($goldBrush, @([System.Drawing.Point]::new(830,335), [System.Drawing.Point]::new(842,347), [System.Drawing.Point]::new(830,359), [System.Drawing.Point]::new(818,347)))

# Presented-to line (name area itself stays BLANK — GuildOS draws the recipient's name there)
$presFont = New-Object System.Drawing.Font('Georgia', 16)
$subBrush = New-Object System.Drawing.SolidBrush($subInk)
$g.DrawString('This certificate is proudly presented to', $presFont, $subBrush, [System.Drawing.RectangleF]::new(0, 400, $W, 40), $center)

# Body text (kept low so the auto-drawn recipient name at ~55% height stays clear)
$bodyFont = New-Object System.Drawing.Font('Georgia', 15)
$g.DrawString("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin bibendum diam purus, vitae condimentum ipsum scelerisque eu.", $bodyFont, $subBrush, [System.Drawing.RectangleF]::new(280, 720, $W - 560, 90), $center)

# Signature lines
$linePen = New-Object System.Drawing.Pen($navy, 2)
$g.DrawLine($linePen, 240, 920, 560, 920)
$g.DrawLine($linePen, $W - 560, 920, $W - 240, 920)
$sigFont = New-Object System.Drawing.Font('Georgia', 14)
$g.DrawString('Signature', $sigFont, $subBrush, [System.Drawing.RectangleF]::new(240, 935, 320, 30), $center)
$g.DrawString('Signature', $sigFont, $subBrush, [System.Drawing.RectangleF]::new($W - 560, 935, 320, 30), $center)

# Center badge (gold rosette + navy disk)
$badgeCx = $W / 2; $badgeCy = 900
for ($a = 0; $a -lt 360; $a += 30) {
  $rad = $a * [Math]::PI / 180
  $px = $badgeCx + [Math]::Cos($rad) * 52 - 14
  $py = $badgeCy + [Math]::Sin($rad) * 52 - 14
  $g.FillEllipse($goldBrush, [float]$px, [float]$py, 28, 28)
}
$g.FillEllipse($goldBrush, [float]($badgeCx - 52), [float]($badgeCy - 52), 104, 104)
$g.FillEllipse($navyBrush, [float]($badgeCx - 40), [float]($badgeCy - 40), 80, 80)
$badgeFont = New-Object System.Drawing.Font('Arial', 11, [System.Drawing.FontStyle]::Bold)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.DrawString("TOP`nBRAND`nAWARD", $badgeFont, $whiteBrush, [System.Drawing.RectangleF]::new($badgeCx - 40, $badgeCy - 26, 80, 60), $center)
# Ribbon tails
Tri $goldBrush @([System.Drawing.Point]::new($badgeCx-28,$badgeCy+40), [System.Drawing.Point]::new($badgeCx-6,$badgeCy+40), [System.Drawing.Point]::new($badgeCx-17,$badgeCy+95))
Tri $goldBrush @([System.Drawing.Point]::new($badgeCx+6,$badgeCy+40), [System.Drawing.Point]::new($badgeCx+28,$badgeCy+40), [System.Drawing.Point]::new($badgeCx+17,$badgeCy+95))

$g.Dispose()
$bmp.Save('C:\Users\Administrator\Desktop\Guild0S\backend\custom-template.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'custom-template.png written'
