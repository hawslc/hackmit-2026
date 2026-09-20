import { useState } from "react";
import { useMaterialSetup } from "./hooks/useMaterialSetup";
import PracticeScreen from "./screens/PracticeScreen";
import ReviewScreen from "./screens/ReviewScreen";
import SetupScreen from "./screens/SetupScreen";
import type { CompletedSession } from "./types";

type View =
  | { name: "setup" }
  | { name: "practice"; stream: MediaStream }
  | { name: "review"; session: CompletedSession };

export default function App() {
  const [view, setView] = useState<View>({ name: "setup" });
  // Held here (not in SetupScreen) so the material survives Setup → Practice → Setup.
  const setup = useMaterialSetup();
  // Carried from a review's focus card into the next practice session as a reminder.
  const [practiceGoal, setPracticeGoal] = useState<string | undefined>(undefined);

  if (view.name === "practice") {
    return (
      <PracticeScreen
        material={setup.material}
        stream={view.stream}
        practiceGoal={practiceGoal}
        onFinish={(session) => setView({ name: "review", session })}
        onCancel={() => setView({ name: "setup" })}
      />
    );
  }
  if (view.name === "review") {
    // The review is discarded on the way back; material stays in `setup`.
    return (
      <ReviewScreen
        material={setup.material}
        session={view.session}
        onPracticeAgain={(goal) => {
          setPracticeGoal(goal);
          setView({ name: "setup" });
        }}
      />
    );
  }
  return <SetupScreen setup={setup} onStart={(stream) => setView({ name: "practice", stream })} />;
}
