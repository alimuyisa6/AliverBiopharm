 import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FlashcardOnboarding from '../components/FlashcardOnboarding';
import FlashcardWelcome from '../components/FlashcardWelcome';
import FlashcardSubjectSelect from '../components/FlashcardSubjectSelect';
import FlashcardDeckView from '../components/FlashcardDeckView';
import FlashcardProgress from '../components/Flashcardprogress';
import {
  getFlashcardOnboardingState,
  saveFlashcardOnboarding,
  completeFlashcardSession,
  getKnownFlashcards,
} from '../api/cachedClient';
import {
  FaArrowUp,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaFilter,
  FaSearch,
  FaSpinner,
  FaBars,
  FaBell,
  FaBook,
  FaBookOpen,
  FaBookOpenReader,
  FaBrain,
  FaBullhorn,
  FaBullseye,
  FaCalculator,
  FaCalendarDay,
  FaCapsules,
  FaChartLine,
  FaChartSimple,
  FaCheck,
  FaCircleCheck,
  FaCircleInfo,
  FaCircleXmark,
  FaClipboardCheck,
  FaClock,
  FaComment,
  FaCreditCard,
  FaCrown,
  FaDna,
  FaDownload,
  FaEnvelope,
  FaEnvelopeCircleCheck,
  FaExclamation,
  FaFaceSmile,
  FaFileContract,
  FaFileLines,
  FaFilePdf,
  FaFilePen,
  FaFire,
  FaFlask,
  FaGlobe,
  FaHandHoldingHeart,
  FaHeadset,
  FaHeart,
  FaHospital,
  FaInstagram,
  FaLayerGroup,
  FaLeaf,
  FaLightbulb,
  FaLink,
  FaLinkedinIn,
  FaLocationDot,
  FaLock,
  FaMedal,
  FaMessage,
  FaMicroscope,
  FaMoon,
  FaPen,
  FaPencil,
  FaPenToSquare,
  FaPills,
  FaRightFromBracket,
  FaRightToBracket,
  FaRocket,
  FaRotate,
  FaRoute,
  FaScrewdriverWrench,
  FaShieldHalved,
  FaSpellCheck,
  FaStar,
  FaStarOfLife,
  FaSun,
  FaThumbsUp,
  FaTree,
  FaTriangleExclamation,
  FaTrophy,
  FaUnlock,
  FaUserPen,
  FaUserPlus,
  FaUsers,
  FaVolumeHigh,
  FaVolumeXmark,
  FaXmark,
  FaXTwitter,
  FaAddressBook,
  FaAward,
  FaBalanceScale,
  FaBandAid,
  FaBiohazard,
  FaBolt,
  FaBone,
  FaBookMedical,
  FaBriefcaseMedical,
  FaBug,
  FaCannabis,
  FaClipboardList,
  FaCloudSun,
  FaCommentDots,
  FaCrow,
  FaCube,
  FaCubes,
  FaDove,
  FaEye,
  FaEyeDropper,
  FaFeather,
  FaFeatherAlt,
  FaFingerprint,
  FaFish,
  FaFrog,
  FaGears,
  FaGift,
  FaGraduationCap,
  FaHandsHelping,
  FaHeartPulse,
  FaHeartbeat,
  FaHippo,
  FaHistory,
  FaHome,
  FaHospitalAlt,
  FaHourglassHalf,
  FaInfinity,
  FaInfo,
  FaJar,
  FaJarWheat,
  FaLaptopMedical,
  FaListCheck,
  FaListUl,
  FaMagnet,
  FaMask,
  FaMasksTheater,
  FaMicrochip,
  FaMortarPestle,
  FaNotesMedical,
  FaPalette,
  FaPaperPlane,
  FaPaw,
  FaPersonWalking,
  FaPlantWilt,
  FaPrescription,
  FaPrescriptionBottle,
  FaPrescriptionBottleMedical,
  FaPumpMedical,
  FaQuoteLeft,
  FaQuoteRight,
  FaRadiation,
  FaReceipt,
  FaRecycle,
  FaSchool,
  FaScroll,
  FaShareAlt,
  FaShieldCat,
  FaShieldDog,
  FaShoePrints,
  FaSkull,
  FaSmog,
  FaSnowflake,
  FaSolarPanel,
  FaSpa,
  FaSplotch,
  FaSquarePollVertical,
  FaStaffSnake,
  FaStethoscope,
  FaSyringe,
  FaTablets,
  FaTags,
  FaTeeth,
  FaTeethOpen,
  FaTemperatureHigh,
  FaTemperatureLow,
  FaTent,
  FaTooth,
  FaTractor,
  FaTruckMedical,
  FaUserDoctor,
  FaUserGraduate,
  FaUserMd,
  FaUserNurse,
  FaVial,
  FaVials,
  FaVirus,
  FaViruses,
  FaWeightScale,
  FaWheatAwn,
  FaWind,
} from '../components/icons/IconMap';

const COLORS = {
  primary: '#b8873a',
  secondary: '#0ab5b5',
  accent: '#10b981',
  magenta: '#b8873a',
  cyan: '#0ab5b5',
  orange: '#f59e0b',
  red: '#ef4444',
  green: '#10b981',
  purple: '#8b5cf6',
  pink: '#ec4899',
  blue: '#3b82f6',
  white: '#ffffff',
  dim: '#94a3b8',
};

const STAGE = {
  LOADING: 'loading',
  ONBOARDING: 'onboarding',
  WELCOME: 'welcome',
  SUBJECT: 'subject',
  STUDY: 'study',
  COMPLETE: 'complete',
};

export default function FlashcardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState(STAGE.LOADING);
  const [fcState, setFcState] = useState(null);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);
  const [knownIds, setKnownIds] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    init();
  }, [user]);

  async function init() {
    try {
      const [stateData, knownData] = await Promise.all([
        getFlashcardOnboardingState(),
        getKnownFlashcards(),
      ]);
      setKnownIds(knownData || []);

      if (stateData?.onboarding_complete) {
        setFcState(stateData);
        setStage(STAGE.SUBJECT);
      } else {
        setStage(STAGE.ONBOARDING);
      }
    } catch (err) {
      setError('Failed to load. Please refresh.');
    }
  }

  async function handleOnboardingComplete(payload) {
    try {
      await saveFlashcardOnboarding({ ...payload, onboarding_complete: false });
      setFcState(prev => ({ ...prev, ...payload }));
      setStage(STAGE.WELCOME);
    } catch {
      setError('Failed to save your choices. Please try again.');
    }
  }

  async function handleWelcomeDone() {
    try {
      await saveFlashcardOnboarding({ onboarding_complete: true });
      setFcState(prev => ({ ...prev, onboarding_complete: true }));
      setStage(STAGE.SUBJECT);
    } catch {
      setStage(STAGE.SUBJECT);
    }
  }

  function handleSubjectStart({ confidence, topic, deck }) {
    saveFlashcardOnboarding({
      confidence_level: confidence,
      last_topic: topic || null,
      last_deck_id: deck.id,
    }).catch(() => {});
    setFcState(prev => ({ ...prev, confidence_level: confidence, last_topic: topic }));
    setSelectedDeck(deck);
    setStage(STAGE.STUDY);
  }

  async function handleStudyComplete({ sessionId, total }) {
    let result = { total, correct: 0, incorrect: 0, score: 0 };
    if (sessionId) {
      try {
        const data = await completeFlashcardSession(sessionId);
        result = {
          total: data.card_count ?? total,
          correct: data.correct ?? 0,
          incorrect: data.incorrect ?? 0,
          score: data.score ?? 0,
        };
      } catch {}
    }
    setSessionResult(result);
    setStage(STAGE.COMPLETE);
  }

  function handleRestart() {
    setSelectedDeck(null);
    setSessionResult(null);
    setStage(STAGE.SUBJECT);
  }

  function handleResetOnboarding() {
    setFcState(null);
    setSelectedDeck(null);
    setSessionResult(null);
    setStage(STAGE.ONBOARDING);
  }

  if (error) {
    return (
      <div className="fc-page">
        <div className="fc-page-inner">
          <div className="fc-empty">
            <FaTriangleExclamation style={{ color: COLORS.red, fontSize: '3rem', marginBottom: '1rem' }} />
            <p style={{ color: COLORS.white }}>{error}</p>
            <button className="fc-btn fc-btn-primary" style={{ marginTop: '1rem' }} onClick={init}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGE.LOADING) {
    return (
      <div className="fc-page">
        <div className="fc-page-inner">
          <div className="fc-loading">
            <FaSpinner className="icon-spin" style={{ color: COLORS.primary, fontSize: '2rem' }} />
            <p style={{ color: COLORS.dim, marginTop: '1rem' }}>Loading your flashcards…</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === STAGE.ONBOARDING) {
    return <FlashcardOnboarding onComplete={handleOnboardingComplete} />;
  }

  if (stage === STAGE.WELCOME) {
    return (
      <FlashcardWelcome
        user={user}
        level={fcState?.selected_level}
        discipline={fcState?.selected_discipline}
        cls={fcState?.selected_class}
        onDone={handleWelcomeDone}
      />
    );
  }

  if (stage === STAGE.SUBJECT) {
    return (
      <FlashcardSubjectSelect
        state={fcState}
        onStart={handleSubjectStart}
        onBack={handleResetOnboarding}
      />
    );
  }

  if (stage === STAGE.STUDY && selectedDeck) {
    return (
      <FlashcardDeckView
        deck={selectedDeck}
        knownIds={knownIds}
        mode={fcState?.last_mode || 'flip'}
        onComplete={handleStudyComplete}
      />
    );
  }

  if (stage === STAGE.COMPLETE) {
    return (
      <FlashcardProgress
        result={sessionResult}
        onRestart={handleRestart}
        onHome={() => navigate('/')}
      />
    );
  }

  return null;
}
