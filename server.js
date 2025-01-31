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

// 📌 Fonction pour attribuer une sage-femme aléatoire
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

// 📌 Correspondance avec des mots-clés pour gérer les réponses libres
function findMatchingStep(userInput) {
  const cleanedInput = userInput.toLowerCase().trim();

  const keywords = {
    "règles douloureuses": "pain",
    "douleurs menstruelles": "pain",
    "spm": "pms_info",
    "syndrome prémenstruel": "pms_info",
    "flux abondant": "heavy_flow",
    "règles abondantes": "heavy_flow",
    "absence de règles": "no_period",
    "retard de règles": "no_period",
    "grossesse": "pregnancy",
    "post-partum": "pregnancy",
    "allaitement": "breastfeeding",
    "autre souci gynécologique": "other_issue",
    "douleurs pelviennes": "pelvic_pain",
    "saignements anormaux": "abnormal_bleeding",
    "infections fréquentes": "recurring_infections"
  };

  for (let key in keywords) {
    if (cleanedInput.includes(key)) {
      return keywords[key];
    }
  }

  return null;
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

  // 📌 Vérifier si l'utilisateur est en mode texte libre après "Autre (précisez)"
  if (userStages[userId] === "ask_user_input") {
    console.log("🔄 [DEBUG] Mode saisie libre détecté.");
    userStages[userId] = "start"; // Revenir à l'état normal après la saisie libre
    return res.json({
      reply: "Merci pour cette précision. Pouvez-vous me donner plus de détails ?",
      options: ["Retour"],
      sageFemme,
    });
  }

  // 📌 Vérifier l'étape suivante dans l'arbre interactif
  let nextStepKey = getNextDiagnosisStep(userStages[userId], userMessage);

  // 🔍 Si aucune étape n'est trouvée, essayer une correspondance alternative
  if (!nextStepKey || !diagnosisTree[nextStepKey]) {
    console.log("⚠️ [DEBUG] Étape suivante non trouvée, tentative de correspondance alternative...");
    nextStepKey = findMatchingStep(userMessage);
  }

  if (!nextStepKey || !diagnosisTree[nextStepKey]) {
    console.log("⛔ [DEBUG] Aucune correspondance trouvée, retour à une question générale.");
    return res.json({
      reply: "Je ne suis pas sûre de comprendre, pouvez-vous reformuler ?",
      options: ["Retour", "Autre (précisez)"],
      sageFemme,
    });
  }

  console.log(`🔍 [DEBUG] Étape suivante trouvée : ${nextStepKey}`);
  userStages[userId] = nextStepKey; // ✅ Mise à jour correcte de l'état de l'utilisateur

  const nextStep = diagnosisTree[nextStepKey];

  // 📌 Ajout de "Autre (précisez)" pour permettre la saisie libre
  if (nextStep.options && nextStep.options.length > 0) {
    if (!nextStep.options.includes("Autre (précisez)")) {
      nextStep.options.push("Autre (précisez)");
      nextStep.next = nextStep.next || {};
      nextStep.next["Autre (précisez)"] = "ask_user_input";
    }
  }

  // 📌 Envoi de la réponse
  return res.json({
    reply: `**${nextStep.question}**`,
    options: nextStep.options.length > 0 ? nextStep.options : ["Retour"],
    sageFemme,
  });
});

// 🚀 Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur en cours sur http://localhost:${PORT}`);
});
