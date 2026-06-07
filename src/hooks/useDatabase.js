import { useState, useCallback } from 'react';

const useDatabase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (operation) => {
    setLoading(true);
    setError(null);
    try {
      const result = await operation();
      if (!result.success) setError(result.error);
      return result;
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute, setError };
};

export default useDatabase;
