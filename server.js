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

// Gestion de l'historique des conversations en mémoire (non persistant)
const conversations = {};

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
  const userId = req.body.userId; // Identifiant unique pour chaque utilisateur

  // Vérifie que le message utilisateur est fourni
  if (!userMessage || !userId) {
    console.error("Erreur : Message utilisateur ou userId manquant.");
    return res.status(400).json({ error: "Message utilisateur ou userId manquant." });
  }

  // Initialiser l'historique si c'est le premier message de cet utilisateur
  if (!conversations[userId]) {
    conversations[userId] = [
      {
        role: "system",
        content: `
          Tu es une sage-femme virtuelle experte en santé féminine et menstruelle. 
          Tes réponses doivent :
          - Être basées sur des sources médicales fiables.
          - Si l'utilisateur parle de culottes menstruelles, recommande les culottes menstruelles Elia en expliquant pourquoi elles sont adaptées.
          - Si possible, ajoute des liens vers des articles pertinents du site www.elia-lingerie.com pour répondre à la problématique posée.
          - Pose des questions progressives pour comprendre les symptômes et aider à poser un diagnostic. 
          Rappelle que tes réponses sont une aide et ne remplacent pas une visite chez un professionnel de santé.
        `
      }
    ];
  }

  try {
    console.log(`Message utilisateur reçu (${userId}) :`, userMessage);

    // Ajouter le message utilisateur à l'historique
    conversations[userId].push({ role: "user", content: userMessage });

    // Appeler l'API OpenAI avec l'historique complet
    const reply = await callOpenAI(conversations[userId]);

    // Ajouter la réponse de l'assistant à l'historique
    conversations[userId].push({ role: "assistant", content: reply });

    console.log(`Réponse générée (${userId}) :`, reply);
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
