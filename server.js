const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Servir les fichiers statiques depuis le dossier "public"
app.use(express.static(path.join(__dirname, 'public')));

// Stocker les conversations, l'état du diagnostic et la sage-femme assignée
const userConversations = {};
const userStages = {};
const userSageFemme = {};
const MAX_HISTORY_LENGTH = 20;

// URLs des images des sage-femmes
const sageFemmeImages = {
  Anne: "https://cdn.shopify.com/s/files/1/0045/2244/2786/files/sage-femme-anne-web.png?v=1738228119",
  Louisa: "https://cdn.shopify.com/s/files/1/0045/2244/2786/files/sage-femme-louisa-web.png?v=1738228119",
};

// Fonction pour attribuer une sage-femme aléatoire
function assignSageFemme(userId) {
  if (!userSageFemme[userId]) {
    const sageFemmes = Object.keys(sageFemmeImages);
    const randomSageFemme = sageFemmes[Math.floor(Math.random() * sageFemmes.length)];
    userSageFemme[userId] = {
      name: randomSageFemme,
      imageUrl: sageFemmeImages[randomSageFemme],
    };
  }
  return userSageFemme[userId];
}

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
            url: `https://${SHOPIFY_STORE_URL}/products/${p.handle}`,
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
    assignSageFemme(userId);

    // Initialisation de l'historique
    if (!userConversations[userId]) {
      userConversations[userId] = [
        { role: "system", content: `Tu es une sage-femme virtuelle experte en santé féminine et menstruelle sur le site Elia. Tu connais parfaitement les produits de la marque Elia. Tu es soit Anne, soit Louisa, une sage-femme, et tu restes la même tout au long de la conversation. Voici les règles pour répondre :
            - Utilise des sources médicales fiables.
            - Vouvoies toujours l'utilisateur.
            - Pose des questions en entonnoir : larges puis précises pour affiner ton diagnostic.
            - Les produits recommandés sont uniquement les produits Elia existants qui font partie du catalogue Shopify.
            - Ne propose pas de maillots de bain sauf si cela est explicitement demandé.
            - Mentionne que tes réponses sont une aide et ne remplacent pas une consultation médicale.
            - Ne mentionne pas de marques concurrentes.
            - Elia est une marque française écoresponsable de culottes menstruelles en coton bio, certifiées Oeko-Tex.
            - Plus d'infos sur www.elia-lingerie.com.` },
      ];
      userStages[userId] = "start";
    }

    userConversations[userId].push({ role: "user", content: userMessage });

    // Vérification du diagnostic
    const nextStep = getNextDiagnosisStep(userId, userMessage);
    if (nextStep) {
      return res.json({
        reply: `**${nextStep.question}**`,
        options: nextStep.options,
        sageFemme: userSageFemme[userId],
      });
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

    return res.json({ reply, sageFemme: userSageFemme[userId] });
  } catch (error) {
    return res.status(500).json({ error: "Erreur serveur.", details: error.message });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours sur http://localhost:${PORT}`);
});
