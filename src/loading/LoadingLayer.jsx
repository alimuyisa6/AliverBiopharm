import { useContext } from "react";
import { LoadingContext } from "./LoadingProvider";
import PageProgressBar from "./components/PageProgressBar";
import BackgroundIndicator from "./components/BackgroundIndicator";
import AuthOverlay from "./components/AuthOverlay";
import FormOverlay from "./components/FormOverlay";
import QuizOverlay from "../components/QuizOverlay";

export default function LoadingLayer() {
  const { type, message, progress } = useContext(LoadingContext);

  return (
    <>
      <PageProgressBar active={type === "page" || type === "data"} progress={progress} />
      <BackgroundIndicator active={type === "background"} />
      {type === "auth" && <AuthOverlay message={message} />}
      {type === "form" && <FormOverlay message={message} />}
      {type === "quiz" && <QuizOverlay message={message} />}
    </>
  );
}
