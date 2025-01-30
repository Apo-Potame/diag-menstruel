// diagnosisTree.js

const diagnosisTree = {
  start: {
    question: "Quel est votre principal souci ?",
    options: ["Règles douloureuses", "Flux abondant", "Absence de règles", "Grossesse et postpartum", "Autre souci gynécologique", "Autre (précisez)"],
    next: {
      "Règles douloureuses": "pain",
      "Flux abondant": "heavy_flow",
      "Absence de règles": "no_period",
      "Grossesse et postpartum": "pregnancy",
      "Autre souci gynécologique": "other_issue",
      "Autre (précisez)": "ask_user_input",
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
      "Toujours eu un flux abondant": "chronic_heavy_flow",
      "Depuis quelques mois": "recent_heavy_flow",
      "Depuis un accouchement": "postpartum_heavy_flow",
      "Autre (précisez)": "ask_user_input",
    },
  },
  pregnancy: {
    question: "Avez-vous des préoccupations spécifiques concernant votre grossesse ou votre postpartum ?",
    options: ["Calcul de la date d'accouchement", "Suivi médical", "Symptômes inhabituels", "Allaitement", "Autre (précisez)"],
    next: {
      "Calcul de la date d'accouchement": "due_date",
      "Suivi médical": "pregnancy_followup",
      "Symptômes inhabituels": "pregnancy_symptoms",
      "Allaitement": "breastfeeding_support",
      "Autre (précisez)": "ask_user_input",
    },
  },
  other_issue: {
    question: "Pouvez-vous préciser votre problème gynécologique ?",
    options: ["Douleurs pelviennes", "Saignements anormaux", "Infections fréquentes", "Autre (précisez)"],
    next: {
      "Douleurs pelviennes": "pelvic_pain",
      "Saignements anormaux": "abnormal_bleeding",
      "Infections fréquentes": "frequent_infections",
      "Autre (précisez)": "ask_user_input",
    },
  },
  breastfeeding_support: {
    question: "Avez-vous des questions spécifiques sur l’allaitement ?",
    options: ["Douleur lors de l'allaitement", "Quantité de lait insuffisante", "Position d'allaitement", "Sevrage", "Autre (précisez)"],
    next: {
      "Douleur lors de l'allaitement": "breastfeeding_pain",
      "Quantité de lait insuffisante": "low_milk_supply",
      "Position d'allaitement": "breastfeeding_positions",
      "Sevrage": "weaning_info",
      "Autre (précisez)": "ask_user_input",
    },
  },
  ask_user_input: {
    question: "Pouvez-vous préciser votre situation en quelques mots ?",
    options: ["Retour"],
  },
};

// Fonction pour obtenir l'étape suivante
function getNextDiagnosisStep(userStage, userChoice) {
  if (!userStage || userStage === "start") {
    return diagnosisTree.start;
  }

  const currentStep = diagnosisTree[userStage];

  if (currentStep && currentStep.next && currentStep.next[userChoice]) {
    return diagnosisTree[currentStep.next[userChoice]];
  }

  return diagnosisTree.ask_user_input;
}

module.exports = { diagnosisTree, getNextDiagnosisStep };
