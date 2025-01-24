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

  // Vérification des erreurs dans la réponse
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Erreur avec l'API OpenAI.");
  }

  // Vérifie si 'choices' contient des données valides
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Aucune réponse générée par l'API OpenAI.");
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

  // Vérifie que le message utilisateur est fourni
  if (!userMessage) {
    console.error("Erreur : Le message utilisateur est vide.");
    return res.status(400).json({ error: "Le message utilisateur est vide." });
  }

  try {
    console.log("Message utilisateur reçu :", userMessage);

    // Appel à l'API OpenAI avec un prompt pour le chatbot
    const reply = await callOpenAI([
      {
        role: "system",
        content: "Tu es une sage-femme virtuelle experte en santé féminine et menstruelle. Réponds de manière claire et rassurante, mais précise une fois que la discussion est finie que tes réponses sont une aide au diagnostic et ne remplacent pas une visite médicale chez un professionnel de santé."
      },
      { role: "user", content: userMessage }
    ]);

    console.log("Réponse générée :", reply);
    res.json({ reply }); // Envoi de la réponse au frontend
  } catch (error) {
    console.error("Erreur dans le backend :", error.message || error);
    res.status(500).json({
      error: "Erreur du serveur.",
      details: error.message || "Une erreur inattendue est survenue."
    });
  }
});

// Route de test pour vérifier l'API OpenAI
app.get('/test-openai', async (req, res) => {
  try {
    // Appel simple à l'API OpenAI pour tester la connectivité
    const reply = await callOpenAI([{ role: "user", content: "Test de l'API OpenAI" }], 50);
    res.json({ reply });
  } catch (error) {
    console.error("Erreur lors du test :", error.message || error);
    res.status(500).json({
      error: "Erreur lors du test de l'API.",
      details: error.message || "Une erreur inattendue est survenue."
    });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
