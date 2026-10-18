# Evangadi Forum

A full-stack community platform where learners ask questions, share answers, participate in discussions, and use AI tools to support learning.

🌐 **Live website:** https://evangadiforum.builtbyyeab.com

## Features

- User registration and login with JWT authentication
- Google sign-in
- Password recovery through email
- Password strength validation for registration and password reset
- Questions and answers
- Likes and saved questions
- AI writing assistance and similar-question recommendations
- PDF upload and AI-assisted document search
- Discussion rooms and private messaging
- Chat attachments and voice messages
- Real-time notifications with Socket.IO
- Profile editing and avatars

Some features require external service configuration. See the current limitations below.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, React Router, Axios |
| Styling and UI | CSS Modules, Framer Motion, Lucide |
| Backend | Node.js, Express |
| Database | MySQL, mysql2 |
| Authentication | JWT, bcryptjs, Google OAuth |
| Real-time communication | Socket.IO |
| AI | Google Gemini API |
| Email | Resend HTTPS API |
| Deployment | Vercel, Render, Aiven |

## Project Structure

```text
Evangadi/
├── backend/
│   ├── db/
│   │   ├── config.js
│   │   ├── schema.sql
│   │   └── migrations/
│   ├── src/
│   │   ├── api/
│   │   ├── middleware/
│   │   ├── socket/
│   │   └── utils/
│   ├── .env.example
│   ├── index.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── services/
│   ├── .env.example
│   ├── vercel.json
│   └── package.json
└── README.md
```

## Run Locally

### Prerequisites

- Node.js 24
- npm
- MySQL
- Git
- A Gemini API key for AI features
- A Google OAuth web client ID for Google sign-in
- A Resend API key and verified sending domain for password-reset emails

### 1. Clone the repository

```bash
git clone https://github.com/Yeab0226/Evangadi.git
cd Evangadi
```

### 2. Set up the database

Create an empty MySQL database:

```sql
CREATE DATABASE evangadi_forum
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Import `backend/db/schema.sql` into that database using MySQL Workbench or another MySQL client.

> **Warning:** The schema file contains `DROP TABLE` statements. Use it only to initialize an empty database. Back up existing data before applying schema changes.

Review `backend/db/migrations/` before applying migrations. Do not rerun changes already included in the schema.

### 3. Configure the backend

Create `backend/.env` using `backend/.env.example` as a starting point.

```env
PORT=3777

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=evangadi_forum
DB_SSL_CA=

JWT_SECRET=replace_with_a_strong_random_secret
JWT_EXPIRES_IN=1d

FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your_google_web_client_id

GEMINI_API_KEY=your_gemini_api_key
GEMINI_EMBEDDING_MODEL=your_supported_embedding_model
GEMINI_TEXT_MODEL=your_supported_text_generation_model

RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=Evangadi Forum <noreply@your_verified_domain>
```

For hosted MySQL, use the provider's connection details and configure `DB_SSL_CA` with the complete CA certificate where required.

The embedding model must support embedding generation, while the text model must support content generation. Use compatible embeddings when indexing documents and searching them.

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start the backend

```bash
cd backend
npm ci
npm start
```

Backend address:

```text
http://localhost:3777
```

Health check:

```text
http://localhost:3777/health
```

### 5. Configure the frontend

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3777
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id
```

Use the same Google client ID in the frontend and backend. Configure the frontend origin in your Google OAuth client's authorized JavaScript origins.

Do not add `/api` to `VITE_API_BASE_URL`; the application appends endpoint paths.

> Variables prefixed with `VITE_` are exposed in browser code. Never place database passwords, JWT secrets, Gemini keys, or Resend keys in them.

### 6. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite.

## Password Requirements

New passwords must contain:

- At least 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one special character

Numbers are optional. Spaces do not count as special characters.

These rules apply to registration and password reset. Existing users can continue logging in with their current passwords.

## Deployment

The application uses:

```text
GitHub
├── Vercel → React frontend
└── Render → Express backend
             ├── Aiven → MySQL database
             ├── Gemini → AI features
             └── Resend → Password-reset email
```

### Frontend: Vercel

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Production branch | `main` |

Set:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id
```

Rebuild after changing frontend environment variables.

### Backend: Render

| Setting | Value |
|---|---|
| Runtime | Node.js |
| Root directory | `backend` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health-check path | `/health` |
| Auto-deploy | On Commit |
| Branch | `main` |

Configure the backend environment variables in Render, including:

```env
NODE_VERSION=24
FRONTEND_URL=https://your-frontend-domain
```

Use Aiven's host, port, database credentials, and CA certificate. Let Render supply `PORT`.

The backend root URL may display `Cannot GET /`. Use `/health` to check startup.

### Database: Aiven

Create a MySQL service and import the schema or an existing database export into an empty target database.

If an import fails because a primary key is required, ensure primary keys are defined inside each `CREATE TABLE` statement rather than added only at the end of the export.

Do not run the full database schema automatically on every deployment.

### Email: Resend

Verify a sending domain and configure:

```env
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=Evangadi Forum <noreply@your_verified_domain>
FRONTEND_URL=https://your-frontend-domain
```

Password-reset emails use the Resend HTTPS API. Render Free blocks the usual SMTP ports, so Gmail SMTP is unsuitable for this deployment.

## Automatic Deployments

Vercel and Render are connected to the repository's `main` branch.

```bash
git add <changed-files>
git commit -m "Describe your change"
git push origin main
```

A push triggers the connected deployments according to each platform's settings.

Database migrations must be reviewed and applied separately. A code deployment does not automatically migrate or restore database data.

## Useful Commands

### Backend

```bash
npm start
npm test
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

## Current Limitations and Planned Improvements

- **Upload persistence:** Uploaded avatars, PDFs, and chat files currently use local backend storage. Render Free does not retain runtime files across restarts or redeployments. Persistent object storage is planned.
- **Password-reset security:** Reset links expire after 15 minutes. Single-use token enforcement is planned.
- **Rate limiting:** Additional protection for authentication, reset requests, and AI endpoints is planned.
- **Cold starts:** Render Free can sleep when inactive, causing a delay on the first request.
- **Moderation:** Reporting and administrator review tools are planned.
- **Accepted answers:** Allowing question authors to mark a solution is planned.

## Contributing

1. Create a branch for your change.
2. Make focused changes.
3. Run the relevant checks.
4. Open a pull request describing the change and how it was tested.

Never commit `.env` files, API keys, database exports, or private user uploads.
