$file = 'c:\Users\ntceh\Desktop\tayyarihub\Tayyari-hub\app\admin\students\page.tsx'
$content = Get-Content $file -Raw -Encoding UTF8

# Fix corrupted graduation cap emoji
$content = $content -replace [char]0xF0 + [char]0x9F + [char]0x8E + [char]0x93, '🎓'

# Fix corrupted bullet point
$content = $content -replace [char]0xE2 + [char]0x80 + [char]0xA2, '•'

# Alternative: Just remove the emoji entirely
$content = $content -replace 'ðŸŽ"', ''
$content = $content -replace 'â€¢', '•'

Set-Content $file -Value $content -Encoding UTF8 -NoNewline
Write-Host 'Fixed encoding issues'
