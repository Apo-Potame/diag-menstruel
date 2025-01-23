const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware pour traiter les requêtes JSON
app.use(bodyParser.json());

// Servir l'interface HTML à la racine
const path = require('path');
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Endpoint pour le chatbot
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.userMessage;

  if (!userMessage) {
    return res.status(400).json({ error: "Le message utilisateur est vide." });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "Tu es une sage-femme virtuelle experte en santé féminine et menstruelle. Réponds de manière claire et rassurante."
          },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Erreur API OpenAI :", data.error);
      return res.status(500).json({ error: "Erreur avec l'API OpenAI." });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error("Erreur API OpenAI :", error.message || error);
    res.status(500).json({ error: "Erreur du serveur." });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
