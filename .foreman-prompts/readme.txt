Schreibe eine production-ready README.md fuer das Projekt 'Bob Foreman' direkt im aktuellen Verzeichnis.

KONTEXT:
Bob Foreman ist ein Orchestrator fuer mehrere Bob CLI Instanzen die parallel in isolierten git worktrees arbeiten. Submission fuer die IBM Bob Coding Challenge 2026 (Team: ibm-hackathon-6).

KOMPONENTEN:
- scripts/foreman-build.ps1 - Orchestrator (estimate, spawn, wait, mark done)
- scripts/spawn-worker.ps1 - spawnt einen Bob in worktrees/<task-id>/, isoliert via git worktree
- status-server.cjs - Express auf Port 3001, aggregiert Worker-State aus .foreman/tasks/*.json und logs/*.json
- dashboard/index.html - Live Dashboard mit Estimated/Elapsed/Saved Countern, Worker Cards, Coin Counter
- MCP Telegram Bot fuer 10min Status Updates aufs Handy

FLAGSHIP DEMO: URL Shortener (Express + sql.js + vanilla JS frontend) wurde von Foreman mit 4 parallelen Workern in 45 Minuten gebaut, sequentiell waeren es ~9 Stunden gewesen.

README STRUKTUR:
1. Hook/Tagline mit kurzem one-liner pitch
2. 'Why Foreman' - das Problem (sequenzielles Bob coding ist langsam) und die Loesung
3. Quick Start mit konkretem PowerShell-Befehl
4. Architecture - kurze ASCII oder Mermaid-Skizze (oder Verweis auf ARCHITECTURE.md)
5. Live Demo Links: Dashboard auf 192.168.178.86:8765/dashboard.html, URL Shortener auf 192.168.179.250:3000
6. Coin Budget Beispiele (4 Worker x 5 Coins = 20 Coins fuer eine ganze App)
7. Roadmap - was noch geht
8. Acknowledgments - IBM Bob Team, Anthropic

TONE: technisch professionell, praegnant, sparsam mit Emojis (max 1-2 pro section), keine Buzzword-Fuell.

SCHREIBE DIREKT die Datei README.md im aktuellen Worktree-Verzeichnis. Kein anderer Output noetig.
