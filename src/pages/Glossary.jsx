import React, { useState, useEffect, useCallback } from 'react';
import GlossaryView from './GlossaryView';
import { useAuth } from '../contexts/AuthContext';
import {
  getGlossaryTerms,
  getGlossaryTerm,
  getGlossaryCategories,
  getSelectedLevel
} from '../api/client';
import { getSections } from '../api/sections';


export default function Glossary() {
  const { user } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState('A-Level');
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
    getSelectedLevel()
      .then(res => {
        if (res?.selected_level) setSelectedLevel(res.selected_level);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getGlossaryCategories(selectedLevel)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [selectedLevel]);

  const fetchTerms = useCallback(() => {
    setLoading(true);
    getGlossaryTerms(selectedLevel, selectedCategory || undefined, searchQuery || undefined)
      .then(data => {
        setTerms(data || []);
        setActiveTerm(null);
        setTermContent(null);
      })
      .catch(() => setTerms([]))
      .finally(() => setLoading(false));
  }, [selectedLevel, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const handleTermClick = useCallback(async (term) => {
    setActiveTerm(term);
    setTermLoading(true);
    setTermContent(null);
    try {
      const data = await getGlossaryTerm(term.slug, selectedLevel);
      setTermContent(data);
    } catch {
      setTermContent(null);
    } finally {
      setTermLoading(false);
    }
  }, [selectedLevel]);

  const handleLevelChange = (level) => {
    setSelectedLevel(level);
    setActiveTerm(null);
    setTermContent(null);
    setSelectedCategory('');
  };

  const getLevelColor = (level) => {
    if (level === 'O-Level') return '#0ab5b5';
    if (level === 'A-Level') return '#b8873a';
    if (level === 'Pharmacy') return '#10b981';
    return 'var(--clr-cyan)';
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
      selectedLevel={selectedLevel}
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
      onLevelChange={handleLevelChange}
      onCategoryChange={setSelectedCategory}
      onSearchChange={setSearchQuery}
      onTermClick={handleTermClick}
      onToggleSidebar={() => setSidebarOpen(prev => !prev)}
      onClearSearch={() => { setSearchQuery(''); setSelectedCategory(''); }}
    />
  );
}
