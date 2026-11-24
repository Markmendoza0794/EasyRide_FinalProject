import VanGallery from "./Components/Home/VanGallery";
import { useEffect, useState } from "react";
import "./style.css";
import "./Components/Home/homepage.css";

import Jessie_DispatcherAuth from "./Components/Dispatcher/Jessie_DispatcherAuth";
import Mark_DriverPortal from "./Components/Driver/Mark_DriverPortal";
import Alexis_PassengerPage from "./Components/Passenger/Alexis_PassengerPage";

import Navbar from "./Components/Home/Navbar";
import Hero from "./Components/Home/Hero";
import QuickInfo from "./Components/Home/QuickInfo";
import About from "./Components/Home/About";
import PassengerPreview from "./Components/Home/PassengerPreview";
import Footer from "./Components/Home/Footer";
import AccessModal from "./Components/Home/AccessModal";

const getCurrentPage = () => {
  if (window.location.hash === "#driver") {
    return "driver";
  }

  if (window.location.hash === "#passenger") {
    return "passenger";
  }

  if (window.location.hash === "#dispatcher") {
    return "dispatcher";
  }

  return "home";
};

const App = () => {
  const [currentPage, setCurrentPage] = useState(getCurrentPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  const goHome = () => {
    window.location.hash = "home";
    setCurrentPage("home");
    setMenuOpen(false);
    setAccessOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const openDriver = () => {
    window.location.hash = "driver";
    setCurrentPage("driver");
    setMenuOpen(false);
    setAccessOpen(false);
    window.scrollTo(0, 0);
  };

  const openPassenger = () => {
    window.location.hash = "passenger";
    setCurrentPage("passenger");
    setMenuOpen(false);
    setAccessOpen(false);
    window.scrollTo(0, 0);
  };

  const openDispatcher = () => {
    window.location.hash = "dispatcher";
    setCurrentPage("dispatcher");
    setMenuOpen(false);
    setAccessOpen(false);
    window.scrollTo(0, 0);
  };

  const goToSection = (section) => {
    setCurrentPage("home");
    setMenuOpen(false);
    setAccessOpen(false);
    window.location.hash = section;

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

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(getCurrentPage());
      setMenuOpen(false);
      setAccessOpen(false);
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener(
        "hashchange",
        handleHashChange
      );
    };
  }, []);

  if (currentPage === "driver") {
    return <Mark_DriverPortal onBack={goHome} />;
  }

  if (currentPage === "passenger") {
    return <Alexis_PassengerPage onBack={goHome} />;
  }

  if (currentPage === "dispatcher") {
    return <Jessie_DispatcherAuth onBack={goHome} />;
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
        openDriver={openDriver}
        openDispatcher={openDispatcher}
        openPassenger={openPassenger}
      />

      <Hero setAccessOpen={setAccessOpen} />

      <QuickInfo />
      <PassengerPreview />
      <VanGallery />
      <About />
      <Footer />
    </div>
  );
};

export default App;
