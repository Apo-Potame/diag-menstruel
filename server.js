const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Stocker les conversations et l'état du diagnostic
const userConversations = {};
const userStages = {};
const MAX_HISTORY_LENGTH = 20;

// Middleware pour traiter les requêtes JSON et ajouter des headers CORS
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Fonction pour récupérer la date du jour
function getCurrentDate() {
  return new Date().toLocaleDateString("fr-FR");
}

// Fonction pour récupérer les produits Shopify
async function fetchShopifyProducts() {
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;

  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    throw new Error("Variables d'environnement Shopify non configurées.");
  }

  let products = [];
  let nextPageUrl = `https://${SHOPIFY_STORE_URL}/admin/api/2023-01/products.json?limit=50`;

  while (nextPageUrl) {
    const response = await fetch(nextPageUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur API Shopify: ${await response.text()}`);
    }

    const data = await response.json();
    if (data.products) {
      products = products.concat(
        data.products
          .filter(p => p.published_at)
          .map(p => ({
            name: p.title,
            description: p.body_html.replace(/<[^>]*>/g, '').slice(0, 300),
            url: `https://${SHOPIFY_STORE_URL}/products/${p.handle}`
          }))
      );
    }

    nextPageUrl = null; // Pas de pagination pour simplifier
  }

  return products;
}

// Arbre de diagnostic interactif
const diagnosisTree = {
  start: {
    question: "Quel est votre principal souci ?",
    options: ["Règles douloureuses", "Flux abondant", "Absence de règles", "Grossesse", "Autre"],
    next: {
      "Règles douloureuses": "pain",
      "Flux abondant": "heavy_flow",
      "Absence de règles": "no_period",
      "Grossesse": "pregnancy",
      "Autre": "other_issue",
    },
  },
  heavy_flow: {
    question: "Quels symptômes avez-vous en plus du flux abondant ?",
    options: ["Douleurs intenses", "Caillots sanguins", "Fatigue", "Aucun autre symptôme"],
  },
  pregnancy: {
    question: "Souhaitez-vous un calcul de votre stade de grossesse ?",
    options: ["Oui", "Non"],
  },
};

// Fonction pour gérer les étapes de diagnostic
function getNextDiagnosisStep(userId, userChoice) {
  if (!userStages[userId]) {
    userStages[userId] = "start";
  }

  const currentStep = diagnosisTree[userStages[userId]];
  if (currentStep.next && currentStep.next[userChoice]) {
    userStages[userId] = currentStep.next[userChoice];
    return diagnosisTree[userStages[userId]];
  }

  return null;
}

// Route pour le chatbot
app.post('/api/chat', async (req, res) => {
  const { userMessage, userId } = req.body;

  if (!userMessage || !userId) {
    return res.status(400).json({ error: "Message utilisateur ou ID vide." });
  }

  try {
    // Initialisation de l'historique
    if (!userConversations[userId]) {
      userConversations[userId] = [
        { role: "system", content: `Tu es une sage-femme virtuelle experte en santé féminine et menstruelle sur le site Elia. Tu connais parfaitement les produits de la marque Elia. Voici les règles pour répondre :
            - Utilise des sources médicales fiables.
            - Vouvoies toujours l'utilisateur.
            - sauf question précise de l'utilisateur, essaye de diagnostiquer son affection gynécologique ou du cycle menstruel.
            - Pose des questions en entonnoir : larges puis précises pour affiner ton diagnostic.
            - les produits recommandés sont uniquement les produits Elia existants qui font partie de la liste.
            - Recommande les produits Elia si cela est opportun dans la discussion.
            - Ne propose pas de maillots de bain sauf si cela est explicitement demandé.
            - Propose plusieurs produits menstruels si plusieurs options sont pertinentes et demande de préciser le besoin pour affiner la réponse.
            - Ne considère jamais la conversation comme terminée sauf si l'utilisateur le précise.
            - Mentionne à la fin de chaque discussion que tes réponses sont une aide et ne remplacent pas une consultation médicale.
            - ne mentionne pas de marques concurrentes
            - Elia est une marque française écoresponsable de culottes menstruelles en coton bio, certifiées Oeko-Tex
            - Tu peux trouver plus d'informations sur le site www.elia-lingerie.com` }
      ];
      userStages[userId] = "start";
    }

    userConversations[userId].push({ role: "user", content: userMessage });

    // Vérification du diagnostic
    const nextStep = getNextDiagnosisStep(userId, userMessage);
    if (nextStep) {
      return res.json({ reply: `**${nextStep.question}**`, options: nextStep.options });
    }

    // Recherche des produits Elia
    const products = await fetchShopifyProducts();
    const relevantProducts = products.filter(product =>
      userMessage.toLowerCase().includes(product.name.toLowerCase())
    );

    let productResponse = "";
    if (relevantProducts.length > 0) {
      productResponse = relevantProducts
        .map(p => `✅ <a href="${p.url}" target="_blank">${p.name}</a>: ${p.description}`)
        .join("<br>");
    }

    const reply = productResponse || "Je ne suis pas sûre de bien comprendre, pouvez-vous préciser ?";

    userConversations[userId].push({ role: "assistant", content: reply });

    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({ error: "Erreur serveur.", details: error.message });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours sur http://localhost:${PORT}`);
});
