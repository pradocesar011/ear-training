import { supabase } from '../lib/supabase.js'

export function useSurveySubmit() {
  async function submitSurvey(userId, surveyData) {
    if (!userId) return
    try {
      await supabase.from('onboarding_surveys').insert({
        user_id:             userId,
        has_formal_training: surveyData.hasFormalTraining,
        training_years:      surveyData.hasFormalTraining ? surveyData.trainingYears : null,
        plays_instrument:    surveyData.playsInstrument,
        main_instrument:     surveyData.playsInstrument ? surveyData.mainInstrument : null,
        practiced_dictation: surveyData.practicedDictation,
        age_range:           surveyData.ageRange,
        main_goal:           surveyData.mainGoal,
      })
    } catch {
      // Survey is non-critical — ignore errors
    }
  }

  return { submitSurvey }
}
