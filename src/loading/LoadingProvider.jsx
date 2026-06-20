import { useState, useCallback, createContext } from "react";
import LoadingLayer from "./LoadingLayer";

export const LoadingContext = createContext(null);

export default function LoadingProvider({ children }) {
  const [state, setState] = useState({
    type: null,
    message: "",
    progress: null,
  });

  const show = useCallback((type, message = "", progress = null) => {
    setState({ type, message, progress });
  }, []);

  const hide = useCallback(() => {
    setState({ type: null, message: "", progress: null });
  }, []);

  const setProgress = useCallback((progress) => {
    setState(prev => ({ ...prev, progress }));
  }, []);

  return (
    <LoadingContext.Provider value={{ ...state, show, hide, setProgress }}>
      {children}
      <LoadingLayer />
    </LoadingContext.Provider>
  );
}
