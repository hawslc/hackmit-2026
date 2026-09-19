import { useState } from "react";
import { useMaterialSetup } from "./hooks/useMaterialSetup";
import PracticeScreen from "./screens/PracticeScreen";
import SetupScreen from "./screens/SetupScreen";

type View = { name: "setup" } | { name: "practice"; stream: MediaStream };

export default function App() {
  const [view, setView] = useState<View>({ name: "setup" });
  // Held here (not in SetupScreen) so the material survives Setup → Practice → Setup.
  const setup = useMaterialSetup();

  if (view.name === "practice") {
    return (
      <PracticeScreen
        material={setup.material}
        stream={view.stream}
        onFinish={() => setView({ name: "setup" })}
      />
    );
  }
  return <SetupScreen setup={setup} onStart={(stream) => setView({ name: "practice", stream })} />;
}
