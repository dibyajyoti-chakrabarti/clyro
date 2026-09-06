import { Outlet } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Navbar />

      <main className="w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
