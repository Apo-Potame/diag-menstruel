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

// Stockage des conversations, du diagnostic et de la sage-femme attribuée
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

// Arbre de diagnostic dynamique
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
    options: ["Endométriose", "Syndrome prémenstruel", "Douleur inexpliquée", "Autre (précisez)"],
    next: {
      "Endométriose": "endometriosis_info",
      "Syndrome prémenstruel": "pms_info",
      "Douleur inexpliquée": "other_pain",
      "Autre (précisez)": "ask_user_input",
    },
  },
  heavy_flow: {
    question: "Depuis combien de temps avez-vous un flux abondant ?",
    options: ["Toujours eu un flux abondant", "Depuis quelques mois", "Depuis un accouchement", "Autre (précisez)"],
    next: {
      "Toujours eu un flux abondant": "flux_long_term",
      "Depuis quelques mois": "flux_recent",
      "Depuis un accouchement": "flux_postpartum",
      "Autre (précisez)": "ask_user_input",
    },
  },
  other_issue: {
    question: "Pouvez-vous préciser votre problème gynécologique ?",
    options: ["Douleurs pelviennes", "Saignements anormaux", "Infections fréquentes", "Autre (précisez)"],
    next: {
      "Douleurs pelviennes": "pelvic_pain_info",
      "Saignements anormaux": "bleeding_info",
      "Infections fréquentes": "infection_info",
      "Autre (précisez)": "ask_user_input",
    },
  },
  ask_user_input: {
    question: "Pouvez-vous préciser votre situation en quelques mots ?",
    options: [],
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
    const sageFemme = assignSageFemme(userId);

    // Initialisation des conversations et du diagnostic
    if (!userConversations[userId]) {
      userConversations[userId] = [
        { role: "system", content: `Tu es une sage-femme virtuelle experte en santé féminine. Tu es soit Anne, soit Louisa, et restes la même tout au long de la conversation.` },
      ];
      userStages[userId] = "start";
    }

    userConversations[userId].push({ role: "user", content: userMessage });

    // Vérification du diagnostic et options dynamiques
    const nextStep = getNextDiagnosisStep(userId, userMessage);
    if (nextStep) {
      return res.json({
        reply: `**${nextStep.question}**`,
        options: nextStep.options,
        sageFemme,
      });
    }

    // Gestion de la saisie utilisateur après "Autre (précisez)"
    if (userStages[userId] === "ask_user_input") {
      return res.json({
        reply: "Merci pour cette précision. Pouvez-vous me donner plus de détails ?",
        options: [],
        sageFemme,
      });
    }

    return res.json({
      reply: "Je vais essayer de mieux comprendre. Pouvez-vous préciser votre problème ?",
      options: [],
      sageFemme,
    });

  } catch (error) {
    console.error("Erreur serveur :", error);
    return res.status(500).json({ error: "Erreur serveur.", details: error.message });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur en cours sur http://localhost:${PORT}`);
});
