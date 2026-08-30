import { useState } from "react";
import { MobileRuntime } from "./mobile";
import Prototype from "./Prototype";
import { DeviceShell, WebShell } from "./shell";

/** `?frame=1` keeps the iPhone / Pixel prototype harness. Everything else gets the real responsive app. */
function useDeviceFramePreview() {
  const [framed] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("frame") === "1";
  });

  return framed;
}

export default function App() {
  const framed = useDeviceFramePreview();

  if (framed) {
    return (
      <MobileRuntime>
        <DeviceShell>
          <Prototype />
        </DeviceShell>
      </MobileRuntime>
    );
  }

  return (
    <WebShell>
      <Prototype />
    </WebShell>
  );
}
