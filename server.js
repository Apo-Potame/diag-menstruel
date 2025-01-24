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

  if (!data.choices || data.choices.length === 0) {
    throw new Error("Aucune réponse générée par l'API OpenAI.");
  }

  return data.choices[0].message.content;
}

// Fonction pour récupérer les produits depuis Shopify
async function fetchShopifyProducts() {
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;

  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    throw new Error("Les variables d'environnement Shopify ne sont pas configurées.");
  }

  const url = `https://${SHOPIFY_STORE_URL}/admin/api/2023-01/products.json`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
  });

  const data = await response.json();

  if (!response.ok || data.errors) {
    throw new Error(`Erreur API Shopify: ${data.errors || response.statusText}`);
  }

  return data.products.map(product => ({
    name: product.title,
    url: `https://${SHOPIFY_STORE_URL}/products/${product.handle}`,
  }));
}

// Servir l'interface HTML
const path = require('path');
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Route pour le chatbot
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.userMessage;
  const userId = req.body.userId;

  if (!userMessage || !userId) {
    console.error("Erreur : Le message utilisateur ou l'ID utilisateur est vide.");
    return res.status(400).json({ error: "Le message utilisateur ou l'ID utilisateur est vide." });
  }

  try {
    console.log(`Message utilisateur reçu [${userId}] :`, userMessage);

    // Récupération des produits Shopify
    const products = await fetchShopifyProducts();

    // Préparation des informations des produits pour le contexte du chatbot
    const productContext = products.map(p => `${p.name}: ${p.url}`).join("\n");

    // Appel à OpenAI avec un contexte spécifique pour Elia
    const reply = await callOpenAI([
      {
        role: "system",
        content: `Tu es une sage-femme virtuelle experte en santé féminine et menstruelle, et tu connais parfaitement les produits de la marque Elia. Voici une liste des produits Elia disponibles : \n${productContext}\nN'invente jamais des produits ou des liens inexistants. Utilise uniquement cette liste pour répondre.`,
      },
      { role: "user", content: userMessage }
    ]);

    console.log(`Réponse générée [${userId}] :`, reply);
    res.json({ reply }); // Envoi de la réponse au frontend
  } catch (error) {
    console.error("Erreur dans le backend :", error.message || error);
    res.status(500).json({
      error: "Erreur du serveur.",
      details: error.message || "Une erreur inattendue est survenue.",
    });
  }
});

// Route de test pour vérifier l'API Shopify
app.get('/test-shopify', async (req, res) => {
  try {
    const products = await fetchShopifyProducts();
    res.json({ products });
  } catch (error) {
    console.error("Erreur lors du test Shopify :", error.message || error);
    res.status(500).json({
      error: "Erreur lors du test Shopify.",
      details: error.message,
    });
  }
});

// Route de test pour vérifier l'API OpenAI
app.get('/test-openai', async (req, res) => {
  try {
    const reply = await callOpenAI([{ role: "user", content: "Test de l'API OpenAI" }], 50);
    res.json({ reply });
  } catch (error) {
    console.error("Erreur lors du test OpenAI :", error.message || error);
    res.status(500).json({
      error: "Erreur lors du test OpenAI.",
      details: error.message,
    });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
