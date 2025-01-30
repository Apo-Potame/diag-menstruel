// diagnosisTree.js

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
      "Toujours eu un flux abondant": "chronic_heavy_flow",
      "Depuis quelques mois": "recent_heavy_flow",
      "Depuis un accouchement": "postpartum_heavy_flow",
      "Autre (précisez)": "ask_user_input",
    },
  },
  pregnancy: {
    question: "Avez-vous des préoccupations spécifiques concernant votre grossesse ?",
    options: ["Calcul de la date d'accouchement", "Suivi médical", "Symptômes inhabituels", "Autre (précisez)"],
    next: {
      "Calcul de la date d'accouchement": "due_date",
      "Suivi médical": "pregnancy_followup",
      "Symptômes inhabituels": "pregnancy_symptoms",
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
  ask_user_input: {
    question: "Pouvez-vous préciser votre situation en quelques mots ?",
    options: [],
    next: {},
  },
};

// Fonction pour obtenir l'étape suivante
function getNextDiagnosisStep(userStage, userChoice) {
  if (!userStage || userStage === "start") {
    return {
      nextStage: diagnosisTree.start.next[userChoice] || "ask_user_input",
      question: diagnosisTree[userStage]?.question || "Pouvez-vous préciser votre problème ?",
      options: diagnosisTree[userStage]?.options || [],
    };
  }

  const currentStep = diagnosisTree[userStage];

  if (currentStep.next && currentStep.next[userChoice]) {
    return {
      nextStage: currentStep.next[userChoice],
      question: diagnosisTree[currentStep.next[userChoice]].question,
      options: diagnosisTree[currentStep.next[userChoice]].options,
    };
  }

  return {
    nextStage: "ask_user_input",
    question: "Merci pour cette précision. Pouvez-vous donner plus de détails ?",
    options: [],
  };
}

module.exports = { getNextDiagnosisStep };
