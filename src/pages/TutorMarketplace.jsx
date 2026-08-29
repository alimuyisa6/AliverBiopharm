 /* src/pages/TutorMarketplace.jsx */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayout } from '../contexts/LayoutContext';
import { listTutorsCached } from '../api/cachedClient';
import { sendContactRequest } from '../api/client';
import TutorCard from '../features/tutor-marketplace/TutorCard';
import Spinner from '../components/Spinner/Spinner';
import EmptyState from '../components/EmptyState/EmptyState';
import { useToast } from '../components/Toast/Toast';
import Icon from '../components/Icon/Icon';
import Input from '../components/Input/Input';
import Button from '../components/Button/Button';

export default function TutorMarketplace() {
  const { user } = useAuth();
  const { bootstrap, level, class_name } = useLayout();
  const addToast = useToast();

  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [allTutors, setAllTutors] = useState([]);

  useEffect(() => {
    let cancelled = false;

    listTutorsCached({ limit: 50 })
      .then((data) => {
        if (!cancelled) {
          setAllTutors(data || []);
          setTutors(data || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let filtered = allTutors;

    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (tutor) =>
          tutor.display_name.toLowerCase().includes(query) ||
          (tutor.headline && tutor.headline.toLowerCase().includes(query)) ||
          (tutor.specialty && tutor.specialty.toLowerCase().includes(query))
      );
    }
    if (subjectFilter) {
      filtered = filtered.filter(
        (tutor) => tutor.subjects && tutor.subjects.includes(subjectFilter)
      );
    }
    if (levelFilter) {
      filtered = filtered.filter(
        (tutor) => tutor.levels && tutor.levels.includes(levelFilter)
      );
    }
    if (formatFilter) {
      filtered = filtered.filter(
        (tutor) => tutor.teaching_format === formatFilter
      );
    }
    setTutors(filtered);
  }, [search, subjectFilter, levelFilter, formatFilter, allTutors]);

  async function handleContact(tutor) {
    if (!user) {
      addToast('Please sign in to contact a tutor', 'warning');
      return;
    }
    try {
      await sendContactRequest(tutor.user_id, '');
      addToast('Request sent!', 'success');
    } catch {
      addToast('Could not send request', 'error');
    }
  }

  function getUiImage(key) {
    const uiComponents = bootstrap?.ui_components || [];
    const component = uiComponents.find((item) => item.component_key === key);
    return component?.properties?.image_url || null;
  }

  if (loading) {
    return (
      <div className="section">
        <div className="fcd-loading-wrap">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="tutor-marketplace-page">
      <div className="section">
        <div className="section-head">
          <div className="section-head-left">
            <span className="eyebrow">Tutor Marketplace</span>
            <h2>Find a qualified tutor</h2>
            <p className="section-subtitle">
              For individual learners, schools and institutions — filter by subject, level and availability.
            </p>
          </div>
        </div>

        <div className="tutor-search">
          <Input
            type="text"
            placeholder="Search by name, specialty, or subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="magnifying-glass"
            className="tutor-search-input"
          />
          <select
            className="filter-select"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">All Subjects</option>
            <option value="Biology">Biology</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Pharmacology">Pharmacology</option>
            <option value="Pharmaceutics">Pharmaceutics</option>
          </select>
          <select
            className="filter-select"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="">All Levels</option>
            <option value="O-Level">O-Level</option>
            <option value="A-Level">A-Level</option>
            <option value="Pharmacy">Pharmacy</option>
          </select>
          <select
            className="filter-select"
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
          >
            <option value="">All Formats</option>
            <option value="online">Online</option>
            <option value="in-person">In-person</option>
            <option value="both">Both</option>
          </select>
        </div>

        {tutors.length === 0 ? (
          <EmptyState
            image={getUiImage('empty_state_tutors')}
            title="No tutors found"
            description="Try adjusting your filters or search terms."
            action={
              <Button
                onClick={() => {
                  setSearch('');
                  setSubjectFilter('');
                  setLevelFilter('');
                  setFormatFilter('');
                }}
              >
                Clear Filters
              </Button>
            }
          />
        ) : (
          <div className="tutor-grid-flat">
            {tutors.map((tutor) => (
              <TutorCard
                key={tutor.id}
                tutor={tutor}
                onContact={handleContact}
                user={user}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
