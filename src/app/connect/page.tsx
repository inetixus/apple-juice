import { ConnectRuntime } from "@/components/connect-runtime";

/**
 * /connect — pair the website with the locally-installed Apple Juice Runtime
 * (the premium, full-tool, native-speed tier). If the Runtime isn't detected,
 * the page explains how to install it; the app still works without it via the
 * cloud path.
 */
export default function ConnectPage() {
  return <ConnectRuntime />;
}
