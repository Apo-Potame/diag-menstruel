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
    options: ["Endométriose", "Syndrome prémenstruel", "Douleur inexpliquée", "Autre (précisez)"],
    next: {
      "Endométriose": "endometriosis",
      "Syndrome prémenstruel": "pms",
      "Douleur inexpliquée": "other_pain",
      "Autre (précisez)": null,
    },
  },
  heavy_flow: {
    question: "Depuis combien de temps avez-vous un flux abondant ?",
    options: ["Toujours eu un flux abondant", "Depuis quelques mois", "Depuis un accouchement", "Autre (précisez)"],
    next: {
      "Toujours eu un flux abondant": "chronic_heavy_flow",
      "Depuis quelques mois": "recent_heavy_flow",
      "Depuis un accouchement": "postpartum_heavy_flow",
      "Autre (précisez)": null,
    },
  },
  pregnancy: {
    question: "Souhaitez-vous un calcul de votre stade de grossesse ?",
    options: ["Oui", "Non"],
    next: {
      "Oui": "pregnancy_stage",
      "Non": null,
    },
  },
  other_issue: {
    question: "Pouvez-vous préciser votre problème gynécologique ?",
    options: ["Douleurs pelviennes", "Saignements anormaux", "Infections fréquentes", "Autre (précisez)"],
    next: {
      "Douleurs pelviennes": "pelvic_pain",
      "Saignements anormaux": "abnormal_bleeding",
      "Infections fréquentes": "frequent_infections",
      "Autre (précisez)": null,
    },
  },
};

// Fonction pour récupérer l'étape suivante en fonction de la réponse de l'utilisateur
function getNextDiagnosisStep(userStage, userChoice) {
  const currentStep = diagnosisTree[userStage];

  if (!currentStep) return null;

  const nextStepKey = currentStep.next ? currentStep.next[userChoice] : null;

  if (nextStepKey && diagnosisTree[nextStepKey]) {
    return {
      nextStage: nextStepKey,
      question: diagnosisTree[nextStepKey].question,
      options: diagnosisTree[nextStepKey].options,
    };
  }

  return null; // Si l'option n'a pas de suite (comme "Autre (précisez)")
}

module.exports = { diagnosisTree, getNextDiagnosisStep };
