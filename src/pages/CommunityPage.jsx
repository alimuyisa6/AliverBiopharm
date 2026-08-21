/* pages/CommunityPage.jsx */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { getSections } from '../api/sections';
import { getCommunityActivity, submitMood, submitWeeklyChallenge } from '../api/cachedClient';
import { MoodCheckSection } from '../features/mood/MoodCheckSection';
import { CommunitySection } from '../features/community/CommunitySection';

export default function CommunityPage() {
  const { user } = useAuth();
  const { level } = useLayout();
  const [sections, setSections] = useState({});
  const [communityActivity, setCommunityActivity] = useState([]);
  const [moodSelected, setMoodSelected] = useState(null);
  const [moodMessage, setMoodMessage] = useState('');
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [weeklyChallengeAnswer, setWeeklyChallengeAnswer] = useState(null);

  useEffect(() => {
    getSections(level?.id || 'O-Level').then(setSections).catch(() => {});
    getCommunityActivity().then(setCommunityActivity).catch(() => {});
  }, [level]);

  const handleMoodSubmit = useCallback(async () => {
    if (!moodSelected) return;

    try {
      await submitMood(moodSelected, moodMessage);
      setMoodSubmitted(true);
    } catch {}
  }, [moodSelected, moodMessage]);

  const handleWeeklyChallengeSubmit = useCallback(async (index, correct, explanation) => {
    if (!user) return;

    setWeeklyChallengeAnswer({ correct: index === correct, explanation });

    try {
      await submitWeeklyChallenge(new Date().toISOString().slice(0, 10), index);
    } catch {}
  }, [user]);

  return (
    <div className="home-page">
      <MoodCheckSection
        moodSelected={moodSelected}
        moodMessage={moodMessage}
        moodSubmitted={moodSubmitted}
        onMoodSelect={setMoodSelected}
        onMessageChange={setMoodMessage}
        onSubmit={handleMoodSubmit}
      />

      <CommunitySection
        activity={communityActivity}
        weeklyChallenge={sections?.weekly_challenge}
        weeklyChallengeAnswer={weeklyChallengeAnswer}
        onWeeklySubmit={handleWeeklyChallengeSubmit}
      />
    </div>
  );
}
