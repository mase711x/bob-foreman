# Snipper

The minimalist URL shortener.

## Features

- Six character random codes
- Click analytics per link
- History stored in localStorage
- Dark mode UI

## Quick Start

```bash
npm install
npm start
```

Visit `localhost:3000` in browser.

## API Reference

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| POST | /shorten | body has url | returns code |
| GET | /:code | redirects to original | - |
| GET | /api/stats/:code | returns click count | - |

## Architecture

```
Browser Frontend
       |
       v
  Express API
       |
       v
SQLite database
```

## Tech Stack

- Node.js
- Express
- better-sqlite3
- nanoid
- vanilla JavaScript

## License

MIT
