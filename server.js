const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour traiter les requêtes JSON et ajouter des headers CORS
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Fonction utilitaire pour appeler l'API OpenAI
async function callOpenAI(messages, maxTokens = 500) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("La clé API OpenAI n'est pas configurée.");
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Erreur avec l'API OpenAI.");
  }
  return data.choices[0].message.content;
}

// Servir l'interface HTML
const path = require('path');
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Route pour le chatbot
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.userMessage;

  if (!userMessage) {
    console.error("Erreur : Le message utilisateur est vide.");
    return res.status(400).json({ error: "Le message utilisateur est vide." });
  }

  try {
    console.log("Message utilisateur reçu :", userMessage);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Tu es une sage-femme virtuelle experte en santé féminine et menstruelle. Réponds de manière claire et rassurante, mais tes réponses sont juste une aide au diagnostic et ne remplace pas une visite médicale chez un pro de santé."
          },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500
      }),
    });

    const data = await response.json();
    console.log("Réponse brute de l'API OpenAI :", data);

    // Vérification si la réponse est valide
    if (!response.ok || data.error) {
      console.error("Erreur API OpenAI :", data.error || data);
      return res.status(500).json({
        error: "Erreur avec l'API OpenAI.",
        details: data.error || "Réponse invalide de l'API."
      });
    }

    // Vérification de 'choices'
    if (!data.choices || data.choices.length === 0) {
      console.error("Erreur : Aucune réponse valide dans 'choices'.");
      return res.status(500).json({ error: "Aucune réponse générée par l'API OpenAI." });
    }

    // Récupération et envoi de la réponse
    const reply = data.choices[0].message.content;
    console.log("Réponse générée :", reply);
    res.json({ reply });
  } catch (error) {
    console.error("Erreur dans le backend :", error.message || error);
    res.status(500).json({
      error: "Erreur du serveur.",
      details: error.message || "Une erreur inattendue est survenue."
    });
  }
});


// Route de test
app.get('/test-openai', async (req, res) => {
  try {
    const reply = await callOpenAI([{ role: "user", content: "Test de l'API OpenAI" }], 50);
    res.json({ reply });
  } catch (error) {
    console.error("Erreur lors du test :", error.message || error);
    res.status(500).json({ error: "Erreur lors du test de l'API.", details: error.message });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
