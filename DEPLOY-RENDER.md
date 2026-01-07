# 🚀 Deploy Backend su Render.com

## 📋 Setup Database PostgreSQL

### 1. Crea Database su Render.com

1. Vai su https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Configurazione:
   - **Name**: `lumen-studio-db`
   - **Database**: `imparafacile`
   - **User**: (auto-generato)
   - **Region**: Frankfurt (EU)
   - **Plan**: Free
4. Click "Create Database"
5. **Copia l'Internal Database URL** (formato: `postgresql://user:pass@host/db`)

### 2. Deploy Backend

1. Vai su https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connetti repository GitHub del backend
4. Configurazione:
   - **Name**: `lumen-studio-api`
   - **Environment**: Node
   - **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy`
   - **Start Command**: `node server.js`
   - **Plan**: Free

### 3. Environment Variables

Aggiungi queste variabili in "Environment" tab:

```bash
# Database
DATABASE_URL=<COPIA_INTERNAL_DATABASE_URL_QUI>

# App
NODE_ENV=production
PORT=4000

# OpenAI (opzionale per AI features)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# CORS Origins
FRONTEND_URL=https://lumenstudio-edu.netlify.app
```

### 4. Inizializza Database

Dopo il primo deploy, vai su "Shell" tab e esegui:

```bash
npx prisma migrate deploy
npx prisma db seed
```

## ✅ Verifica Funzionamento

Test API:
```bash
curl https://lumen-studio-api-2.onrender.com/api/materie
```

Dovrebbe rispondere con lista materie.

## 🔧 Troubleshooting

**Errore "P1001: Can't reach database"**
- Verifica che DATABASE_URL sia corretto
- Controlla che il database sia attivo su Render

**Errore "Table does not exist"**
- Esegui: `npx prisma migrate deploy` nella Shell

**CORS errors**
- Verifica che lumenstudio-edu.netlify.app sia nei domini CORS in server.js
