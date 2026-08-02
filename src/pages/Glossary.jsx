 import { useState, useEffect, useCallback } from 'react';
import GlossaryView from './GlossaryView';
import { useAuth } from '../contexts/AuthContext';
import {
  getGlossaryTerms,
  getGlossaryTerm,
  getGlossaryCategories
} from '../api/client';
import { useLevelFilter } from '../hooks/useLevelFilter';

export default function Glossary() {
  const { user } = useAuth();
  const { level, class_name } = useLevelFilter();
  const [terms, setTerms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTerm, setActiveTerm] = useState(null);
  const [termContent, setTermContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termLoading, setTermLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    getGlossaryCategories(level, class_name)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [level, class_name]);

  const fetchTerms = useCallback(() => {
    setLoading(true);
    getGlossaryTerms(level, selectedCategory || undefined, searchQuery || undefined, class_name)
      .then(data => {
        setTerms(data || []);
        setActiveTerm(null);
        setTermContent(null);
      })
      .catch(() => setTerms([]))
      .finally(() => setLoading(false));
  }, [level, selectedCategory, searchQuery, class_name]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const handleTermClick = useCallback(async (term) => {
    setActiveTerm(term);
    setTermLoading(true);
    setTermContent(null);
    try {
      const data = await getGlossaryTerm(term.slug, level, class_name);
      setTermContent(data);
    } catch {
      setTermContent(null);
    } finally {
      setTermLoading(false);
    }
  }, [level, class_name]);

  const getLevelColor = (lvl) => {
    if (lvl === 'O-Level') return 'var(--primary)';
    if (lvl === 'A-Level') return 'var(--warm)';
    if (lvl === 'Pharmacy') return 'var(--success)';
    return 'var(--primary)';
  };

  const groupedTerms = {};
  (terms || []).forEach(term => {
    const cat = term.category || 'General';
    if (!groupedTerms[cat]) groupedTerms[cat] = [];
    groupedTerms[cat].push(term);
  });

  return (
    <GlossaryView
      user={user}
      selectedLevel={level}
      selectedClass={class_name}
      terms={terms}
      categories={categories}
      selectedCategory={selectedCategory}
      searchQuery={searchQuery}
      activeTerm={activeTerm}
      termContent={termContent}
      loading={loading}
      termLoading={termLoading}
      sidebarOpen={sidebarOpen}
      groupedTerms={groupedTerms}
      getLevelColor={getLevelColor}
      onCategoryChange={setSelectedCategory}
      onSearchChange={setSearchQuery}
      onTermClick={handleTermClick}
      onToggleSidebar={() => setSidebarOpen(prev => !prev)}
      onClearSearch={() => { setSearchQuery(''); setSelectedCategory(''); }}
    />
  );
}
