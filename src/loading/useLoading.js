import { useContext } from "react";
import { LoadingContext } from "./LoadingProvider";

export default function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used inside <LoadingProvider>");
  return ctx;
}
