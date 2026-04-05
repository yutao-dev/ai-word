Write-Host "Installing Backend Dependencies..." -ForegroundColor Cyan
conda activate ai-word
pip install -r backend/requirements.txt

Write-Host ""
Write-Host "Installing Frontend Dependencies..." -ForegroundColor Cyan
cd frontend
npm install
cd ..

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!               " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy backend/.env.example to backend/.env and configure your API keys" -ForegroundColor White
Write-Host "2. Run ./start-dev.ps1 to start development servers" -ForegroundColor White
Write-Host ""
