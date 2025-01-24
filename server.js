const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; // Utilisation de la variable d'environnement pour le port si disponible

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

  // Vérification si le message utilisateur est vide
  if (!userMessage) {
    return res.status(400).json({ error: "Le message utilisateur est vide." });
  }

  try {
    // Envoi de la requête à l'API OpenAI avec le modèle gpt-3.5-turbo
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, // Utilisation de la clé API depuis le fichier .env
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Modèle utilisé
        messages: [
          {
            role: "system",
            content: "Tu es une sage-femme virtuelle experte en santé féminine et menstruelle. Réponds de manière claire et rassurante."
          },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500 // Nombre maximum de tokens dans la réponse
      }),
    });

    // Lecture de la réponse de l'API
    const data = await response.json();

    // Gestion des erreurs spécifiques à l'API OpenAI
    if (response.status !== 200 || data.error) {
      console.error("Erreur API OpenAI :", data.error || data);
      return res.status(500).json({
        error: "Erreur avec l'API OpenAI.",
        details: data.error || "Réponse invalide de l'API."
      });
    }

    // Envoi de la réponse au frontend
    res.json({ reply: data.choices[0].message.content });
  } 
  
  catch (error) {
    // Gestion des erreurs réseau ou de serveur
    console.error("Erreur API OpenAI :", error.message || error);
    res.status(500).json({
      error: "Erreur du serveur.",
      details: error.message || "Une erreur inattendue est survenue."
    });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
