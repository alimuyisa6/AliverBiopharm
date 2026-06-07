import { useState, useEffect, useCallback } from 'react';
import { getAllCourses, getCoursesByCategory, getCourseById } from '@services/databaseService';

const useCourses = (category = null) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = category ? await getCoursesByCategory(category) : await getAllCourses();
    if (result.success) setCourses(result.data);
    else setError(result.error);
    setLoading(false);
  }, [category]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return { courses, loading, error, refetch: fetchCourses };
};

export const useCourseDetail = (courseId) => {
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    const fetch = async () => {
      setLoading(true);
      const result = await getCourseById(courseId);
      if (result.success) setCourse(result.data);
      else setError(result.error);
      setLoading(false);
    };
    fetch();
  }, [courseId]);

  return { course, loading, error };
};

export default useCourses;
