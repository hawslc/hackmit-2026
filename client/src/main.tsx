import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DevHarness } from "./live/DevHarness";
import "./index.css";

// #dev renders the standalone live-capture harness instead of the app —
// handy for testing mic/Scribe/metrics without the Setup flow.
const root = location.hash === "#dev" ? <DevHarness /> : <App />;

createRoot(document.getElementById("root")!).render(
  <StrictMode>{root}</StrictMode>,
);
