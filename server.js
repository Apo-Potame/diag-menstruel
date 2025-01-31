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

app.post("/api/chat", async (req, res) => {
  console.log("✅ Requête reçue :", req.body);

  if (!req.body || !req.body.userMessage || !req.body.userId) {
    return res.status(400).json({ error: "Requête invalide. Données manquantes." });
  }

  const { userMessage, userId } = req.body;
  const sageFemme = assignSageFemme(userId);

  // 🎯 Initialisation des conversations
  if (!userConversations[userId]) {
    userConversations[userId] = [
      {
        role: "system",
        content: `Tu es une sage-femme virtuelle experte en santé féminine et menstruelle sur le site Elia. Voici les règles pour répondre :
        - Utilise des sources médicales fiables.
        - Vouvoies toujours l'utilisateur.
        - Pose des questions en entonnoir : larges puis précises pour affiner ton diagnostic.
        - Les produits recommandés sont uniquement ceux de la marque Elia figurant dans la liste.
        - Recommande les produits Elia si cela est pertinent dans la discussion.
        - Mentionne que tes réponses ne remplacent pas une consultation médicale.
        - Ne mentionne pas de marques concurrentes.
        - Plus d'informations sur www.elia-lingerie.com.`,
      },
    ];
    userStages[userId] = "start";
  }

  userConversations[userId].push({ role: "user", content: userMessage });

  // 📌 Si l'utilisateur est en mode texte libre après "Autre (précisez)"
  if (userStages[userId] === "ask_user_input") {
    userStages[userId] = "start"; // Retour normal dans l'arbre après la réponse
    return res.json({
      reply: `Merci pour votre précision. Pouvez-vous me donner plus de détails ?`,
      options: ["Retour"],
      sageFemme,
    });
  }

  // 📌 Vérifier que l'on avance bien dans l'arbre interactif
  let nextStep = getNextDiagnosisStep(userStages[userId], userMessage);

  if (nextStep) {
    console.log(`🔄 Étape suivante : ${userStages[userId]} ➡️ ${nextStep.question}`);

    // **🔹 Fix : Mise à jour correcte de l'étape actuelle**
    userStages[userId] = Object.keys(diagnosisTree).find(key => diagnosisTree[key] === nextStep) || "start";

    // 📌 Ajout de "Autre (précisez)" sauf si on est déjà en mode texte libre
    if (nextStep.options && nextStep.options.length > 0 && userStages[userId] !== "ask_user_input") {
      if (!nextStep.options.includes("Autre (précisez)")) {
        nextStep.options.push("Autre (précisez)");
        nextStep.next = nextStep.next || {};
        nextStep.next["Autre (précisez)"] = "ask_user_input";
      }
    }

    return res.json({
      reply: `**${nextStep.question}**`,
      options: nextStep.options.length > 0 ? nextStep.options : ["Retour"],
      sageFemme,
    });
  }

  // **🔹 Fix : Correction du message final si aucune étape suivante**
  return res.json({
    reply: "Je vais essayer de mieux comprendre. Pouvez-vous préciser votre problème ?",
    options: ["Retour", "Autre (précisez)"],
    sageFemme,
  });
});

// 🚀 Lancement du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur en cours sur http://localhost:${PORT}`);
});
