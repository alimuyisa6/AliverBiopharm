import { useState, useCallback, useRef } from 'react';
import { saveQuizResult } from '@services/databaseService';
import useAuth from './useAuth';

const useQuiz = (questions, timeLimit = 600) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef(null);

  const startQuiz = useCallback(() => {
    setIsActive(true);
    setCurrentIndex(0);
    setAnswers({});
    setScore(null);
    setSubmitted(false);
    setTimeRemaining(timeLimit);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timeLimit]);

  const answerQuestion = useCallback((questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const next = () => { if (currentIndex < questions.length - 1) setCurrentIndex((p) => p + 1); };
  const prev = () => { if (currentIndex > 0) setCurrentIndex((p) => p - 1); };

  const submitQuiz = useCallback(async () => {
    clearInterval(timerRef.current);
    setIsActive(false);
    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });
    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);
    setSubmitted(true);
    if (user) {
      await saveQuizResult(user.id, {
        score: finalScore,
        total_questions: questions.length,
        correct_answers: correct,
        answers,
        time_taken: timeLimit - timeRemaining,
      });
    }
  }, [questions, answers, timeLimit, timeRemaining, user]);

  const resetQuiz = useCallback(() => {
    clearInterval(timerRef.current);
    setIsActive(false);
    setCurrentIndex(0);
    setAnswers({});
    setScore(null);
    setSubmitted(false);
    setTimeRemaining(timeLimit);
  }, [timeLimit]);

  return {
    currentQuestionIndex: currentIndex,
    currentQuestion: questions[currentIndex],
    answers,
    score,
    isSubmitted: submitted,
    timeRemaining,
    isActive,
    totalQuestions: questions.length,
    startQuiz,
    answerQuestion,
    nextQuestion: next,
    prevQuestion: prev,
    submitQuiz,
    resetQuiz,
    hasAnswered: (qId) => qId in answers,
    getAnswer: (qId) => answers[qId],
  };
};

export default useQuiz;
