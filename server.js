const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
require("dotenv").config();
const { diagnosisTree, getNextDiagnosisStep } = require("./diagnosisTree");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const userConversations = {};
const userStages = {};
const userSageFemme = {};

const sageFemmeImages = {
  Anne: "https://cdn.shopify.com/s/files/1/0045/2244/2786/files/sage-femme-anne-web.png?v=1738228119",
  Louisa: "https://cdn.shopify.com/s/files/1/0045/2244/2786/files/sage-femme-louisa-web.png?v=1738228119",
};

// 📌 Attribuer une sage-femme aléatoire
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

app.post("/api/chat", async (req, res) => {
  console.log("\n✅ [DEBUG] Nouvelle requête reçue :", req.body);

  if (!req.body || !req.body.userMessage || !req.body.userId) {
    return res.status(400).json({ error: "Requête invalide. Données manquantes." });
  }

  const { userMessage, userId } = req.body;
  const sageFemme = assignSageFemme(userId);

  // 🎯 Initialisation des conversations
  if (!userConversations[userId]) {
    userConversations[userId] = [{ role: "system", content: "Bienvenue dans le chat." }];
    userStages[userId] = "start";
  }

  userConversations[userId].push({ role: "user", content: userMessage });

  console.log(`🔄 [DEBUG] État actuel de l'utilisateur (${userId}) : ${userStages[userId]}`);
  console.log(`📝 [DEBUG] Message reçu : "${userMessage}"`);

  // 📌 Vérifier l'étape suivante dans l'arbre interactif
  let nextStepKey = getNextDiagnosisStep(userStages[userId], userMessage);

  if (!nextStepKey) {
    console.log("⚠️ [DEBUG] Aucune correspondance directe, tentative de correspondance alternative...");

    // 🔎 Vérifier si l'input de l'utilisateur correspond à une option dans l'arbre
    const lowerMessage = userMessage.toLowerCase();
    for (let key in diagnosisTree) {
      if (diagnosisTree[key].options && diagnosisTree[key].options.some(opt => opt.toLowerCase() === lowerMessage)) {
        nextStepKey = key;
        break;
      }
    }

    if (!nextStepKey) {
      console.log("⛔ [DEBUG] Aucune correspondance trouvée.");
      return res.json({ reply: "Je ne suis pas sûre de comprendre, pouvez-vous reformuler ?", options: ["Retour", "Autre (précisez)"], sageFemme });
    }
  }

  // 📌 Mettre à jour l'état utilisateur
  console.log(`🔍 [DEBUG] Étape suivante trouvée : ${nextStepKey}`);
  userStages[userId] = nextStepKey;

  const nextStep = diagnosisTree[nextStepKey];

  // 📌 Ajout de "Autre (précisez)" si ce n'est pas déjà le cas
  if (nextStep.options && nextStep.options.length > 0) {
    if (!nextStep.options.includes("Autre (précisez)")) {
      nextStep.options.push("Autre (précisez)");
      nextStep.next = nextStep.next || {};
      nextStep.next["Autre (précisez)"] = "ask_user_input";
    }
  }

  // 📌 Envoi de la réponse
  return res.json({ reply: `**${nextStep.question}**`, options: nextStep.options, sageFemme });
});

// 🚀 Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur en cours sur http://localhost:${PORT}`);
});
