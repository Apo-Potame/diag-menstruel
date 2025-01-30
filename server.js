const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();
const { diagnosisTree, getNextDiagnosisStep } = require('./diagnosisTree'); // Importation correcte

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const userConversations = {};
const userStages = {};
const userSageFemme = {};

const sageFemmeImages = {
  Anne: "https://cdn.shopify.com/s/files/1/0045/2244/2786/files/sage-femme-anne-web.png?v=1738228119",
  Louisa: "https://cdn.shopify.com/s/files/1/0045/2244/2786/files/sage-femme-louisa-web.png?v=1738228119",
};

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

app.post('/api/chat', async (req, res) => {
  console.log("Requête reçue :", req.body);

  if (!req.body || !req.body.userMessage || !req.body.userId) {
    return res.status(400).json({ error: "Requête invalide. Données manquantes." });
  }

  const { userMessage, userId } = req.body;

  try {
    const sageFemme = assignSageFemme(userId);

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
            - Tu peux trouver plus d'informations sur le site www.elia-lingerie.com
` },
      ];
      userStages[userId] = "start";
    }

    userConversations[userId].push({ role: "user", content: userMessage });

    let nextStep = getNextDiagnosisStep(userStages[userId], userMessage);
    
    // Ajouter toujours "Autre (précisez)" sauf si on est déjà dans la saisie libre
    if (nextStep && nextStep.options.length > 0 && nextStep !== diagnosisTree.ask_user_input) {
      nextStep.options.push("Autre (précisez)");
      nextStep.next["Autre (précisez)"] = "ask_user_input";
    }

    if (nextStep) {
      userStages[userId] = Object.keys(diagnosisTree).find(key => diagnosisTree[key] === nextStep) || "start";

      return res.json({
        reply: `**${nextStep.question}**`,
        options: nextStep.options.length > 0 ? nextStep.options : ["Retour"],
        sageFemme,
      });
    }

    return res.json({
      reply: "Je vais essayer de mieux comprendre. Pouvez-vous préciser votre problème ?",
      options: ["Retour", "Autre (précisez)"],
      sageFemme,
    });

  } catch (error) {
    console.error("Erreur serveur :", error);
    return res.status(500).json({ error: "Erreur serveur.", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur en cours sur http://localhost:${PORT}`);
});
