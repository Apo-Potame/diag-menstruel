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

  // 📌 Gestion du mode "Autre (précisez)"
  if (userStages[userId] === "ask_user_input") {
    console.log("🟡 [DEBUG] Mode saisie libre activé.");
    userStages[userId] = "start";
    return res.json({ reply: "Merci pour votre précision. Pouvez-vous me donner plus de détails ?", options: ["Retour"], sageFemme });
  }

  // 📌 Vérifier l'étape suivante dans l'arbre interactif
  let nextStep = getNextDiagnosisStep(userStages[userId], userMessage);

  if (!nextStep) {
    console.log("⚠️ [DEBUG] Aucune correspondance directe, tentative de correspondance alternative...");

    // 🔎 Vérifier si l'input de l'utilisateur correspond à une option dans l'arbre
    const lowerMessage = userMessage.toLowerCase();
    let foundKey = null;

    for (let key in diagnosisTree) {
      if (diagnosisTree[key].options && diagnosisTree[key].options.some(opt => opt.toLowerCase() === lowerMessage)) {
        foundKey = key;
        break;
      }
    }

    if (foundKey) {
      console.log(`✅ [DEBUG] Correspondance trouvée : ${foundKey}`);
      nextStep = diagnosisTree[foundKey];
      userStages[userId] = foundKey; // 🔹 **Mise à jour correcte de l'état**
    } else {
      console.log("⛔ [DEBUG] Aucune correspondance trouvée.");
    }
  } else {
    console.log(`🔍 [DEBUG] Étape suivante trouvée : ${nextStep.question}`);
    userStages[userId] = Object.keys(diagnosisTree).find(key => diagnosisTree[key] === nextStep) || "start";
  }

  // 📌 Vérification que l'état a bien changé
  console.log(`✅ [DEBUG] Nouvel état de l'utilisateur : ${userStages[userId]}`);

  // 📌 Ajout de "Autre (précisez)" si ce n'est pas déjà le cas
  if (nextStep && nextStep.options && nextStep.options.length > 0 && userStages[userId] !== "ask_user_input") {
    if (!nextStep.options.includes("Autre (précisez)")) {
      nextStep.options.push("Autre (précisez)");
      nextStep.next = nextStep.next || {};
      nextStep.next["Autre (précisez)"] = "ask_user_input";
    }
  }

  // 📌 Envoi de la réponse
  if (nextStep) {
    return res.json({ reply: `**${nextStep.question}**`, options: nextStep.options, sageFemme });
  }

  // 🚨 Si aucune correspondance trouvée, retour à l'utilisateur
  console.log("⚠️ [DEBUG] Réponse par défaut envoyée.");
  return res.json({ reply: "Je vais essayer de mieux comprendre. Pouvez-vous préciser votre problème ?", options: ["Retour", "Autre (précisez)"], sageFemme });
});

// 🚀 Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur en cours sur http://localhost:${PORT}`);
});
