import { useState } from "react";
import "./style.css";

import Navbar from "./Components/Home/Navbar";
import Hero from "./Components/Home/Hero";
import QuickInfo from "./Components/Home/QuickInfo";
import About from "./Components/Home/About";
import Features from "./Components/Home/Features";
import Routes from "./Components/Home/Routes";
import PassengerPreview from "./Components/Home/PassengerPreview";
import Contact from "./Components/Home/Contact";
import Footer from "./Components/Home/Footer";
import AccessModal from "./Components/Home/AccessModal";
import Alexis_PassengerSeats from "./Components/Passenger/Alexis_PassengerSeats";

const App = () => {
  const [currentPage, setCurrentPage] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const goHome = () => {
    setCurrentPage("home");
    setMenuOpen(false);
    setAccessOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const openPassenger = () => {
    setCurrentPage("passengerSeats");
    setMenuOpen(false);
    setAccessOpen(false);
    window.scrollTo(0, 0);
  };

  const goToSection = (section) => {
    setCurrentPage("home");
    setMenuOpen(false);
    setAccessOpen(false);

    setTimeout(() => {
      const target = document.getElementById(section);

      if (!target) return;

      const navbarHeight =
        document.querySelector(".navbar")?.offsetHeight || 0;

      const targetPosition =
        target.getBoundingClientRect().top +
        window.scrollY -
        navbarHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    }, 100);
  };

  if (currentPage === "passengerSeats") {
    return <Alexis_PassengerSeats onBack={goHome} />;
  }

  return (
    <div className="easyride-app">
      <Navbar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        goHome={goHome}
        goToSection={goToSection}
      />

      <AccessModal
        accessOpen={accessOpen}
        setAccessOpen={setAccessOpen}
        openPassenger={openPassenger}
      />

      <Hero setAccessOpen={setAccessOpen} />

      <QuickInfo />
      <About />
      <Features />
      <Routes />

      <section className="passenger-entry">
        <h2>Passenger Seat Availability</h2>
        <p>Check available seats before your trip.</p>

        <button type="button" onClick={openPassenger}>
          View Available Seats
        </button>
      </section>

      <PassengerPreview />
      <Contact />
      <Footer />
    </div>
  );
};

export default App;