const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Stocker les historiques des conversations et l'état de progression
const userConversations = {};
const userStages = {};
const MAX_HISTORY_LENGTH = 20; // Limite de l'historique à 20 messages utilisateur

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

// Fonction pour récupérer les produits depuis Shopify avec pagination
async function fetchShopifyProducts() {
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;

  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    throw new Error("Les variables d'environnement Shopify ne sont pas configurées.");
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
      const errorDetails = await response.json();
      throw new Error(`Erreur API Shopify: ${JSON.stringify(errorDetails)}`);
    }

    const data = await response.json();
    if (data.products && data.products.length > 0) {
      products = products.concat(
        data.products
          .filter(product => product.published_at)
          .map(product => {
            const fullDescription = product.body_html.replace(/<[^>]*>/g, '');
            const fluxSentence = fullDescription.match(/[^.]*flux[^.]*\./i);
            const fluxInfo = fluxSentence ? fluxSentence[0].trim() : "Flux non spécifié";
            const shortDescription = fullDescription.slice(0, 300);

            return {
              name: product.title,
              description: `${shortDescription} ${fluxInfo}`,
              url: `https://${SHOPIFY_STORE_URL}/products/${product.handle}`,
            };
          })
      );
    }

    const linkHeader = response.headers.get('link');
    nextPageUrl = linkHeader?.includes('rel="next"')
      ? linkHeader.match(/<([^>]+)>;\s*rel="next"/)?.[1]
      : null;
  }

  return products;
}

// Arbre des questions interactives pour le diagnostic
const diagnosisTree = {
  start: {
    question: "Quel est votre principal souci en ce moment ?",
    options: [
      "Règles douloureuses",
      "Flux menstruel abondant",
      "Absence de règles",
      "Grossesse ou post-partum",
      "Autre souci gynécologique",
    ],
    next: {
      "Règles douloureuses": "pain",
      "Flux menstruel abondant": "heavy_flow",
      "Absence de règles": "no_period",
      "Grossesse ou post-partum": "pregnancy",
      "Autre souci gynécologique": "other_issue",
    },
  },
  pain: {
    question: "Vos douleurs sont-elles associées à un des cas suivants ?",
    options: ["Endométriose", "Syndrome prémenstruel", "Douleur inexpliquée", "Autre"],
    next: { "Endométriose": "endometriosis", "Syndrome prémenstruel": "pms", "Douleur inexpliquée": "other_pain" },
  },
  heavy_flow: {
    question: "Depuis combien de temps avez-vous un flux abondant ?",
    options: ["Toujours eu un flux abondant", "Depuis quelques mois", "Depuis un accouchement"],
  },
};

// Fonction pour gérer la navigation dans le diagnostic
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
  const userMessage = req.body.userMessage;
  const userId = req.body.userId;

  if (!userMessage || !userId) {
    return res.status(400).json({ error: "Le message utilisateur ou l'ID utilisateur est vide." });
  }

  try {
    if (!userConversations[userId]) {
      userConversations[userId] = [
        { role: "system", content: `Tu es une sage-femme virtuelle experte en santé féminine.` },
      ];
      userStages[userId] = "start"; // Initialisation de l'état de diagnostic
    }

    userConversations[userId].push({ role: "user", content: userMessage });

    const nextStep = getNextDiagnosisStep(userId, userMessage);

    if (nextStep) {
      return res.json({
        reply: `**${nextStep.question}**`,
        options: nextStep.options,
      });
    }

    const messagesToSend = [
      userConversations[userId][0],
      ...userConversations[userId].filter(msg => msg.role === "user").slice(-MAX_HISTORY_LENGTH),
      { role: "system", content: `Date du jour : ${getCurrentDate()}` },
    ];

    const reply = await callOpenAI(messagesToSend);
    userConversations[userId].push({ role: "assistant", content: reply });

    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({ error: "Erreur du serveur.", details: error.message });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur en cours sur http://localhost:${PORT}`);
});
