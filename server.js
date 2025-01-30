const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

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

    nextPageUrl = null;
  }

  return products;
}

// Arbre de diagnostic interactif
const diagnosisTree = {
  start: {
    question: "Quel est votre principal souci ?",
    options: ["Règles douloureuses", "Flux abondant", "Absence de règles", "Grossesse", "Autre souci gynécologique"],
    next: {
      "Règles douloureuses": "pain",
      "Flux abondant": "heavy_flow",
      "Absence de règles": "no_period",
      "Grossesse": "pregnancy",
      "Autre souci gynécologique": "other_issue",
    },
  },
  pain: {
    question: "Vos douleurs sont-elles associées à un des cas suivants ?",
    options: ["Endométriose", "Syndrome prémenstruel", "Douleur inexpliquée", "Autre"],
  },
  heavy_flow: {
    question: "Depuis combien de temps avez-vous un flux abondant ?",
    options: ["Toujours eu un flux abondant", "Depuis quelques mois", "Depuis un accouchement"],
  },
  other_issue: {
    question: "Pouvez-vous préciser votre problème gynécologique ?",
    options: ["Douleurs pelviennes", "Saignements anormaux", "Infections fréquentes", "Autre"],
  },
};

// Fonction pour gérer les étapes de diagnostic
function getNextDiagnosisStep(userId, userChoice) {
  if (!userStages[userId]) {
    userStages[userId] = "start";
  }

  const currentStep = diagnosisTree[userStages[userId]];
  if (currentStep && currentStep.next && currentStep.next[userChoice]) {
    userStages[userId] = currentStep.next[userChoice];
    return diagnosisTree[userStages[userId]];
  }

  return null;
}

// Route pour le chatbot
app.post('/api/chat', async (req, res) => {
  console.log("Requête reçue :", req.body);

  if (!req.body || !req.body.userMessage || !req.body.userId) {
    console.error("Erreur : Corps de la requête invalide", req.body);
    return res.status(400).json({ error: "Requête invalide. Données manquantes." });
  }

  const { userMessage, userId } = req.body;

  try {
    assignSageFemme(userId);

    if (!userConversations[userId]) {
      userConversations[userId] = [
        { role: "system", content: `Tu es une sage-femme virtuelle experte en santé féminine. Tu es soit Anne, soit Louisa, et restes la même tout au long de la conversation.` },
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

    const reply = productResponse || "Je vais essayer de mieux comprendre. Pouvez-vous préciser votre problème ?";

    userConversations[userId].push({ role: "assistant", content: reply });

    return res.json({ reply, sageFemme: userSageFemme[userId] });
  } catch (error) {
    console.error("Erreur serveur :", error);
    return res.status(500).json({ error: "Erreur serveur.", details: error.message });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur en cours sur http://localhost:${PORT}`);
});
