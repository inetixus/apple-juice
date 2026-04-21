import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./app/page";
import DashboardPage from "./app/app/page";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
